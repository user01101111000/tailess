import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearCache } from "../../src/extract/collect.js";
import tailess from "../../src/vite/index.js";

/**
 * The dev-server half of the plugin: a source file changing has to end in Tailwind
 * being handed the new class list.
 *
 * Worth its own suite because this path fails *quietly* and only in dev. The build
 * runs the scan directly, so a wrong watcher gate still produces a correct first
 * build; what breaks is every class written after the server started, and nothing
 * is logged when it does.
 */

let dir = "";

beforeEach(async () => {
  clearCache();
  dir = await mkdtemp(join(tmpdir(), "tailess-watch-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** The slice of Vite's dev server the plugin touches, with the events it emitted. */
function fakeServer() {
  const listeners = new Map<string, Array<(file: string) => void>>();
  const emitted: Array<[string, string]> = [];
  return {
    emitted,
    fire(event: string, file: string): void {
      for (const listener of listeners.get(event) ?? []) listener(file);
    },
    watcher: {
      on(event: string, listener: (file: string) => void) {
        const list = listeners.get(event) ?? [];
        list.push(listener);
        listeners.set(event, list);
        return this;
      },
      emit(event: string, file: string) {
        emitted.push([event, file]);
        return true;
      },
    },
  };
}

/** Wait for the debounce and the rescan behind it, without pinning a duration. */
async function settle(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Start a dev server on `dir` with the given `extensions`, then add a file and
 * report whether the stylesheet was re-emitted.
 */
async function pickUpNewFile(extensions?: string[]): Promise<boolean> {
  await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);

  const plugin = extensions ? tailess({ extensions }) : tailess();
  plugin.configResolved({ root: dir, cacheDir: join(dir, ".vite") });

  const entry = join(dir, "app.css");
  await plugin.transform.handler.call({ addWatchFile() {} }, '@import "tailwindcss";', entry);

  const server = fakeServer();
  plugin.configureServer(server);

  await writeFile(join(dir, "b.tsx"), `ss({ lg: "gap-7" })`);
  server.fire("add", join(dir, "b.tsx"));
  await settle(() => server.emitted.length > 0);

  return server.emitted.some(([event, file]) => event === "change" && file === entry);
}

describe("the dev-server watcher", () => {
  it("re-emits the stylesheet when a scanned file appears", async () => {
    expect(await pickUpNewFile()).toBe(true);
  });

  it("honours an explicit extension list", async () => {
    expect(await pickUpNewFile(["tsx"])).toBe(true);
  });

  it("honours an extension list written with leading dots", async () => {
    // The scan normalizes `.tsx` to `tsx`; the watcher used to compare the raw
    // option against a normalized extension, so this matched nothing and every
    // class added after start-up silently lost its CSS.
    expect(await pickUpNewFile([".tsx"])).toBe(true);
  });

  it("honours an extension list written in upper case", async () => {
    expect(await pickUpNewFile(["TSX"])).toBe(true);
  });

  it("ignores a file whose extension is not scanned", async () => {
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);

    const plugin = tailess({ extensions: [".tsx"] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".vite") });
    const entry = join(dir, "app.css");
    await plugin.transform.handler.call({ addWatchFile() {} }, '@import "tailwindcss";', entry);

    const server = fakeServer();
    plugin.configureServer(server);

    await writeFile(join(dir, "notes.txt"), `ss({ lg: "gap-7" })`);
    server.fire("change", join(dir, "notes.txt"));
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(server.emitted).toEqual([]);
  });
});
