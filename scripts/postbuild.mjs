/**
 * Post-build fixes tsup cannot express.
 *
 * Run as part of `npm run build`. Every step fails loudly if the output it expects
 * isn't there, so a tsup upgrade that changes the emitted shape breaks the build
 * instead of silently shipping the thing the step was meant to fix.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const problems = [];

/**
 * Both plugins have only a default export, so Rollup emits `module.exports = fn` —
 * `require("tailess/postcss")` and `require("tailess/vite")` *are* the functions.
 *
 * For PostCSS that shape is mandatory: Next.js
 * (`build/webpack/config/blocks/css/plugins.ts`) and `postcss-load-config` both
 * `require()` a string-named plugin and pass the result straight to PostCSS,
 * without unwrapping `.default`. Giving either module a named export as well would
 * turn it into `{ default, … }` and break every string-named consumer with "is not
 * a PostCSS plugin"; for the Vite entry it would hand a `vite.config.cjs` a
 * namespace object where Vite expects a plugin.
 *
 * But tsup's CJS declarations describe them as `export default`, which tells
 * TypeScript under `node16` that a CJS consumer must reach for `.default` — and
 * that is `undefined` at runtime. So correct the declarations to `export =`, which
 * is what the shape actually is, and what `@tailwindcss/postcss` ships for the
 * same reason.
 */
const cjsDefaultEntries = [
  {
    file: "postcss/index.d.cts",
    fn: "tailessPostcss",
    expected: "export { type TailessPostcssOptions, tailessPostcss as default };",
    types: ["TailessPostcssOptions"],
  },
  {
    file: "vite/index.d.cts",
    fn: "tailess",
    expected: "export { type TailessViteOptions, type TailessVitePlugin, tailess as default };",
    types: ["TailessViteOptions", "TailessVitePlugin"],
  },
];

async function fixCjsDefaultTypes() {
  for (const { file: name, fn, expected, types } of cjsDefaultEntries) {
    const file = new URL(name, dist);
    const source = await readFile(file, "utf8");

    if (!source.includes(expected)) {
      // Already correct is fine; anything else means the output shape moved.
      if (source.includes(`export = ${fn};`)) continue;
      problems.push(
        `dist/${name} does not contain the expected export line.\n` +
          `  looked for: ${expected}\n` +
          `  Check what tsup emitted and update scripts/postbuild.mjs.`,
      );
      continue;
    }

    const replacement = [
      `declare namespace ${fn} {`,
      `  export { ${types.join(", ")} };`,
      "}",
      "",
      `export = ${fn};`,
    ].join("\n");

    await writeFile(file, source.replace(expected, replacement), "utf8");
  }
}

/** tsup can append the source-map comment twice; one is enough and two is invalid-ish. */
async function dedupeSourceMapComments() {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:js|cjs)$/.test(entry.name)) files.push(path);
    }
  };
  await walk(fileURLToPath(dist));

  for (const path of files) {
    const source = await readFile(path, "utf8");
    const deduped = source.replace(
      /(?:\r?\n\/\/# sourceMappingURL=[^\r\n]*)+\s*$/,
      (match) => `\n${match.trim().split(/\r?\n/).at(-1)}\n`,
    );
    if (deduped !== source) await writeFile(path, deduped, "utf8");
  }
}

await fixCjsDefaultTypes();
await dedupeSourceMapComments();

if (problems.length > 0) {
  console.error(`\n[tailess] post-build check failed:\n\n${problems.join("\n\n")}\n`);
  process.exit(1);
}
