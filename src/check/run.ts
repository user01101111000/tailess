/// <reference types="node" />
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collect } from "../extract/collect.js";
import { maskLiterals } from "../extract/scan.js";
import { isTailwindEntry, tailwindPrefixIn } from "../integration/entry.js";
import { buildPrelude } from "../integration/inject.js";
import { reportDiagnostics } from "../integration/report.js";
import { collectTheme, themeDiagnostics } from "../integration/theme.js";
import { hasRule } from "../internal/selector.js";
import { type Command, commands, jsonResult } from "./result.js";
import { findHost, readWiring, runDoctor, runInit } from "./setup.js";
import { findBrokenAcross, probeList, utilitySentinel } from "./verify.js";

/**
 * `tailess check` — compile the project for real and prove every class the runtime
 * can build has a rule behind it.
 *
 * The plugins guarantee the *bridge*: the scanner enumerates what the runtime builds
 * and hands the list to Tailwind. Nothing until now proved the far end. This does,
 * which is why it exits non-zero: it is meant to be a gate, not a warning.
 */

export interface Options {
  /** Which command to run. `check` compiles and verifies; `emit` writes the prelude. */
  command: Command;
  content: string[];
  css: string | undefined;
  cwd: string;
  /** Make the build-time diagnostics fail the gate too, not just print. */
  strict: boolean;
  /** File extensions to scan, replacing the default list. */
  extensions: string[];
  /** Extra directory names to skip, on top of the built-in list. */
  ignore: string[];
  /** Print one JSON object instead of prose, for a CI job that has to read it. */
  json: boolean;
  /** How many broken classes to name before summarising. `0` means all of them. */
  max: number;
  /** Where `emit` writes its stylesheet. */
  out: string | undefined;
  /** Let `init` actually change the config, rather than only showing the edit. */
  write: boolean;
}

/** Options that take a comma-separated list as well as being repeatable. */
const listOptions = new Set(["--content", "--extensions", "--ignore"]);
const pathOptions = new Set(["--css", "--out"]);
/**
 * What each option's value actually is, for the message when it is missing.
 *
 * `--ignore` takes directory *names* and was told it needed a path, which sends the
 * reader looking for the wrong thing.
 */
const nouns: Record<string, string> = {
  "--content": "path",
  "--css": "path",
  "--out": "path",
  "--extensions": "list of extensions",
  "--ignore": "directory name",
};

/** The commands each flag means something to; `--json` and the rest apply to all four. */
const scoped: Record<string, Options["command"][]> = {
  "--content": ["check", "emit"],
  "--css": ["check"],
  "--extensions": ["check", "emit"],
  "--ignore": ["check", "emit"],
  "--strict": ["check"],
  "--max": ["check"],
  "--out": ["emit"],
  "--write": ["init"],
};

/**
 * An error in how the command was invoked, as opposed to one from running it.
 *
 * The binary printed its whole usage text after *any* failure — including "tailwindcss is
 * not installed here" and a module-resolution error — which is thirty lines of noise
 * pushing the one useful line out of a CI log tail, and tells the reader to re-check
 * flags that were fine.
 */
export class UsageError extends Error {}

