import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../../src/extract/collect.js";
import { clearReported } from "../../src/integration/report.js";
import tailess from "../../src/postcss/index.js";
import tailessVite from "../../src/vite/index.js";
import { missingRules } from "../helpers/css.js";

/**
 * The regression suite for the bug this package existed to have: tailess builds
 * `md:`/`hover:` prefixes at runtime, so Tailwind's scanner never sees them and
 * emits no CSS. Everything looks right in the DOM and nothing is styled.
 *
 * These tests run the real `@tailwindcss/postcss` compiler over a real fixture
 * directory and assert on generated rules — the only assertion that can actually
 * fail when the bridge breaks.
 */

/** Every prefixed class the fixture below must end up with CSS for. */
const expected = [
  "sm:block",
  "md:text-2xl",
  "2xl:tracking-wide",
  "max-md:gap-2",
  "hover:opacity-100",
  "dark:bg-black",
  "group-hover:underline",
  "focus-visible:ring-2",
  "dark:hover:bg-neutral-900",
  "lg:text-lg",
  "xl:text-3xl",
  "sm:max-lg:grid",
  "data-[state=open]:opacity-100",
  "data-[state=closed]:opacity-100",
  "data-[disabled]:pointer-events-none",
  "aria-expanded:rotate-180",
  "supports-[display:grid]:grid",
  // The escaped spelling is the whole point of the helper: written as CSS spells
  // it, this only has a rule because the space became `_` on both sides.
  "supports-[display:_grid]:gap-4",
  "supports-[gap]:gap-2",
  "not-supports-[display:_grid]:flex",
  "md:supports-[container-type:_inline-size]:block",
  // A name lands after the variant, as a modifier.
  "group-hover/row:underline",
  "peer-invalid/email:text-red-600",
  "@md/sidebar:grid-cols-2",
  "md:group-hover/card:ring-2",
  // From `composedSource` below.
  "lg:p-6",
  "sm:bg-red-500",
  "dark:focus:ring-4",
  "md:max-xl:grid-cols-2",
  "xl:hover:underline",
];

const source = `
import { aria, between, cn, container, data, group, notSupports, on, peer, responsive, ss, supports, until, withPrefix } from "tailess";

export const cls = cn(
  ss({
    base: "text-xl flex",
    sm: "block",
    md: "text-2xl",
    "2xl": "tracking-wide",
    "max-md": "gap-2",
    hover: "opacity-100",
    dark: "bg-black",
    "group-hover": "underline",
  }),
  on("focus-visible", "ring-2"),
  on(["dark", "hover"], "bg-neutral-900"),
  responsive("text-sm", { lg: "text-lg", xl: "text-3xl" }),
  until("md", "hidden"),
  between("sm", "lg", "grid"),
  data("state", open ? "open" : "closed", "opacity-100"),
  data("disabled", null, "pointer-events-none"),
  aria("expanded", "rotate-180"),
  withPrefix("supports-[display:grid]", "grid"),
  supports("display: grid", "gap-4"),
  supports("gap", "gap-2"),
  notSupports("display: grid", "flex"),
  ss({ md: supports("container-type: inline-size", "block") }),
  group("row", "hover", "underline"),
  peer("email", "invalid", "text-red-600"),
  container("sidebar", "@md", "grid-cols-2"),
  ss({ md: group("card", "hover", "ring-2") }),
  "px-2 px-4",
);
`;

/**
 * The same idea written the way `ss` is meant to be written now: one call, the maps
 * composed as arguments, compound variants nested. Two shapes here are the ones a
 * scanner is easiest to get wrong — a map that sits behind a condition rather than
 * starting its argument, and a prefix assembled from two nested keys. Neither
 * appears literally in the source, so if the scanner misses one the class still
 * reaches the element with no rule behind it.
 */
const composedSource = `
import { ss } from "tailess";

export const card = (isDisabled, className) =>
  ss(
    { base: "rounded-lg border", lg: "p-6" },
    isDisabled && { sm: "bg-red-500" },
    {
      dark: { focus: "ring-4" },
      md: { "max-xl": "grid-cols-2" },
      xl: { hover: "underline" },
    },
    className,
  );
`;

let dir = "";

