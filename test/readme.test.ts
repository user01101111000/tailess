import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  containerKeys,
  maxContainerKeys,
  maxScreenKeys,
  screenKeys,
  stateKeys,
} from "../src/constants.js";

/**
 * The README's numbers, held to the ones the package actually ships.
 *
 * They are hand-maintained in five places — a badge, two sentences and a table with a
 * per-family count on every row — and nothing checked any of them. The docs site shows
 * exactly what that drift looks like in production: it still says the package has 149
 * keys, two minors after it stopped being true. A wrong count is the third thing a
 * reader sees, so it is worth a test.
 */

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

/** Every key `ss` accepts, `base` included. */
const total =
  1 +
  screenKeys.length +
  maxScreenKeys.length +
  containerKeys.length +
  maxContainerKeys.length +
  stateKeys.length;

/** The rows of the Keys table, as `[label, count]`. */
function keyTableRows(): Array<[string, number]> {
  const table = readme.slice(readme.indexOf("| Group | # | Keys |"));
  const rows: Array<[string, number]> = [];
  for (const line of table.split("\n")) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").map((cell) => cell.trim());
    const count = Number(cells[2]);
    if (Number.isInteger(count)) rows.push([cells[1] as string, count]);
  }
  return rows;
}

describe("the Keys table", () => {
  it("adds up to the number of keys that exist", () => {
    const rows = keyTableRows();
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.reduce((sum, [, count]) => sum + count, 0)).toBe(total);
  });

  it("counts the compound families the way they are derived", () => {
    // `group-*`, `peer-*` and `has-*` are unambiguous prefixes, so they can be counted
    // straight off the key list.
    const counted = (prefix: string) => stateKeys.filter((key) => key.startsWith(prefix)).length;
    const rows = new Map(keyTableRows());
    expect(rows.get("`group-*`")).toBe(counted("group-"));
    expect(rows.get("`peer-*`")).toBe(counted("peer-"));
    expect(rows.get("`has-*`")).toBe(counted("has-"));
    expect(rows.get("`not-*`")).toBe(counted("not-"));
    // `in-*` cannot be counted that way — `in-range` is a form state, not a compound —
    // but it is built from the same list as `group-*`, so it has the same size.
    expect(rows.get("`in-*`")).toBe(counted("group-"));
  });

  it("agrees with the breakpoint and container rows", () => {
    const rows = new Map(keyTableRows());
    expect(rows.get("Breakpoints")).toBe(screenKeys.length);
    expect(rows.get("Max-width ranges")).toBe(maxScreenKeys.length);
    expect(rows.get("Container queries")).toBe(containerKeys.length);
    expect(rows.get("Container ranges")).toBe(maxContainerKeys.length);
    expect(rows.get("`base`")).toBe(1);
  });
});

describe("every count written into the prose", () => {
  it("says the number that is true, in the badge and in the text", () => {
    // The badge is the third thing on the page, so a wrong number there is the first
    // impression the package makes.
    expect(readme).toContain(`typed_keys-${total}-`);
    expect(readme).toContain(`${total} keys, every one verified`);
    expect(readme).toContain(`**${total} in total**`);
    expect(readme).toContain(`The same ${total} are available`);
  });

  it("mentions no other key count anywhere", () => {
    // Catches the half-updated edit: one place changed, four left behind.
    const others = [...readme.matchAll(/\b(\d{3}) (?:keys|typed keys|in total)\b/g)]
      .map((match) => Number(match[1]))
      .filter((count) => count !== total);
    expect(others).toEqual([]);
  });

  it("says how many build-time checks there are, and is right", async () => {
    // The headline number for the package's central feature, and it was hand-maintained
    // in three published places — README, llms.txt and a changeset — while the source of
    // truth is a union in `diagnose.ts`. It had drifted to eleven. Counting one kind as
    // one check is the convention `main` set.
    const source = await readFile(new URL("../src/extract/diagnose.ts", import.meta.url), "utf8");
    const union = source.match(/\n {2}kind:([\s\S]*?);\n/);
    expect(union).not.toBeNull();
    const kinds = new Set([...(union?.[1] ?? "").matchAll(/\|\s*"([a-z-]+)"/g)].map((m) => m[1]));
    expect(kinds.size).toBeGreaterThan(5);

    const spelled = [
      "Zero",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
    ];
    expect(readme).toContain(`${spelled[kinds.size]} things are checked:`);

    const llms = await readFile(new URL("../llms.txt", import.meta.url), "utf8");
    expect(llms).toContain(`reports ${(spelled[kinds.size] ?? "").toLowerCase()} things`);
  });
});

