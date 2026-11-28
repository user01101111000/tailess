import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/**
 * The slice of Vite's dev server the plugin touches, with the events it emitted and the
 * paths it asked the watcher to add.
 */
function fakeServer() {
  const listeners = new Map<string, Array<(file: string) => void>>();
  const emitted: Array<[string, string]> = [];
  const added: string[] = [];
  return {
    emitted,
    added,
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
      add(paths: string[]) {
        added.push(...paths);
        return this;
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

  it("tells every server, though another refresh wrote the new list first", async () => {
    // Nuxt runs a client and an SSR server off one plugin instance, and a CSS transform
    // refreshes the list too. Under Nuxt 4 the transform got there first, both watchers'
    // refreshes found the sidecar already written, neither re-emitted the stylesheet —
    // and a class in a file nothing imports never reached the browser.
    await writeFile(join(dir, "a.tsx"), `ss({ md: "p-4" })`);
    const plugin = tailess();
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".vite") });
    const entry = join(dir, "app.css");
    const transform = () =>
      plugin.transform.handler.call({ addWatchFile() {} }, '@import "tailwindcss";', entry);
    await transform();

    const client = fakeServer();
    const ssr = fakeServer();
    plugin.configureServer(client);
    plugin.configureServer(ssr);

    await writeFile(join(dir, "b.tsx"), `ss({ lg: "gap-7" })`);
    await transform();
    client.fire("add", join(dir, "b.tsx"));
    ssr.fire("add", join(dir, "b.tsx"));
    await settle(() => client.emitted.length > 0 && ssr.emitted.length > 0);
    expect(client.emitted).toEqual([["change", entry]]);
    expect(ssr.emitted).toEqual([["change", entry]]);

    // Nothing new: neither is told again.
    client.fire("change", join(dir, "b.tsx"));
    ssr.fire("change", join(dir, "b.tsx"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(client.emitted).toHaveLength(1);
    expect(ssr.emitted).toHaveLength(1);

    // Another class, written by the transform first again: both are told again.
    await writeFile(join(dir, "c.tsx"), `ss({ xl: "gap-9" })`);
    await transform();
    client.fire("add", join(dir, "c.tsx"));
    ssr.fire("add", join(dir, "c.tsx"));
    await settle(() => client.emitted.length > 1 && ssr.emitted.length > 1);
    expect(client.emitted).toHaveLength(2);
    expect(ssr.emitted).toHaveLength(2);
  });

  it("watches a content root outside Vite's root, where a new file raised no event", async () => {
    // A monorepo's design system: `content` names `packages/ui/src` from `apps/web`.
    // Vite watches only its own root, and the scanned files were added one by one — so a
    // new file in the package was seen only if something else rebuilt the stylesheet.
    const app = join(dir, "apps", "web");
    const ui = join(dir, "packages", "ui", "src");
    await mkdir(app, { recursive: true });
    await mkdir(ui, { recursive: true });
    await writeFile(join(ui, "button.ts"), `ss({ md: "p-4" })`);

    const plugin = tailess({ content: ["src", "../../packages/ui/src"] });
    plugin.configResolved({ root: app, cacheDir: join(app, ".vite") });
    const entry = join(app, "app.css");
    await plugin.transform.handler.call({ addWatchFile() {} }, '@import "tailwindcss";', entry);

    const server = fakeServer();
    plugin.configureServer(server);
    // Only the package: `src` is inside the root, which Vite already watches.
    expect(server.added).toEqual([ui]);

    await writeFile(join(ui, "probe.ts"), `ss({ lg: "gap-7" })`);
    server.fire("add", join(ui, "probe.ts"));
    await settle(() => server.emitted.length > 0);
    expect(server.emitted).toEqual([["change", entry]]);
  });

  it("adds nothing to the watcher when every content root is inside Vite's", async () => {
    const plugin = tailess({ content: ["src", "."] });
    plugin.configResolved({ root: dir, cacheDir: join(dir, ".vite") });
    const server = fakeServer();
    plugin.configureServer(server);
    expect(server.added).toEqual([]);
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
