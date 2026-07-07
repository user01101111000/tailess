/// <reference types="node" />
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { TailessConfig } from "../config/types.js";
import { extractClasses } from "./extract.js";

/** File extensions scanned by default. */
export const DEFAULT_EXTENSIONS = [
  "tsx",
  "ts",
  "jsx",
  "js",
  "mjs",
  "cjs",
  "mdx",
  "html",
  "vue",
  "svelte",
  "astro",
];

/** Directory names skipped by default. */
export const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "out",
];

const CONFIG_NAMES = [
  "tailess.config.ts",
  "tailess.config.mts",
  "tailess.config.js",
  "tailess.config.mjs",
  "tailess.config.cjs",
];

export interface ScanOptions {
  /** Files or directories to scan. Defaults to the current directory. */
  paths?: string[];
  /** A tailess config object, or a path to one. Auto-detected when omitted. */
  config?: string | TailessConfig;
  /** File extensions to scan (without the dot). */
  extensions?: Iterable<string>;
  /** Extra directory names to skip. */
  ignore?: Iterable<string>;
}

export interface ScanResult {
  /** Sorted, de-duplicated class names built by tailess at runtime. */
  classes: string[];
  /** Absolute paths of every file that was scanned. */
  files: string[];
  /** Absolute root directories that were walked (for watch/dependency tracking). */
  dirs: string[];
  /**
   * Breakpoints declared in the user's config (raw, pre-merge). Only keys the
   * user set are included — overrides of a default (e.g. `md`) and brand-new
   * keys (e.g. `3xl`) — so a consumer can emit them as Tailwind `@theme`
   * `--breakpoint-*` values while untouched keys keep Tailwind's defaults.
   */
  screens: Record<string, string>;
  /** State variants declared in the user's config (raw, pre-merge). */
  states: Record<string, string>;
}

/** Recursively collect files under `root` whose extension is in `extensions`. */
export async function collectFiles(
  root: string,
  extensions: Set<string>,
  ignore: Set<string>,
  found: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    // Not a directory — treat `root` as a single file.
    if (extensions.has(extname(root).slice(1))) found.push(root);
    return;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!ignore.has(entry.name)) await collectFiles(full, extensions, ignore, found);
    } else if (entry.isFile() && extensions.has(extname(entry.name).slice(1))) {
      found.push(full);
    }
  }
}

/** Load a tailess config from JS/MJS/CJS directly, or TS via jiti if installed. */
export async function loadTailessConfig(explicit?: string): Promise<TailessConfig> {
  const path = explicit ? resolve(explicit) : await findConfig();
  if (!path) return {};

  const asObject = (mod: unknown): TailessConfig => {
    const value = (mod as { default?: unknown })?.default ?? mod;
    return (value ?? {}) as TailessConfig;
  };

  if (/\.(js|mjs|cjs)$/.test(path)) {
    return asObject(await import(pathToFileURL(path).href));
  }

  if (/\.m?ts$/.test(path)) {
    try {
      // Indirect specifier so bundlers/TS treat jiti as an optional runtime dep.
      const jitiSpecifier = "jiti";
      const { createJiti } = (await import(jitiSpecifier)) as {
        createJiti: (url: string) => { import: (id: string) => Promise<unknown> };
      };
      const jiti = createJiti(import.meta.url);
      return asObject(await jiti.import(path));
    } catch {
      process.stderr.write(
        `tailess: found "${relative(process.cwd(), path)}" but could not load it.\n` +
          `        Install "jiti" (npm i -D jiti) to read a TypeScript config,\n` +
          `        or pass a .js/.mjs config. Falling back to default states.\n`,
      );
      return {};
    }
  }

  return {};
}

async function findConfig(): Promise<string | undefined> {
  const cwd = process.cwd();
  const entries = new Set(await readdir(cwd).catch(() => [] as string[]));
  for (const name of CONFIG_NAMES) {
    if (entries.has(name)) return join(cwd, name);
  }
  return undefined;
}

/**
 * Walk the given paths, extract every class tailess could build at runtime, and
 * return them along with the scanned files and root directories.
 */
export async function scanProject(options: ScanOptions = {}): Promise<ScanResult> {
  const extensions = new Set(options.extensions ?? DEFAULT_EXTENSIONS);
  const ignore = new Set(options.ignore ?? DEFAULT_IGNORE);
  const paths = options.paths && options.paths.length > 0 ? options.paths : ["."];
  const config =
    options.config && typeof options.config === "object"
      ? options.config
      : await loadTailessConfig(options.config);

  const files: string[] = [];
  const dirs: string[] = [];
  for (const p of paths) {
    const abs = resolve(p);
    dirs.push(abs);
    await collectFiles(abs, extensions, ignore, files);
  }

  const classes = new Set<string>();
  for (const file of files) {
    const code = await readFile(file, "utf8").catch(() => "");
    for (const cls of extractClasses(code, config)) classes.add(cls);
  }

  return {
    classes: [...classes].sort(),
    files,
    dirs,
    screens: config.screens ?? {},
    states: config.states ?? {},
  };
}
