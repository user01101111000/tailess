import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  diffOf,
  type Edit,
  findHost,
  planEdit,
  runDoctor,
  runInit,
  wired,
} from "../../src/check/setup.js";

/**
 * Setup is the one failure nothing else catches. Wiring the plugin is four hand-edited
 * variants across two config shapes, ordering matters in one of them, and getting it
 * wrong produces no build error at all — the classes reach the element and no rule is
 * generated, which is discovered in a browser rather than in CI.
 */

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-setup-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Run a command quietly, returning its exit code and what it printed. */
async function capture(fn: () => Promise<number>) {
  const out: string[] = [];
  vi.spyOn(console, "log").mockImplementation((m) => void out.push(String(m)));
  vi.spyOn(console, "error").mockImplementation((m) => void out.push(String(m)));
  return { code: await fn(), output: out.join("\n") };
}

describe("reading whether the plugin is wired up", () => {
  it("wants the plugin called, not merely named", () => {
    // A leftover import after a deleted `tailess()` is the case this exists to catch.
    expect(wired(`import tailess from "tailess/vite";\nplugins: [tailess()]`)).toBe(true);
    expect(wired(`import tailess from "tailess/vite";\nplugins: [tailwindcss()]`)).toBe(false);
  });

  it("follows the name the plugin was imported as", () => {
    expect(wired(`import tw from "tailess/vite";\nplugins: [tw()]`)).toBe(true);
    expect(wired(`const t = require("tailess/vite");\nplugins: [t()]`)).toBe(true);
  });

  it("takes the postcss string form as wiring, since there is nothing to call", () => {
    expect(wired(`plugins: { "tailess/postcss": {} }`)).toBe(true);
  });
});

describe("finding which integration a project needs", () => {
  it("prefers Vite when both configs exist", async () => {
    // A Vite project with a postcss.config still compiles its CSS through Vite.
    await writeFile(join(dir, "vite.config.ts"), "export default {};");
    await writeFile(join(dir, "postcss.config.mjs"), "export default {};");
    expect((await findHost(dir)).kind).toBe("vite");
  });

  it("finds a postcss config in any of its spellings", async () => {
    await writeFile(join(dir, "postcss.config.mjs"), "export default {};");
    expect((await findHost(dir)).kind).toBe("postcss");
  });

  it("says so when there is neither", async () => {
    expect((await findHost(dir)).kind).toBe("unknown");
  });
});

describe("tailess doctor", () => {
  it("passes a project that calls the plugin", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailess from "tailess/vite";\nexport default { plugins: [tailess()] };`,
    );
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(0);
    expect(output).toContain("Nothing to do");
  });

  it("fails a project that does not, and says nothing else reports it", async () => {
    await writeFile(join(dir, "vite.config.ts"), `export default { plugins: [tailwindcss()] };`);
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(1);
    expect(output).toContain("does not call the plugin");
    expect(output).toContain("the build succeeds");
    expect(output).toContain("tailess()");
  });

  it("names the ordering rule for PostCSS, which is the half people get wrong", async () => {
    await writeFile(join(dir, "postcss.config.mjs"), `export default { plugins: {} };`);
    const { output } = await capture(() => runDoctor(dir));
    expect(output).toContain("tailess must come first");
  });

  it("exits 2 where there is no build config at all", async () => {
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(2);
    expect(output).toContain("no vite.config or postcss.config");
  });
});

describe("tailess init", () => {
  it("shows the edit and writes nothing without --write", async () => {
    const before = `import tailwindcss from "@tailwindcss/vite";\nexport default { plugins: [tailwindcss()] };\n`;
    await writeFile(join(dir, "vite.config.ts"), before);
    const { code, output } = await capture(() => runInit(dir, false));
    expect(code).toBe(0);
    expect(output).toContain("nothing written");
    expect(output).toContain('import tailess from "tailess/vite"');
    expect(await readFile(join(dir, "vite.config.ts"), "utf8")).toBe(before);
  });

  it("writes the Vite edit, import and all", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailwindcss from "@tailwindcss/vite";\nexport default { plugins: [tailwindcss()] };\n`,
    );
    const { code } = await capture(() => runInit(dir, true));
    expect(code).toBe(0);
    const after = await readFile(join(dir, "vite.config.ts"), "utf8");
    expect(after).toContain('import tailess from "tailess/vite";');
    expect(after).toContain("plugins: [tailess(), tailwindcss()]");
    expect(wired(after)).toBe(true);
  });

  it("writes the PostCSS edit first in the object, since order decides whether it works", async () => {
    await writeFile(
      join(dir, "postcss.config.mjs"),
      `export default { plugins: { "@tailwindcss/postcss": {} } };\n`,
    );
    await capture(() => runInit(dir, true));
    const after = await readFile(join(dir, "postcss.config.mjs"), "utf8");
    expect(after.indexOf("tailess/postcss")).toBeLessThan(after.indexOf("@tailwindcss/postcss"));
    expect(wired(after)).toBe(true);
  });

  it("is idempotent", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailess from "tailess/vite";\nexport default { plugins: [tailess()] };\n`,
    );
    const { code, output } = await capture(() => runInit(dir, true));
    expect(code).toBe(0);
    expect(output).toContain("already calls the plugin");
  });

  it("refuses to guess at a config it does not recognise", async () => {
    // A wrong edit to a build config is worse than no edit.
    await writeFile(join(dir, "vite.config.ts"), `export default someFactory();\n`);
    const { code, output } = await capture(() => runInit(dir, true));
    expect(code).toBe(2);
    expect(output).toContain("nothing was written");
    expect(await readFile(join(dir, "vite.config.ts"), "utf8")).toBe(
      "export default someFactory();\n",
    );
    expect(planEdit(await findHost(dir))).toBeNull();
  });
});

describe("the diff shown before writing", () => {
  it("reports only the lines that change, even after a modified one", async () => {
    // A modified line throws a running index out of step, and a naive comparison then
    // calls every line after it new. Editing someone's build config on the strength of
    // a wrong diff is worse than not offering the command at all.
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailwindcss from "@tailwindcss/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [tailwindcss()],\n});\n`,
    );
    const plan = planEdit(await findHost(dir));
    expect(plan).not.toBeNull();
    const lines = diffOf(plan as Edit).split("\n");
    expect(lines).toEqual([
      '+ import tailess from "tailess/vite";',
      "-   plugins: [tailwindcss()],",
      "+   plugins: [tailess(), tailwindcss()],",
    ]);
  });
});
