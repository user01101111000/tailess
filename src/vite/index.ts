/// <reference types="node" />
import { join, resolve, sep } from "node:path";
import { collect, defaultExtensions, isScannable } from "../extract/collect.js";
import { isTailwindEntry } from "../integration/entry.js";
import { createSidecar, importSpecifier } from "../integration/sidecar.js";

/** Options for the tailess Vite plugin. */
export interface TailessViteOptions {
  /** Files or directories to scan. Defaults to Vite's `root`. */
  content?: string[];
  /** Extra directory names to skip while scanning. */
  ignore?: string[];
  /** File extensions to scan, without the dot. Defaults to the usual source types. */
  extensions?: string[];
}

/** The slice of Vite's transform context we use. */
interface TransformContext {
  addWatchFile(file: string): void;
}

/** The slice of Vite's dev server we use. */
interface ViteServer {
  watcher: {
    on(event: string, listener: (file: string) => void): unknown;
    /** Optional: absent when Vite runs with its watcher disabled. */
    emit?(event: string, file: string): unknown;
  };
}

/**
 * Structural stand-in for Vite's `Plugin`, so tailess needs no dependency (not
 * even a peer one) on Vite. It is assignable to `Plugin` / `PluginOption`.
 */
export interface TailessVitePlugin {
  name: string;
  enforce: "pre";
  configResolved(config: { root?: string; cacheDir?: string }): void;
  configureServer(server: ViteServer): void;
  transform: {
    order: "pre";
    handler(
      this: TransformContext,
      code: string,
      id: string,
    ): Promise<{ code: string; map: null } | null>;
  };
}

/** `?raw` and `?url` hand the file's bytes to the app verbatim — never touch those. */
const passthroughQuery = /[?&](?:raw|url)(?:&|$)/;

const cssFile = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus)$/;

/** Coalesce bursts of file-system events (editors save in several steps). */
const debounceMs = 25;

/**
 * Vite plugin that bridges tailess to Tailwind v4 — the integration to use with
 * **Vite** (React, Vue, Svelte, Solid, Astro, …).
 *
 * tailess builds variant prefixes (`md:`, `hover:`, …) at runtime, so those full
 * class names never appear literally in your source and Tailwind's scanner misses
 * them. This plugin scans your source, enumerates the classes tailess can produce,
 * and hands them to Tailwind as `@source inline(...)`.
 *
 * ```ts
 * // vite.config.ts
 * import tailwindcss from "@tailwindcss/vite";
 * import tailess from "tailess/vite";
 *
 * export default defineConfig({
 *   plugins: [tailwindcss(), tailess()],
 * });
 * ```
 *
 * Order in the array doesn't matter: the hook is registered `order: "pre"`, so it
 * always runs before `@tailwindcss/vite` wherever you put it.
 *
 * Note this is a real Vite plugin rather than the PostCSS one — with
 * `@tailwindcss/vite`, Tailwind compiles CSS in an `enforce: "pre"` transform,
 * which is *before* Vite's PostCSS stage, so a PostCSS plugin can never reach it.
 */
export function tailess(options: TailessViteOptions = {}): TailessVitePlugin {
  let root = process.cwd();
  let sidecar = createSidecar(join(root, "node_modules", ".vite"));

  /** Tailwind entry stylesheets we've injected into, by absolute path. */
  const entries = new Set<string>();
  let watching = false;

  const extensions = new Set<string>(options.extensions ?? defaultExtensions);

  const roots = (): string[] => (options.content?.length ? options.content : [root]);

  /** Re-scan and refresh the sidecar, returning the files that were read. */
  async function refresh(): Promise<{ files: string[]; css: string; changed: boolean }> {
    const { classes, files } = await collect({
      roots: roots(),
      ignore: options.ignore,
      extensions: options.extensions,
    });
    const { css, changed } = await sidecar.refresh(classes);
    return { files, css, changed };
  }

  return {
    name: "tailess",
    // `enforce: "pre"` puts us in the same bucket as `@tailwindcss/vite`;
    // `order: "pre"` on the hook itself is what makes us win inside that bucket.
    enforce: "pre",

    configResolved(config) {
      if (config.root) root = config.root;
      sidecar = createSidecar(config.cacheDir ?? join(root, "node_modules", ".vite"));
    },

    configureServer(server) {
      if (watching) return;
      watching = true;

      let timer: ReturnType<typeof setTimeout> | undefined;
      const scanRoots = roots().map((path) => resolve(path));

      const onChange = (file: string): void => {
        const path = resolve(file);
        if (!isScannable(path, extensions)) return;
        if (!scanRoots.some((base) => path === base || path.startsWith(base + sep))) return;

        clearTimeout(timer);
        timer = setTimeout(() => {
          refresh()
            .then(({ changed }) => {
              if (!changed) return;
              // Rewriting the sidecar is what makes Tailwind rebuild; re-emitting the
              // entry is what makes Vite re-run this chain and push the new CSS. Vite
              // does not invalidate a stylesheet just because a scanned file changed
              // (`addWatchFile` only registers a watch, not a module dependency), so
              // we can't leave this to somebody else.
              for (const entry of entries) server.watcher.emit?.("change", entry);
            })
            // Never let a failed rescan become an unhandled rejection: that would
            // take down the dev server over a transient file-system error.
            .catch((error: unknown) => {
              console.error("[tailess] could not refresh the class list:", error);
            });
        }, debounceMs);
      };

      server.watcher.on("change", onChange);
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
    },

    transform: {
      order: "pre",
      async handler(code, id) {
        if (passthroughQuery.test(id)) return null;
        const [file = ""] = id.split("?");
        if (!cssFile.test(file)) return null;

        const entry = resolve(file);
        // Only a stylesheet Tailwind emits utilities into — directly, or through a
        // chain of relative `@import`s. Anywhere else the injection is dead weight,
        // and in a stylesheet Tailwind skips entirely it would leak into the output.
        if (!(await isTailwindEntry(code, entry))) return null;

        entries.add(entry);

        const { files, css } = await refresh();
        // Watch the sources so `build --watch` retriggers, and so Vite's watcher is
        // listening on them in dev even outside its own module graph.
        for (const dependency of files) this.addWatchFile(dependency);
        this.addWatchFile(sidecar.path);

        const specifier = importSpecifier(entry, sidecar.path);
        // No relative path exists only when the two sit on different Windows drives
        // (a `cacheDir` pointed at another volume). Inline the list instead: still
        // correct, it just loses the mtime signal that makes Tailwind rebuild in dev.
        if (specifier === null) return { code: `${css}${code}`, map: null };

        return { code: `@import "${specifier}";\n${code}`, map: null };
      },
    },
  };
}

export default tailess;