beforeEach(async () => {
  clearCache();
  // Inside node_modules so that `@import "tailwindcss"` resolves the same way it
  // would in a real project (and so the dir is already gitignored).
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-e2e-"));
  await writeFile(join(dir, "app.tsx"), source);
  await writeFile(join(dir, "card.tsx"), composedSource);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Run a CSS entry through tailess' PostCSS plugin and then through Tailwind. */
async function compileWithPostcss(css: string): Promise<string> {
  const result = await postcss([
    tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    tailwindcss({ base: dir, optimize: false }),
  ]).process(css, { from: join(dir, "app.css") });
  return result.css;
}

describe("PostCSS integration (Next.js and any PostCSS setup)", () => {
  it("generates CSS for every class tailess builds at runtime", async () => {
    const css = await compileWithPostcss(`@import "tailwindcss";`);
    expect(missingRules(css, expected)).toEqual([]);
  });

  it("is what makes the difference — without it Tailwind emits none of them", async () => {
    const result = await postcss([tailwindcss({ base: dir, optimize: false })]).process(
      `@import "tailwindcss";`,
      { from: join(dir, "app.css") },
    );
    // Unprefixed classes are literal in source, so Tailwind finds those on its own.
    expect(missingRules(result.css, ["text-xl", "flex", "px-4"])).toEqual([]);
    // The prefixed ones are exactly what this package has to supply.
    expect(missingRules(result.css, expected).sort()).toEqual([...expected].sort());
  });

  /** Compile `css`, returning what reached `console.warn`. */
  async function warningsFrom(css: string): Promise<string[]> {
    clearReported();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await compileWithPostcss(css);
      return warn.mock.calls.map((args) => String(args[0]));
    } finally {
      // In `finally` so a failed expectation cannot leave `console.warn` mocked for
      // the next test — which turns one failure into several unrelated ones.
      warn.mockRestore();
    }
  }

  it("reports a @theme that moves the breakpoints out from under the keys", async () => {
    // The module that decides this is unit-tested; what this pins is the wiring —
    // that the plugin actually reaches the CSS and hands the result to the reporter.
    const said = await warningsFrom(`@import "tailwindcss";\n@theme { --breakpoint-sm: initial; }`);
    expect(said.some((m) => m.includes('removes the "sm" breakpoint'))).toBe(true);
  });

  it("reports a @custom-variant the keys do not cover", async () => {
    // The other half of the CSS check, and the half that reaches the plugin through a
    // different at-rule — so the wiring is worth pinning separately.
    const said = await warningsFrom(
      `@import "tailwindcss";\n@custom-variant midnight-only (&:where([data-theme=midnight] *));`,
    );
    expect(said.some((m) => m.includes('defines the "midnight-only" variant'))).toBe(true);
  });

  it("stays quiet about a stylesheet with no @theme", async () => {
    const said = await warningsFrom(`@import "tailwindcss";`);
    expect(said.filter((m) => m.includes("breakpoint"))).toEqual([]);
  });

  it("injects the runtime marker so a missing integration is detectable", async () => {
    const css = await compileWithPostcss(`@import "tailwindcss";`);
    expect(css).toMatch(/--tailess:\s*1/);
  });

  it("consumes the @source directive instead of leaking it into the output", async () => {
    const css = await compileWithPostcss(`@import "tailwindcss";`);
    expect(css).not.toContain("@source");
  });

  it("registers every scanned file as a dependency", async () => {
    // These are what make the *bundler* rebuild the stylesheet when a source file
    // changes, which is what re-runs this plugin at all.
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(`@import "tailwindcss";`, { from: join(dir, "app.css") });
    const files = result.messages.filter((m) => m.type === "dependency").map((m) => m.file);
    expect(files).toContain(join(dir, "app.tsx"));
    expect(result.messages.some((m) => m.type === "dir-dependency")).toBe(true);
  });

  it("imports a sidecar stylesheet holding the candidate list", async () => {
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(`@import "tailwindcss";`, { from: join(dir, "app.css") });

    const specifier = /@import "([^"]+tailess\.css)"/.exec(result.css)?.[1];
    expect(specifier).toBeDefined();
    const sidecar = await readFile(join(dir, specifier ?? ""), "utf8");
    expect(sidecar).toContain("@source inline(");
    expect(sidecar).toContain("md:text-2xl");
    expect(sidecar).toMatch(/--tailess:\s*1/);
  });

  it("picks up a class added after the first build, reusing one compiler", async () => {
    // The point of the sidecar: Tailwind only re-reads `@source inline(...)` when a
    // build dependency's mtime changes, and a `@import`ed file is one. Reuse a single
    // processor so Tailwind's compiler cache stays warm, exactly like a dev server.
    const processor = postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
      tailwindcss({ base: dir, optimize: false }),
    ]);
    const build = async () =>
      (await processor.process(`@import "tailwindcss";`, { from: join(dir, "app.css") })).css;

    expect(missingRules(await build(), ["lg:italic"])).toEqual(["lg:italic"]);

    await writeFile(join(dir, "app.tsx"), `${source}\nexport const extra = ss({ lg: "italic" });`);
    clearCache();
    expect(missingRules(await build(), ["lg:italic"])).toEqual([]);

    // And removing it takes the rule away again, rather than leaving it behind.
    await writeFile(join(dir, "app.tsx"), source);
    clearCache();
    expect(missingRules(await build(), ["lg:italic"])).toEqual(["lg:italic"]);
  });

  it("falls back to inlining when there is no file to resolve the import against", async () => {
    // PostCSS can be driven without `from`; the list still has to reach Tailwind.
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(`@import "tailwindcss";`, { from: undefined });
    expect(result.css).toContain("@source inline(");
    expect(result.css).toMatch(/--tailess:\s*1/);
  });

  it("leaves stylesheets Tailwind does not compile untouched", async () => {
    const plain = `.a{color:red}`;
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(plain, {
      from: join(dir, "plain.css"),
    });
    expect(result.css).toBe(plain);
    expect(result.messages).toEqual([]);
  });

  it("recognises @tailwind utilities as an entry too", async () => {
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(`@tailwind utilities;`, { from: join(dir, "app.css") });
    expect(result.css).toContain("tailess.css");
  });

  it("finds the entry through a relative import chain", async () => {
    // A split setup: globals.css only imports the file that imports Tailwind.
    await writeFile(join(dir, "tailwind.css"), `@import "tailwindcss";`);
    const css = await compileWithPostcss(`@import "./tailwind.css";`);
    expect(missingRules(css, expected)).toEqual([]);
    expect(css).not.toContain("@source");
  });

  it("leaves a partial that never reaches Tailwind alone", async () => {
    await writeFile(join(dir, "reset.css"), `*{box-sizing:border-box}`);
    const input = `@import "./reset.css";\n.a{color:red}`;
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(input, {
      from: join(dir, "partial.css"),
    });
    expect(result.css).toBe(input);
  });

  it("leaves a @reference'd CSS module alone", async () => {
    const input = `@reference "./app.css";\n.a{@apply flex}`;
    const result = await postcss([
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(input, {
      from: join(dir, "card.module.css"),
    });
    expect(result.css).toBe(input);
  });
});

