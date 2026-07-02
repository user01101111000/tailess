import { describe, expect, it } from "vitest";
import tailessPostcss from "../../src/postcss/index.js";

interface FakeAtRule {
  name: string;
  params: string;
}

function runOnce(options: { content: string[] }) {
  const prepended: FakeAtRule[] = [];
  const messages: Array<Record<string, unknown>> = [];
  const root = { prepend: (node: FakeAtRule) => prepended.push(node) };
  const helpers = {
    result: { messages },
    postcss: { atRule: (defaults: FakeAtRule) => ({ ...defaults }) },
  };
  const plugin = tailessPostcss(options);
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
});
