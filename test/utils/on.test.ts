import { describe, expect, it } from "vitest";
import { on } from "../../src/utils/on.js";

describe("on", () => {
  it("prefixes every token with a single state", () => {
    expect(on("hover", "bg-blue-600 text-white")).toBe("hover:bg-blue-600 hover:text-white");
  });

  it("stacks an array of states into a compound variant", () => {
    expect(on(["dark", "hover"], "bg-black")).toBe("dark:hover:bg-black");
  });

  it("keeps array order", () => {
    expect(on(["group-hover", "focus-visible"], "underline")).toBe(
      "group-hover:focus-visible:underline",
    );
  });

  it("accepts clsx-style values", () => {
    expect(on("focus", ["ring-2", false && "ring-4"])).toBe("focus:ring-2");
  });

  it("returns an empty string for empty classes", () => {
    expect(on("hover", "")).toBe("");
    expect(on("hover", false)).toBe("");
    expect(on([], "underline")).toBe("");
  });
});