export function parse(argv: readonly string[]): Options | "help" | "version" {
  const content: string[] = [];
  const extensions: string[] = [];
  const ignore: string[] = [];
  let css: string | undefined;
  let out: string | undefined;
  let strict = false;
  let json = false;
  let write = false;
  let max = 20;
  // `tailess check …` and a bare `tailess …` are the same thing; `emit` is the one
  // other command, so the subcommand is read here rather than in the binary.
  let command: Options["command"] = "check";
  let rest = argv;
  if ((commands as readonly string[]).includes(rest[0] ?? "")) {
    command = rest[0] as Options["command"];
    rest = rest.slice(1);
  }

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] as string;
    if (arg === "--help" || arg === "-h") return "help";
    if (arg === "--version" || arg === "-v") return "version";
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--max") {
      const value = rest[i + 1];
      if (value === undefined || !/^\d+$/.test(value)) {
        throw new UsageError("--max needs a whole number (0 for no limit)");
      }
      max = Number(value);
      i += 1;
      continue;
    }
    if (listOptions.has(arg) || pathOptions.has(arg)) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new UsageError(`${arg} needs a ${nouns[arg] ?? "value"}`);
      }
      if (arg === "--css") css = value;
      else if (arg === "--out") out = value;
      else {
        const target = arg === "--content" ? content : arg === "--extensions" ? extensions : ignore;
        for (const part of value.split(",")) {
          const trimmed = part.trim();
          if (trimmed !== "") target.push(trimmed);
        }
      }
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) throw new UsageError(`unknown option ${arg}`);
    // A bare word in the first position was meant as a command, not an option, and
    // saying "unknown option" sends the reader to the flag list rather than the command
    // list — where the answer is. After a command it is an argument nothing takes:
    // "unknown command doctor. Expected one of: …, doctor" rejected the very word it
    // listed.
    if (i === 0 && rest === argv) {
      throw new UsageError(`unknown command ${arg}. Expected one of: ${commands.join(", ")}.`);
    }
    throw new UsageError(
      `unexpected argument ${arg}` +
        (command === "check" || command === "emit" ? ` — for a directory, --content ${arg}` : ""),
    );
  }

  // `--help` annotates the flags that belong to one command, and accepting them anywhere
  // else did nothing without saying so: `init --content apps/web` wrote to the current
  // directory's config, and `doctor --strict` was the same doctor.
  for (const flag of new Set(rest.filter((arg) => arg.startsWith("--")))) {
    const only = scoped[flag];
    if (only && !only.includes(command)) {
      throw new UsageError(
        `${flag} does not apply to ${command} (it is for ${only.join(" and ")})`,
      );
    }
  }

  return {
    command,
    content,
    css,
    cwd: process.cwd(),
    strict,
    extensions,
    ignore,
    json,
    write,
    max,
    out,
  };
}

export const help = `tailess — prove every class tailess builds has CSS behind it.

  npx tailess check [options]     compile the project and verify every class
  npx tailess doctor              say whether the plugin is wired up, and how
  npx tailess init [--write]      wire it up, after showing the edit
  npx tailess emit --out <file>   write the @source inline(...) stylesheet

  --content <dir>       where your source lives. Repeatable, or comma-separated.
                        Defaults to the working directory.
  --css <file>          your Tailwind entry stylesheet. Found automatically when it
                        is inside a --content root. (check only)
  --extensions <list>   file extensions to scan, replacing the default list.
  --ignore <list>       extra directory names to skip.
  --strict              also fail on the build-time diagnostics, which are otherwise
                        printed and do not affect the exit code. (check only)
  --max <n>             how many broken classes to name before summarising.
                        Default 20; 0 for all of them. (check only)
  --json                print one JSON object instead of prose. On emit it also changes
                        what is produced: the candidate list, not the stylesheet — so
                        with --out the file holds that list and stdout holds an ack.
  --out <file>          where to write. (emit only)
  --write               let init change the config. Without it, it only shows the
                        edit it would make.
  --version, -v         print the version and exit.
  --help, -h            print this and exit.

Give --content, --extensions and --ignore the same values as the plugin, or the gate
checks a different set of files than your build does.

Exit codes:
  0  every runtime-built class has a rule (or the scan found no tailess calls)
  1  a class reaches the element with no rule behind it
  2  nothing could be checked — no stylesheet, no files scanned, or a bad option`;

/**
 * The package's own version, for `--version`.
 *
 * Walked up from this module rather than imported, because the same file runs from
 * `src/` under the test runner and from `dist/` as the binary, and the manifest sits
 * one level further up in the second case.
 */
export async function version(): Promise<string> {
  for (const up of ["../package.json", "../../package.json", "../../../package.json"]) {
    const text = await readFile(new URL(up, import.meta.url), "utf8").catch(() => undefined);
    if (text === undefined) continue;
    const pkg = JSON.parse(text) as { name?: string; version?: string };
    if (pkg.name === "tailess" && pkg.version) return pkg.version;
  }
  return "unknown";
}

/** An `exports` entry: a path, a map of conditions, or a list of fallbacks. */
type ExportTarget = string | null | ExportTarget[] | { [condition: string]: ExportTarget };

/**
 * The file an `exports` entry names for a stylesheet: the `style` condition, which is
 * what Tailwind's own resolver asks for, else `default` — whichever comes first, since
 * conditions match in the order the package wrote them.
 */
