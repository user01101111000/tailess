/// <reference types="node" />
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { type Diagnostic, diagnose } from "./diagnose.js";
import { extractClasses } from "./extract.js";

/** File extensions scanned by default. */
export const defaultExtensions = [
  "tsx",
  "ts",
  "mts",
  "cts",
  "jsx",
  "js",
  "mjs",
  "cjs",
  "mdx",
  "md",
  "html",
  "vue",
  "svelte",
  "astro",
] as const;

/**
 * Directory names skipped by default: dependencies, build output, caches and VCS
 * metadata. Everything else is scanned, including dot-directories — see {@link walk}.
 */
export const defaultIgnore = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".output",
  ".vercel",
  ".netlify",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vite",
  ".rollup.cache",
  ".yarn",
  ".pnpm-store",
  ".venv",
  ".expo",
  ".wrangler",
  ".docusaurus",
  ".idea",
  ".vscode",
] as const;

/**
 * Both optional fields are spelled `| undefined` because that is what the callers
 * hand over: each plugin forwards its own `options.extensions` straight through, and
 * those are optional too. Under `exactOptionalPropertyTypes` a bare `?:` means
 * "absent, or a value" and refuses an explicit `undefined`.
 */
export interface CollectOptions {
  /** Files or directories to scan. */
  roots: string[];
  /** File extensions to scan, without the dot. Defaults to {@link defaultExtensions}. */
  extensions?: Iterable<string> | undefined;
  /** Extra directory names to skip on top of {@link defaultIgnore}. */
  ignore?: Iterable<string> | undefined;
}

export interface CollectResult {
  /** Sorted, de-duplicated classes tailess builds at runtime in the scanned files. */
  classes: string[];
  /** Absolute path of every file that was scanned, for watch/dependency tracking. */
  files: string[];
  /** Absolute roots that were walked. */
  roots: string[];
  /**
   * The extensions that were scanned, normalized (lower-case, no leading dot).
   * Callers use it to describe the same file set to a bundler's watcher.
   */
  extensions: string[];
  /**
   * Problems the scanner could prove from the source, with the file they are in.
   * The runtime warns about most of these too, but only once the line runs — these
   * are found on every build, for every call site, and reach CI.
   */
  diagnostics: FileDiagnostic[];
}

/** A {@link Diagnostic} together with the file it was found in. */
export interface FileDiagnostic extends Diagnostic {
  /** Absolute path of the file. */
  file: string;
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  classes: string[];
  diagnostics: Diagnostic[];
}

/**
 * Per-file extraction cache, keyed by absolute path and invalidated by
 * mtime + size. A dev server re-scans on every stylesheet rebuild, so without
 * this we'd re-read and re-parse the whole project on every keystroke.
 *
 * Module-level on purpose: the Vite and PostCSS integrations share it when they
 * run in the same process.
 */
const cache = new Map<string, CacheEntry>();

/**
 * Scans already running, keyed by their options. A build with many stylesheets asks
 * for the same scan several times at once (Next compiles each CSS entry separately);
 * sharing the in-flight walk turns that back into one. Entries are removed as soon
 * as they settle, so a later scan always sees fresh mtimes.
 */
const inFlight = new Map<string, Promise<CollectResult>>();

/** Drop cached extractions. Exposed for tests and long-lived dev processes. */
export function clearCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * An extension list reduced to the form {@link isScannable} compares against: no
 * leading dot, lower case.
 *
 * Exported because the Vite plugin needs the very same set to decide which watcher
 * events are worth a rescan. Building it a second time by hand is how the two
 * drifted: `extensions: [".tsx"]` scanned correctly and then matched nothing in the
 * watcher, so the first build was right and every class added afterwards silently
 * had no CSS until the dev server was restarted.
 */
export function normalizeExtensions(extensions: Iterable<string> = defaultExtensions): Set<string> {
  const out = new Set<string>();
  for (const ext of extensions) out.add(ext.replace(/^\./, "").toLowerCase());
  return out;
}

