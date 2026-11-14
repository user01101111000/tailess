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

describe("aria, with a value", () => {
  // The bare form is `[aria-name="true"]`, which is every boolean state and none of the
  // others: `aria-current="page"`, `aria-sort="ascending"` and `aria-orientation` had no
  // spelling here at all, while `data` — the same shape of variant — always took one.
  it("builds the aria-[name=value] variant", () => {
    expect(aria("current", "page", "font-semibold")).toBe("aria-[current=page]:font-semibold");
    expect(aria("sort", "ascending", "text-blue-700")).toBe("aria-[sort=ascending]:text-blue-700");
  });

  it("stringifies a number or a boolean the way data() does", () => {
    expect(aria("level", 2, "text-lg")).toBe("aria-[level=2]:text-lg");
    expect(aria("hidden", false, "block")).toBe("aria-[hidden=false]:block");
  });

  it("builds the attribute-presence variant when the value is nullish", () => {
    expect(aria("current", null, "underline")).toBe("aria-[current]:underline");
    expect(aria("current", undefined, "underline")).toBe("aria-[current]:underline");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(aria("orientation", "vertical", "flex-col gap-2")).toBe(
      "aria-[orientation=vertical]:flex-col aria-[orientation=vertical]:gap-2",
    );
  });

  it("is told apart by the argument count, not by what the arguments hold", () => {
    // Two arguments is the bare form even when the classes are absent — a forwarded
    // `undefined` must not be mistaken for a value with no classes after it.
    expect(aria("expanded", undefined)).toBe("");
    expect(aria("expanded", false)).toBe("");
    expect(aria("current", "page", undefined)).toBe("");
    expect(aria("current", "page", false)).toBe("");
  });
});
