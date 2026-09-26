import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The plugins' types under `moduleResolution: node10`, where TypeScript reads
 * `typesVersions` instead of `exports`.
 *
 * `typesVersions` pointed at the ESM declarations — `export { plugin as default }` — while
 * Node's `require` loads `module.exports = plugin`. Without `esModuleInterop` the spelling
 * that type-checked, `import tailess from "tailess/postcss"`, crashed at runtime with
 * "(0, postcss_1.default) is not a function", and the one that runs,
 * `import tailess = require(…)`, was a type error.
 */

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = existsSync(join(root, "dist", "postcss", "index.d.cts"));

/** The compiler's messages for `source` as a CommonJS project resolving like Node 10. */
async function errorsFor(source: string): Promise<string[]> {
  const dir = await mkdtemp(join(root, "node_modules", ".tailess-node10-"));
  try {
    await mkdir(join(dir, "node_modules"));
    // The package as a consumer resolves it: by name, through its own package.json.
    await symlink(root, join(dir, "node_modules", "tailess"), "junction");
    await writeFile(join(dir, "config.ts"), source);
    const program = ts.createProgram([join(dir, "config.ts")], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: false,
      allowSyntheticDefaultImports: false,
      target: ts.ScriptTarget.ES2022,
      types: [],
      ignoreDeprecations: "6.0",
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe.runIf(built)("the plugins under node10 resolution without esModuleInterop", () => {
  it.each(["postcss", "vite"])("type-check tailess/%s the way it runs", async (entry) => {
    expect(
      await errorsFor(
        `import tailess = require("tailess/${entry}");\nexport const p = tailess();\n`,
      ),
    ).toEqual([]);
  });

  it.each(["postcss", "vite"])(
    "refuse a default import of tailess/%s, which crashes",
    async (entry) => {
      const errors = await errorsFor(
        `import tailess from "tailess/${entry}";\nexport const p = tailess();\n`,
      );
      expect(errors.join("\n")).toMatch(/esModuleInterop|default export/);
    },
  );
});
