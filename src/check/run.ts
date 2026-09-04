/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { collect } from "../extract/collect.js";
import { type BrokenClass, findBroken, probeList } from "./verify.js";
import { isTailwindEntry } from "../integration/entry.js";

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
}

export function parse(argv: readonly string[]): Options | "help" {
  const content: string[] = [];
  let css: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return "help";
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

  return { content, css, cwd: process.cwd() };
}

export const help = `tailess check — prove every class tailess builds has CSS behind it.

  npx tailess check [--content <dir>]... [--css <file>]

  --content <dir>   where your source lives. Repeatable. Defaults to the working
                    directory.
  --css <file>      your Tailwind entry stylesheet. Found automatically when it is
                    inside a --content root.

Exits 1 when a class the runtime can build has no rule, so it can gate a build.`;

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
    if (resolved !== undefined && resolved.endsWith(".css")) {
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

/** The slice of Tailwind's own API this needs, so no dependency on it is declared. */
type Compile = (
  css: string,
  options: { base: string; loadStylesheet: typeof loadStylesheet },
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
  const mod = (await import(`file://${entry.replace(/\\/g, "/")}`)) as {
    compile?: unknown;
    default?: { compile?: unknown };
  };
  const compile = mod.compile ?? mod.default?.compile;
  if (typeof compile !== "function") {
    throw new Error("this copy of tailwindcss has no compile() — v4 is required");
  }
  return compile as Compile;
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

  const { classes } = await collect({ roots });
  if (classes.length === 0) {
    console.log("[tailess] no runtime-built classes found — nothing to check.");
    return 0;
  }

  const compile = await loadCompiler(options.cwd);
  const probe = probeList(classes);

  // A class only has to work in *one* stylesheet — a project can have several, and a
  // component is styled by whichever one its page loads. So a class is broken only if
  // every entry fails it.
  const perEntry: Array<Map<string, BrokenClass>> = [];
  for (const entry of entries) {
    const source = await readFile(entry, "utf8");
    const compiler = await compile(source, { base: dirname(entry), loadStylesheet });
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
    return 0;
  }

  console.error(
    `[tailess] ${broken.length} of ${classes.length} runtime-built classes reach the ` +
      "element with no rule behind them:\n",
  );
  for (const { candidate, utility } of broken.slice(0, 20)) {
    console.error(`  ${candidate}\n    "${utility}" resolves on its own, so the variant is what fails.`);
  }
  if (broken.length > 20) console.error(`  …and ${broken.length - 20} more.`);
  console.error(
    "\nUsually a @theme that moved a breakpoint, a variant your CSS redefines, or an " +
      "arbitrary value Tailwind rejects.",
  );
  return 1;
}