describe("markup files reach the compiler too", () => {
  /**
   * The `.tsx` fixture above is parseable as JavaScript from top to bottom. Most
   * scanned files are not: in `.vue`, `.svelte`, `.html` and `.astro` a quote is an
   * attribute delimiter or an apostrophe in prose. Reading those as JavaScript used
   * to open a string that swallowed every call after it — Vue and HTML lost all of
   * their candidates, and the failure was invisible because the class still reached
   * the element. Assert on real compiled CSS, since that is the only thing that
   * would have caught it.
   */
  it("emits CSS for calls in Vue, Svelte, HTML and Markdown, apostrophes and all", async () => {
    await writeFile(
      join(dir, "Card.vue"),
      `<template>
  <div :class="ss({ base: 'flex', md: 'grid-cols-3' })">It's here</div>
  <span :class="on('hover', 'underline')">Don't miss it</span>
</template>`,
    );
    await writeFile(
      join(dir, "Panel.svelte"),
      `<div class={ss({ base: "flex", lg: "tracking-tight" })}>Let's go</div>
<b class={on("focus", "ring-4")}>y</b>`,
    );
    await writeFile(
      join(dir, "page.html"),
      `<p>It's fine</p>\n<div class="\${ss({ xl: 'leading-loose' })}">x</div>`,
    );
    await writeFile(
      join(dir, "guide.md"),
      `# Guide\n\nHere's how you don't break it.\n\n<Demo class={ss({ sm: "font-mono" })} />`,
    );

    const css = await compileWithPostcss(`@import "tailwindcss";`);
    expect(
      missingRules(css, [
        "md:grid-cols-3",
        "hover:underline",
        "lg:tracking-tight",
        "focus:ring-4",
        "xl:leading-loose",
        "sm:font-mono",
      ]),
    ).toEqual([]);
  });
});

