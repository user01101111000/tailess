import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * What the compiler says about a mistake in a recipe, not only that it refuses one.
 *
 * With `variants(base)` as the last overload, TypeScript reported every mistake in a flat
 * recipe against that one — "'variants' does not exist in type 'SsInput | ClassValue[]'",
 * at the `variants` key — so a typo in the fortieth compound rule named neither the rule
 * nor the typo. 0.11.0, with one overload, named both.
 */

const declarations = fileURLToPath(new URL("../../dist/index.d.ts", import.meta.url));

/** The compiler's messages for `source`, flattened. */
async function errorsFor(source: string): Promise<string[]> {
  const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-messages-"));
  try {
    await writeFile(join(dir, "recipe.ts"), source);
    const program = ts.createProgram([join(dir, "recipe.ts")], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      paths: { tailess: [declarations] },
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const recipe = (compound: string) => `import { variants } from "tailess";
variants({
  base: "rounded",
  variants: { tone: { primary: "bg-blue-600", danger: "bg-red-600" }, size: { lg: "p-4" } },
  compound: [${compound}],
});
`;

describe.runIf(existsSync(declarations))("a mistake in a recipe's compound rules", () => {
  it.each([
    ['{ tones: "primary", class: "ring-2" }', "tones"],
    ['{ tone: "primry", class: "ring-2" }', "primry"],
    ['{ tone: "danger", sise: "lg", class: "ring-2" }', "sise"],
  ])("is reported with the mistake in it: %s", async (rule, typo) => {
    const errors = await errorsFor(recipe(rule));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(typo);
    expect(errors.join("\n")).not.toContain("'variants' does not exist in type");
  });

  it("is not reported on a recipe without one", async () => {
    expect(await errorsFor(recipe('{ tone: "danger", size: "lg", class: "ring-2" }'))).toEqual([]);
  });
});
