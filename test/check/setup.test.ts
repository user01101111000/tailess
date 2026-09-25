import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkEdit,
  diffOf,
  type Edit,
  findHost,
  planEdit,
  pluginFor,
  runDoctor,
  runInit,
  wired,
  wiring,
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

  it("does not read a comment as wiring", () => {
    // The comment left behind by deleting the call is the likeliest artefact of exactly
    // the deletion this check exists to catch, so reading it green is the worst answer.
    expect(
      wired(`import { defineConfig } from "vite";
// we removed tailess() from the plugins array
export default defineConfig({ plugins: [] });`),
    ).toBe(false);
    expect(
      wired(`module.exports = {
  // plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} }
  plugins: { "@tailwindcss/postcss": {} },
};`),
    ).toBe(false);
    expect(wired(`/* plugins: [tailess()] */\nplugins: []`)).toBe(false);
  });

  it("does not read a code sample in a template as wiring", () => {
    expect(wired("const doc = `plugins: [tailess()]`;\nplugins: []")).toBe(false);
  });

  describe("the Vite plugin, called where Vite runs it", () => {
    const vite = (source: string) =>
      wired(`import tailess from "tailess/vite";\n${source}`, "vite");

    it("counts the config's own list, however the config is built", () => {
      expect(vite(`export default defineConfig({ plugins: [tailess()] });`)).toBe(true);
      expect(vite(`export default defineConfig(() => ({ plugins: [tailess()] }));`)).toBe(true);
      expect(
        vite(`export default defineConfig(() => {\n  return { plugins: [tailess()] };\n});`),
      ).toBe(true);
      expect(vite(`export default mergeConfig(base, { plugins: [tailess()] });`)).toBe(true);
      expect(vite(`const plugins = [tailwindcss(), tailess()];\nexport default { plugins };`)).toBe(
        true,
      );
      expect(vite(`export default c ? { plugins: [x()] } : { plugins: [tailess()] };`)).toBe(true);
      expect(wired(`module.exports = { plugins: [require("tailess/vite")()] };`, "vite")).toBe(
        true,
      );
    });

    it("does not count one in an option nested inside it", () => {
      // Vite ignores a plugin's dev-server hooks in rollupOptions.plugins: the build has the
      // CSS and the dev server has none, with nothing printed.
      expect(vite(`export default { build: { rollupOptions: { plugins: [tailess()] } } };`)).toBe(
        false,
      );
      expect(vite(`export default { worker: { plugins: () => [tailess()] } };`)).toBe(false);
    });

    it("does not count tailess/postcss beside @tailwindcss/vite", () => {
      // The README's own warning: that PostCSS plugin cannot work on Vite's Tailwind.
      const source = `import tailwindcss from "@tailwindcss/vite";\nexport default {\n  plugins: [tailwindcss()],\n  css: { postcss: { plugins: [require("tailess/postcss")()] } },\n};`;
      expect(pluginFor("vite.config.ts", source)).toBe("vite");
      expect(wired(source, pluginFor("vite.config.ts", source))).toBe(false);
    });

    it("reads a Vite config that runs Tailwind through PostCSS as a PostCSS one", () => {
      const source = `export default {\n  css: { postcss: { plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()] } },\n};`;
      expect(wired(source, pluginFor("vite.config.ts", source))).toBe(true);
    });
  });

  describe("the PostCSS plugin, listed ahead of Tailwind's", () => {
    const postcss = (source: string) => wiring(source, "postcss");

    it("counts every form a loader reads", () => {
      expect(
        postcss(
          `module.exports = { plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} } };`,
        ),
      ).toBe("wired");
      expect(postcss(`export default { plugins: { "tailess/postcss": { cacheDir: "x" } } };`)).toBe(
        "wired",
      );
      expect(
        postcss(`module.exports = { plugins: ["tailess/postcss", "@tailwindcss/postcss"] };`),
      ).toBe("wired");
      expect(
        postcss(`module.exports = { plugins: [["tailess/postcss", {}], "@tailwindcss/postcss"] };`),
      ).toBe("wired");
      expect(
        postcss(
          `module.exports = { plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()] };`,
        ),
      ).toBe("wired");
      expect(
        postcss(
          `import tailess from "tailess/postcss";\nimport tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailess(), tailwindcss()] };`,
        ),
      ).toBe("wired");
      expect(
        postcss(
          `const tailess = require("tailess/postcss");\nmodule.exports = { plugins: [tailess, require("@tailwindcss/postcss")] };`,
        ),
      ).toBe("wired");
    });

    it("does not count an import or require whose name is never used", () => {
      // The README's array form with its call deleted: the build loads only Tailwind and
      // prints nothing, and naming the package passed doctor and check --strict.
      expect(
        postcss(
          `import tailess from "tailess/postcss";\nimport tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailwindcss()] };`,
        ),
      ).toBe("unwired");
      expect(
        postcss(
          `const tailess = require("tailess/postcss");\nmodule.exports = { plugins: [require("@tailwindcss/postcss")()] };`,
        ),
      ).toBe("unwired");
      expect(
        postcss(
          `import type { TailessPostcssOptions } from "tailess/postcss";\nexport default { plugins: [] };`,
        ),
      ).toBe("unwired");
    });

    it("does not count a plugin switched off with false", () => {
      expect(
        postcss(
          `export default { plugins: { "tailess/postcss": false, "@tailwindcss/postcss": {} } };`,
        ),
      ).toBe("unwired");
    });

    it("tells a plugin listed after Tailwind's from one listed before it", () => {
      expect(
        postcss(
          `export default { plugins: { "@tailwindcss/postcss": {}, "tailess/postcss": {} } };`,
        ),
      ).toBe("misordered");
      expect(
        postcss(
          `module.exports = { plugins: [require("@tailwindcss/postcss")(), require("tailess/postcss")()] };`,
        ),
      ).toBe("misordered");
      expect(
        postcss(
          `import tailess from "tailess/postcss";\nimport tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailwindcss(), tailess()] };`,
        ),
      ).toBe("misordered");
    });
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

  it("reads the Vite config Vite loads, not the first one the directory lists", async () => {
    // Vite tries js, mjs, ts, cjs, mts, cts; a stale `vite.config.cjs` beside the `.ts`
    // was read instead and a wired project failed.
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailwindcss from "@tailwindcss/vite";\nimport tailess from "tailess/vite";\nexport default { plugins: [tailwindcss(), tailess()] };\n`,
    );
    await writeFile(join(dir, "vite.config.cjs"), `module.exports = { plugins: [] };\n`);
    const host = await findHost(dir);
    expect(host.kind === "vite" && basename(host.file)).toBe("vite.config.ts");
  });

  it("answers for the PostCSS config when that is where a Vite project gets Tailwind", async () => {
    // The README calls `tailess/postcss` the right plugin there; asking for `tailess()` in
    // the Vite config failed a working build, and `init` added a redundant plugin.
    await writeFile(join(dir, "vite.config.ts"), `export default { plugins: [react()] };\n`);
    await writeFile(
      join(dir, "postcss.config.mjs"),
      `export default { plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} } };\n`,
    );
    expect((await findHost(dir)).kind).toBe("postcss");
    const { code } = await capture(() => runDoctor(dir));
    expect(code).toBe(0);
  });

  describe("PostCSS configs that are data, in every place postcss-load-config looks", () => {
    const wiredObject = { plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} } };
    const unwiredObject = { plugins: { "@tailwindcss/postcss": {} } };

    it.each([
      ["package.json", JSON.stringify({ name: "app", postcss: wiredObject })],
      [".postcssrc", JSON.stringify(wiredObject)],
      [".postcssrc.json", JSON.stringify(wiredObject)],
      [
        ".postcssrc.yml",
        `# PostCSS\nplugins:\n  tailess/postcss: {}\n  "@tailwindcss/postcss": {}\n`,
      ],
      [".postcssrc.yaml", `plugins:\n  - tailess/postcss\n  - "@tailwindcss/postcss"\n`],
      [
        ".postcssrc.js",
        `module.exports = { plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} } };\n`,
      ],
    ])("passes one wired in %s", async (file, text) => {
      // Each of these exited 2 — "no postcss.config here" — on a working project.
      await writeFile(join(dir, file), text);
      const { code } = await capture(() => runDoctor(dir));
      expect(code).toBe(0);
    });

    it.each([
      ["package.json", JSON.stringify({ name: "app", postcss: unwiredObject }), '"postcss": {'],
      [".postcssrc.json", JSON.stringify(unwiredObject), '"plugins": {'],
      [
        ".postcssrc.yml",
        `plugins:\n  tailess/postcss: false\n  "@tailwindcss/postcss": {}\n`,
        "plugins:\n",
      ],
    ])("fails one unwired in %s, with the line in its own syntax", async (file, text, snippet) => {
      await writeFile(join(dir, file), text);
      const { code, output } = await capture(() => runDoctor(dir));
      expect(code).toBe(1);
      expect(output).toContain(snippet);
    });

    it("reads them, and does not edit them", async () => {
      const text = JSON.stringify({ name: "app", postcss: unwiredObject });
      await writeFile(join(dir, "package.json"), text);
      const { code, output } = await capture(() => runInit(dir, true));
      expect(code).toBe(2);
      expect(output).toContain("data rather than code");
      expect(await readFile(join(dir, "package.json"), "utf8")).toBe(text);
    });

    it("ignores a package.json with no postcss key", async () => {
      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "app" }));
      expect((await findHost(dir)).kind).toBe("unknown");
    });
  });

  describe("frameworks that run Vite from their own config", () => {
    it.each([
      ["astro.config.mjs", "Astro"],
      ["nuxt.config.ts", "Nuxt"],
    ])("reads vite.plugins in %s", async (file, framework) => {
      // The README lists Astro under Vite; doctor exited 2 and blamed a monorepo.
      await writeFile(
        join(dir, file),
        `import tailwindcss from "@tailwindcss/vite";\nimport tailess from "tailess/vite";\nexport default defineConfig({ vite: { plugins: [tailwindcss(), tailess()] } });\n`,
      );
      const host = await findHost(dir);
      expect(host.kind === "vite" && host.framework).toBe(framework);
      expect((await capture(() => runDoctor(dir))).code).toBe(0);
    });

    it("fails one that is not wired, says where it goes, and leaves the file alone", async () => {
      const text = `import tailwindcss from "@tailwindcss/vite";\nexport default defineConfig({ vite: { plugins: [tailwindcss()] } });\n`;
      await writeFile(join(dir, "astro.config.mjs"), text);
      const doctor = await capture(() => runDoctor(dir));
      expect(doctor.code).toBe(1);
      expect(doctor.output).toContain("vite: { plugins: [tailwindcss(), tailess()] }");
      const init = await capture(() => runInit(dir, true));
      expect(init.code).toBe(2);
      expect(init.output).toContain("Astro's own config");
      expect(await readFile(join(dir, "astro.config.mjs"), "utf8")).toBe(text);
    });

    it("takes app.config for SolidStart's only when it is", async () => {
      await writeFile(
        join(dir, "app.config.ts"),
        `export default defineAppConfig({ title: "x" });\n`,
      );
      expect((await findHost(dir)).kind).toBe("unknown");
      await writeFile(
        join(dir, "app.config.ts"),
        `import { defineConfig } from "@solidjs/start/config";\nexport default defineConfig({ vite: { plugins: [] } });\n`,
      );
      const host = await findHost(dir);
      expect(host.kind === "vite" && host.framework).toBe("SolidStart");
    });
  });
});

