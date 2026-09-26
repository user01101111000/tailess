import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasUtilitiesAtRule,
  importSpecifiers,
  isTailwindEntry,
  isTailwindSpecifier,
  resolveWithNode,
} from "../../src/integration/entry.js";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tailess-entry-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("isTailwindSpecifier", () => {
  it("recognises Tailwind's own specifiers", () => {
    expect(isTailwindSpecifier("tailwindcss")).toBe(true);
    expect(isTailwindSpecifier("tailwindcss/utilities.css")).toBe(true);
    expect(isTailwindSpecifier("tailwindcss/theme.css")).toBe(true);
  });

  it("does not match unrelated specifiers that merely contain the word", () => {
    expect(isTailwindSpecifier("./reset.css")).toBe(false);
    expect(isTailwindSpecifier("@acme/styles")).toBe(false);
    expect(isTailwindSpecifier("my-tailwindcss-theme")).toBe(false);
    expect(isTailwindSpecifier("./tailwindcss-notes.css")).toBe(false);
  });
});

describe("importSpecifiers / hasUtilitiesAtRule", () => {
  it("reads every import form", () => {
    const css = `
      @import "tailwindcss";
      @import 'a.css';
      @import url("b.css");
      @import "c.css" layer(base);
    `;
    expect(importSpecifiers(css)).toEqual(["tailwindcss", "a.css", "b.css", "c.css"]);
  });

  it("detects the v3-style utilities at-rule", () => {
    expect(hasUtilitiesAtRule("@tailwind utilities;")).toBe(true);
    expect(hasUtilitiesAtRule("@tailwind all;")).toBe(true);
    expect(hasUtilitiesAtRule("@tailwind base;")).toBe(false);
  });
});

