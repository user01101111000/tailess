import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearCache,
  collect,
  defaultExtensions,
  isScannable,
  normalizeExtensions,
} from "../../src/extract/collect.js";

let dir = "";

beforeEach(async () => {
  clearCache();
  dir = await mkdtemp(join(tmpdir(), "tailess-collect-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("collect", () => {
  it("walks nested directories and merges classes across files", async () => {
    await mkdir(join(dir, "src", "ui"), { recursive: true });
    await writeFile(join(dir, "src", "a.tsx"), `ss({ md: "text-2xl" })`);
    await writeFile(join(dir, "src", "ui", "b.tsx"), `on("hover", "underline")`);

    const result = await collect({ roots: [dir] });
    expect(result.classes).toEqual(["hover:underline", "md:text-2xl"]);
    expect(result.files).toHaveLength(2);
    expect(result.roots).toEqual([dir]);
  });

  it("skips dependencies, build output and caches", async () => {
    for (const name of ["node_modules", ".next", ".turbo", "dist", "coverage"]) {
      await mkdir(join(dir, name), { recursive: true });
      await writeFile(join(dir, name, "x.tsx"), `ss({ md: "from-${name}" })`);
    }
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "x.tsx"), `ss({ md: "kept" })`);

    expect((await collect({ roots: [dir] })).classes).toEqual(["md:kept"]);
  });

  it("still scans dot-directories that hold real source", async () => {
    // `.storybook/preview.tsx` is the canonical case: a blanket dot-directory rule
    // would drop its classes silently, which is the failure mode to avoid.
    await mkdir(join(dir, ".storybook"), { recursive: true });
    await writeFile(join(dir, ".storybook", "preview.tsx"), `ss({ md: "from-storybook" })`);

    expect((await collect({ roots: [dir] })).classes).toEqual(["md:from-storybook"]);
  });

  it("honours extra ignore entries", async () => {
    await mkdir(join(dir, "fixtures"), { recursive: true });
    await writeFile(join(dir, "fixtures", "x.tsx"), `ss({ md: "from-fixtures" })`);
    await writeFile(join(dir, "y.tsx"), `ss({ md: "kept" })`);

    expect((await collect({ roots: [dir], ignore: ["fixtures"] })).classes).toEqual(["md:kept"]);
  });

  it("only reads configured extensions", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "kept" })`);
    await writeFile(join(dir, "b.txt"), `ss({ md: "skipped" })`);

    expect((await collect({ roots: [dir] })).classes).toEqual(["md:kept"]);
    expect((await collect({ roots: [dir], extensions: ["txt"] })).classes).toEqual(["md:skipped"]);
  });

  it("accepts a single file as a root", async () => {
    const file = join(dir, "only.tsx");
    await writeFile(file, `ss({ lg: "grid" })`);
    expect((await collect({ roots: [file] })).classes).toEqual(["lg:grid"]);
  });

  it("de-duplicates roots", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "flex" })`);
    const result = await collect({ roots: [dir, dir] });
    expect(result.roots).toEqual([dir]);
    expect(result.files).toHaveLength(1);
  });

  it("picks up edits to a file it already cached", async () => {
    const file = join(dir, "a.tsx");
    await writeFile(file, `ss({ md: "text-sm" })`);
    expect((await collect({ roots: [dir] })).classes).toEqual(["md:text-sm"]);

    // Same path, new content and a different size — the cache must not win.
    await writeFile(file, `ss({ md: "text-sm text-lg" })`);
    expect((await collect({ roots: [dir] })).classes).toEqual(["md:text-lg", "md:text-sm"]);
  });

  it("shares one walk between concurrent scans with the same options", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "flex" })`);
    // A build with many stylesheets asks for the same scan at once; they must all
    // get the same result rather than each re-walking the project.
    const [first, second, third] = await Promise.all([
      collect({ roots: [dir] }),
      collect({ roots: [dir] }),
      collect({ roots: [dir] }),
    ]);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.classes).toEqual(["md:flex"]);
  });

  it("does not share between scans with different options", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "flex" })`);
    const [wide, narrow] = await Promise.all([
      collect({ roots: [dir] }),
      collect({ roots: [dir], extensions: ["txt"] }),
    ]);
    expect(wide).not.toBe(narrow);
    expect(narrow.classes).toEqual([]);
  });

  it("scans again after an in-flight scan settles", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "flex" })`);
    await collect({ roots: [dir] });
    await writeFile(join(dir, "b.tsx"), `ss({ lg: "grid" })`);
    // A cached in-flight promise must not outlive its scan, or later edits vanish.
    expect((await collect({ roots: [dir] })).classes).toEqual(["lg:grid", "md:flex"]);
  });

  it("tolerates a missing root", async () => {
    const result = await collect({ roots: [join(dir, "nope")] });
    expect(result.classes).toEqual([]);
    expect(result.files).toEqual([]);
  });
});

describe("isScannable", () => {
  it("matches the default source extensions, case-insensitively", () => {
    expect(isScannable("a.tsx")).toBe(true);
    expect(isScannable("a.TSX")).toBe(true);
    expect(isScannable("a.svelte")).toBe(true);
    expect(isScannable("a.css")).toBe(false);
    expect(isScannable("a")).toBe(false);
  });

  it("respects a custom extension set", () => {
    expect(isScannable("a.tsx", new Set(["vue"]))).toBe(false);
    expect(isScannable("a.vue", new Set(["vue"]))).toBe(true);
  });

  it("covers the framework file types people actually use", () => {
    for (const ext of ["tsx", "ts", "jsx", "js", "vue", "svelte", "astro", "mdx", "html"]) {
      expect(defaultExtensions).toContain(ext);
    }
  });
});

describe("a root that is not a directory", () => {
  it("scans a single file passed directly", async () => {
    const file = join(dir, "one.tsx");
    await writeFile(file, `ss({ md: "text-2xl" })`);

    const result = await collect({ roots: [file] });
    expect(result.classes).toEqual(["md:text-2xl"]);
    expect(result.files).toEqual([file]);
  });

  it("does not count a glob as a file that was read", async () => {
    // `content` was glob-shaped in Tailwind v3, so a glob is the first thing a
    // reader reaches for. It has a scannable extension and no directory to walk, so
    // it used to be recorded as a scanned file — leaving `files` non-empty with no
    // classes in it, which is exactly the state the "matched no files" warning tests
    // for. The one guard against a mistyped `content` was defeated by the most
    // likely way of mistyping it.
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "a.tsx"), `ss({ md: "p-9" })`);

    const result = await collect({ roots: [join(dir, "src", "**", "*.tsx")] });
    expect(result.classes).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it("does not count a path that simply does not exist", async () => {
    const result = await collect({ roots: [join(dir, "nope", "missing.tsx")] });
    expect(result.files).toEqual([]);
  });
});

describe("normalizeExtensions", () => {
  it("accepts a leading dot and any case, matching what the scan does", () => {
    // The Vite plugin builds this same set to gate its watcher. When it built one by
    // hand instead, `extensions: [".tsx"]` scanned correctly and then matched nothing
    // in the watcher, so the first build was right and every class added afterwards
    // silently had no CSS until the server was restarted.
    expect([...normalizeExtensions([".tsx", "TS", ".Vue"])].sort()).toEqual(["ts", "tsx", "vue"]);
    expect(isScannable("a.tsx", normalizeExtensions([".tsx"]))).toBe(true);
    expect(isScannable("a.TSX", normalizeExtensions(["tsx"]))).toBe(true);
  });

  it("defaults to the extensions the scan defaults to", () => {
    expect([...normalizeExtensions()].sort()).toEqual([...defaultExtensions].sort());
  });

  it("agrees with collect() for a dotted extension list", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-9" })`);
    const result = await collect({ roots: [dir], extensions: [".tsx"] });
    expect(result.classes).toEqual(["md:p-9"]);
    expect(isScannable(join(dir, "a.tsx"), normalizeExtensions([".tsx"]))).toBe(true);
  });
});
