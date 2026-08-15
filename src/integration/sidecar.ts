/// <reference types="node" />
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
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

/**
 * Windows refuses a rename onto a file another handle has open, and reports it as
 * `EPERM`/`EACCES`/`EBUSY` rather than as the transient condition it usually is:
 * Tailwind reading the sidecar, a virus scanner, or the file indexer, all of which
 * let go within a few milliseconds. Retrying briefly turns a spurious build failure
 * — or, in our callers, an unnecessary fall back to inlining — into a normal write.
 *
 * The delays are short and few, so a genuinely unwritable path still fails fast.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  const delays = [1, 5, 15, 40, 80];
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryable = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      const delay = delays[attempt];
      if (!retryable || delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Create a sidecar writer rooted at `cacheDir`. */
export function createSidecar(cacheDir: string): Sidecar {
  const path = join(resolve(cacheDir), "tailess", "tailess.css");
  let written: string | null = null;
  let serial = 0;

  /**
   * Refreshes are serialized. Both integrations can ask for one from several
   * places at once — a build with many stylesheets transforms them in parallel,
   * and in dev a watcher tick can land mid-transform — and two overlapping writes
   * to one path can interleave into a stylesheet that parses as neither list.
   */
  let queue: Promise<void> = Promise.resolve();

  async function write(css: string): Promise<void> {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });

    // Write beside the target and rename over it. Rename is atomic, so Tailwind
    // reading the sidecar concurrently sees either the old list or the new one,
    // never a truncated file mid-write.
    serial += 1;
    const temporary = join(directory, `.tailess.${process.pid}.${serial}.tmp`);
    try {
      await writeFile(temporary, css, "utf8");
      await renameWithRetry(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  async function refreshNow(
    classes: readonly string[],
  ): Promise<{ css: string; changed: boolean }> {
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

    await write(css);
    written = css;
    return { css, changed: true };
  }

  return {
    path,
    refresh(classes) {
      const result = queue.then(() => refreshNow(classes));
      // The caller owns the error through `result`; the chain itself must stay
      // settled so one failed refresh can't reject every later one.
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
