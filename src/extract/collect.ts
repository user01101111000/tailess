/// <reference types="node" />
import type { Dirent } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { shared } from "../internal/shared.js";
import { configuresMerge, type Diagnostic, diagnose } from "./diagnose.js";
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
 *
 * The plain-word build outputs in {@link outputDirs} are skipped only where a build
 * writes them; the rest wherever they are.
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
 * The build outputs whose names are ordinary words, skipped only where a build writes
 * them: at the top of a content root, or beside a `package.json`.
 *
 * Anywhere else they are source. `app/build/page.tsx` is a Next.js route and
 * `src/coverage/` an insurance dashboard; skipping every directory with one of these
 * names dropped their runtime-built classes while Tailwind still styled the literals —
 * half a page, and a `check` that passed because it read the same walk.
 */
const outputDirs = new Set(["dist", "build", "out", "coverage"]);

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
  /**
   * Also record which files each class came from.
   *
   * Off by default because the plugins never ask: they hand Tailwind a flat list, and
   * a dev server rescans on every keystroke. `tailess check` does ask, because a
   * report that names a broken class without naming a file leaves the reader grepping
   * escaped selectors by hand.
   */
  provenance?: boolean | undefined;
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
  /**
   * Class name to the absolute paths of the files that build it, present only when
   * `provenance` was asked for. Sorted, so a report reads the same on every run.
   */
  sources?: Map<string, string[]> | undefined;
}

/** A {@link Diagnostic} together with the file it was found in. */
export interface FileDiagnostic extends Diagnostic {
  /** Absolute path of the file. */
  file: string;
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  /** When the file was read, which decides whether its mtime can be trusted. */
  readAt: number;
  /** Whether the file configures a merge of its own; see `configuresMerge`. */
  merge: boolean;
  classes: string[];
  diagnostics: Diagnostic[];
}

/**
 * How close to the read an mtime has to be before it cannot vouch for the content.
 *
 * Two seconds is the coarsest mtime in use (FAT and exFAT), and NTFS often leaves a
 * back-to-back rewrite with the same one. A same-length edit inside that window — a
 * formatter, a codemod, an agent — kept the old classes until the dev server restarted.
 * Git's "racy" rule, for the same reason: a file changed within a tick of being read is
 * read again, and one changed well before is trusted.
 */
const mtimeTick = 2000;

/**
 * Per-file extraction cache, keyed by absolute path and invalidated by
 * mtime + size. A dev server re-scans on every stylesheet rebuild, so without
 * this we'd re-read and re-parse the whole project on every keystroke.
 *
 * Process-level on purpose: the Vite and PostCSS integrations share it when they run in
 * the same process — and so do the CommonJS entries, which each bundle their own copy of
 * this module, so a module-level map left `clearCache()` from `tailess/build` unable to
 * reach the plugin's. The key names this entry shape.
 */
const cache = shared("tailess.scan-cache.2", () => new Map<string, CacheEntry>());

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
  outputs: ReadonlySet<string> = outputDirs,
  top = true,
  links: Set<string> = new Set(),
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

  // Where a build writes its output: the top of a root, or a package's own directory.
  const writesOutput = top || entries.some((e) => e.isFile() && e.name === "package.json");
  const nested: Array<Promise<void>> = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      // Only the explicit list is skipped — no blanket rule for dot-directories.
      // Real source lives in some of them (`.storybook/preview.tsx`), and silently
      // dropping those classes is the exact failure this package exists to prevent.
      if (ignore.has(entry.name)) continue;
      if (writesOutput && outputs.has(entry.name)) continue;
      nested.push(walk(full, extensions, ignore, found, outputs, false, links));
    } else if (entry.isFile() && isScannable(entry.name, extensions)) {
      found.push(full);
    } else if (entry.isSymbolicLink()) {
      if (ignore.has(entry.name) || (writesOutput && outputs.has(entry.name))) continue;
      nested.push(follow(full, root, extensions, ignore, found, outputs, links));
    }
  }
  await Promise.all(nested);
}

