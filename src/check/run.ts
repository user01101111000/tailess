/// <reference types="node" />
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collect } from "../extract/collect.js";
import { isTailwindEntry, tailwindPrefixIn } from "../integration/entry.js";
import { reportDiagnostics } from "../integration/report.js";
import { type BrokenClass, findBroken, probeList } from "./verify.js";

/**
 * `tailess check` — compile the project for real and prove every class the runtime
 * can build has a rule behind it.
 *
 * The plugins guarantee the *bridge*: the scanner enumerates what the runtime builds
 * and hands the list to Tailwind. Nothing until now proved the far end. This does,
 * which is why it exits non-zero: it is meant to be a gate, not a warning.
 */

export interface Options {
  content: string[];
  css: string | undefined;
  cwd: string;
  /** Make the build-time diagnostics fail the gate too, not just print. */
  strict: boolean;
}

export function parse(argv: readonly string[]): Options | "help" {
  const content: string[] = [];
  let css: string | undefined;
  let strict = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return "help";
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--content" || arg === "--css") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${arg} needs a path`);
      }
      if (arg === "--content") content.push(value);
      else css = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown option ${arg}`);
  }

  return { content, css, cwd: process.cwd(), strict };
}

export const help = `tailess check — prove every class tailess builds has CSS behind it.

  npx tailess check [--content <dir>]... [--css <file>] [--strict]

  --content <dir>   where your source lives. Repeatable. Defaults to the working
                    directory.
  --css <file>      your Tailwind entry stylesheet. Found automatically when it is
                    inside a --content root.
  --strict          also fail on the build-time diagnostics, which are otherwise
                    printed and do not affect the exit code.

