import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, win32 } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSidecar, importSpecifier } from "../../src/integration/sidecar.js";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-sidecar-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Class list of a given size, so each refresh writes visibly different content. */
const listOf = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `md:${tag}-${i}`);

describe("sidecar", () => {
  it("writes the candidate list and reports the change", async () => {
    const sidecar = createSidecar(dir);
    const first = await sidecar.refresh(["md:flex"]);

    expect(first.changed).toBe(true);
    const written = await readFile(sidecar.path, "utf8");
    expect(written).toBe(first.css);
    expect(written).toContain("@source inline(");
    expect(written).toMatch(/--tailess:\s*1/);
  });

  it("skips the write when the list has not changed", async () => {
    const sidecar = createSidecar(dir);
    await sidecar.refresh(["md:flex"]);
    expect((await sidecar.refresh(["md:flex"])).changed).toBe(false);
    expect((await sidecar.refresh(["md:flex", "lg:grid"])).changed).toBe(true);
  });

  it("rewrites when the file disappeared behind our back", async () => {
    // `vite --force` and clean scripts wipe the cache directory.
    const sidecar = createSidecar(dir);
    await sidecar.refresh(["md:flex"]);
    await rm(sidecar.path);
    expect((await sidecar.refresh(["md:flex"])).changed).toBe(true);
    expect(await readFile(sidecar.path, "utf8")).toContain("md:flex");
  });

  it("never leaves a half-written file when refreshes overlap", async () => {
    // A build transforms several stylesheets at once and a watcher tick can land
    // mid-transform, so refresh() gets called concurrently with different lists.
    // Unserialized, two writes to one path interleave into a file that is neither.
    const sidecar = createSidecar(dir);
    const lists = [
      listOf(400, "a"),
      listOf(20, "b"),
      listOf(900, "c"),
      listOf(5, "d"),
      listOf(1200, "e"),
    ];

    const results = await Promise.all(lists.map((list) => sidecar.refresh(list)));

    // Whatever landed last, the file must be exactly one of the preludes we asked
    // for — complete, not a blend of two.
    const onDisk = await readFile(sidecar.path, "utf8");
    expect(results.map((r) => r.css)).toContain(onDisk);

    // And the serialized order means the final write is the final request.
    expect(onDisk).toBe(results.at(-1)?.css);
  });

  it("leaves no temporary files behind", async () => {
    const sidecar = createSidecar(dir);
    await Promise.all([
      sidecar.refresh(listOf(50, "a")),
      sidecar.refresh(listOf(60, "b")),
      sidecar.refresh(listOf(70, "c")),
    ]);
    const entries = await readdir(join(dir, "tailess"));
    expect(entries).toEqual(["tailess.css"]);
  });

  it("keeps serving later refreshes after one fails", async () => {
    const sidecar = createSidecar(join(dir, "nested"));
    await sidecar.refresh(["md:flex"]);
    // Replace the directory with a file so the next write cannot succeed.
    await rm(join(dir, "nested"), { recursive: true });
    await writeFile(join(dir, "nested"), "x");

    await expect(sidecar.refresh(["lg:grid"])).rejects.toThrow();

    // The queue must not be left rejected — a later refresh still runs.
    await rm(join(dir, "nested"));
    await expect(sidecar.refresh(["xl:block"])).resolves.toMatchObject({ changed: true });
  });
});

describe("importSpecifier", () => {
  it("always produces a relative specifier a CSS @import will resolve", () => {
    // A bare-looking path like `.cache/x.css` would be looked up in node_modules.
    expect(importSpecifier(join(dir, "app.css"), join(dir, ".cache", "x.css"))).toBe(
      "./.cache/x.css",
    );
    expect(importSpecifier(join(dir, "a", "app.css"), join(dir, "x.css"))).toBe("../x.css");
  });

  it("returns null when there is no path to express", () => {
    // Both the "target is the containing directory itself" case and the one that
    // motivated the guard: two absolute paths on different Windows volumes, where
    // `relative` gives back an absolute path rather than a relative one.
    expect(importSpecifier(join(dir, "app.css"), dir)).toBeNull();
    expect(win32.relative(win32.dirname("C:\\a\\app.css"), "D:\\cache\\x.css")).toBe(
      "D:\\cache\\x.css",
    );
  });
});