describe("isTailwindEntry", () => {
  it("accepts a direct import", async () => {
    expect(await isTailwindEntry(`@import "tailwindcss";`)).toBe(true);
    expect(await isTailwindEntry(`@import "tailwindcss/utilities.css" layer(utilities);`)).toBe(
      true,
    );
    expect(await isTailwindEntry(`@tailwind utilities;`)).toBe(true);
  });

  it("rejects stylesheets Tailwind emits no utilities into", async () => {
    expect(await isTailwindEntry(`.a{color:red}`)).toBe(false);
    expect(await isTailwindEntry(`@reference "../app.css";\n.a{@apply flex}`)).toBe(false);
  });

  it("follows a relative import chain to find the real entry", async () => {
    // The common split setup: the entry only imports a file that imports Tailwind.
    await writeFile(join(dir, "tailwind.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "app.css"), `@import "./tailwind.css";`);

    expect(await isTailwindEntry(`@import "./tailwind.css";`, join(dir, "app.css"))).toBe(true);
  });

  it("follows several hops and a subdirectory", async () => {
    await mkdir(join(dir, "styles", "deep"), { recursive: true });
    await writeFile(join(dir, "styles", "deep", "tw.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "styles", "mid.css"), `@import "./deep/tw.css";`);

    expect(await isTailwindEntry(`@import "./styles/mid.css";`, join(dir, "app.css"))).toBe(true);
  });

  it("resolves an import written without its extension", async () => {
    await writeFile(join(dir, "tw.css"), `@import "tailwindcss";`);
    expect(await isTailwindEntry(`@import "./tw";`, join(dir, "app.css"))).toBe(true);
  });

  it("returns false when the chain never reaches Tailwind", async () => {
    await writeFile(join(dir, "reset.css"), `*{box-sizing:border-box}`);
    expect(await isTailwindEntry(`@import "./reset.css";`, join(dir, "app.css"))).toBe(false);
  });

  it("survives a circular import chain", async () => {
    await writeFile(join(dir, "a.css"), `@import "./b.css";`);
    await writeFile(join(dir, "b.css"), `@import "./a.css";`);
    expect(await isTailwindEntry(`@import "./a.css";`, join(dir, "entry.css"))).toBe(false);
  });

  /** `app.css` → l1 → … → l<hops>.css, the last of which imports Tailwind. */
  async function chain(hops: number): Promise<boolean> {
    await writeFile(join(dir, `l${hops}.css`), `@import "tailwindcss";`);
    for (let i = hops - 1; i >= 1; i -= 1) {
      await writeFile(join(dir, `l${i}.css`), `@import "./l${i + 1}.css";`);
    }
    return isTailwindEntry(`@import "./l1.css";`, join(dir, "app.css"));
  }

  it("follows a real layout's five hops", async () => {
    // app → base → theme → tokens → Tailwind was one hop past the old limit of three,
    // and got no injection and no warning.
    expect(await chain(5)).toBe(true);
  });

  it("stops after a bounded number of hops", async () => {
    // Beyond the limit — better to under-inject than to walk forever.
    expect(await chain(12)).toBe(false);
  });

  it("ignores missing files and unresolvable bare specifiers", async () => {
    expect(await isTailwindEntry(`@import "./nope.css";`, join(dir, "app.css"))).toBe(false);
    expect(await isTailwindEntry(`@import "@acme/styles";`, join(dir, "app.css"))).toBe(false);
  });

  it("follows a bare or aliased import through the resolver it is given", async () => {
    // A Vite alias (`@/styles/tw.css`) or a workspace package (`@acme/ui/styles.css`)
    // between the app's stylesheet and Tailwind: never followed, so no injection.
    await mkdir(join(dir, "styles"));
    await writeFile(join(dir, "styles", "tw.css"), `@import "tailwindcss";`);
    const resolveImport = async (specifier: string) =>
      specifier.startsWith("@/") ? join(dir, specifier.slice(2)) : undefined;
    const css = `@import "@/styles/tw.css";`;
    expect(await isTailwindEntry(css, join(dir, "app.css"))).toBe(false);
    expect(
      await isTailwindEntry(css, join(dir, "app.css"), undefined, undefined, resolveImport),
    ).toBe(true);
  });

  it("treats a resolver that throws as one that found nothing", async () => {
    // A plugin resolver can reject; the transform must not fail the stylesheet over it.
    await writeFile(join(dir, "tw.css"), `@import "tailwindcss";`);
    const failing = () => Promise.reject(new Error("resolver down"));
    const css = `@import "@acme/ui/styles.css";\n@import "./tw.css";`;
    expect(await isTailwindEntry(css, join(dir, "app.css"), undefined, undefined, failing)).toBe(
      true,
    );
    expect(
      await isTailwindEntry(
        `@import "@acme/ui/styles.css";`,
        join(dir, "app.css"),
        8,
        undefined,
        failing,
      ),
    ).toBe(false);
  });

  it("follows a workspace package's exports through Node's resolution", async () => {
    // The shadcn/ui monorepo template: `@import "@workspace/ui/globals.css"`.
    const pkg = join(dir, "node_modules", "@workspace", "ui");
    await mkdir(join(pkg, "src"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@workspace/ui", exports: { "./globals.css": "./src/globals.css" } }),
    );
    await writeFile(join(pkg, "src", "globals.css"), `@import "tailwindcss";`);
    const css = `@import "@workspace/ui/globals.css";`;
    expect(
      await isTailwindEntry(css, join(dir, "app.css"), undefined, undefined, resolveWithNode),
    ).toBe(true);
  });

  it("never tries to follow a remote import", async () => {
    let asked = 0;
    const resolveImport = async () => {
      asked += 1;
      return undefined;
    };
    const css = `@import url("https://fonts.googleapis.com/css2?family=Inter");`;
    await isTailwindEntry(css, join(dir, "app.css"), undefined, undefined, resolveImport);
    expect(asked).toBe(0);
  });

  it("cannot follow imports without knowing the file, but still sees direct ones", async () => {
    expect(await isTailwindEntry(`@import "./tailwind.css";`)).toBe(false);
    expect(await isTailwindEntry(`@import "tailwindcss";`)).toBe(true);
  });
});

describe("at-rule names are case-insensitive", () => {
  // CSS folds an at-rule's *name* to lower case, so `@Import "tailwindcss"` is the
  // same rule as `@import "tailwindcss"`. Reading it case-sensitively meant such a
  // stylesheet was not recognised as an entry, and every runtime-built class in the
  // project lost its CSS with nothing said about it.
  it("recognises an entry written with an upper-case @IMPORT", async () => {
    expect(await isTailwindEntry(`@IMPORT "tailwindcss";`)).toBe(true);
    expect(await isTailwindEntry(`@Import "tailwindcss";`)).toBe(true);
  });

  it("recognises an upper-case @TAILWIND utilities", async () => {
    expect(hasUtilitiesAtRule(`@TAILWIND UTILITIES;`)).toBe(true);
    expect(await isTailwindEntry(`@Tailwind Utilities;`)).toBe(true);
  });

  it("still follows a relative import written in upper case", async () => {
    await writeFile(join(dir, "base.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "app.css"), `@IMPORT "./base.css";`);
    expect(await isTailwindEntry(`@IMPORT "./base.css";`, join(dir, "app.css"))).toBe(true);
  });

  it("leaves a stylesheet with no Tailwind in it alone", async () => {
    expect(await isTailwindEntry(`@IMPORT "./other.css";`)).toBe(false);
  });
});
