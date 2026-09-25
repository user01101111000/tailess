import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A consumer's declaration emit over values that hold a tailess plugin.
 *
 * A typed `postcss.config.ts` in a `composite` project, or a shared config package that
 * exports the plugin, failed to build its declarations: the PostCSS plugin's return type
 * was a private `Plugin` interface, which the consumer's `.d.ts` cannot name — "Default
 * export of the module has or is using private name 'Plugin'". The Vite one was fine,
 * because `TailessVitePlugin` is exported.
 */

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = existsSync(join(root, "dist", "postcss", "index.d.cts"));

/** Declaration-emit errors for `source`, resolved the way `module` resolves. */
async function emitErrors(source: string, module: "esm" | "cjs"): Promise<string[]> {
  const dir = await mkdtemp(join(root, "node_modules", ".tailess-emit-"));
  try {
    await mkdir(join(dir, "node_modules"));
    await symlink(root, join(dir, "node_modules", "tailess"), "junction");
    const file = join(dir, module === "cjs" ? "config.cts" : "config.mts");
    await writeFile(file, source);
    const program = ts.createProgram([file], {
      declaration: true,
      emitDeclarationOnly: true,
      outDir: join(dir, "out"),
      rootDir: dir,
      strict: true,
      skipLibCheck: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      types: [],
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe.runIf(built)("declaration emit over a tailess plugin", () => {
  const esm = `import tailessPostcss from "tailess/postcss";
import tailessVite from "tailess/vite";
export default { plugins: [tailessPostcss()] };
export const postcss = tailessPostcss();
export const vite = tailessVite();
`;
  const cjs = `import tailessPostcss = require("tailess/postcss");
import tailessVite = require("tailess/vite");
export const config = { plugins: [tailessPostcss()] };
export const vite = tailessVite();
`;

  it("names the plugins' types from an ES module config", async () => {
    expect(await emitErrors(esm, "esm")).toEqual([]);
  });

  it("names them from a CommonJS one, through the export = declarations", async () => {
    expect(await emitErrors(cjs, "cjs")).toEqual([]);
  });
});