describe("a plugin list built in another file", () => {
  const preset = `import tailwindcss from "@tailwindcss/vite";\nimport tailess from "tailess/vite";\n\nexport const sharedPlugins = () => [tailwindcss(), tailess()];\n`;

  it.each([
    ["called", "plugins: sharedPlugins()"],
    ["spread", "plugins: [...sharedPlugins()]"],
  ])("is followed when %s from a local preset", async (_, plugins) => {
    // The shape every monorepo has. doctor failed it, and init registered the plugin a
    // second time.
    await writeFile(join(dir, "vite.shared.ts"), preset);
    const config = `import { defineConfig } from "vite";\nimport { sharedPlugins } from "./vite.shared";\n\nexport default defineConfig({ ${plugins} });\n`;
    await writeFile(join(dir, "vite.config.ts"), config);
    const doctor = await capture(() => runDoctor(dir));
    expect(doctor.code).toBe(0);
    expect(doctor.output).toContain("through vite.shared.ts");
    const init = await capture(() => runInit(dir, true));
    expect(init.code).toBe(0);
    expect(await readFile(join(dir, "vite.config.ts"), "utf8")).toBe(config);
  });

  it("still fails when the preset does not wire it either", async () => {
    await writeFile(
      join(dir, "vite.shared.ts"),
      `import tailwindcss from "@tailwindcss/vite";\nexport const sharedPlugins = () => [tailwindcss()];\n`,
    );
    await writeFile(
      join(dir, "vite.config.ts"),
      `import { sharedPlugins } from "./vite.shared.js";\nexport default { plugins: sharedPlugins() };\n`,
    );
    expect((await capture(() => runDoctor(dir))).code).toBe(1);
  });

  it("says it cannot tell when the preset cannot be read, rather than failing the build", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import { sharedPlugins } from "./presets/vite";\nexport default { plugins: sharedPlugins() };\n`,
    );
    const doctor = await capture(() => runDoctor(dir));
    expect(doctor.code).toBe(0);
    expect(doctor.output).toContain("could not read");
    expect((await capture(() => runInit(dir, true))).code).toBe(2);
  });

  it("does not take package.json, or any other non-code import, for a preset", async () => {
    // `with { type: "json" }` is how an ESM config reads its version; it has no plugins.
    await writeFile(
      join(dir, "vite.config.ts"),
      `import pkg from "./package.json" with { type: "json" };\nexport default { plugins: [] };\n`,
    );
    expect((await capture(() => runDoctor(dir))).code).toBe(1);
  });
});

describe("a config with no Tailwind plugin at all", () => {
  it("is noted, not failed, since a preset package can bring Tailwind in unseen", async () => {
    // Nothing is styled at all in this project, and doctor called it healthy.
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailess from "tailess/vite";\nexport default { plugins: [tailess()] };\n`,
    );
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(0);
    expect(output).toContain("does not load @tailwindcss/vite either");
  });

  it("is quiet when Tailwind's plugin is there", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailwindcss from "@tailwindcss/vite";\nimport tailess from "tailess/vite";\nexport default { plugins: [tailwindcss(), tailess()] };\n`,
    );
    const { output } = await capture(() => runDoctor(dir));
    expect(output).not.toContain("note:");
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

  it("fails a PostCSS config that lists tailess after Tailwind, and says to move it", async () => {
    // Its own advice is "tailess must come first"; passing a config that breaks it left
    // a build log line as the only sign that no variant class had CSS.
    await writeFile(
      join(dir, "postcss.config.cjs"),
      `module.exports = { plugins: [require("@tailwindcss/postcss")(), require("tailess/postcss")()] };\n`,
    );
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(1);
    expect(output).toContain('after "@tailwindcss/postcss"');
    expect(output).toContain(
      'plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()]',
    );
  });

  it("fails a PostCSS config that imports tailess and never lists it", async () => {
    await writeFile(
      join(dir, "postcss.config.mjs"),
      `import tailess from "tailess/postcss";\nimport tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailwindcss()] };\n`,
    );
    const { code, output } = await capture(() => runDoctor(dir));
    expect(code).toBe(1);
    expect(output).toContain('import tailess from "tailess/postcss"');
  });

  it("fails a Vite config whose only tailess() is in build.rollupOptions.plugins", async () => {
    await writeFile(
      join(dir, "vite.config.ts"),
      `import tailess from "tailess/vite";\nimport tailwindcss from "@tailwindcss/vite";\nconst plugins = [tailwindcss()];\nexport default { plugins, build: { rollupOptions: { plugins: [tailess()] } } };\n`,
    );
    const { code } = await capture(() => runDoctor(dir));
    expect(code).toBe(1);
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

  /**
   * Every one of these wrote a broken build config and reported success. The command
   * exists to make setup safe, so a plausible diff over a file that no longer loads is
   * the worst thing it can do — worse than refusing, which `doctor` already covers.
   */
  describe("never writes a config that does not load", () => {
    /** Write `source` as the project's Vite config, run `init --write`, read it back. */
    async function initVite(source: string) {
      await writeFile(join(dir, "vite.config.ts"), source);
      const { code } = await capture(() => runInit(dir, true));
      return { code, after: await readFile(join(dir, "vite.config.ts"), "utf8") };
    }

    it("brings the import when the file does not begin with one", async () => {
      // A leading comment is ordinary in a build config, and the insertion regex was not
      // multiline — so it silently no-opped and left a `tailess()` call with no import.
      const { code, after } = await initVite(
        `// Build config for the app.\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [],\n});\n`,
      );
      expect(code).toBe(0);
      expect(after).toContain('import tailess from "tailess/vite";');
      expect(after.startsWith("// Build config for the app.")).toBe(true);
      expect(wired(after)).toBe(true);
    });

    it("puts the import after a multi-line one rather than inside it", async () => {
      // A formatter produces this shape past its print width; the old capture stopped at
      // the first newline and landed the new import between the brace and the specifiers.
      const { code, after } = await initVite(
        `import {\n  defineConfig,\n  loadEnv,\n} from "vite";\n\nexport default defineConfig({\n  plugins: [],\n});\n`,
      );
      expect(code).toBe(0);
      expect(after).toContain(`} from "vite";\nimport tailess from "tailess/vite";`);
      expect(after).not.toContain(`import {\nimport tailess`);
      expect(wired(after)).toBe(true);
    });

    it("leaves a `/// <reference>` at the top of the file", async () => {
      const { after } = await initVite(
        `/// <reference types="vite/client" />\nexport default { plugins: [] };\n`,
      );
      expect(after.startsWith('/// <reference types="vite/client" />')).toBe(true);
      expect(wired(after)).toBe(true);
    });

    it("writes into the config's own list, never into css.postcss.plugins before it", async () => {
      // `css.postcss.plugins` is a documented Vite option and can precede the top-level
      // array; a first-match replace put the Vite plugin in the PostCSS list and left the
      // one that matters untouched.
      const { code, after } = await initVite(
        `import { defineConfig } from "vite";\n\nexport default defineConfig({\n  css: { postcss: { plugins: [] } },\n  plugins: [],\n});\n`,
      );
      expect(code).toBe(0);
      expect(after).toContain("css: { postcss: { plugins: [] } },\n  plugins: [tailess()],");
    });

    it("refuses when two lists are both the config's own", async () => {
      const source = `import { defineConfig } from "vite";\nexport default defineConfig(({ command }) =>\n  command === "build" ? { plugins: [a()] } : { plugins: [b()] },\n);\n`;
      const { code, after } = await initVite(source);
      expect(code).toBe(2);
      expect(after).toBe(source);
    });

    it.each([
      ["build.rollupOptions.plugins", "build: { rollupOptions: { plugins: [banner()] } }"],
      ["css.postcss.plugins", "css: { postcss: { plugins: [noop] } }"],
    ])("does not take %s for the list a plugins variable holds", async (_, option) => {
      // With `plugins` in a variable the nested literal was the only one left, and writing
      // there lost every variant class in dev with nothing printed (rollupOptions) or
      // failed the build (css.postcss) — with `doctor` calling both wired afterwards.
      const source = `import tailwindcss from "@tailwindcss/vite";\nconst plugins = [tailwindcss()];\nexport default { plugins, ${option} };\n`;
      const { code, after } = await initVite(source);
      expect(code).toBe(2);
      expect(after).toBe(source);
    });

    it("ignores a plugins list that is only mentioned in a comment", async () => {
      const { code, after } = await initVite(
        `import { defineConfig } from "vite";\n// plugins: [react()],\nexport default defineConfig({\n  plugins: [],\n});\n`,
      );
      expect(code).toBe(0);
      expect(after).toContain("// plugins: [react()],");
      expect(wired(after)).toBe(true);
    });

    it("keeps a CRLF config on CRLF", async () => {
      const { after } = await initVite(
        `import { defineConfig } from "vite";\r\n\r\nexport default defineConfig({\r\n  plugins: [],\r\n});\r\n`,
      );
      expect(after).toContain('\r\nimport tailess from "tailess/vite";');
      expect(
        after.split("\n").every((line, i, all) => i === all.length - 1 || line.endsWith("\r")),
      ).toBe(true);
    });

    it("adds no dangling separator to an empty list", async () => {
      const { after } = await initVite(`export default { plugins: [] };\n`);
      expect(after).toContain("plugins: [tailess()]");
    });
  });

  /**
   * Four shapes the release audit found `init --write` turning into a config Vite could not
   * load — after exiting 0, with `doctor` calling the result wired. Each output is parsed
   * with the Vite this repository tests against, because reading the edit's text is what
   * let all four through.
   */
  describe("never writes a config that does not parse", () => {
    /** Write `source` as `file`, run `init --write`, read it back. */
    async function init(file: string, source: string) {
      await writeFile(join(dir, file), source);
      const { code, output } = await capture(() => runInit(dir, true));
      return { code, output, after: await readFile(join(dir, file), "utf8") };
    }

    /** True when the project's own Vite parses `text` as `file`. */
    async function parses(file: string, text: string): Promise<boolean> {
      const vite = (await import("vite")) as unknown as {
        parseSync: (file: string, text: string) => { errors: unknown[] };
      };
      return vite.parseSync(file, text).errors.length === 0;
    }

    /** How many times `text` imports or requires the Vite plugin. */
    const imports = (text: string) => text.split('"tailess/vite"').length - 1;

    it("reuses the import a deleted call left behind instead of declaring it again", async () => {
      // The commonest unwired shape there is, and the one `doctor` sends people to `init`
      // for. The second `import tailess` was "Identifier `tailess` has already been declared".
      const { code, after } = await init(
        "vite.config.ts",
        `import tailwindcss from "@tailwindcss/vite";\nimport tailess from "tailess/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [tailwindcss()],\n});\n`,
      );
      expect(code).toBe(0);
      expect(imports(after)).toBe(1);
      expect(after).toContain("plugins: [tailess(), tailwindcss()]");
      expect(await parses("vite.config.ts", after)).toBe(true);
    });

    it("reuses it when the call was commented out rather than deleted", async () => {
      const { after } = await init(
        "vite.config.ts",
        `import tailess from "tailess/vite";\nexport default {\n  plugins: [\n    // tailess(),\n  ],\n};\n`,
      );
      expect(imports(after)).toBe(1);
      expect(wired(after)).toBe(true);
      expect(await parses("vite.config.ts", after)).toBe(true);
    });

    it("calls the plugin by the name it was imported as", async () => {
      const { after } = await init(
        "vite.config.ts",
        `import { default as tw } from "tailess/vite";\nexport default { plugins: [react()] };\n`,
      );
      expect(imports(after)).toBe(1);
      expect(after).toContain("plugins: [tw(), react()]");
      expect(wired(`import { default as tw } from "tailess/vite";\nplugins: [tw()]`)).toBe(true);
    });

    it("gives up rather than declare a name the file already uses", async () => {
      const source = `import * as tailess from "tailess/vite";\nexport default { plugins: [] };\n`;
      const { code, after } = await init("vite.config.ts", source);
      expect(code).toBe(2);
      expect(after).toBe(source);
    });

    it("requires the plugin in a CommonJS config", async () => {
      // The README documents this shape; an `import` on line 1 of it is "Cannot use
      // import statement outside a module", and the whole dev server is gone.
      const { code, after } = await init(
        "vite.config.cjs",
        `const { defineConfig } = require("vite");\nconst tailwindcss = require("@tailwindcss/vite");\n\nmodule.exports = defineConfig({\n  plugins: [tailwindcss()],\n});\n`,
      );
      expect(code).toBe(0);
      expect(after).not.toMatch(/^import /m);
      expect(after).toContain(
        `const tailwindcss = require("@tailwindcss/vite");\nconst tailess = require("tailess/vite");`,
      );
      expect(after).toContain("plugins: [tailess(), tailwindcss()]");
      expect(wired(after)).toBe(true);
    });

    it("keeps a `use strict` directive first in a CommonJS config with no requires", async () => {
      const { after } = await init(
        "vite.config.cjs",
        `"use strict";\nmodule.exports = { plugins: [] };\n`,
      );
      expect(after).toBe(
        `"use strict";\nconst tailess = require("tailess/vite");\nmodule.exports = { plugins: [tailess()] };\n`,
      );
    });

    it("reuses a require that is already there", async () => {
      const { after } = await init(
        "vite.config.cjs",
        `const tailess = require("tailess/vite");\nmodule.exports = { plugins: [] };\n`,
      );
      expect(imports(after)).toBe(1);
      expect(after).toContain("plugins: [tailess()]");
    });

    it("reads a `.js` config written in CommonJS as CommonJS", async () => {
      const { after } = await init(
        "vite.config.js",
        `const react = require("@vitejs/plugin-react");\nmodule.exports = { plugins: [react()] };\n`,
      );
      expect(after).not.toMatch(/^import /m);
      expect(after).toContain('const tailess = require("tailess/vite");');
    });

    it.each([
      ["with", 'import pkg from "./package.json" with { type: "json" };'],
      ["assert", 'import pkg from "./package.json" assert { type: "json" };'],
    ])("puts the import after one carrying a `%s` clause, not inside it", async (_, statement) => {
      // Reading the app's version from package.json is how an ESM config does it, and Node
      // requires the attribute; the splice landed between the specifier and the clause.
      const { code, after } = await init(
        "vite.config.ts",
        `import tailwindcss from "@tailwindcss/vite";\n${statement}\n\nexport default {\n  define: { version: JSON.stringify(pkg.version) },\n  plugins: [tailwindcss()],\n};\n`,
      );
      expect(code).toBe(0);
      expect(after).toContain(`${statement}\nimport tailess from "tailess/vite";`);
      expect(await parses("vite.config.ts", after)).toBe(true);
    });

    it("puts the import after a TypeScript `import x = require()`, not inside it", async () => {
      const { after } = await init(
        "vite.config.ts",
        `import path = require("node:path");\nexport default { root: path.resolve("."), plugins: [] };\n`,
      );
      expect(after).toContain(
        `import path = require("node:path");\nimport tailess from "tailess/vite";`,
      );
      expect(await parses("vite.config.ts", after)).toBe(true);
    });
  });

  describe("a PostCSS list, in the form its loader reads", () => {
    /** Write `source` as `file`, run `init --write`, read it back. */
    async function init(file: string, source: string) {
      await writeFile(join(dir, file), source);
      const { code } = await capture(() => runInit(dir, true));
      return { code, after: await readFile(join(dir, file), "utf8") };
    }

    it("adds a call to a CommonJS list of plugin instances, never a string", async () => {
      // The README's "Other PostCSS setups" form. A string in front of an instance is
      // "Invalid PostCSS Plugin found at: plugins[0]" in postcss-load-config.
      const { code, after } = await init(
        "postcss.config.cjs",
        `module.exports = { plugins: [require("@tailwindcss/postcss")()] };\n`,
      );
      expect(code).toBe(0);
      expect(after).toBe(
        `module.exports = { plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()] };\n`,
      );
      expect(wiring(after, "postcss")).toBe("wired");
    });

    it("imports and calls it in an ES module list of plugin instances", async () => {
      const { code, after } = await init(
        "postcss.config.mjs",
        `import tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailwindcss()] };\n`,
      );
      expect(code).toBe(0);
      expect(after).toBe(
        `import tailwindcss from "@tailwindcss/postcss";\nimport tailess from "tailess/postcss";\nexport default { plugins: [tailess(), tailwindcss()] };\n`,
      );
    });

    it("reuses an import of it that is already there", async () => {
      const { after } = await init(
        "postcss.config.mjs",
        `import tw from "tailess/postcss";\nimport tailwindcss from "@tailwindcss/postcss";\nexport default { plugins: [tailwindcss()] };\n`,
      );
      expect(after.split('"tailess/postcss"').length - 1).toBe(1);
      expect(after).toContain("plugins: [tw(), tailwindcss()]");
    });

    it("keeps a list of strings — the Next.js form — a list of strings", async () => {
      const { after } = await init(
        "postcss.config.js",
        `module.exports = { plugins: ["@tailwindcss/postcss"] };\n`,
      );
      expect(after).toContain(`plugins: ["tailess/postcss", "@tailwindcss/postcss"]`);
    });

    it("does not add a key in front of one that switches it off", async () => {
      // The later duplicate key is the one an object literal keeps, so the plugin stayed
      // off after an edit that read as wiring it.
      const source = `export default { plugins: { "tailess/postcss": false, "@tailwindcss/postcss": {} } };\n`;
      const { code, after } = await init("postcss.config.mjs", source);
      expect(code).toBe(2);
      expect(after).toBe(source);
    });

    it("leaves an empty list alone, which says nothing about its loader", async () => {
      const source = `module.exports = { plugins: [] };\n`;
      const { code, after } = await init("postcss.config.cjs", source);
      expect(code).toBe(2);
      expect(after).toBe(source);
    });

    it("does not add a second entry to a list that has it after Tailwind's", async () => {
      const source = `export default { plugins: { "@tailwindcss/postcss": {}, "tailess/postcss": {} } };\n`;
      await writeFile(join(dir, "postcss.config.mjs"), source);
      const { code, output } = await capture(() => runInit(dir, true));
      expect(code).toBe(2);
      expect(output).toContain("move it first");
      expect(await readFile(join(dir, "postcss.config.mjs"), "utf8")).toBe(source);
    });
  });

  describe("parsing an edit before writing it", () => {
    const edit = (before: string, after: string): Edit => ({
      file: join(dir, "vite.config.ts"),
      before,
      after,
    });

    it("refuses an edit that breaks a config which parsed", async () => {
      const reason = await checkEdit(
        edit(`export default { plugins: [] };`, `export default { plugins: [tailess() };`),
        dir,
      );
      expect(reason).toEqual(expect.any(String));
    });

    it("says nothing when the edit parses, or when the original did not either", async () => {
      expect(
        await checkEdit(edit(`export default {};`, `export default { a: 1 };`), dir),
      ).toBeUndefined();
      expect(await checkEdit(edit(`export default {`, `export default { a`), dir)).toBeUndefined();
    });
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

  it("costs the size of the change, not the square of the file", () => {
    // A full table of (lines + 1)² numbers: 6.7 s at 10,000 lines, and out of memory at
    // 30,000, where `--json` printed nothing at all.
    const define = Array.from({ length: 30_000 }, (_, i) => `    K${i}: ${i},`).join("\n");
    const before = `import tailwindcss from "@tailwindcss/vite";\nexport default {\n  define: {\n${define}\n  },\n  plugins: [tailwindcss()],\n};\n`;
    const plan = planEdit({ kind: "vite", file: join(dir, "vite.config.ts"), source: before });
    const started = performance.now();
    const lines = diffOf(plan as Edit).split("\n");
    expect(performance.now() - started).toBeLessThan(2000);
    expect(lines).toEqual([
      '+ import tailess from "tailess/vite";',
      "-   plugins: [tailwindcss()],",
      "+   plugins: [tailess(), tailwindcss()],",
    ]);
  });

  it("stays correct for changes it did not write", () => {
    const edit = (before: string, after: string): Edit => ({ file: "x", before, after });
    expect(diffOf(edit("a\nb\nc", "a\nc"))).toBe("- b");
    expect(diffOf(edit("a\nc", "a\nb\nc"))).toBe("+ b");
    expect(diffOf(edit("a\nb\nc", "x\nb\ny"))).toBe("- a\n+ x\n- c\n+ y");
    expect(diffOf(edit("same", "same"))).toBe("");
  });
});

