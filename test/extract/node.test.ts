import { describe, expect, it } from "vitest";
import { scanProject } from "../../src/extract/node.js";

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
});
