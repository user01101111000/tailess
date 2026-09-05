/// <reference types="node" />
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

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
 */
export function wired(text: string): boolean {
  if (/["']tailess\/postcss["']/.test(text)) return true;
  const name = esmImport.exec(text)?.[1] ?? cjsImport.exec(text)?.[1] ?? "tailess";
  return new RegExp(`\\b${name}\\s*\\(`).test(text);
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

/** The `plugins: [...]` array in a Vite config, with tailess added to the front. */
const vitePlugins = /(\bplugins\s*:\s*\[)/;

/**
 * The edit that wires the plugin in, or `null` when it cannot be written safely.
 *
 * Deliberately narrow: it inserts into a `plugins: [` array and a `plugins: {` object,
 * and gives up on anything else rather than guessing at a config it does not recognise.
 * A wrong edit to a build config is worse than no edit, and `doctor` still says what to
 * do by hand.
 */
export function planEdit(host: Host): Edit | null {
  if (host.kind === "unknown" || wired(host.source)) return null;

  if (host.kind === "vite") {
    if (!vitePlugins.test(host.source)) return null;
    const withImport = /^import\s/m.test(host.source)
      ? host.source.replace(/^(import\s[^\n]*\n)/, '$1import tailess from "tailess/vite";\n')
      : `import tailess from "tailess/vite";\n${host.source}`;
    return {
      file: host.file,
      before: host.source,
      after: withImport.replace(vitePlugins, "$1tailess(), "),
    };
  }

  // PostCSS: order matters, so tailess goes first — it has to write the candidate list
  // before Tailwind reads it.
  const pluginsObject = /(\bplugins\s*:\s*\{)/;
  if (pluginsObject.test(host.source)) {
    return {
      file: host.file,
      before: host.source,
      after: host.source.replace(pluginsObject, '$1\n    "tailess/postcss": {},'),
    };
  }
  const pluginsArray = /(\bplugins\s*:\s*\[)/;
  if (pluginsArray.test(host.source)) {
    return {
      file: host.file,
      before: host.source,
      after: host.source.replace(pluginsArray, '$1"tailess/postcss", '),
    };
  }
  return null;
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

/** `tailess doctor` — read the project and say what it needs. */
export async function runDoctor(cwd: string): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;

  if (host.kind === "unknown") {
    console.error(
      "[tailess] no vite.config or postcss.config here, so there is nothing to wire the " +
        "plugin into. Run this from the directory that holds your build config — in a " +
        "monorepo that is the app, not the root.",
    );
    return 2;
  }

  if (wired(host.source)) {
    console.log(`[tailess] ${where(host.file)} calls the plugin. Nothing to do.`);
    return 0;
  }

  const plan = planEdit(host);
  console.error(
    `[tailess] ${where(host.file)} does not call the plugin, so no variant class on the ` +
      "page has CSS behind it — and nothing else reports that: the build succeeds and the " +
      "class attributes are correct.",
  );
  console.error(
    plan
      ? "\nRun `npx tailess init` to add it, or add it by hand:"
      : "\nThis config is not one `tailess init` can edit safely. Add it by hand:",
  );
  console.error(
    host.kind === "vite"
      ? '\n  import tailess from "tailess/vite";\n  plugins: [tailwindcss(), tailess()]'
      : '\n  plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} }' +
          "\n\ntailess must come first: it writes the candidate list Tailwind then reads.",
  );
  return 1;
}

/** `tailess init` — write that edit, after showing it. */
export async function runInit(cwd: string, write: boolean): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;

  if (host.kind === "unknown") {
    console.error(
      "[tailess] no vite.config or postcss.config here. Create the one your build uses " +
        "first — there is nothing to add the plugin to.",
    );
    return 2;
  }

  if (wired(host.source)) {
    console.log(`[tailess] ${where(host.file)} already calls the plugin. Nothing to do.`);
    return 0;
  }

  const plan = planEdit(host);
  if (!plan) {
    console.error(
      `[tailess] ${where(host.file)} has no plugins list this can edit safely, so nothing ` +
        "was written. `npx tailess doctor` prints the line to add.",
    );
    return 2;
  }

  console.log(`[tailess] ${where(plan.file)}\n\n${diffOf(plan)}\n`);
  if (!write) {
    console.log("[tailess] nothing written. Re-run with --write to apply it.");
    return 0;
  }

  await writeFile(plan.file, plan.after, "utf8");
  console.log(`[tailess] wrote ${where(plan.file)}. Restart your dev server.`);
  return 0;
}