describe("the other numbers in the prose", () => {
  it("quotes the benchmark table's ss() figure in the feature list", () => {
    // The feature list said ~385 ns — a stale figure from the docs site — while the
    // Performance table, which `npm run bench` reproduces, said ~244 ns.
    const table = readme.match(/\| `ss\(\)` with 3 groups \| ~(\d+) ns \|/);
    expect(table).not.toBeNull();
    expect(readme).toContain(`\`ss()\` with three groups costs ~${table?.[1]} ns`);
    expect([...readme.matchAll(/~(\d+) ns/g)].map((m) => m[0])).not.toContain("~385 ns");
  });

  it("spells the default extension count as the list has it", async () => {
    const { defaultExtensions } = await import("../src/extract/collect.js");
    const spelled = ["twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
    const word = spelled[defaultExtensions.length - 12];
    expect(word).toBeDefined();
    expect(readme).toContain(`gate reading ${word}`);
  });

  it("puts the same classes on both sides of the intro's before and after", async () => {
    // The "one call" rewrite added a dark:hover class the "wrapper" version never had.
    const { cn, ss } = await import("../src/index.js");
    const block = readme.slice(
      readme.indexOf("// ❌ a wrapper"),
      readme.indexOf("\n```", readme.indexOf("// ❌ a wrapper")),
    );
    const calls = [...block.matchAll(/className=\{([\s\S]*?\n\))\}/g)].map((m) => m[1] as string);
    expect(calls).toHaveLength(2);
    const [before, after] = calls.map(
      (code) => new Function("cn", "ss", "isDisabled", "className", `return ${code};`),
    );
    for (const isDisabled of [false, true]) {
      for (const className of [undefined, "mt-2", "p-2"]) {
        expect(after?.(cn, ss, isDisabled, className)).toBe(
          before?.(cn, ss, isDisabled, className),
        );
      }
    }
  });
});

