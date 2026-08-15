/// <reference types="node" />
import { isAbsolute, join, resolve, sep } from "node:path";
import { collect, defaultExtensions, isScannable } from "../extract/collect.js";
import { isTailwindEntry } from "../integration/entry.js";
import { buildPrelude } from "../integration/inject.js";
import { createSidecar, importSpecifier } from "../integration/sidecar.js";

/**
 * Options for the tailess Vite plugin.
 *
 * Each is `| undefined` so that passing one conditionally — `content: isCI ? […] :
 * undefined` — compiles under `exactOptionalPropertyTypes`, which is what the
 * implementation already accepts.
 */
export interface TailessViteOptions {
  /**
   * Files or directories to scan. Relative paths resolve against Vite's `root`,
   * which is also the default.
   */
  content?: string[] | undefined;
  /** Extra directory names to skip while scanning. */
  ignore?: string[] | undefined;
  /** File extensions to scan, without the dot. Defaults to the usual source types. */
  extensions?: string[] | undefined;
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

  /**
   * Watchers already wired up. Scoped to the watcher rather than to this closure
   * because Vite calls `configureServer` again on every restart, and a plugin
   * instance passed through `inlineConfig.plugins` is reused across one — a latch
   * on the instance would leave the new server with no listeners, and new classes
   * would quietly stop reaching Tailwind until the process was restarted.
   */
  const watched = new WeakSet<object>();

  const extensions = new Set<string>(options.extensions ?? defaultExtensions);

  /**
   * `content` resolved against Vite's root, not the working directory.
   *
   * The two are the same only when the build runs from the project it builds.
   * `vite build apps/web`, a monorepo task launched from the workspace root, or a
   * `--config` pointing elsewhere all break that assumption, and a relative
   * `content` would then name a directory that does not exist. The scan finds
   * nothing, the sidecar still gets its marker, and every runtime-built class
   * silently loses its CSS — with the integration check reporting success.
   */
  let contentRoots: string[] | undefined;

  const roots = (): string[] => contentRoots ?? [root];

  let warnedAboutSidecar = false;
  let warnedAboutEmptyScan = false;

  /**
   * Re-scan and refresh the sidecar, returning the files that were read and
   * whether the sidecar is usable.
   *
   * A failed write is reported rather than thrown. It means a locked or read-only
   * cache directory — transient on Windows, permanent in a sandboxed CI — and
   * failing the whole CSS transform over it would take the build down when
   * inlining the list would have worked.
   */
  async function refresh(): Promise<{
    files: string[];
    css: string;
    changed: boolean;
    wrote: boolean;
  }> {
    const scanned = roots();
    const { classes, files } = await collect({
      roots: scanned,
      ignore: options.ignore,
      extensions: options.extensions,
    });

    // An explicit `content` that matches nothing is always a mistake — a wrong path,
    // or an extension list that excludes the project's own files. Left quiet it looks
    // exactly like a project that uses no tailess at all, right up until the page
    // renders unstyled.
    if (files.length === 0 && options.content?.length && !warnedAboutEmptyScan) {
      warnedAboutEmptyScan = true;
      console.warn(
        `[tailess] the "content" option matched no files, so no variant class will ` +
          `have CSS. Scanned: ${scanned.join(", ")}. Paths are resolved against Vite's ` +
          `root (${root}).`,
      );
    }

    try {
      const { css, changed } = await sidecar.refresh(classes);
      return { files, css, changed, wrote: true };
    } catch (error) {
      if (!warnedAboutSidecar) {
        warnedAboutSidecar = true;
        console.warn(
          `[tailess] could not write ${sidecar.path}, so the class list is being ` +
            "inlined into your stylesheet instead. Builds are unaffected; in dev, a " +
            "brand-new variant may need a restart to pick up.",
          error,
        );
      }
      return { files, css: buildPrelude(classes), changed: false, wrote: false };
    }
  }

  return {
    name: "tailess",
    // `enforce: "pre"` puts us in the same bucket as `@tailwindcss/vite`;
    // `order: "pre"` on the hook itself is what makes us win inside that bucket.
    enforce: "pre",

    configResolved(config) {
      if (config.root) root = config.root;
      contentRoots = options.content?.length
        ? options.content.map((path) => (isAbsolute(path) ? path : resolve(root, path)))
        : undefined;
      sidecar = createSidecar(config.cacheDir ?? join(root, "node_modules", ".vite"));
    },

    configureServer(server) {
      if (watched.has(server.watcher)) return;
      watched.add(server.watcher);

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

        const { files, css, wrote } = await refresh();
        // Watch the sources so `build --watch` retriggers, and so Vite's watcher is
        // listening on them in dev even outside its own module graph.
        for (const dependency of files) this.addWatchFile(dependency);
        if (wrote) this.addWatchFile(sidecar.path);

        const specifier = wrote ? importSpecifier(entry, sidecar.path) : null;
        // No relative path exists when the two sit on different Windows drives (a
        // `cacheDir` pointed at another volume), and there is nothing to import if
        // the write failed. Inline the list instead: still correct, it just loses
        // the mtime signal that makes Tailwind rebuild in dev.
        if (specifier === null) return { code: `${css}${code}`, map: null };

        return { code: `@import "${specifier}";\n${code}`, map: null };
      },
    },
  };
}

export default tailess;
