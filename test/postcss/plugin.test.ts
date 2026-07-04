import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { TailessConfig } from "../../src/config/types.js";
import tailessPostcss from "../../src/postcss/index.js";

interface FakeDecl {
  prop: string;
  value: string;
}
interface FakeAtRule {
  name: string;
  params: string;
  nodes: FakeDecl[];
  append(node: FakeDecl): void;
}

function runOnce(options: {
  content: string[];
  config?: string | TailessConfig;
  types?: boolean | string;
}) {
  const prepended: FakeAtRule[] = [];
  const messages: Array<Record<string, unknown>> = [];
  const root = { prepend: (node: FakeAtRule) => prepended.push(node) };
  const helpers = {
    result: { messages },
    postcss: {
      atRule: (defaults: { name: string; params: string }): FakeAtRule => {
        const nodes: FakeDecl[] = [];
        return { ...defaults, nodes, append: (node: FakeDecl) => nodes.push(node) };
      },
      decl: (defaults: FakeDecl) => ({ ...defaults }),
    },
  };
  // Default `types: false` so tests never write a `tailess-env.d.ts` into the repo.
  const plugin = tailessPostcss({ types: false, ...options });
  return plugin.Once(root, helpers).then(() => ({ prepended, messages }));
}

describe("tailess/postcss", () => {
  it("is a valid PostCSS plugin creator", () => {
    expect(tailessPostcss.postcss).toBe(true);
    expect(tailessPostcss({}).postcssPlugin).toBe("tailess");
  });

  it("injects a single @source inline directive with the built classes", async () => {
    const { prepended } = await runOnce({ content: ["test/fixtures"] });

    expect(prepended).toHaveLength(1);
    const rule = prepended[0];
    expect(rule?.name).toBe("source");
    expect(rule?.params).toMatch(/^inline\("/);
    expect(rule?.params).toContain("md:text-2xl");
    expect(rule?.params).toContain("dark:hover:bg-black");
  });

  it("registers scanned directories as watch dependencies", async () => {
    const { messages } = await runOnce({ content: ["test/fixtures"] });
    const deps = messages.filter((m) => m.type === "dir-dependency");
    expect(deps).toHaveLength(1);
    expect(String(deps[0]?.dir)).toMatch(/fixtures$/);
  });

  it("emits a @theme block mirroring config breakpoints (override + custom)", async () => {
    const { prepended } = await runOnce({
      content: ["test/fixtures"],
      config: { screens: { md: "867px", "3xl": "1600px" } },
    });

    const theme = prepended.find((r) => r.name === "theme");
    expect(theme).toBeDefined();
    expect(theme?.nodes).toEqual([
      { prop: "--breakpoint-md", value: "867px" }, // overrides Tailwind's default md
      { prop: "--breakpoint-3xl", value: "1600px" }, // brand-new key
    ]);
  });

  it("emits no @theme block when the config sets no screens", async () => {
    const { prepended } = await runOnce({ content: ["test/fixtures"] });
    expect(prepended.some((r) => r.name === "theme")).toBe(false);
  });

  it("generates the type-augmentation file when `types` is a path", async () => {
    const out = join(tmpdir(), "tailess-plugin-test.d.ts");
    afterAll(() => rm(out, { force: true }));

    await runOnce({
      content: ["test/fixtures"],
      config: { screens: { "3xl": "1600px" }, states: { groupHover: "group-hover" } },
      types: out,
    });

    const dts = await readFile(out, "utf8");
    expect(dts).toContain('declare module "tailess"');
    expect(dts).toContain('screens: { "3xl": string }');
    expect(dts).toContain('states: { "groupHover": string }');
  });
});
