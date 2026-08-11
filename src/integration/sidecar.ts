/// <reference types="node" />
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { buildPrelude } from "./inject.js";

/**
 * The candidate list lives in a small generated stylesheet that your entry
 * `@import`s, rather than inline in the entry itself.
 *
 * That indirection is the whole reason new classes work without restarting a dev
 * server. Tailwind reads `@source inline(...)` only when it *creates* its compiler,
 * and it only recreates that compiler when one of its own build dependencies — the
 * stylesheet and the files it imports — has a newer mtime. Your source files are not
 * build dependencies, so a list inlined into the entry freezes at whatever the first
 * build saw. An `@import`ed file *is* a dependency, so rewriting it is a guaranteed
 * trigger, and the rebuild uses the exact current list (a class you delete loses its
 * CSS too, rather than lingering).
 */
export interface Sidecar {
  /** Absolute path of the generated stylesheet. */
  readonly path: string;
  /**
   * Write the candidate list if it changed. Returns whether anything was written,
   * which is what callers use to decide if a dev-server update is worth pushing.
   */
  refresh(classes: readonly string[]): Promise<{ css: string; changed: boolean }>;
}

/**
 * A relative POSIX specifier a CSS `@import` will resolve, or `null` when no
 * relative path exists between the two (different Windows drives).
 *
 * It must begin with `./` or `../`: anything else is read as a bare package
 * specifier, so a cache directory like `.cache/…` would be looked up in
 * `node_modules` and fail to resolve.
 */
export function importSpecifier(from: string, to: string): string | null {
  const rel = relative(dirname(from), to);
  if (rel === "" || isAbsolute(rel)) return null;
  const posix = rel.split(sep).join("/");
  return posix.startsWith("./") || posix.startsWith("../") ? posix : `./${posix}`;
}

/** Create a sidecar writer rooted at `cacheDir`. */
export function createSidecar(cacheDir: string): Sidecar {
  const path = join(resolve(cacheDir), "tailess", "tailess.css");
  let written: string | null = null;

  return {
    path,
    async refresh(classes) {
      const css = buildPrelude(classes);

      // Confirm the file is still there rather than trusting `written` alone: cache
      // directories get wiped between runs (`vite --force`, a clean script), and a
      // stale "already written" would leave the entry importing nothing.
      const unchanged =
        css === written &&
        (await stat(path).then(
          () => true,
          () => false,
        ));
      if (unchanged) return { css, changed: false };

      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, css, "utf8");
      written = css;
      return { css, changed: true };
    },
  };
}