/** True if `file` has an extension we scan. */
export function isScannable(
  file: string,
  extensions: Set<string> = new Set(defaultExtensions),
): boolean {
  return extensions.has(extname(file).slice(1).toLowerCase());
}

/** Recursively collect scannable files under `root`. */
async function walk(
  root: string,
  extensions: Set<string>,
  ignore: Set<string>,
  found: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    // Not a directory (or unreadable) — `root` may still be a single file, but it
    // has to really be one. A glob such as `src/**/*.tsx` lands here too and has a
    // scannable extension, so counting it as a file that was read would leave
    // `files` non-empty with no classes in it — which is precisely the condition
    // the "content matched no files" warning tests, and the only thing standing
    // between a mistyped `content` and a silently unstyled build.
    if (!isScannable(root, extensions)) return;
    const info = await stat(root).catch(() => undefined);
    if (info?.isFile()) found.push(root);
    return;
  }

  const nested: Array<Promise<void>> = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      // Only the explicit list is skipped — no blanket rule for dot-directories.
      // Real source lives in some of them (`.storybook/preview.tsx`), and silently
      // dropping those classes is the exact failure this package exists to prevent.
      if (ignore.has(entry.name)) continue;
      nested.push(walk(full, extensions, ignore, found));
    } else if (entry.isFile() && isScannable(entry.name, extensions)) {
      found.push(full);
    }
  }
  await Promise.all(nested);
}

/** Read one file, reusing the cached extraction when it hasn't changed. */
async function scanFile(file: string): Promise<CacheEntry> {
  const empty: CacheEntry = { mtimeMs: 0, size: -1, classes: [], diagnostics: [] };
  let mtimeMs = 0;
  let size = -1;
  try {
    const info = await stat(file);
    mtimeMs = info.mtimeMs;
    size = info.size;
  } catch {
    cache.delete(file);
    return empty;
  }

  const cached = cache.get(file);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return cached;

  const code = await readFile(file, "utf8").catch(() => "");
  // Both walks read the same text once; diagnostics are cached beside the classes so
  // an unchanged file costs a `stat` on the next scan, exactly as before.
  const entry: CacheEntry = {
    mtimeMs,
    size,
    classes: extractClasses(code),
    diagnostics: diagnose(code),
  };
  cache.set(file, entry);
  return entry;
}

/**
 * Walk `roots` and return every class tailess could build at runtime, together
 * with the files that were read so the caller can register them as build
 * dependencies.
 */
export async function collect(options: CollectOptions): Promise<CollectResult> {
  const key = JSON.stringify([
    [...options.roots].sort(),
    [...(options.extensions ?? [])].sort(),
    [...(options.ignore ?? [])].sort(),
  ]);

  const running = inFlight.get(key);
  if (running) return running;

  const scan = run(options).finally(() => inFlight.delete(key));
  inFlight.set(key, scan);
  return scan;
}

async function run(options: CollectOptions): Promise<CollectResult> {
  const extensions = normalizeExtensions(options.extensions);
  const ignore = new Set<string>(defaultIgnore);
  for (const dir of options.ignore ?? []) ignore.add(dir);

  const roots = [...new Set(options.roots.map((p) => resolve(p)))];
  const files: string[] = [];
  await Promise.all(roots.map((root) => walk(root, extensions, ignore, files)));
  files.sort();

  const classes = new Set<string>();
  const diagnostics: FileDiagnostic[] = [];
  const perFile = await Promise.all(files.map(scanFile));
  perFile.forEach((entry, index) => {
    for (const cls of entry.classes) classes.add(cls);
    const file = files[index] as string;
    for (const d of entry.diagnostics) diagnostics.push({ ...d, file });
  });

  return {
    classes: [...classes].sort(),
    files,
    roots,
    extensions: [...extensions],
    diagnostics,
  };
}
