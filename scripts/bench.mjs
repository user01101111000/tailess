/**
 * The numbers in the README's Performance table, produced rather than remembered.
 *
 * They were written down once and never regenerated, which is the same shape of problem
 * as the key counts: a claim on the front page with nothing behind it. Run this after a
 * change that could plausibly move them.
 *
 *   npm run build && node scripts/bench.mjs
 *
 * It measures the **built** package, because that is what a consumer installs — `src/`
 * through a transform is a different program. Runtime numbers are per call and warm;
 * `tailwind-merge` keeps its own cache, so a cold first call is much slower and is not
 * what a rendering app pays.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { cn, ss } = await import("../dist/index.js");
const { collect, clearCache } = await import("../dist/build.js");

/** Nanoseconds per call, taking the best of several rounds to shed scheduler noise. */
function perCall(label, fn, iterations = 200_000) {
  for (let i = 0; i < iterations / 10; i += 1) fn(i);
  let best = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 5; round += 1) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i += 1) fn(i);
    const ns = Number(process.hrtime.bigint() - start) / iterations;
    if (ns < best) best = ns;
  }
  console.log(`  ${label.padEnd(34)} ~${Math.round(best)} ns`);
  return best;
}

/**
 * Milliseconds for one whole scan, best of three.
 *
 * `cold` clears the cache before *every* round, which is the whole point: taking the
 * best of three without it measures one cold scan and two warm ones, and then reports
 * the warm number as the cold one.
 */
async function scan(label, roots, { cold }) {
  let best = Number.POSITIVE_INFINITY;
  if (!cold) await collect({ roots });
  for (let round = 0; round < 3; round += 1) {
    if (cold) clearCache();
    const start = process.hrtime.bigint();
    await collect({ roots });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms < best) best = ms;
  }
  console.log(`  ${label.padEnd(34)} ~${Math.round(best)} ms`);
  return best;
}

console.log(`\nnode ${process.version}\n`);
console.log("runtime, per call, warm:");
perCall('cn("px-2 py-1", …, "px-4")', () => cn("px-2 py-1", false, "px-4"));
perCall("ss() with 3 groups", () =>
  ss({ base: "flex text-xl", md: "text-2xl", hover: "underline" }),
);
perCall("ss() with 8 groups", () =>
  ss({
    base: "flex text-xl",
    sm: "block",
    md: "text-2xl",
    lg: "p-6",
    xl: "p-8",
    hover: "underline",
    focus: "outline",
    dark: "bg-black",
  }),
);

// A project the size the README claims, written out rather than assumed.
const files = 2_000;
const dir = await mkdtemp(join(tmpdir(), "tailess-bench-"));
try {
  console.log(`\nscanner, ${files.toLocaleString()}-file project:`);
  await Promise.all(
    Array.from({ length: files }, (_, i) =>
      writeFile(
        join(dir, `C${i}.tsx`),
        `import { ss, on } from "tailess";\n` +
          `export const a${i} = ss({ base: "rounded border p-4", md: "p-6", hover: "underline" });\n` +
          `export const b${i} = on(["dark", "hover"], "bg-black");\n`,
      ),
    ),
  );
  await scan("cold scan", [dir], { cold: true });
  await scan("warm rescan", [dir], { cold: false });
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log();