function styleTarget(target: ExportTarget | undefined): string | undefined {
  if (typeof target === "string") return target;
  if (Array.isArray(target)) {
    for (const option of target) {
      const found = styleTarget(option);
      if (found) return found;
    }
    return undefined;
  }
  if (!target) return undefined;
  for (const [condition, value] of Object.entries(target)) {
    if (condition === "style" || condition === "default") {
      const found = styleTarget(value);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * The directory of an installed package, found on disk rather than through Node's
 * resolver.
 *
 * `require.resolve("<pkg>/package.json")` goes through the package's `exports` map, and
 * a style-only package — tw-animate-css, which shadcn/ui's stylesheet imports, or a
 * scoped design-token package — has no reason to export its manifest. Tailwind's own
 * resolver does not need it to, so the gate cannot either.
 */
async function packageDir(name: string, base: string): Promise<string | undefined> {
  for (let dir = base; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (await stat(join(candidate, "package.json")).catch(() => undefined)) return candidate;
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * Resolve an `@import` the way Tailwind's Node host does.
 *
 * A bare package root resolves to JavaScript, not CSS — `require.resolve("tailwindcss")`
 * hands back `dist/lib.js` — so the package's `style` condition is what to follow, on the
 * root or on a subpath (`@import "@acme/ui/theme"`). A subpath that names the file
 * (`tailwindcss/theme.css`) resolves directly.
 */
async function loadStylesheet(id: string, base: string) {
  let path: string | undefined;
  if (id.startsWith(".") || isAbsolute(id)) {
    path = resolve(base, id);
  } else {
    try {
      const resolved = createRequire(join(base, "_")).resolve(id);
      if (resolved.endsWith(".css")) path = resolved;
    } catch {
      // A style-only export has no `require` condition; the manifest is read below.
    }
    if (path === undefined) {
      const segments = id.split("/");
      const nameLength = id.startsWith("@") ? 2 : 1;
      const name = segments.slice(0, nameLength).join("/");
      const subpath = segments.slice(nameLength).join("/");
      const dir = await packageDir(name, base);
      if (dir === undefined) throw new Error(`could not resolve "${id}" from ${base}`);
      const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
        exports?: ExportTarget;
        style?: string;
      };
      const key = subpath ? `./${subpath}` : ".";
      const { exports } = pkg;
      // `exports` is either a map of subpaths or, for a single-entry package, the
      // conditions for "." directly.
      const isSubpathMap =
        exports !== null &&
        typeof exports === "object" &&
        !Array.isArray(exports) &&
        Object.keys(exports).some((k) => k.startsWith("."));
      const entry = isSubpathMap
        ? (exports as Record<string, ExportTarget>)[key]
        : key === "."
          ? exports
          : undefined;
      const target = styleTarget(entry);
      path = target ? resolve(dir, target) : resolve(dir, subpath || (pkg.style ?? "index.css"));
    }
  }
  return { base: dirname(path), path, content: await readFile(path, "utf8") };
}

/**
 * Resolve an `@plugin` or `@config` the way Tailwind's own Node host would.
 *
 * Without this, `compile()` throws "No `loadModule` function provided" the moment the
 * stylesheet reaches an `@plugin` line, so a project using typography or forms — or a
 * v3 config kept through the migration — could not be checked at all. Loading them is
 * also what makes the answer right rather than merely available: a plugin registers
 * utilities and variants, and a class that only exists because of one would otherwise
 * be reported as broken.
 */
async function loadModule(id: string, base: string) {
  const req = createRequire(join(base, "_"));
  let resolved: string;
  try {
    resolved = id.startsWith(".") ? req.resolve(resolve(base, id)) : req.resolve(id);
  } catch {
    throw new Error(`could not resolve "${id}" from ${base}`);
  }
  // A plugin is usually CJS, which `import()` exposes under `default`; an ESM one
  // exposes the plugin itself. Tailwind's own loader makes the same choice.
  const mod = (await import(pathToFileURL(resolved).href)) as { default?: unknown };
  return { path: resolved, base: dirname(resolved), module: mod.default ?? mod };
}

/**
 * Run `task` with `console.log`, `console.info` and `console.debug` writing to stderr,
 * then put them back — so code this process runs on the project's behalf cannot put a
 * second thing on a stdout that promised one JSON object.
 */
async function toStderr<T>(task: () => Promise<T>): Promise<T> {
  const { log, info, debug } = console;
  const redirect = (...args: unknown[]) => console.error(...args);
  console.log = redirect;
  console.info = redirect;
  console.debug = redirect;
  try {
    return await task();
  } finally {
    console.log = log;
    console.info = info;
    console.debug = debug;
  }
}

/**
 * The version of the Tailwind whose entry file is at `from`, read off the nearest
 * manifest that names it — `tailwindcss/package.json` is not reached through `exports`.
 */
async function tailwindVersion(from: string): Promise<string | undefined> {
  for (let dir = from; ; dir = dirname(dir)) {
    const text = await readFile(join(dir, "package.json"), "utf8").catch(() => undefined);
    if (text !== undefined) {
      try {
        const pkg = JSON.parse(text) as { name?: unknown; version?: unknown };
        if (pkg.name === "tailwindcss" && typeof pkg.version === "string") return pkg.version;
      } catch {
        // Not a manifest worth reading; keep walking up.
      }
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** True for a v4 release before 4.1.0, the first to parse `@source inline(…)`. */
function olderThanFloor(version: string): boolean {
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  return major === 4 && minor === 0;
}

/** The slice of Tailwind's own API this needs, so no dependency on it is declared. */
type Compile = (
  css: string,
  options: {
    base: string;
    loadModule: typeof loadModule;
    loadStylesheet: typeof loadStylesheet;
  },
) => Promise<{ build(candidates: string[]): string }>;

/** `compile()` from `@tailwindcss/node`, the host `@tailwindcss/postcss` and `/vite` run. */
type NodeHostCompile = (
  css: string,
  options: { base: string; onDependency: (path: string) => void },
) => Promise<{ build(candidates: string[]): string }>;

/**
 * Tailwind's own Node host, when the project has one — directly, or as the dependency of
 * the PostCSS or Vite plugin, which is where a strict package manager keeps it.
 *
 * It resolves `@import`, `@plugin` and `@config` exactly as the build does: `import`
 * conditions for an ESM-only plugin, `style` conditions for a stylesheet, and TypeScript
 * through its own loader rather than whatever the running Node happens to strip. The
 * gate answering for a different resolver than the build is how it came to exit 2 on an
 * ESM-only plugin the build loaded fine.
 */
async function loadNodeHost(cwd: string): Promise<NodeHostCompile | undefined> {
  const from = createRequire(join(cwd, "_"));
  const places = [
    () => from.resolve("@tailwindcss/node"),
    () => createRequire(from.resolve("@tailwindcss/postcss")).resolve("@tailwindcss/node"),
    () => createRequire(from.resolve("@tailwindcss/vite")).resolve("@tailwindcss/node"),
  ];
  for (const place of places) {
    let entry: string;
    try {
      entry = place();
    } catch {
      continue;
    }
    const mod = (await import(pathToFileURL(entry).href)) as {
      compile?: unknown;
      default?: { compile?: unknown };
    };
    const compile = mod.compile ?? mod.default?.compile;
    if (typeof compile === "function") return compile as NodeHostCompile;
  }
  return undefined;
}

/**
 * Load Tailwind from the project being checked, not from tailess' own tree.
 *
 * `tailwindcss` is the host's, exactly as it is for the plugins — resolving it from
 * here would check tailess' devDependency against the consumer's source. Tailwind's own
 * Node host is preferred when it is there; the bare compiler, with the loaders in this
 * file, is what is left for a project that has none.
 */
async function loadCompiler(cwd: string): Promise<Compile> {
  const req = createRequire(join(cwd, "_"));
  let entry: string;
  try {
    entry = req.resolve("tailwindcss");
  } catch {
    throw new Error("tailwindcss is not installed here, so there is nothing to compile against");
  }
  const version = await tailwindVersion(dirname(entry));
  if (version !== undefined && olderThanFloor(version)) {
    throw new Error(
      `tailess needs tailwindcss 4.1 or later, and this project has ${version}. The ` +
        `plugins inject @source inline(…), which Tailwind parses from 4.1.0 — on ${version} ` +
        "the build fails with Tailwind's own error, `@source` paths must be quoted.",
    );
  }
  const host = await loadNodeHost(cwd);
  if (host) return (css, { base }) => host(css, { base, onDependency: () => {} });
  // `require.resolve` picks the `require` condition, so this is usually Tailwind's
  // CJS build — importing that puts its named exports under `default`.
  const mod = (await import(pathToFileURL(entry).href)) as {
    compile?: unknown;
    default?: { compile?: unknown };
  };
  const compile = mod.compile ?? mod.default?.compile;
  if (typeof compile !== "function") {
    throw new Error("this copy of tailwindcss has no compile() — v4 is required");
  }
  return compile as Compile;
}

/** A local module a config pulls its plugin list from, which this cannot always follow. */
const localImport = /^[ \t]*import\b[^;]*?["']\.[^"'\n]*["']|\brequire\(\s*["']\.[^"'\n]*["']/m;

/** True when `dir` is `root` or inside it. */
function inside(root: string, dir: string): boolean {
  const rel = relative(root, dir);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * True when nothing in the project's root config mentions tailess.
 *
 * The plugin not being wired up is the first failure the troubleshooting section
 * lists, and it is the one that unstyles an entire application — yet the check cannot
 * see it by compiling. It scans the source itself and hands the candidates straight to
 * Tailwind, so whether the *project's* build would have done that never comes into it,
 * and a project with the plugin deleted passes green.
 *
 * Compiling for the marker would not answer it either: the PostCSS plugin injects
 * `:root{--tailess:1}` into the AST and the Vite one imports a sidecar at transform
 * time, so neither reaches the stylesheet on disk. What is left is the config, which
 * is where a reader would look too. Heuristic, so it warns rather than failing unless
 * asked — a gate that fails on a guess is a gate teams delete.
 *
 * Read the way `doctor` reads it — the file the build loads, followed into a local
 * preset, a PostCSS entry counted only when listed ahead of Tailwind's — and only a
 * real build config counts. Any `*rc` and `*.config.*` did before, so a monorepo root
 * with an `.npmrc` "had a config" that wired nothing, and `--strict` failed a correctly
 * wired app. With no build config in the working directory, the nearest one above each
 * `--content` root inside it answers instead, which is where a monorepo keeps them.
 */
async function pluginLooksUnwired(cwd: string, roots: readonly string[]): Promise<boolean> {
  const dirs = new Set<string>();
  if ((await findHost(cwd)).kind !== "unknown") dirs.add(cwd);
  else {
    for (const root of roots) {
      for (let dir = root; inside(cwd, dir) && dir !== cwd; dir = dirname(dir)) {
        if ((await findHost(dir)).kind === "unknown") continue;
        dirs.add(dir);
        break;
      }
    }
  }
  // No config at all means this is not a project root worth guessing about.
  if (dirs.size === 0) return false;

  for (const dir of dirs) {
    const host = await findHost(dir);
    if (host.kind === "unknown") continue;
    const { state } = await readWiring(host);
    if (state === "wired" || state === "unknown") return false;
    // A config that builds its plugin list somewhere else — `import base from
    // "./vite.base.js"`, the shape every monorepo and shared preset has — may do it
    // through a package this cannot read, and concluding "unwired" there failed a
    // correctly wired project under `--strict`. A guess that cannot see the whole config
    // has to abstain.
    if (localImport.test(maskLiterals(host.source))) return false;
  }
  return true;
}

/**
 * Every Tailwind entry stylesheet under `roots`, skipping what `ignore` names.
 *
 * `--ignore` did not reach this search, so a stale `legacy/old-admin.css` anywhere under
 * `--content` stayed an entry — and since a class only has to work in one entry, it
 * vouched for the app's broken ones, with no way to leave it out short of `--css`.
 */
async function findEntries(roots: string[], ignore: readonly string[] = []): Promise<string[]> {
  const { files } = await collect({
    roots,
    extensions: ["css"],
    ...(ignore.length ? { ignore: [...ignore] } : {}),
  });
  const entries: string[] = [];
  for (const file of files) {
    const css = await readFile(file, "utf8").catch(() => undefined);
    if (css !== undefined && (await isTailwindEntry(css, file))) entries.push(file);
  }
  return entries;
}

/** Absolute paths, relative to the project, sorted — what a report should print. */
function shown(paths: readonly string[] | undefined, cwd: string): string[] {
  return (paths ?? []).map((path) => relative(cwd, path) || path);
}

/** Resolve `--content` against the working directory, defaulting to it. */
function rootsFor(options: Options): string[] {
  return options.content.length
    ? options.content.map((path) => (isAbsolute(path) ? path : resolve(options.cwd, path)))
    : [options.cwd];
}

/**
 * The scan both commands run, with the options the plugin would have been given.
 *
 * `--extensions` and `--ignore` exist so this can be made to agree with the build. A
 * project narrowing either one had a plugin enumerating one set of files and a gate
 * reading another, which fails in both directions and silently.
 */
function scanOptions(options: Options, roots: string[]) {
  return {
    roots,
    ...(options.extensions.length ? { extensions: options.extensions } : {}),
    ...(options.ignore.length ? { ignore: options.ignore } : {}),
  };
}

/** `tailess emit` — write the stylesheet the plugins would have injected. */
async function runEmit(options: Options): Promise<number> {
  const roots = rootsFor(options);
  const { classes, files, sources } = await collect({
    ...scanOptions(options, roots),
    provenance: options.json,
  });

  if (files.length === 0) {
    // `check` answers this same condition in JSON; answering it in prose here left the
    // two commands' contracts disagreeing on the one exit code a CI job watches.
    if (options.json) {
      console.log(jsonResult("emit", 2, { error: "no-files", roots: shown(roots, options.cwd) }));
      return 2;
    }
    console.error(
      `[tailess] scanned no files, so there is nothing to emit. Looked in: ${roots.join(", ")}.`,
    );
    return 2;
  }

  // The candidate list itself, for anyone who has to look at what the scanner found
  // rather than at the stylesheet it wrapped them in. The documented way to answer
  // "did it see my class?" was reading escaped selectors out of the built CSS.
  if (options.json) {
    const body = jsonResult("emit", 0, {
      files: files.length,
      classes: classes.map((cls) => ({
        class: cls,
        files: shown(sources?.get(cls), options.cwd),
      })),
    });
    if (options.out === undefined) {
      console.log(body);
      return 0;
    }

    const path = isAbsolute(options.out) ? options.out : resolve(options.cwd, options.out);
    const where = relative(options.cwd, path) || path;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, "utf8");
    // An acknowledgement, in JSON. This was the one `--json` path in the whole binary
    // that answered in prose, so `emit --out … --json | jq -e .ok` failed to parse on a
    // run that exited 0 — which reads as a broken pipeline rather than a pass.
    console.log(
      jsonResult("emit", 0, { files: files.length, classes: classes.length, out: where }),
    );
    // `--json` changes *what emit produces*, not just how it prints: the file holds the
    // candidate list, not a stylesheet. Naming it `.css` and importing it is the shape
    // where that difference costs every runtime-built class its rule, silently — which is
    // the failure this package exists to prevent, so it is worth a line on stderr where
    // it cannot break the JSON on stdout.
    if (/\.css$/i.test(where)) {
      console.error(
        `[tailess] ${where} holds the candidate list because of --json, not a stylesheet — ` +
          "importing it into your CSS enumerates nothing. Drop --json to write the " +
          "stylesheet, or name the file .json.",
      );
    }
    return 0;
  }

  const css = buildPrelude(classes);
  const note =
    `[tailess] ${classes.length} runtime-built class${classes.length === 1 ? "" : "es"} ` +
    `from ${files.length} file${files.length === 1 ? "" : "s"}`;

  if (options.out === undefined) {
    // The stylesheet on stdout so it can be piped; the note on stderr so it is not
    // mixed into the thing being piped.
    console.error(`${note} to stdout.`);
    process.stdout.write(css);
    return 0;
  }

  const path = isAbsolute(options.out) ? options.out : resolve(options.cwd, options.out);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, css, "utf8");
  console.log(`${note} written to ${relative(options.cwd, path) || path}.`);
  return 0;
}

/** `tailess check` — compile the project for real and look. */
async function runCheck(options: Options): Promise<number> {
  const roots = rootsFor(options);
  const quiet = options.json;
  const say = (message: string): void => {
    if (!quiet) console.log(message);
  };
  const complain = (message: string): void => {
    if (!quiet) console.error(message);
  };
  /** Print the JSON form, if that is what was asked for, and hand back the exit code. */
  const finish = (code: number, body: Record<string, unknown>): number => {
    if (quiet) console.log(jsonResult("check", code, body));
    return code;
  };

  const entries = options.css
    ? [isAbsolute(options.css) ? options.css : resolve(options.cwd, options.css)]
    : await findEntries(roots, options.ignore);

  if (entries.length === 0) {
    complain(
      "[tailess] no Tailwind entry stylesheet found. Pass one with --css, or point " +
        "--content at the directory that holds it.",
    );
    return finish(2, { error: "no-stylesheet", roots: shown(roots, options.cwd) });
  }

  const scanned = await collect({
    ...scanOptions(options, roots),
    provenance: true,
  });
  const { classes, files, sources } = scanned;
  // The checks both plugins run over the stylesheet itself — a `@theme` that removes a
  // breakpoint, a `@custom-variant` — which a build under `diagnostics: "error"` fails
  // on. `--strict` is documented as the one gate covering both, and never ran them.
  const diagnostics = [...scanned.diagnostics];
  for (const entry of entries) {
    const css = await readFile(entry, "utf8").catch(() => undefined);
    if (css === undefined) continue;
    const theme = await collectTheme(css, entry);
    for (const found of themeDiagnostics(theme.breakpoints, theme.variants)) {
      diagnostics.push({ ...found, file: entry });
    }
  }
  // A note — a variant or breakpoint the project added, a width moved — describes CSS
  // that works, and fails nothing here any more than it does in the build.
  const failing = diagnostics.filter((d) => d.informational !== true).length;
  const asJson = diagnostics.map((d) => ({
    kind: d.kind,
    file: relative(options.cwd, d.file) || d.file,
    message: d.message,
  }));

  // A gate that cannot say "I checked nothing" is worse than no gate: a mistyped
  // --content, or a monorepo task runner in the wrong directory, would otherwise
  // print a cheerful line and exit 0 forever after.
  if (files.length === 0) {
    const glob = roots.some((path) => path.includes("*"))
      ? ' Wildcards are not expanded — pass a directory ("src") or a file, not a glob.'
      : "";
    complain(
      `[tailess] scanned no files, so there is nothing to check. Looked in: ` +
        `${roots.join(", ")}.${glob}`,
    );
    return finish(2, { error: "no-files", roots: shown(roots, options.cwd) });
  }

  // The checks the scanner can prove from the source alone. `tailess check` computed
  // them on the way past and used to drop them — and they are precisely the failures
  // compiling cannot find, since a class carrying an unusable value never reaches the
  // compiler to be found missing.
  reportDiagnostics(diagnostics, options.cwd, quiet ? "off" : "warn");

  if (classes.length === 0) {
    say(
      `[tailess] scanned ${files.length} file${files.length === 1 ? "" : "s"} and found ` +
        "no runtime-built classes — nothing to check.",
    );
    const failed = options.strict && failing > 0;
    return finish(failed ? 1 : 0, { checked: 0, files: files.length, diagnostics: asJson });
  }

  const unwired = await pluginLooksUnwired(options.cwd, roots);
  if (unwired) {
    complain(
      "[tailess] no build config here calls the plugin, so it may not be running at " +
        "all — in which case every variant class on the page is unstyled and " +
        "this check cannot see it: it scans your source itself rather than reading what " +
        'your build produced. Add tailess() to vite.config, or "tailess/postcss" to ' +
        'postcss.config before "@tailwindcss/postcss".',
    );
    if (options.strict) {
      // Nothing was compiled on this path, so `checked` has to say zero: reporting the
      // class count told a consumer reading it that a verification had happened.
      return finish(1, {
        error: "plugin-unwired",
        checked: 0,
        found: classes.length,
        diagnostics: asJson,
      });
    }
  }

  // Ask before compiling. With a Tailwind prefix every candidate fails, so the report
  // would be hundreds of classes under a heading blaming a moved breakpoint — true only
  // in the sense that everything is broken, and useless for finding out why.
  for (const entry of entries) {
    const prefix = tailwindPrefixIn(await readFile(entry, "utf8"));
    if (prefix === undefined) continue;
    complain(
      `[tailess] ${relative(options.cwd, entry) || entry} imports Tailwind with ` +
        `prefix("${prefix}"), which tailess does not support: it builds "hover:underline" ` +
        `where the working class is "${prefix}:hover:underline", so every runtime-built ` +
        "class is unstyled. There is nothing to check until the prefix is gone.",
    );
    return finish(2, {
      error: "unsupported-prefix",
      prefix,
      stylesheet: relative(options.cwd, entry) || entry,
    });
  }

  const compile = await loadCompiler(options.cwd);
  const probe = probeList(classes);

  // A class only has to work in *one* stylesheet — a project can have several, and a
  // component is styled by whichever one its page loads. So a class is broken only if
  // no entry has its rule — and only an entry that generates utilities at all has a say.
  const sheets: string[] = [];
  const silent: string[] = [];
  // Compiling runs the project's `@plugin`s in this process, and some print — daisyUI's
  // banner goes through console.log. Under --json stdout is the one JSON object, so
  // anything they say goes to stderr for as long as they run.
  await (quiet ? toStderr : (task: () => Promise<void>) => task())(async () => {
    for (const entry of entries) {
      const source = await readFile(entry, "utf8");
      const compiler = await compile(source, { base: dirname(entry), loadModule, loadStylesheet });
      const css = compiler.build([...probe, utilitySentinel]);
      if (hasRule(css, utilitySentinel)) sheets.push(css);
      else silent.push(entry);
    }
  });
  if (sheets.length === 0) {
    complain(
      `[tailess] ${shown(silent, options.cwd).join(", ")} ` +
        `${silent.length === 1 ? "generates" : "generate"} no Tailwind utilities — not even ` +
        `"${utilitySentinel}" — so there is nothing to check against. Point --css at the ` +
        "stylesheet that imports Tailwind for the app; if it does, look for a prefix(…) in " +
        "one of the files it imports.",
    );
    return finish(2, { error: "no-utilities", stylesheets: shown(silent, options.cwd) });
  }
  const broken = findBrokenAcross(classes, sheets);

  const brokenJson = broken.map((b) => ({
    class: b.candidate,
    utility: b.utility,
    files: shown(sources?.get(b.candidate), options.cwd),
  }));
  const summary = {
    checked: classes.length,
    files: files.length,
    stylesheets: shown(entries, options.cwd),
    broken: brokenJson,
    diagnostics: asJson,
    ...(unwired ? { warning: "plugin-unwired" } : {}),
  };

  if (broken.length === 0) {
    say(
      `[tailess] ${classes.length} runtime-built classes checked against ` +
        `${entries.length} stylesheet${entries.length === 1 ? "" : "s"} — every one has CSS.`,
    );
    if (options.strict && failing > 0) {
      complain(
        `\n[tailess] --strict: ${failing} build-time ` +
          `diagnostic${failing === 1 ? "" : "s"} above.`,
      );
      return finish(1, summary);
    }
    return finish(0, summary);
  }

  complain(
    `[tailess] ${broken.length} of ${classes.length} runtime-built classes reach the ` +
      "element with no rule behind them:\n",
  );
  // `--max 0` means all of them: on a `@theme` that moved a breakpoint the list is the
  // whole project, and truncating it is what sends the reader to grep instead.
  const listed = options.max > 0 ? broken.slice(0, options.max) : broken;
  for (const { candidate, utility } of listed) {
    const where = shown(sources?.get(candidate), options.cwd);
    complain(
      `  ${candidate}\n` +
        (where.length ? `    ${where.join(", ")}\n` : "") +
        `    "${utility}" resolves on its own, so the variant is what fails.`,
    );
  }
  if (listed.length < broken.length) {
    complain(`  …and ${broken.length - listed.length} more. Pass --max 0 to list them all.`);
  }
  complain(
    "\nUsually a @theme that moved a breakpoint, a variant your CSS redefines, or an " +
      "arbitrary value Tailwind rejects.",
  );
  return finish(1, summary);
}

export async function run(options: Options): Promise<number> {
  if (options.command === "emit") return runEmit(options);
  if (options.command === "doctor") return runDoctor(options.cwd, options.json);
  if (options.command === "init") return runInit(options.cwd, options.write, options.json);
  return runCheck(options);
}