/**
 * Walk a symlink or junction the way Tailwind's own scanner does: into the folder or
 * file it points at.
 *
 * Skipped, a linked `shared/` folder — how monorepos put common components into an app —
 * had its literal classes styled by Tailwind and every tailess-built one unstyled, with
 * the check green. Each target is walked once per scan, and never when it is the
 * directory the link sits in or one above it, so a link back up the tree ends.
 */
async function follow(
  link: string,
  parent: string,
  extensions: Set<string>,
  ignore: Set<string>,
  found: string[],
  outputs: ReadonlySet<string>,
  links: Set<string>,
): Promise<void> {
  const info = await stat(link).catch(() => undefined);
  if (info?.isFile()) {
    if (isScannable(link, extensions)) found.push(link);
    return;
  }
  if (!info?.isDirectory()) return;
  const target = await realpath(link).catch(() => undefined);
  if (target === undefined || links.has(target)) return;
  // Claimed before the next await: two links to one folder are followed concurrently.
  links.add(target);
  const here = await realpath(parent).catch(() => parent);
  if (here === target || here.startsWith(target + sep)) return;
  await walk(link, extensions, ignore, found, outputs, false, links);
}

/** Read one file, reusing the cached extraction when it hasn't changed. */
async function scanFile(file: string): Promise<CacheEntry> {
  const empty: CacheEntry = {
    mtimeMs: 0,
    size: -1,
    readAt: 0,
    merge: false,
    classes: [],
    diagnostics: [],
  };
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
  if (
    cached &&
    cached.mtimeMs === mtimeMs &&
    cached.size === size &&
    mtimeMs < cached.readAt - mtimeTick
  ) {
    return cached;
  }

  const readAt = Date.now();
  const code = await readFile(file, "utf8").catch(() => "");
  // Both walks read the same text once; diagnostics are cached beside the classes so
  // an unchanged file costs a `stat` on the next scan, exactly as before.
  const entry: CacheEntry = {
    mtimeMs,
    size,
    readAt,
    merge: configuresMerge(code),
    classes: extractClasses(code),
    diagnostics: diagnose(code, file),
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
  // The output names are position-sensitive, unless the project names one itself — then
  // it is skipped wherever it is, like every other entry it lists.
  const ignore = new Set<string>(defaultIgnore.filter((name) => !outputDirs.has(name)));
  for (const dir of options.ignore ?? []) ignore.add(dir);

  const roots = [...new Set(options.roots.map((p) => resolve(p)))];
  const walked: string[] = [];
  const links = new Set<string>();
  await Promise.all(
    roots.map((root) => walk(root, extensions, ignore, walked, outputDirs, true, links)),
  );
  // Overlapping roots — `src` and `src/components`, the whole project and one of its
  // folders — reach the same file twice. Read twice, it counted twice and reported every
  // diagnostic in it twice, which is what `check --json` then handed CI.
  const files = [...new Set(walked)].sort();

  const classes = new Set<string>();
  const diagnostics: FileDiagnostic[] = [];
  const sources = options.provenance ? new Map<string, string[]>() : undefined;
  const perFile = await Promise.all(files.map(scanFile));
  // The dead-class check assumes the default merge; a project with its own gets none.
  const ownMerge = perFile.some((entry) => entry.merge);
  perFile.forEach((entry, index) => {
    const file = files[index] as string;
    for (const cls of entry.classes) {
      classes.add(cls);
      if (!sources) continue;
      const seen = sources.get(cls);
      if (seen) seen.push(file);
      else sources.set(cls, [file]);
    }
    for (const d of entry.diagnostics) {
      if (!(ownMerge && d.kind === "dead-class")) diagnostics.push({ ...d, file });
    }
  });

  return {
    classes: [...classes].sort(),
    files,
    roots,
    extensions: [...extensions],
    diagnostics,
    ...(sources ? { sources } : {}),
  };
}
