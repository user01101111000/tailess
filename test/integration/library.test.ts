import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/check/run.js";
import { clearCache } from "../../src/extract/collect.js";
import { clearReported } from "../../src/integration/report.js";
import { hasRule } from "../helpers/css.js";

/**
 * The README's recipe for publishing a component library, built for real: a package
 * whose build bundles its source and runs `tailess emit`, and a consumer with no tailess
 * plugin that imports the package's stylesheet.
 *
 * `emit` writes only the classes tailess *builds* — the prefixed ones. The unprefixed
 * literals are left to Tailwind's own scan, which is right in an app and wrong here: a
 * consumer's scan does not read `node_modules`, so every `base` class, every flat variant
 * option and every plain `className` of the library went unstyled in the consumer, with
 * nothing warning either side.
 */

let dir = "";
let ui = "";

beforeEach(async () => {
  clearCache();
  clearReported();
  // Inside node_modules so `@import "tailwindcss"` resolves as it would in a project.
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-lib-"));
  ui = join(dir, "node_modules", "@acme", "ui");
  await mkdir(join(ui, "src"), { recursive: true });
  await writeFile(
    join(ui, "src", "index.ts"),
    `import { match, ss, variants } from "tailess";
export const card = ss({ base: "rounded-xl shadow-lg", md: "p-4", dark: { hover: "bg-black" } });
export const button = variants({
  base: "inline-flex tracking-wide",
  variants: { tone: { brand: "bg-violet-700", danger: { base: "bg-rose-700", md: "px-9" } } },
});
export const label = (size: "sm" | "lg") => match(size, { sm: "text-amber-700", lg: "border-dashed" });
export const plain = "underline decoration-wavy";
`,
  );
  await writeFile(
    join(ui, "package.json"),
    JSON.stringify({
      name: "@acme/ui",
      type: "module",
      exports: { ".": "./dist/index.js", "./styles.css": "./styles.css" },
    }),
  );
  // The library's own build: bundle the source, then emit what tailess builds at runtime.
  await build({
    entryPoints: [join(ui, "src", "index.ts")],
    bundle: true,
    format: "esm",
    external: ["tailess"],
    outfile: join(ui, "dist", "index.js"),
    logLevel: "silent",
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const code = await run({
    command: "emit",
    content: [join(ui, "src")],
    css: undefined,
    cwd: ui,
    strict: false,
    extensions: [],
    ignore: [],
    json: false,
    max: 20,
    out: join(ui, "dist", "tailess.css"),
    write: false,
  });
  expect(code).toBe(0);
  vi.restoreAllMocks();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/**
 * Compile the consumer's stylesheet the way its build would: Tailwind, no tailess.
 *
 * `source(none)` stands in for what a real consumer's scan does with a dependency — it
 * never reads `node_modules`. This fixture lives inside the repository's own
 * `node_modules`, so leaving detection on lets it read the package anyway and proves
 * nothing.
 */
async function consumerCss(): Promise<string> {
  const entry = join(dir, "app.css");
  const css = `@import "tailwindcss" source(none);\n@import "@acme/ui/styles.css";\n`;
  await writeFile(entry, css);
  const result = await postcss([tailwindcss({ base: dir, optimize: false })]).process(css, {
    from: entry,
  });
  return result.css;
}

/** The stylesheet the README tells a library to ship at its package root. */
const libraryStylesheet = `@source "./dist";            /* your bundle: every literal class in it */
@import "./dist/tailess.css"; /* the classes tailess builds at runtime */
`;

const prefixed = ["md:p-4", "dark:hover:bg-black", "md:px-9"];
const literal = [
  "rounded-xl",
  "shadow-lg",
  "inline-flex",
  "tracking-wide",
  "bg-violet-700",
  "bg-rose-700",
  "text-amber-700",
  "border-dashed",
  "underline",
  "decoration-wavy",
];

describe("publishing a component library", () => {
  it("left every unprefixed class unstyled when the stylesheet shipped only the emit", async () => {
    // The old recipe, kept to show what the new one fixes.
    await writeFile(join(ui, "styles.css"), `@import "./dist/tailess.css";\n`);
    const css = await consumerCss();
    for (const cls of prefixed) expect(hasRule(css, cls), cls).toBe(true);
    expect(literal.filter((cls) => hasRule(css, cls))).toEqual([]);
  });

  it("styles every class when the shipped stylesheet also points Tailwind at the bundle", async () => {
    // The documented recipe: the package's stylesheet names its own `dist` as a source,
    // relative to itself, so the consumer's one @import reads the literals as well.
    // This is the README's `styles.css`, byte for byte.
    await writeFile(join(ui, "styles.css"), libraryStylesheet);
    const css = await consumerCss();
    const missing = [...prefixed, ...literal].filter((cls) => !hasRule(css, cls));
    expect(missing).toEqual([]);
  });
});
