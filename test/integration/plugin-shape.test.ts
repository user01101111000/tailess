import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

/**
 * How the built plugins are *shaped* — not what they do.
 *
 * A PostCSS plugin named by string in a config is `require()`d and handed straight
 * to PostCSS. Neither Next.js (`build/webpack/config/blocks/css/plugins.ts`) nor
 * `postcss-load-config` unwraps a `.default`, so `module.exports` has to be the
 * plugin creator itself. Adding a named export to `src/postcss/index.ts` would
 * quietly turn it into `{ default, … }` and every string-named consumer would fail
 * with "is not a PostCSS plugin" — a break no unit test of the plugin's behaviour
 * would notice, because the plugin itself still works fine.
 *
 * These assertions run against `dist/`, so they only mean something after a build.
 */
const require = createRequire(import.meta.url);
const distUrl = new URL("../../dist/", import.meta.url);
const dist = (path: string) => fileURLToPath(new URL(path, distUrl));
const built = existsSync(dist("postcss/index.cjs"));

// Skipping is right on a developer's machine before a first build. In CI it is how this
// suite went unrun for its whole life — the workflow tested before it built, so `built`
// was false on every run and the one check guarding the string-named PostCSS entry was
// green by never executing. Fail loudly there instead.
if (!built && process.env.CI) {
  throw new Error(
    "dist/ is missing, so the built-plugin assertions would silently skip. " +
      "Run the build before the tests.",
  );
}

describe.runIf(built)("built plugin entry points", () => {
  it("exposes the PostCSS plugin as module.exports itself", () => {
    const plugin = require(dist("postcss/index.cjs"));
    expect(typeof plugin).toBe("function");
    // PostCSS identifies a plugin creator by this marker.
    expect(plugin.postcss).toBe(true);
    // A `.default` here would mean the CJS shape changed and string-named configs broke.
    expect(plugin.default).toBeUndefined();
  });

  it("is accepted by PostCSS when named the way a config names it", async () => {
    const plugin = require(dist("postcss/index.cjs"));
    // Throws "is not a PostCSS plugin" if the shape is wrong.
    const processor = postcss([plugin({ content: [] })]);
    const result = await processor.process("a{color:red}", { from: undefined });
    expect(result.css).toContain("color:red");
  });

  it("survives Node's ESM-importing-CJS interop", async () => {
    // `postcss-load-config` reaches the CJS build through `import(...)` and takes
    // `.default`, which Node fills with the whole `module.exports`.
    const namespace = await import(pathToFileURL(dist("postcss/index.cjs")).href);
    expect(typeof namespace.default).toBe("function");
    expect(namespace.default.postcss).toBe(true);
  });

  it("exposes the Vite plugin as module.exports itself, like the PostCSS one", () => {
    // Same reasoning as above, one step less severe: a `vite.config.cjs` doing
    // `require("tailess/vite")` has to receive the plugin creator, not a namespace
    // object Vite would reject. Keeping both entries on one shape also keeps
    // Rollup's CJS writer from having to guess, which is what made every build
    // print a mixed-exports warning.
    const plugin = require(dist("vite/index.cjs"));
    expect(typeof plugin).toBe("function");
    expect(plugin().name).toBe("tailess");
    expect(plugin.default).toBeUndefined();
  });

  it("exposes the Vite plugin as a callable default from ESM", async () => {
    const esm = await import(pathToFileURL(dist("vite/index.js")).href);
    expect(typeof esm.default).toBe("function");
    expect(esm.default().name).toBe("tailess");

    // And through Node's ESM-importing-CJS interop, which fills `.default` with the
    // whole `module.exports` — so the documented `import tailess from "tailess/vite"`
    // works whichever build the resolver picks.
    const namespace = await import(pathToFileURL(dist("vite/index.cjs")).href);
    expect(typeof namespace.default).toBe("function");
    expect(namespace.default().name).toBe("tailess");
  });

  it("answers --help and --version in JSON when asked to", async () => {
    // `--json` promises one object on stdout, and these were the two paths that printed
    // prose instead.
    const { execFileSync } = await import("node:child_process");
    const cli = (...args: string[]) =>
      JSON.parse(execFileSync(process.execPath, [dist("cli.js"), ...args], { encoding: "utf8" }));
    expect(cli("--version", "--json")).toMatchObject({
      tailess: 1,
      ok: true,
      code: 0,
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
    expect(cli("doctor", "--help", "--json")).toMatchObject({
      command: "doctor",
      ok: true,
      help: expect.stringContaining("npx tailess doctor"),
    });
  });

  it("shares configure() between the ES module and CommonJS builds", async () => {
    // An ESM app rendering a CommonJS component library loads both copies. Each kept its
    // own settings, so the app's merge never reached the library's cn(): the default one
    // ran there, silently, and the declared keys and onWarn did not reach it either.
    const esm = await import(pathToFileURL(dist("index.js")).href);
    const cjs = require(dist("index.cjs"));
    esm.configure({ merge: (classes: string) => classes });
    try {
      expect(cjs.cn("p-2", "p-4")).toBe("p-2 p-4");
    } finally {
      const { twMerge } = await import("tailwind-merge");
      esm.configure({ merge: twMerge });
    }
    expect(cjs.cn("p-2", "p-4")).toBe("p-4");
  });

  it("shares the scanner cache between the CommonJS entries", async () => {
    // Each CommonJS entry bundles its own copy of the scanner, so clearCache() from
    // tailess/build did not reach the PostCSS plugin's cache.
    const { mkdtemp, readFile, rm, utimes, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = await mkdtemp(
      join(fileURLToPath(new URL("../../node_modules/", import.meta.url)), ".tailess-shape-"),
    );
    try {
      const file = join(dir, "a.tsx");
      const old = new Date(Date.now() - 60_000);
      const plugin = require(dist("postcss/index.cjs"));
      const build = require(dist("build.cjs"));
      /** The candidate list the plugin wrote, read from the sidecar the entry imports. */
      const run = async () => {
        const { css } = await postcss([
          plugin({ content: [dir], cacheDir: join(dir, ".cache") }),
        ]).process(`@import "tailwindcss";`, { from: join(dir, "app.css") });
        const sidecar = /@import "(\.[^"]+tailess\.css)"/.exec(css)?.[1] ?? "";
        return readFile(join(dir, sidecar), "utf8");
      };
      // Same size and an old, identical mtime: nothing but clearing the cache can tell.
      await writeFile(file, `ss({ md: "p-6" })`);
      await utimes(file, old, old);
      expect(await run()).toContain("md:p-6");
      await writeFile(file, `ss({ md: "p-8" })`);
      await utimes(file, old, old);
      build.clearCache();
      expect(await run()).toContain("md:p-8");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps Node built-ins out of the browser entry", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const entry of ["index.js", "index.cjs"]) {
      const code = await readFile(dist(entry), "utf8");
      expect(code, entry).not.toMatch(/["']node:/);
      expect(code, entry).not.toMatch(/require\(["'](?:fs|path|url|os)["']\)/);
      expect(code, entry).not.toMatch(/from ["'](?:fs|path|url|os)["']/);
    }
  });
});
