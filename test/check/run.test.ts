import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, run, version } from "../../src/check/run.js";
import { clearCache } from "../../src/extract/collect.js";
import { clearReported } from "../../src/integration/report.js";

/**
 * The gate itself, run against real project directories and the real Tailwind
 * compiler. `verify.ts` proves the comparison; this proves the thing a CI job
 * actually invokes — that it finds the stylesheet, compiles it, and returns the exit
 * code someone can rely on.
 */

let dir = "";

beforeEach(async () => {
  clearCache();
  // The reporter de-duplicates for the life of the process, which is right for a dev
  // server and wrong for two runs in one test file.
  clearReported();
  // Inside node_modules so `@import "tailwindcss"` resolves the way it would in a
  // real project, and so the directory is already gitignored.
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Run the check quietly, returning its exit code and what it printed. */
async function check(extra: Partial<Parameters<typeof run>[0]> = {}) {
  const out: string[] = [];
  vi.spyOn(console, "log").mockImplementation((m) => void out.push(String(m)));
  vi.spyOn(console, "error").mockImplementation((m) => void out.push(String(m)));
  // The diagnostics reporter warns; without this the gate's own findings are invisible.
  vi.spyOn(console, "warn").mockImplementation((m) => void out.push(String(m)));
  const code = await run({
    command: "check",
    content: [dir],
    css: undefined,
    cwd: dir,
    strict: false,
    extensions: [],
    ignore: [],
    json: false,
    max: 20,
    out: undefined,
    write: false,
    ...extra,
  });
  return { code, output: out.join("\n") };
}

describe("parsing the command line", () => {
  it("takes repeatable --content and a single --css", () => {
    expect(parse(["--content", "src", "--content", "app", "--css", "a.css"])).toMatchObject({
      content: ["src", "app"],
      css: "a.css",
    });
  });

  it("defaults to no roots, which means the working directory", () => {
    expect(parse([])).toMatchObject({ content: [], css: undefined });
  });

  it("asks for help", () => {
    expect(parse(["--help"])).toBe("help");
    expect(parse(["-h"])).toBe("help");
  });

  it("refuses an option with no value, rather than eating the next flag", () => {
    expect(() => parse(["--content"])).toThrow(/needs a path/);
    expect(() => parse(["--content", "--css"])).toThrow(/needs a path/);
  });

  it("refuses an option it does not know", () => {
    expect(() => parse(["--bogus"])).toThrow(/unknown option/);
  });

  it("reads the subcommand, and treats a bare invocation as check", () => {
    expect(parse([])).toMatchObject({ command: "check" });
    expect(parse(["check"])).toMatchObject({ command: "check" });
    expect(parse(["emit", "--out", "a.css"])).toMatchObject({ command: "emit", out: "a.css" });
  });

  it("takes --extensions and --ignore, so the gate can be made to match the build", () => {
    expect(parse(["--extensions", "tsx,vue", "--ignore", "fixtures"])).toMatchObject({
      extensions: ["tsx", "vue"],
      ignore: ["fixtures"],
    });
    // Repeatable as well as comma-separated, and blank entries are dropped.
    expect(parse(["--extensions", "tsx", "--extensions", " vue , "])).toMatchObject({
      extensions: ["tsx", "vue"],
    });
  });

  it("takes --json, --max and --version", () => {
    expect(parse(["--json"])).toMatchObject({ json: true });
    expect(parse(["--max", "0"])).toMatchObject({ max: 0 });
    expect(parse([])).toMatchObject({ json: false, max: 20 });
    expect(parse(["--version"])).toBe("version");
    expect(parse(["-v"])).toBe("version");
    expect(() => parse(["--max", "lots"])).toThrow(/whole number/);
  });

  it("knows its own version", async () => {
    expect(await version()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("the check itself", () => {
  it("passes a project whose classes all have CSS", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ base: "flex", md: "p-4", hover: "underline" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(code).toBe(0);
    expect(output).toContain("every one has CSS");
  });

  it("fails a project whose theme removed a breakpoint out from under a key", async () => {
    // The case the theme warning describes; here it is proved rather than guessed.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4", lg: "p-6" })`);
    await writeFile(
      join(dir, "a.css"),
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`,
    );
    const { code, output } = await check();
    expect(code).toBe(1);
    expect(output).toContain("md:p-4");
    expect(output).not.toContain("lg:p-6");
  });

  it("reports nothing for the junk the scanner produces on purpose", async () => {
    // Every helper in the package, including the ones whose arguments are not classes.
    await writeFile(
      join(dir, "a.tsx"),
      `cn(ss({ md: data("state", "open", "p-2") }), supports("width: calc(100% - 2rem)", "grid"),` +
        ` match(size, { sm: "text-sm" }), group("row", "hover", "underline"), nth(3, "mt-2"))`,
    );
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code } = await check();
    expect(code).toBe(0);
  });

  it("says so when there is no stylesheet to compile against", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    const { code, output } = await check();
    expect(code).toBe(2);
    expect(output).toContain("no Tailwind entry stylesheet");
  });

  it("fails rather than passing when it scanned no files at all", async () => {
    // A gate that cannot say "I checked nothing" is worse than no gate: a mistyped
    // --content or a task runner in the wrong directory used to print a cheerful line
    // and exit 0 forever after.
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(code).toBe(2);
    expect(output).toContain("scanned no files");
    expect(output).toContain(dir);
  });

  it("names the glob case, since that is the usual reason a root matches nothing", async () => {
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { output } = await check({
      content: [join(dir, "**", "*.tsx")],
      css: join(dir, "a.css"),
    });
    expect(output).toContain("Wildcards are not expanded");
  });

  it("passes when it scanned real files that simply use no tailess", async () => {
    // The other half of the same distinction: this project is fine, and the count in
    // the message is what separates it from the case above in a CI log.
    await writeFile(join(dir, "a.tsx"), `export const x = <div className="p-4" />;`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(code).toBe(0);
    expect(output).toContain("scanned 1 file");
    expect(output).toContain("nothing to check");
  });

  it("reports the build-time diagnostics it used to compute and discard", async () => {
    // These are exactly the failures compiling cannot find: the candidate carrying an
    // unusable value is dropped from the list before it ever reaches Tailwind, so no
    // amount of comparing generated CSS can notice it.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" });\nhas('input[type="x"]', "p-2");`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(output).toContain("cannot appear in a class name");
    // Printed, but not fatal on its own — the exit code still reflects the classes.
    expect(code).toBe(0);
  });

  it("makes those diagnostics fail the gate under --strict", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" });\nss({ base: "p-4 p-2" });`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check({ strict: true });
    // Every class here does have CSS — the gate fails on the diagnostic alone.
    expect(output).toContain("every one has CSS");
    expect(output).toContain("never reaches the element");
    expect(output).toContain("--strict");
    expect(code).toBe(1);
  });

  it("parses --strict", () => {
    expect(parse(["--strict"])).toMatchObject({ strict: true });
    expect(parse([])).toMatchObject({ strict: false });
  });

  it("says so when no build config mentions tailess, which it cannot see by compiling", async () => {
    // The first failure the troubleshooting section lists, and the one that unstyles a
    // whole app — yet the check scans the source itself, so a project with the plugin
    // deleted looks identical to one where it runs.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "vite.config.ts"), `export default { plugins: [tailwindcss()] };`);
    const { code, output } = await check();
    expect(output).toContain("may not be running at");
    // A guess, so it warns; the classes themselves are fine.
    expect(code).toBe(0);
    expect((await check({ strict: true })).code).toBe(1);
  });

  it("stays quiet when a config does mention it", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailess from "tailess/vite";\nexport default { plugins: [tailess()] };`,
    );
    expect((await check()).output).not.toContain("may not be running");
  });

  it("stays quiet where there is no config to read at all", async () => {
    // A bare directory is not a project root worth guessing about.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    expect((await check()).output).not.toContain("may not be running");
  });

  it("does not take a dependency entry in package.json as evidence of wiring", async () => {
    // Every consumer's package.json names tailess; that proves it is installed and
    // nothing about whether the plugin runs. Reading the whole file made this check
    // unable to fire for anyone.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "package.json"), `{ "dependencies": { "tailess": "^0.11.0" } }`);
    await writeFile(join(dir, "vite.config.ts"), `export default { plugins: [] };`);
    expect((await check()).output).toContain("may not be running at");
  });

  it("does read a postcss config written inside package.json", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(
      join(dir, "package.json"),
      `{ "dependencies": { "tailess": "^0.11.0" },
         "postcss": { "plugins": { "tailess/postcss": {}, "@tailwindcss/postcss": {} } } }`,
    );
    expect((await check()).output).not.toContain("may not be running");
  });

  it("survives a package.json that is not valid JSON", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "package.json"), `{ not json`);
    // A broken manifest also breaks Node's own resolution from this directory, so the
    // run cannot finish — but it has to get *past* the config scan to fail there, which
    // is what says the parse is guarded rather than fatal.
    await expect(check()).rejects.toThrow(/tailwindcss is not installed/);
  });

  it("names a Tailwind prefix instead of reporting every class as broken", async () => {
    // With prefix(tw) the working class is `tw:md:p-4`, so every candidate fails at
    // once. Reported class by class that reads as "your theme moved a breakpoint",
    // which is true only in the sense that everything is wrong.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4", hover: "underline" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss" prefix(tw);`);
    const { code, output } = await check();
    expect(code).toBe(2);
    expect(output).toContain('prefix("tw")');
    expect(output).not.toContain("md:p-4\n");
  });

  it("names the file a broken class came from", async () => {
    // Without it the report is a list of class names and the documented way to find
    // them is grepping escaped selectors in the built CSS by hand.
    await writeFile(join(dir, "Card.tsx"), `ss({ md: "p-4" })`);
    await writeFile(
      join(dir, "a.css"),
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`,
    );
    const { code, output } = await check();
    expect(code).toBe(1);
    expect(output).toContain("Card.tsx");
  });

  it("lists every broken class under --max 0", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `ss({ md: "p-${i + 1}" })`).join(";\n");
    await writeFile(join(dir, "a.tsx"), many);
    await writeFile(
      join(dir, "a.css"),
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`,
    );
    const capped = await check();
    expect(capped.output).toContain("more. Pass --max 0");
    const all = await check({ max: 0 });
    expect(all.output).not.toContain("more. Pass --max 0");
    expect(all.output).toContain("md:p-25");
  });

  it("prints one JSON object under --json, and nothing else", async () => {
    await writeFile(join(dir, "Card.tsx"), `ss({ md: "p-4" });\nss({ base: "p-4 p-2" });`);
    await writeFile(
      join(dir, "a.css"),
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`,
    );
    const { code, output } = await check({ json: true });
    expect(code).toBe(1);
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({ tailess: 1, command: "check", ok: false, code: 1, checked: 1 });
    expect(parsed.broken).toEqual([{ class: "md:p-4", utility: "p-4", files: ["Card.tsx"] }]);
    expect(parsed.diagnostics[0]).toMatchObject({ kind: "dead-class", file: "Card.tsx" });
    expect(parsed.stylesheets).toEqual(["a.css"]);
  });

  it("says why it could not run, in JSON too", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    const { code, output } = await check({ json: true });
    expect(code).toBe(2);
    expect(JSON.parse(output)).toMatchObject({ ok: false, code: 2, error: "no-stylesheet" });
  });

  it("scans the extensions and ignores it was given, not the defaults", async () => {
    // The gate reading a different file set than the build is wrong in both
    // directions, and silently: `extensions` replaces the default list.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "b.vue"), `ss({ lg: "p-6" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const only = await check({ extensions: ["vue"], json: true, css: join(dir, "a.css") });
    expect(JSON.parse(only.output).checked).toBe(1);
    const both = await check({ json: true, css: join(dir, "a.css") });
    expect(JSON.parse(both.output).checked).toBe(2);
  });

  it("takes an explicit --css rather than looking for one", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "entry.css"), `@import "tailwindcss";`);
    const { code } = await check({ css: join(dir, "entry.css") });
    expect(code).toBe(0);
  });

  it("loads an @plugin, which Tailwind refuses to compile without", async () => {
    // `compile()` throws "No `loadModule` function provided" the moment it reaches an
    // `@plugin` line, so a project using typography or forms could not be checked at
    // all — a healthy project, exiting 2.
    await writeFile(
      join(dir, "plugin.cjs"),
      `module.exports = ({ addVariant }) => addVariant("sidebar-open", "&:is(.sidebar-open *)");`,
    );
    await writeFile(join(dir, "a.tsx"), `withPrefix("sidebar-open", "p-4")`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";\n@plugin "./plugin.cjs";`);
    const { code, output } = await check();
    expect(code).toBe(0);
    expect(output).toContain("every one has CSS");
  });

  it("counts a variant only the plugin defines, rather than calling it broken", async () => {
    // Loading the plugin is also what makes the answer right: without it the variant
    // does not exist, and the class that uses it would be reported as having no rule.
    await writeFile(join(dir, "a.tsx"), `withPrefix("sidebar-open", "p-4")`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(code).toBe(1);
    expect(output).toContain("sidebar-open:p-4");
  });

  it("says which module it could not resolve, rather than Tailwind's own error", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";\n@plugin "./missing.cjs";`);
    await expect(check()).rejects.toThrow(/could not resolve "\.\/missing\.cjs"/);
  });

  it("passes a class that works in one of several stylesheets", async () => {
    // A project can have more than one entry, and a component is styled by whichever
    // its page loads — so failing every one of them is what makes a class broken.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(
      join(dir, "a.css"),
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`,
    );
    await writeFile(join(dir, "b.css"), `@import "tailwindcss";`);
    const { code } = await check();
    expect(code).toBe(0);
  });
});

describe("tailess emit", () => {
  /** Run the emit command quietly, returning its exit code and what it printed. */
  async function emit(extra: Partial<Parameters<typeof run>[0]> = {}) {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m) => void out.push(String(m)));
    vi.spyOn(console, "error").mockImplementation((m) => void out.push(String(m)));
    const code = await run({
      command: "emit",
      content: [dir],
      css: undefined,
      cwd: dir,
      strict: false,
      extensions: [],
      ignore: [],
      json: false,
      max: 20,
      out: join(dir, "tailess.css"),
      write: false,
      ...extra,
    });
    return { code, output: out.join("\n") };
  }

  it("writes the stylesheet the plugins would have injected", async () => {
    // The escape hatch for every host that compiles Tailwind without a PostCSS chain
    // — the standalone CLI, Rspack, Bun — and the way a component library ships the
    // classes its consumers cannot scan out of a published `dist`.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4", hover: "underline" })`);
    const { code, output } = await emit();
    expect(code).toBe(0);
    expect(output).toContain("tailess.css");

    const css = await readFile(join(dir, "tailess.css"), "utf8");
    expect(css).toContain("--tailess");
    expect(css).toContain("@source inline(");
    expect(css).toContain("md:p-4");
    expect(css).toContain("hover:underline");
  });

  it("creates the directory it was pointed at", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    const { code } = await emit({ out: join(dir, "deep", "nested", "t.css") });
    expect(code).toBe(0);
    expect(await readFile(join(dir, "deep", "nested", "t.css"), "utf8")).toContain("md:p-4");
  });

  it("writes to stdout when given no --out, keeping the note off it", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      const { code, output } = await emit({ out: undefined });
      expect(code).toBe(0);
      // The note goes to stderr so it is not mixed into the piped stylesheet.
      expect(output).toContain("to stdout");
      expect(written.join("")).toContain("@source inline(");
    } finally {
      process.stdout.write = original;
    }
  });

  it("refuses to write nothing when it scanned no files", async () => {
    const { code, output } = await emit();
    expect(code).toBe(2);
    expect(output).toContain("nothing to emit");
  });
});

describe("whether the plugin is wired up", () => {
  async function checkWith(config: string) {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m) => void out.push(String(m)));
    vi.spyOn(console, "error").mockImplementation((m) => void out.push(String(m)));
    vi.spyOn(console, "warn").mockImplementation((m) => void out.push(String(m)));
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    await writeFile(join(dir, "vite.config.ts"), config);
    await run({
      command: "check",
      content: [dir],
      css: undefined,
      cwd: dir,
      strict: false,
      extensions: [],
      ignore: [],
      json: false,
      max: 20,
      out: undefined,
      write: false,
    });
    return out.join("\n");
  }

  it("is not fooled by an import left behind when the call was deleted", async () => {
    // Exactly the shape this check exists to catch: someone removes `tailess()` from
    // the plugins array during a refactor and the import stays. Reading for the word
    // alone called that wired, which made the check unable to fire for the one case
    // it was written for.
    const output = await checkWith(
      `import tailess from "tailess/vite";\nexport default { plugins: [tailwindcss()] };`,
    );
    expect(output).toContain("may not be running");
  });

  it("accepts the plugin under whatever name it was imported as", async () => {
    const output = await checkWith(
      `import tw from "tailess/vite";\nexport default { plugins: [tw()] };`,
    );
    expect(output).not.toContain("may not be running");
  });

  it("accepts a CommonJS config", async () => {
    const output = await checkWith(
      `const tailess = require("tailess/vite");\nmodule.exports = { plugins: [tailess()] };`,
    );
    expect(output).not.toContain("may not be running");
  });
});

describe("tailess emit --json", () => {
  it("prints the candidate list itself, with where each class came from", async () => {
    // The documented way to answer "did the scanner see my class?" was reading escaped
    // selectors out of the built CSS by hand.
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m) => void out.push(String(m)));
    await writeFile(join(dir, "Card.tsx"), `ss({ md: "p-4" })`);
    await writeFile(join(dir, "Row.tsx"), `on("hover", "underline"); ss({ md: "p-4" })`);
    const code = await run({
      command: "emit",
      content: [dir],
      css: undefined,
      cwd: dir,
      strict: false,
      extensions: [],
      ignore: [],
      json: true,
      max: 20,
      out: undefined,
      write: false,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.join("\n"));
    expect(parsed).toMatchObject({ tailess: 1, command: "emit", ok: true, files: 2 });
    expect(parsed.classes).toEqual([
      { class: "hover:underline", files: ["Row.tsx"] },
      { class: "md:p-4", files: ["Card.tsx", "Row.tsx"] },
    ]);
  });
});