describe("an edit laid out like the file it goes in", () => {
  /** Plan an edit for `source` as `file`. */
  const plan = (file: string, source: string) =>
    planEdit(
      file.startsWith("vite")
        ? { kind: "vite", file: join(dir, file), source }
        : { kind: "postcss", file: join(dir, file), source },
    )?.after;

  it("puts the entry on its own line, at the others' indent, in a list of one per line", () => {
    expect(
      plan(
        "vite.config.ts",
        `export default {\n  plugins: [\n    react(),\n    tailwindcss(),\n  ],\n};\n`,
      ),
    ).toContain("plugins: [\n    tailess(),\n    react(),\n");
    expect(
      plan(
        "postcss.config.mjs",
        `export default {\n\tplugins: {\n\t\t"@tailwindcss/postcss": {},\n\t},\n};\n`,
      ),
    ).toContain(`plugins: {\n\t\t"tailess/postcss": {},\n\t\t"@tailwindcss/postcss": {},`);
  });

  it("keeps a one-line list on one line, and fills an empty one tidily", () => {
    expect(
      plan("postcss.config.mjs", `export default { plugins: { "@tailwindcss/postcss": {} } };\n`),
    ).toBe(`export default { plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} } };\n`);
    expect(plan("postcss.config.mjs", `export default { plugins: {} };\n`)).toBe(
      `export default { plugins: { "tailess/postcss": {} } };\n`,
    );
  });

  it("writes the import in the file's own quotes, and without a semicolon where it has none", () => {
    expect(
      plan(
        "vite.config.ts",
        `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
      ),
    ).toContain(`import react from '@vitejs/plugin-react'\nimport tailess from 'tailess/vite'\n`);
    expect(
      plan("postcss.config.mjs", `export default { plugins: { '@tailwindcss/postcss': {} } };\n`),
    ).toContain(`{ 'tailess/postcss': {}, '@tailwindcss/postcss': {} }`);
  });
});
