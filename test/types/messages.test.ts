import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { diagnose, otherCompiler } from "../helpers/compiler.js";

/**
 * What the compiler says about a mistake in a recipe, not only that it refuses one.
 *
 * With `variants(base)` as the last overload, TypeScript reported every mistake in a flat
 * recipe against that one — "'variants' does not exist in type 'SsInput | ClassValue[]'",
 * at the `variants` key — so a typo in the fortieth compound rule named neither the rule
 * nor the typo. 0.11.0, with one overload, named both.
 */

const declarations = fileURLToPath(new URL("../../dist/index.d.ts", import.meta.url));

/**
 * Whether there is anything to compile against. Asked about another compiler, a missing
 * build fails rather than skips: the CI job that asks exists to run exactly these.
 */
const ready = existsSync(declarations) || otherCompiler !== undefined;

/** The compiler's messages for `source`, flattened. */
async function errorsFor(source: string): Promise<string[]> {
  const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-messages-"));
  try {
    await writeFile(join(dir, "recipe.ts"), source);
    return await diagnose(dir, ["recipe.ts"], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      module: "esnext",
      moduleResolution: "bundler",
      target: "es2022",
      paths: { tailess: [declarations] },
    });
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

describe.runIf(ready)("a mistake in a recipe's compound rules", () => {
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

/**
 * The same for a recipe with parts, which the flat config's overload came last for too.
 *
 * TypeScript 7 reports a call no overload accepts against the last overload alone, so
 * every mistake in a slotted recipe was the flat config's complaint, at a key that was
 * right: a typo in a part name was "'root' does not exist in type 'SsInput'", and an
 * unknown key "'slots' does not exist". TypeScript 6 listed that complaint beside the
 * slotted one, or showed the slotted one alone when the flat config had more to say — so
 * on 6 only some of these fail without the fix, and on 7 every one does. The flat
 * overload now drops out when the config has `slots`, and must not be mentioned at all.
 */
const card = (config: string) => `import { variants } from "tailess";
variants({
  slots: { root: "rounded", title: "font-bold" },
  ${config}
});
`;

describe.runIf(ready)("a mistake in a slotted recipe", () => {
  const size = 'variants: { size: { sm: { root: "p-2" }, lg: { root: "p-4" } } }';
  it.each([
    [
      "a part an option names",
      'variants: { size: { lg: { root: "p-4", titel: "text-xl" } } }',
      "never",
    ],
    [
      "a group a compound rule names",
      `${size}, compound: [{ sise: "lg", class: { root: "ring-2" } }]`,
      "sise",
    ],
    [
      "a part a compound rule names",
      `${size}, compound: [{ size: "lg", class: { rot: "ring-2" } }]`,
      "rot",
    ],
    ["an option a default names", `${size}, defaults: { size: "md" }`, '"md"'],
    ["a key no config has", 'bse: "flex"', "bse"],
    ["a recipe without parts to extend", 'extend: variants({ base: "flex" })', "AnySlottedRecipe"],
  ])("is reported against the slotted config: %s", async (_, config, mention) => {
    const errors = (await errorsFor(card(config))).join("\n");
    expect(errors).toContain(mention);
    expect(errors).not.toContain("VariantsConfig<");
    expect(errors).not.toContain("'root' does not exist");
  });

  it("is not reported on a slotted recipe without one", async () => {
    expect(await errorsFor(card(`${size}, defaults: { size: "sm" }`))).toEqual([]);
  });
});