describe("the README's relative links", () => {
  it("point only at files the published package carries", async () => {
    // The README is read from node_modules and on npmjs.com, where CONTRIBUTING.md,
    // examples/ and assets/ do not exist — and npm leaves a <source srcset> relative, so
    // the dark hero 404'd there. Anything outside the tarball is linked absolutely.
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const carried = [...(pkg.files as string[]), "README.md", "LICENSE", "package.json"];
    const targets = [
      ...readme.matchAll(/\]\(\.\/([^)#]+)[^)]*\)|(?:src|srcset|href)="\.\/([^"]+)"/g),
    ].map((m) => (m[1] ?? m[2]) as string);
    expect(targets.length).toBeGreaterThan(0);
    const outside = targets.filter(
      (target) => !carried.some((path) => target === path || target.startsWith(`${path}/`)),
    );
    expect(outside).toEqual([]);
  });
});

describe("the anchors the table of contents points at", () => {
  it("resolves every one of them", () => {
    // A renamed heading leaves a link that silently goes nowhere, and the contents list
    // is the first thing a reader uses.
    // GitHub's own slug: lowercase, drop everything but word characters, spaces and
    // hyphens, then turn *each* space into a hyphen — a run of two becomes `--`, which
    // is why so many anchors here have one.
    const headings = [...readme.matchAll(/^#{2,4} (.+?)\s*$/gm)].map(([, text]) =>
      (text as string)
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s/g, "-"),
    );
    const known = new Set(headings);
    const broken = [...readme.matchAll(/\]\(#([\w-]+)\)/g)]
      .map(([, anchor]) => anchor as string)
      .filter((anchor) => !known.has(anchor));
    expect(broken).toEqual([]);
  });
});

describe("every example in the README", () => {
  it("builds classes the real Tailwind has a rule for", async () => {
    // 1,600 lines of hand-written examples across an API that changed three times in
    // three releases, with nothing mechanical behind them until now. This is the same
    // gate the README tells readers to put in CI, pointed at the README.
    const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { run } = await import("../src/check/run.js");
    const { clearCache } = await import("../src/extract/collect.js");
    const { clearReported } = await import("../src/integration/report.js");

    const blocks = [...readme.matchAll(/```(?:ts|tsx|js|jsx)\n([\s\S]*?)```/g)].map(
      ([, code]) => code as string,
    );
    expect(blocks.length).toBeGreaterThan(30);

    clearCache();
    clearReported();
    const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-readme-"));
    try {
      await writeFile(join(dir, "docs.tsx"), blocks.join("\n\n"));
      // The two variants the README documents as things you declare yourself.
      await writeFile(
        join(dir, "app.css"),
        `@import "tailwindcss";\n@custom-variant sidebar-open (&:is(.sidebar-open *));\n` +
          `@theme { --breakpoint-3xl: 120rem; }`,
      );
      const code = await run({
        command: "check",
        content: [dir],
        css: undefined,
        cwd: dir,
        strict: false,
        extensions: [],
        ignore: [],
        json: true,
        max: 0,
        out: undefined,
        write: false,
      });
      expect(code).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
      clearCache();
      clearReported();
    }
  }, 30_000);

  it("shows what tailess check really prints", async () => {
    // The sample had dropped the file line and the closing hint, so a CI script written
    // against it matched output the command never produced.
    const { mkdir, mkdtemp, rm, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { vi } = await import("vitest");
    const { run } = await import("../src/check/run.js");
    const { clearCache } = await import("../src/extract/collect.js");
    const { clearReported } = await import("../src/integration/report.js");

    const start = readme.indexOf("`tailess check` compiles your project for real and looks:");
    const sample = readme.slice(start).match(/\n```\n(\[tailess\][\s\S]*?)\n```/)?.[1];
    expect(sample).toContain("[tailess]");

    clearCache();
    clearReported();
    const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-readme-"));
    const out: string[] = [];
    const push = (m: unknown) => void out.push(String(m));
    vi.spyOn(console, "log").mockImplementation(push);
    vi.spyOn(console, "warn").mockImplementation(push);
    vi.spyOn(console, "error").mockImplementation(push);
    try {
      await mkdir(join(dir, "src"));
      await writeFile(
        join(dir, "src", "Card.tsx"),
        `import { ss } from "tailess";\n` +
          `export const card = ss({ base: "rounded", md: "p-4", hover: "underline", lg: "flex" });\n`,
      );
      await writeFile(
        join(dir, "src", "app.css"),
        `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }\n`,
      );
      const code = await run({
        command: "check",
        content: [dir],
        css: undefined,
        cwd: dir,
        strict: false,
        extensions: [],
        ignore: [],
        json: false,
        max: 20,
        out: undefined,
        write: false,
      });
      expect(code).toBe(1);
      expect(out.join("\n").split("\\").join("/")).toBe(sample);
    } finally {
      vi.restoreAllMocks();
      await rm(dir, { recursive: true, force: true });
      clearCache();
      clearReported();
    }
  }, 30_000);
});

describe("the list of exported types", () => {
  it("names every type the public entry exports", async () => {
    // Hand-maintained, and it had fallen eight names behind — including every key
    // family, which is exactly what someone writing a `Record<StateKey, …>` reaches
    // for. A list that is wrong by omission grows more wrong with every release.
    const entry = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
    const exported = new Set<string>();
    for (const [, group] of entry.matchAll(/export type \{([^}]*)\}/g)) {
      for (const name of (group as string).split(",")) {
        const clean = name.trim().replace(/^type\s+/, "");
        if (clean) exported.add(clean);
      }
    }
    expect(exported.size).toBeGreaterThan(30);

    const undocumented = [...exported].filter((name) => !readme.includes(`\`${name}\``)).sort();
    expect(undocumented).toEqual([]);
  });
});

describe("the tailess.d.ts the README tells you to write", () => {
  it("adds to the package's types rather than replacing them", async () => {
    // Copied verbatim it was a global script, so `declare module "tailess"` replaced the
    // package's declarations and every `import { ss } from "tailess"` stopped compiling.
    // Compiled here against the built declarations, exactly as a consumer's would be.
    const { existsSync } = await import("node:fs");
    const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const ts = (await import("typescript")).default;

    const declarations = fileURLToPath(new URL("../dist/index.d.ts", import.meta.url));
    expect(existsSync(declarations), "build first: this compiles against dist/").toBe(true);

    const snippet = readme.match(/```ts\n(\/\/ tailess\.d\.ts[\s\S]*?)```/)?.[1];
    expect(snippet).toBeDefined();

    const dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-dts-"));
    try {
      await writeFile(join(dir, "tailess.d.ts"), snippet as string);
      await writeFile(
        join(dir, "main.ts"),
        `import { configure, ss } from "tailess";\n` +
          `configure({ keys: ["3xl", "sidebar-open"] });\n` +
          `export const a = ss({ md: "p-6", "3xl": "p-12", "sidebar-open": "translate-x-0" });\n`,
      );
      const program = ts.createProgram([join(dir, "main.ts"), join(dir, "tailess.d.ts")], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        paths: { tailess: [declarations] },
      });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
      expect(errors).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