describe("Vite integration", () => {
  const entryId = () => join(dir, "index.css");

  /** A plugin instance wired up the way Vite would wire it. */
  function makePlugin() {
    const plugin = tailessVite({ content: [dir] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".cache") });
    const watched: string[] = [];
    const run = (code: string, id: string) =>
      plugin.transform.handler.call({ addWatchFile: (f: string) => watched.push(f) }, code, id);
    return { plugin, watched, run };
  }

  const sidecarOf = async (code: string): Promise<string> => {
    const specifier = /@import "([^"]+)"/.exec(code)?.[1] ?? "";
    return readFile(join(dir, specifier), "utf8");
  };

  it("imports a sidecar stylesheet holding the candidate list", async () => {
    const { run } = makePlugin();
    const result = await run(`@import "tailwindcss";`, entryId());

    expect(result?.code).toMatch(/^@import "[^"]*tailess\.css";\n/);
    expect(result?.code.endsWith(`@import "tailwindcss";`)).toBe(true);

    const sidecar = await sidecarOf(result?.code ?? "");
    expect(sidecar).toContain("@source inline(");
    expect(sidecar).toContain("md:text-2xl");
    // The shapes only a variadic, nesting-aware scanner produces — asserted on this
    // path too, since Vite reaches the compiler through a transform rather than a
    // PostCSS plugin and could regress on its own. The sidecar lists candidates, not
    // selectors, so these are matched as the plain class names they are written as.
    expect(sidecar).toContain("sm:bg-red-500");
    expect(sidecar).toContain("md:max-xl:grid-cols-2");
    expect(sidecar).toMatch(/--tailess:\s*1/);
  });

  it("produces CSS Tailwind then compiles into every expected rule", async () => {
    const { run } = makePlugin();
    const result = await run(`@import "tailwindcss";`, entryId());
    const compiled = await postcss([tailwindcss({ base: dir, optimize: false })]).process(
      result?.code ?? "",
      { from: entryId() },
    );
    expect(missingRules(compiled.css, expected)).toEqual([]);
  });

  it("rewrites the sidecar when a class is added, so Tailwind rebuilds", async () => {
    const { run } = makePlugin();
    const first = await run(`@import "tailwindcss";`, entryId());
    expect(await sidecarOf(first?.code ?? "")).not.toContain("lg:italic");

    await writeFile(join(dir, "app.tsx"), `${source}\nexport const extra = ss({ lg: "italic" });`);

    const second = await run(`@import "tailwindcss";`, entryId());
    expect(await sidecarOf(second?.code ?? "")).toContain("lg:italic");
  });

  it("declares the scanned files and the sidecar as watch dependencies", async () => {
    const { watched, run } = makePlugin();
    const result = await run(`@import "tailwindcss";`, entryId());
    expect(watched).toContain(join(dir, "app.tsx"));
    expect(watched.some((f) => f.endsWith("tailess.css"))).toBe(true);
    expect(result).not.toBeNull();
  });

  it("runs before @tailwindcss/vite regardless of plugin order", () => {
    const plugin = tailessVite();
    // `enforce: "pre"` puts us in Tailwind's bucket; `order: "pre"` wins inside it.
    expect(plugin.enforce).toBe("pre");
    expect(plugin.transform.order).toBe("pre");
  });

  it("invalidates the entry stylesheet when a scanned file changes", async () => {
    const { plugin, run } = makePlugin();
    const emitted: Array<[string, string]> = [];
    const listeners: Array<(file: string) => void> = [];
    plugin.configureServer({
      watcher: {
        on: (event, listener) => {
          if (event === "change") listeners.push(listener);
        },
        emit: (event, file) => emitted.push([event, file]),
      },
    });
    await run(`@import "tailwindcss";`, entryId());

    await writeFile(
      join(dir, "app.tsx"),
      `${source}\nexport const extra = ss({ xl: "uppercase" });`,
    );
    for (const listener of listeners) listener(join(dir, "app.tsx"));
    await new Promise((r) => setTimeout(r, 200));

    expect(emitted).toEqual([["change", entryId()]]);
  });

  it("ignores changes to files it does not scan", async () => {
    const { plugin, run } = makePlugin();
    const emitted: string[] = [];
    const listeners: Array<(file: string) => void> = [];
    plugin.configureServer({
      watcher: {
        on: (event, listener) => {
          if (event === "change") listeners.push(listener);
        },
        emit: (_event, file) => emitted.push(file),
      },
    });
    await run(`@import "tailwindcss";`, entryId());

    for (const listener of listeners) {
      listener(join(dir, "notes.txt"));
      listener(join(dir, "..", "outside.tsx"));
    }
    await new Promise((r) => setTimeout(r, 200));

    expect(emitted).toEqual([]);
  });

  it("ignores non-CSS ids, ?raw/?url requests, and non-Tailwind stylesheets", async () => {
    const { run } = makePlugin();
    expect(await run(`@import "tailwindcss";`, join(dir, "main.tsx"))).toBeNull();
    expect(await run(`@import "tailwindcss";`, `${entryId()}?raw`)).toBeNull();
    expect(await run(`@import "tailwindcss";`, `${entryId()}?url`)).toBeNull();
    expect(await run(`.a{color:red}`, join(dir, "other.css"))).toBeNull();
    expect(await run(`@reference "./app.css";\n.a{@apply flex}`, join(dir, "c.module.css"))).toBe(
      null,
    );
  });

  it("finds the entry through a relative import chain", async () => {
    await writeFile(join(dir, "tailwind.css"), `@import "tailwindcss";`);
    const { run } = makePlugin();
    const result = await run(`@import "./tailwind.css";`, entryId());
    expect(result?.code).toContain("tailess.css");

    const compiled = await postcss([tailwindcss({ base: dir, optimize: false })]).process(
      result?.code ?? "",
      { from: entryId() },
    );
    expect(missingRules(compiled.css, expected)).toEqual([]);
  });

  it("rewrites the sidecar if it was deleted behind our back", async () => {
    // `vite --force` and cleanup scripts wipe the cache directory; a stale
    // "already written" flag would leave the entry importing a missing file.
    const { run } = makePlugin();
    const first = await run(`@import "tailwindcss";`, entryId());
    const specifier = /@import "([^"]+)"/.exec(first?.code ?? "")?.[1] ?? "";
    await rm(join(dir, specifier));

    const second = await run(`@import "tailwindcss";`, entryId());
    expect(await sidecarOf(second?.code ?? "")).toContain("@source inline(");
  });

  it("inlines the list rather than failing the build when the sidecar can't be written", async () => {
    // A locked or read-only cache directory — transient on Windows, permanent in
    // some sandboxed CI. Throwing here would take down the whole CSS transform over
    // something inlining handles fine, so this path has to degrade, not fail.
    const blocked = join(dir, "blocked");
    await writeFile(blocked, "not a directory");

    const plugin = tailessVite({ content: [dir] });
    plugin.configResolved({ root: dir, cacheDir: blocked });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await plugin.transform.handler.call(
      { addWatchFile: () => {} },
      `@import "tailwindcss";`,
      entryId(),
    );

    // No `@import` of a sidecar that does not exist — the list is inlined instead.
    expect(result?.code).not.toMatch(/@import "[^"]*tailess\.css"/);
    expect(result?.code).toContain("@source inline(");
    expect(result?.code).toMatch(/--tailess:\s*1/);
    expect(result?.code.endsWith(`@import "tailwindcss";`)).toBe(true);
    expect(warn).toHaveBeenCalled();

    // And the inlined CSS still compiles to every rule.
    const compiled = await postcss([tailwindcss({ base: dir, optimize: false })]).process(
      result?.code ?? "",
      { from: entryId() },
    );
    expect(missingRules(compiled.css, expected)).toEqual([]);
    warn.mockRestore();
  });

  it("handles the query-suffixed ids Vite actually passes", async () => {
    const { run } = makePlugin();
    for (const suffix of ["?direct", "?used", ""]) {
      const result = await run(`@import "tailwindcss";`, `${entryId()}${suffix}`);
      expect(result?.code, suffix).toContain("@import");
    }
  });
});

