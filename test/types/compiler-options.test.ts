import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The published declarations under the compiler settings a consumer may have, not only the
 * strict ones this repository uses.
 *
 * `strictNullChecks` off is TypeScript's own default and where most migrated JavaScript
 * lives. There, `undefined` is assignable to every object type, so a conditional type that
 * asks "was a parent recipe passed?" of a parameter defaulting to `undefined` answers yes —
 * and every `variants()` recipe inherited `Record<string, …>` as its variants. Boolean and
 * numeric props stopped type-checking, a misspelt variant compiled, and the README's
 * `ComponentProps<"button"> & VariantProps<typeof button>` rejected `onClick`.
 */

const declarations = fileURLToPath(new URL("../../dist/index.d.ts", import.meta.url));

const fixture = `import { variants, type VariantProps } from "tailess";

export const button = variants({
  base: "rounded",
  variants: {
    tone: { primary: "bg-blue-600", danger: "bg-red-600" },
    disabled: { true: "opacity-50", false: "" },
    cols: { 1: "grid-cols-1", 2: "grid-cols-2" },
  },
  compound: [{ tone: "danger", disabled: true, class: "ring-2" }],
  defaults: { tone: "primary", disabled: false },
});

type NativeButton = { onClick?: () => void; tabIndex?: number; children?: string };
type ButtonProps = NativeButton & VariantProps<typeof button>;

export const props: ButtonProps = { onClick() {}, tabIndex: 0, disabled: true, cols: 2 };
export const cls: string = button({ tone: "danger", disabled: true, cols: 2 });
// @ts-expect-error "tones" is not a variant.
button({ tones: "danger" });
// @ts-expect-error "huge" is not one of tone's options.
button({ tone: "huge" });
`;

async function compile(options: ts.CompilerOptions): Promise<string[]> {
  const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-types-"));
  try {
    await writeFile(join(dir, "button.ts"), fixture);
    const program = ts.createProgram([join(dir, "button.ts")], {
      noEmit: true,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      paths: { tailess: [declarations] },
      ...options,
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("variants() under a consumer's compiler options", () => {
  it("has declarations to compile against", () => {
    expect(existsSync(declarations), "build first: this compiles against dist/").toBe(true);
  });

  it("types a recipe the same with strictNullChecks on", async () => {
    expect(await compile({ strict: true })).toEqual([]);
  }, 30_000);

  it("types a recipe the same with strictNullChecks off", async () => {
    expect(await compile({ strict: true, strictNullChecks: false })).toEqual([]);
  }, 30_000);

  it("types a recipe the same with no strictness flags at all", async () => {
    expect(await compile({})).toEqual([]);
  }, 30_000);
});
