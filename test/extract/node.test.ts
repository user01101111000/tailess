import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderConfigDts, scanProject, writeConfigDts } from "../../src/extract/node.js";

describe("scanProject", () => {
  it("walks a directory and extracts the classes tailess builds at runtime", async () => {
    const { classes, files, dirs } = await scanProject({ paths: ["test/fixtures"] });

    expect(files.some((f) => f.endsWith("sample.tsx"))).toBe(true);
    expect(dirs).toHaveLength(1);
    expect(classes).toEqual([
      "dark:hover:bg-black",
      "hover:opacity-100",
      "md:text-2xl",
      "md:text-red-500",
    ]);
  });

  it("accepts an inline config object for alias resolution", async () => {
    const { classes } = await scanProject({
      paths: ["test/fixtures"],
      config: { states: { hover: "hover" } },
    });
    expect(classes).toContain("hover:opacity-100");
  });

  it("returns the raw screens and states from the config", async () => {
    const { screens, states } = await scanProject({
      paths: ["test/fixtures"],
      config: { screens: { xs: "480px" }, states: { groupHover: "group-hover" } },
    });
    expect(screens).toEqual({ xs: "480px" });
    expect(states).toEqual({ groupHover: "group-hover" });
  });
});

describe("renderConfigDts — the generated type-augmentation", () => {
  it("augments Register with the config's screen and state keys", () => {
    const dts = renderConfigDts({
      screens: { xs: "480px", "3xl": "1600px" },
      states: { groupHover: "group-hover" },
    });
    expect(dts).toContain('declare module "tailess"');
    expect(dts).toContain("interface Register");
    expect(dts).toContain('screens: { "xs": string; "3xl": string }');
    expect(dts).toContain('states: { "groupHover": string }');
  });

  it("emits empty objects when nothing is configured", () => {
    const dts = renderConfigDts({});
    expect(dts).toContain("config: { screens: {}; states: {} }");
  });
});

describe("writeConfigDts — codegen file writing", () => {
  const out = join(tmpdir(), "tailess-node-test.d.ts");
  afterAll(() => rm(out, { force: true }));

  it("writes the file, then reports it unchanged on a second identical run", async () => {
    const config = { screens: { xs: "480px" }, states: {} };
    expect(await writeConfigDts(config, out)).toBe("written");
    expect(await readFile(out, "utf8")).toContain('screens: { "xs": string }');
    // No content change → no redundant write (prevents watch-mode rebuild loops).
    expect(await writeConfigDts(config, out)).toBe("unchanged");
  });
});