describe("plugin ordering", () => {
  it("says so when it runs after Tailwind instead of failing silently", async () => {
    // Getting the order wrong is the one setup mistake with no other signal: the
    // build succeeds and every runtime-built class quietly loses its CSS.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await postcss([
      tailwindcss({ base: dir, optimize: false }),
      tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    ]).process(`@import "tailwindcss";`, { from: join(dir, "app.css") });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ran after");
    // And it still leaves Tailwind's output alone rather than corrupting it.
    expect(result.css).not.toContain("@source");
    expect(missingRules(result.css, expected).sort()).toEqual([...expected].sort());
    warn.mockRestore();
  });

  it("stays quiet in the correct order", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await compileWithPostcss(`@import "tailwindcss";`);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Vite: content paths and server lifecycle", () => {
  const entryId = () => join(dir, "index.css");

  it("resolves a relative content path against Vite's root, not the cwd", async () => {
    // `vite build apps/web`, a monorepo task run from the workspace root, or a
    // `--config` elsewhere all leave cwd !== root. Resolving against cwd then walks a
    // directory that does not exist: the scan finds nothing, the sidecar still gets
    // its marker so the runtime check reports success, and every class silently
    // loses its CSS. The README documents these paths as root-relative.
    const nested = join(dir, "app");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "page.tsx"), source);
    // Nothing named "app" exists under the real cwd, so a cwd-relative read finds none.
    expect(process.cwd()).not.toBe(dir);

    const plugin = tailessVite({ content: ["app"] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".cache") });
    const result = await plugin.transform.handler.call(
      { addWatchFile: () => {} },
      `@import "tailwindcss";`,
      entryId(),
    );

    const specifier = /@import "([^"]+tailess\.css)"/.exec(result?.code ?? "")?.[1] ?? "";
    expect(await readFile(join(dir, specifier), "utf8")).toContain("md:text-2xl");
  });

  it("leaves an absolute content path alone", async () => {
    const plugin = tailessVite({ content: [dir] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".cache") });
    const result = await plugin.transform.handler.call(
      { addWatchFile: () => {} },
      `@import "tailwindcss";`,
      entryId(),
    );
    const specifier = /@import "([^"]+tailess\.css)"/.exec(result?.code ?? "")?.[1] ?? "";
    expect(await readFile(join(dir, specifier), "utf8")).toContain("md:text-2xl");
  });

  it("warns when an explicit content option matches nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = tailessVite({ content: ["does-not-exist"] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".cache") });
    await plugin.transform.handler.call(
      { addWatchFile: () => {} },
      `@import "tailwindcss";`,
      entryId(),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("matched no files");
    warn.mockRestore();
  });

  it("registers listeners again on a restarted server", async () => {
    // Vite calls configureServer once per server, and reuses a plugin instance
    // supplied through inlineConfig across a restart. A latch on the instance would
    // leave the new watcher with no tailess listeners, and new classes would stop
    // reaching Tailwind with nothing logged.
    const plugin = tailessVite({ content: [dir] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".cache") });

    const makeServer = () => {
      const events: string[] = [];
      return {
        events,
        server: { watcher: { on: (event: string) => events.push(event), emit: () => true } },
      };
    };

    const first = makeServer();
    plugin.configureServer(first.server);
    expect(first.events).toEqual(["change", "add", "unlink"]);

    const second = makeServer();
    plugin.configureServer(second.server);
    expect(second.events).toEqual(["change", "add", "unlink"]);

    // ...but the same watcher twice must not double-register.
    plugin.configureServer(second.server);
    expect(second.events).toEqual(["change", "add", "unlink"]);
  });
});
