/// <reference types="node" />
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { maskLiterals } from "../extract/scan.js";
import { jsonResult } from "./result.js";

/**
 * `tailess init` and `tailess doctor` — the two commands that exist because setup is
 * the one failure nothing else can catch.
 *
 * Wiring the plugin is four hand-edited variants across two config shapes, ordering
 * matters in one of them, and getting it wrong produces no build error at all: the
 * classes reach the element and no rule is generated, which is discovered in a browser
 * rather than in CI. `doctor` reads the project and says which one it needs and whether
 * it has it; `init` writes that edit, after showing it.
 */

/** How this project gets Tailwind, which decides which plugin it needs. */
export type Host =
  | { kind: "vite"; file: string; source: string }
  | { kind: "postcss"; file: string; source: string }
  | { kind: "unknown" };

const viteConfig = /^vite\.config\.[cm]?[jt]s$/;
const postcssConfig = /^postcss\.config\.[cm]?[jt]s$/;
/** A `postcss.config.json` or a `.postcssrc`, which are data rather than code. */
const postcssData = /^(?:\.postcssrc(?:\.json)?|postcss\.config\.json)$/;

/** `import tailess from "tailess/vite"` — the name is what the plugin is called here. */
const esmImport = /import\s+(\w+)\s*(?:,[^\n]*?)?\s+from\s*["']tailess\/vite["']/;
/** `const tailess = require("tailess/vite")` — the same, with the name on the other side. */
const cjsImport = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["']tailess\/vite["']/;

/**
 * True when `text` wires tailess in, rather than merely naming it.
 *
 * The Vite plugin has to be *called*: deleting `tailess()` from the `plugins` array and
 * leaving the import behind is exactly the shape this exists to catch, and reading for
 * the word alone would have called that wired. The import is read only to learn what the
 * plugin was bound to, so an aliased one is not a false alarm. The PostCSS form is a
 * string in a config rather than a call, so naming it *is* wiring it.
 *
 * Read against {@link maskLiterals} rather than the raw text, because the same deletion
 * that leaves an import behind leaves a comment behind — `// we removed tailess()` — and
 * matching that reports a genuinely unwired project as wired. This is the one failure
 * that unstyles a whole application with no build error, so the check that catches it
 * must not be readable by prose.
 */
export function wired(text: string): boolean {
  const code = maskLiterals(text);
  if (/["']tailess\/postcss["']/.test(code)) return true;
  const name = esmImport.exec(code)?.[1] ?? cjsImport.exec(code)?.[1] ?? "tailess";
  return new RegExp(`\\b${name}\\s*\\(`).test(code);
}

/**
 * Which integration this project needs.
 *
 * A `vite.config` means `@tailwindcss/vite`, and the Vite plugin. A `postcss.config`
 * means the PostCSS one — including Next.js, which is the most common case of all and
 * has no Vite config to find. When both exist, Vite wins: a Vite project with a
 * `postcss.config` still compiles its CSS through Vite.
 */
export async function findHost(cwd: string): Promise<Host> {
  const names = await readdir(cwd).catch(() => [] as string[]);
  const read = async (name: string) => ({
    file: join(cwd, name),
    source: await readFile(join(cwd, name), "utf8").catch(() => ""),
  });

  const vite = names.find((name) => viteConfig.test(name));
  if (vite) return { kind: "vite", ...(await read(vite)) };

  const postcss = names.find((name) => postcssConfig.test(name) || postcssData.test(name));
  if (postcss) return { kind: "postcss", ...(await read(postcss)) };

  return { kind: "unknown" };
}

/** What `init` would write, or `null` when there is nothing to change. */
export interface Edit {
  file: string;
  before: string;
  after: string;
}

/** The `plugins: [...]` array a plugin is added to the front of. */
const pluginsArray = /\bplugins\s*:\s*\[/;
/** The `plugins: { ... }` object a PostCSS plugin is added to the front of. */
const pluginsObject = /\bplugins\s*:\s*\{/;

/**
 * A whole top-level `import` statement, through its module specifier.
 *
 * Anchored to the start of a line and run through the specifier rather than to the first
 * newline, because a multi-line import is what a formatter produces past its print width
 * and stopping at the newline puts the next import *inside* the braces. `import(` and
 * `import.meta` are excluded: those are expressions, and can be anywhere.
 */
const topLevelImport = /^[ \t]*import\b(?!\s*[.(])[^;]*?["'][^"'\n]*["'][ \t]*;?/gm;

/**
 * The one place `pattern` matches, or `null` when it matches anywhere but exactly once.
 *
 * Two candidates is an ambiguity, and this command gives up on those. `css.postcss.plugins`
 * is a documented Vite option that can legitimately precede the top-level `plugins` array,
 * and a non-global `String.replace` takes the first match — which writes the Vite plugin
 * into the PostCSS list and leaves the array that matters untouched, after saying it
 * succeeded.
 */
function soleMatch(masked: string, pattern: RegExp): RegExpMatchArray | null {
  const all = [...masked.matchAll(new RegExp(pattern.source, "g"))];
  return all.length === 1 ? (all[0] as RegExpMatchArray) : null;
}

/** How many times `pattern` occurs in `masked`. */
function countOf(masked: string, pattern: RegExp): number {
  return [...masked.matchAll(new RegExp(pattern.source, "g"))].length;
}

/** Splice `text` into `source` at `at`. */
function insertAt(source: string, at: number, text: string): string {
  return source.slice(0, at) + text + source.slice(at);
}

/** True when the list opened just before `at` is empty, so the entry needs no separator. */
function listIsEmpty(masked: string, at: number, close: string): boolean {
  return masked.slice(at).trimStart().startsWith(close);
}

/**
 * Where a new top-level import can go: after the last existing one, or — when there is
 * none — in front of the first real token, which leaves a leading comment or a
 * `/// <reference>` where it has to stay.
 */
function importInsertPoint(masked: string): number {
  let end = -1;
  for (const match of masked.matchAll(topLevelImport)) end = (match.index ?? 0) + match[0].length;
  if (end !== -1) return end;
  const firstToken = masked.search(/\S/);
  return firstToken === -1 ? masked.length : firstToken;
}

/**
 * The edit that wires the plugin in, or `null` when it cannot be written safely.
 *
 * Deliberately narrow: it inserts into a `plugins: [` array and a `plugins: {` object,
 * and gives up on anything else rather than guessing at a config it does not recognise.
 * A wrong edit to a build config is worse than no edit, and `doctor` still says what to
 * do by hand.
 *
 * Every position is found in {@link maskLiterals} of the source and spliced into the raw
 * text at that index, so a `plugins: [` inside a comment is neither edited nor counted.
 * The result is then read back with {@link wired}: an edit that does not actually wire
 * the plugin in is not returned at all, however plausible its diff looks.
 */
export function planEdit(host: Host): Edit | null {
  if (host.kind === "unknown" || wired(host.source)) return null;

  const masked = maskLiterals(host.source);
  // Match the file rather than forcing `\n` into it: a CRLF config edited with a bare
  // newline is left with mixed line endings, which every diff downstream then shows.
  const eol = host.source.includes("\r\n") ? "\r\n" : "\n";
  let after: string;

  if (host.kind === "vite") {
    const list = soleMatch(masked, pluginsArray);
    if (!list) return null;

    const importAt = importInsertPoint(masked);
    const statement = 'import tailess from "tailess/vite";';
    // Leading, when nothing but trivia precedes the insertion point; trailing otherwise,
    // so the new line follows the import it is placed after rather than splitting it.
    const importText =
      masked.slice(0, importAt).trim() === "" ? `${statement}${eol}` : `${eol}${statement}`;

    // Later position first, so the earlier index is still valid when it is used.
    const listAt = (list.index ?? 0) + list[0].length;
    after = insertAt(
      host.source,
      listAt,
      listIsEmpty(masked, listAt, "]") ? "tailess()" : "tailess(), ",
    );
    after = insertAt(after, importAt, importText);
  } else {
    // PostCSS: order matters, so tailess goes first — it has to write the candidate list
    // before Tailwind reads it.
    const objects = countOf(masked, pluginsObject);
    if (objects > 1) return null;
    const object = objects === 1 ? soleMatch(masked, pluginsObject) : null;
    const at = object ?? soleMatch(masked, pluginsArray);
    if (!at) return null;
    const listAt = (at.index ?? 0) + at[0].length;
    const empty = listIsEmpty(masked, listAt, object ? "}" : "]");
    after = insertAt(
      host.source,
      listAt,
      object
        ? `${eol}    "tailess/postcss": {}${empty ? "" : ","}`
        : `"tailess/postcss"${empty ? "" : ", "}`,
    );
  }

  // The point of the command is a config that works afterwards. Anything less is a hand
  // edit `doctor` describes, not a file this writes.
  if (!wired(after)) return null;
  if (host.kind === "vite" && !esmImport.test(maskLiterals(after))) return null;

  return { file: host.file, before: host.source, after };
}

/**
 * The lines that change, for showing before writing.
 *
 * A longest-common-subsequence walk rather than a running index: a *modified* line
 * throws the two sides out of step, and a naive comparison then reports every line
 * after it as new. Showing a wrong diff and then editing someone's build config on the
 * strength of it is worse than not offering the command.
 */
export function diffOf(edit: Edit): string {
  const before = edit.before.split("\n");
  const after = edit.after.split("\n");

  // lengths[i][j] = length of the LCS of before[i..] and after[j..].
  const lengths: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      (lengths[i] as number[])[j] =
        before[i] === after[j]
          ? ((lengths[i + 1] as number[])[j + 1] as number) + 1
          : Math.max(
              (lengths[i + 1] as number[])[j] as number,
              (lengths[i] as number[])[j + 1] as number,
            );
    }
  }

  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      i += 1;
      j += 1;
    } else if (
      ((lengths[i + 1] as number[])[j] as number) >= ((lengths[i] as number[])[j + 1] as number)
    ) {
      lines.push(`- ${before[i]}`);
      i += 1;
    } else {
      lines.push(`+ ${after[j]}`);
      j += 1;
    }
  }
  while (i < before.length) lines.push(`- ${before[i++]}`);
  while (j < after.length) lines.push(`+ ${after[j++]}`);
  return lines.join("\n");
}

/**
 * `tailess doctor` — read the project and say what it needs.
 *
 * `json` is honoured here for the same reason it is on `check`: `--help` lists it in the
 * shared option block and annotates the command-scoped flags, so its silence on the other
 * two read as "applies to all four" — and a CI job wiring `doctor --json` got prose on
 * stderr and an empty stdout, with nothing saying the flag had been ignored.
 */
export async function runDoctor(cwd: string, json = false): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;
  const say = (message: string, error = false) => {
    if (json) return;
    if (error) console.error(message);
    else console.log(message);
  };
  const done = (code: number, body: Record<string, unknown>): number => {
    if (json) console.log(jsonResult("doctor", code, body));
    return code;
  };

  if (host.kind === "unknown") {
    say(
      "[tailess] no vite.config or postcss.config here, so there is nothing to wire the " +
        "plugin into. Run this from the directory that holds your build config — in a " +
        "monorepo that is the app, not the root.",
      true,
    );
    return done(2, { error: "no-config" });
  }

  if (wired(host.source)) {
    say(`[tailess] ${where(host.file)} calls the plugin. Nothing to do.`);
    return done(0, { host: host.kind, file: where(host.file), wired: true });
  }

  const plan = planEdit(host);
  say(
    `[tailess] ${where(host.file)} does not call the plugin, so no variant class on the ` +
      "page has CSS behind it — and nothing else reports that: the build succeeds and the " +
      "class attributes are correct.",
    true,
  );
  say(
    plan
      ? "\nRun `npx tailess init` to add it, or add it by hand:"
      : "\nThis config is not one `tailess init` can edit safely. Add it by hand:",
    true,
  );
  say(
    host.kind === "vite"
      ? '\n  import tailess from "tailess/vite";\n  plugins: [tailwindcss(), tailess()]'
      : '\n  plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} }' +
          "\n\ntailess must come first: it writes the candidate list Tailwind then reads.",
    true,
  );
  return done(1, {
    host: host.kind,
    file: where(host.file),
    wired: false,
    fixable: plan !== null,
  });
}

/** `tailess init` — write that edit, after showing it. */
export async function runInit(cwd: string, write: boolean, json = false): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;
  const say = (message: string, error = false) => {
    if (json) return;
    if (error) console.error(message);
    else console.log(message);
  };
  const done = (code: number, body: Record<string, unknown>): number => {
    if (json) console.log(jsonResult("init", code, body));
    return code;
  };

  if (host.kind === "unknown") {
    say(
      "[tailess] no vite.config or postcss.config here. Create the one your build uses " +
        "first — there is nothing to add the plugin to.",
      true,
    );
    return done(2, { error: "no-config" });
  }

  if (wired(host.source)) {
    say(`[tailess] ${where(host.file)} already calls the plugin. Nothing to do.`);
    return done(0, { file: where(host.file), wired: true, written: false });
  }

  const plan = planEdit(host);
  if (!plan) {
    say(
      `[tailess] ${where(host.file)} has no plugins list this can edit safely, so nothing ` +
        "was written. `npx tailess doctor` prints the line to add.",
      true,
    );
    return done(2, { error: "not-editable", file: where(host.file) });
  }

  say(`[tailess] ${where(plan.file)}\n\n${diffOf(plan)}\n`);
  if (!write) {
    say("[tailess] nothing written. Re-run with --write to apply it.");
    return done(0, { file: where(plan.file), written: false, diff: diffOf(plan) });
  }

  await writeFile(plan.file, plan.after, "utf8");
  say(`[tailess] wrote ${where(plan.file)}. Restart your dev server.`);
  return done(0, { file: where(plan.file), written: true, diff: diffOf(plan) });
}
