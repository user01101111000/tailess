import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { on } from "../../src/utils/on.js";

describe("on", () => {
  it("prefixes classes with a default state variant", () => {
    expect(on(defaultConfig, "hover", "bg-blue-600 text-white")).toBe(
      "hover:bg-blue-600 hover:text-white",
    );
  });

  it("resolves custom state aliases from config", () => {
    const config = resolveConfig({ states: { groupHover: "group-hover" } });
    expect(on(config, "groupHover", "block")).toBe("group-hover:block");
  });

  it("falls back to the raw key when the state is unknown", () => {
    expect(on(defaultConfig, "aria-expanded", "rotate-180")).toBe("aria-expanded:rotate-180");
  });

  it("stacks multiple states in order", () => {
    expect(on(defaultConfig, ["dark", "hover"], "bg-black")).toBe("dark:hover:bg-black");
  });

  it("resolves each state in a stack through config aliases", () => {
    const config = resolveConfig({ states: { groupHover: "group-hover" } });
    expect(on(config, ["dark", "groupHover"], "block")).toBe("dark:group-hover:block");
  });

  it("treats Object.prototype keys as literal prefixes, not inherited members", () => {
    // Regression: `config.states[key] ?? key` used to return the inherited
    // function for keys like "toString"/"constructor", producing garbage.
    expect(on(defaultConfig, "toString", "block")).toBe("toString:block");
    expect(on(defaultConfig, "constructor", "block")).toBe("constructor:block");
    expect(on(defaultConfig, ["dark", "toString"], "block")).toBe("dark:toString:block");
  });
});