Exit codes:
  0  every runtime-built class has a rule (or the scan found no tailess calls)
  1  a class reaches the element with no rule behind it
  2  nothing could be checked — no stylesheet, no files scanned, or a bad option`;

/**
 * Resolve an `@import` the way a bundler would.
 *
 * A bare package root resolves to JavaScript, not CSS — `require.resolve("tailwindcss")`
 * hands back `dist/lib.js` — so the package's `style` condition is what to follow. A
 * subpath (`tailwindcss/theme.css`) resolves directly.
 */
async function loadStylesheet(id: string, base: string) {
  let path: string;
  if (id.startsWith(".") || isAbsolute(id)) {
    path = resolve(base, id);
  } else {
    const req = createRequire(join(base, "_"));
    let resolved: string | undefined;
    try {
      resolved = req.resolve(id);
    } catch {
      resolved = undefined;
    }
    if (resolved?.endsWith(".css")) {
      path = resolved;
    } else {
      const pkgPath = req.resolve(`${id.split("/")[0]}/package.json`);
      const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
        exports?: { "."?: { style?: string } };
        style?: string;
      };
      path = resolve(dirname(pkgPath), pkg.exports?.["."]?.style ?? pkg.style ?? "index.css");
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

/** The slice of Tailwind's own API this needs, so no dependency on it is declared. */
type Compile = (
  css: string,
  options: {
    base: string;
    loadModule: typeof loadModule;
    loadStylesheet: typeof loadStylesheet;
  },
) => Promise<{ build(candidates: string[]): string }>;

/**
 * Load Tailwind from the project being checked, not from tailess' own tree.
 *
 * `tailwindcss` is the host's, exactly as it is for the plugins — resolving it from
 * here would check tailess' devDependency against the consumer's source.
 */
async function loadCompiler(cwd: string): Promise<Compile> {
  const req = createRequire(join(cwd, "_"));
  let entry: string;
  try {
    entry = req.resolve("tailwindcss");
  } catch {
    throw new Error("tailwindcss is not installed here, so there is nothing to compile against");
  }
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

/** A config file a build tool would read from the project root. */
const configFile = /^(?:\..*rc(?:\..*)?|.*\.config\.[cm]?[jt]sx?|.*\.config\.json|package\.json)$/;

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
 */
async function pluginLooksUnwired(cwd: string): Promise<boolean> {
  const entries = await readdir(cwd, { withFileTypes: true }).catch(() => []);
  let sawConfig = false;
  for (const entry of entries) {
    if (!entry.isFile() || !configFile.test(entry.name)) continue;
    const text = await readFile(join(cwd, entry.name), "utf8").catch(() => "");

    // `package.json` names tailess in `dependencies` for every consumer, which proves
    // installation and nothing about wiring. Only its `postcss` key — the one place a
    // build config can actually live in there — counts as evidence.
    if (entry.name === "package.json") {
      let postcss: unknown;
      try {
        postcss = (JSON.parse(text) as { postcss?: unknown }).postcss;
      } catch {
        continue;
      }
      if (postcss === undefined) continue;
      sawConfig = true;
      if (JSON.stringify(postcss).includes("tailess")) return false;
      continue;
    }

    sawConfig = true;
    if (text.includes("tailess")) return false;
  }
  // No config at all means this is not a project root worth guessing about.
  return sawConfig;
}

/** Every Tailwind entry stylesheet under `roots`. */
async function findEntries(roots: string[]): Promise<string[]> {
  const { files } = await collect({ roots, extensions: ["css"] });
  const entries: string[] = [];
  for (const file of files) {
    const css = await readFile(file, "utf8").catch(() => undefined);
    if (css !== undefined && (await isTailwindEntry(css, file))) entries.push(file);
  }
  return entries;
}

export async function run(options: Options): Promise<number> {
  const roots = options.content.length
    ? options.content.map((path) => (isAbsolute(path) ? path : resolve(options.cwd, path)))
    : [options.cwd];

  const entries = options.css
    ? [isAbsolute(options.css) ? options.css : resolve(options.cwd, options.css)]
    : await findEntries(roots);

  if (entries.length === 0) {
    console.error(
      "[tailess] no Tailwind entry stylesheet found. Pass one with --css, or point " +
        "--content at the directory that holds it.",
    );
    return 2;
  }

  const { classes, files, diagnostics } = await collect({ roots });

  // A gate that cannot say "I checked nothing" is worse than no gate: a mistyped
  // --content, or a monorepo task runner in the wrong directory, would otherwise
  // print a cheerful line and exit 0 forever after.
  if (files.length === 0) {
    const glob = roots.some((path) => path.includes("*"))
      ? ' Wildcards are not expanded — pass a directory ("src") or a file, not a glob.'
      : "";
    console.error(
      `[tailess] scanned no files, so there is nothing to check. Looked in: ` +
        `${roots.join(", ")}.${glob}`,
    );
    return 2;
  }

  // The six checks the scanner can prove from the source alone. `tailess check`
  // computed them on the way past and used to drop them — and they are precisely the
  // failures compiling cannot find, since a class carrying an unusable value never
  // reaches the compiler to be found missing.
  reportDiagnostics(diagnostics, options.cwd);

  if (classes.length === 0) {
    console.log(
      `[tailess] scanned ${files.length} file${files.length === 1 ? "" : "s"} and found ` +
        "no runtime-built classes — nothing to check.",
    );
    return options.strict && diagnostics.length > 0 ? 1 : 0;
  }

  if (await pluginLooksUnwired(options.cwd)) {
    console.warn(
      "[tailess] no build config here mentions tailess, so the plugin may not be " +
        "running at all — in which case every variant class on the page is unstyled and " +
        "this check cannot see it: it scans your source itself rather than reading what " +
        'your build produced. Add tailess() to vite.config, or "tailess/postcss" to ' +
        'postcss.config before "@tailwindcss/postcss".',
    );
    if (options.strict) return 1;
  }

  // Ask before compiling. With a Tailwind prefix every candidate fails, so the report
  // would be hundreds of classes under a heading blaming a moved breakpoint — true only
  // in the sense that everything is broken, and useless for finding out why.
  for (const entry of entries) {
    const prefix = tailwindPrefixIn(await readFile(entry, "utf8"));
    if (prefix === undefined) continue;
    console.error(
      `[tailess] ${relative(options.cwd, entry) || entry} imports Tailwind with ` +
        `prefix("${prefix}"), which tailess does not support: it builds "hover:underline" ` +
        `where the working class is "${prefix}:hover:underline", so every runtime-built ` +
        "class is unstyled. There is nothing to check until the prefix is gone.",
    );
    return 2;
  }

  const compile = await loadCompiler(options.cwd);
  const probe = probeList(classes);

  // A class only has to work in *one* stylesheet — a project can have several, and a
  // component is styled by whichever one its page loads. So a class is broken only if
  // every entry fails it.
  const perEntry: Array<Map<string, BrokenClass>> = [];
  for (const entry of entries) {
    const source = await readFile(entry, "utf8");
    const compiler = await compile(source, { base: dirname(entry), loadModule, loadStylesheet });
    const css = compiler.build(probe);
    perEntry.push(new Map(findBroken(classes, css).map((b) => [b.candidate, b])));
  }
  const broken = [...(perEntry[0]?.values() ?? [])].filter((b) =>
    perEntry.every((entry) => entry.has(b.candidate)),
  );

  if (broken.length === 0) {
    console.log(
      `[tailess] ${classes.length} runtime-built classes checked against ` +
        `${entries.length} stylesheet${entries.length === 1 ? "" : "s"} — every one has CSS.`,
    );
    if (options.strict && diagnostics.length > 0) {
      console.error(
        `\n[tailess] --strict: ${diagnostics.length} build-time ` +
          `diagnostic${diagnostics.length === 1 ? "" : "s"} above.`,
      );
      return 1;
    }
    return 0;
  }

  console.error(
    `[tailess] ${broken.length} of ${classes.length} runtime-built classes reach the ` +
      "element with no rule behind them:\n",
  );
  for (const { candidate, utility } of broken.slice(0, 20)) {
    console.error(
      `  ${candidate}\n    "${utility}" resolves on its own, so the variant is what fails.`,
    );
  }
  if (broken.length > 20) console.error(`  …and ${broken.length - 20} more.`);
  console.error(
    "\nUsually a @theme that moved a breakpoint, a variant your CSS redefines, or an " +
      "arbitrary value Tailwind rejects.",
  );
  return 1;
}
