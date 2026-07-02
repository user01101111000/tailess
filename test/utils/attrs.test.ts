import { describe, expect, it } from "vitest";
import { aria, data } from "../../src/utils/attrs.js";

describe("data", () => {
  it("builds the data-[name=value] variant", () => {
    expect(data("state", "open", "opacity-100")).toBe("data-[state=open]:opacity-100");
  });

  it("builds the attribute-presence variant when value is nullish", () => {
    expect(data("disabled", null, "pointer-events-none")).toBe(
      "data-[disabled]:pointer-events-none",
    );
  });

  it("prefixes every token in a multi-class value", () => {
    expect(data("state", "active", "flex gap-2")).toBe(
      "data-[state=active]:flex data-[state=active]:gap-2",
    );
  });
});

describe("aria", () => {
  it("builds the aria-* variant", () => {
    expect(aria("expanded", "rotate-180")).toBe("aria-expanded:rotate-180");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(aria("selected", "bg-blue-600 text-white")).toBe(
      "aria-selected:bg-blue-600 aria-selected:text-white",
    );
  });
});
