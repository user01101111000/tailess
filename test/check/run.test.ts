import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, run } from "../../src/check/run.js";
import { clearCache } from "../../src/extract/collect.js";

/**
 * The gate itself, run against real project directories and the real Tailwind
 * compiler. `verify.ts` proves the comparison; this proves the thing a CI job
 * actually invokes — that it finds the stylesheet, compiles it, and returns the exit
 * code someone can rely on.
 */

let dir = "";

beforeEach(async () => {
  clearCache();
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
  const code = await run({ content: [dir], css: undefined, cwd: dir, ...extra });
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

  it("says so when there is nothing to check", async () => {
    await writeFile(join(dir, "a.css"), `@import "tailwindcss";`);
    const { code, output } = await check();
    expect(code).toBe(0);
    expect(output).toContain("nothing to check");
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
