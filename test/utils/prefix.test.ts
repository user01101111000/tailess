import { describe, expect, it, vi } from "vitest";
import { withPrefix } from "../../src/utils/prefix.js";

describe("withPrefix", () => {
  it("prefixes every token", () => {
    expect(withPrefix("md", "text-lg font-bold")).toBe("md:text-lg md:font-bold");
  });

  it("collapses whitespace", () => {
    expect(withPrefix("md", "  text-lg\n\tfont-bold  ")).toBe("md:text-lg md:font-bold");
  });

  it("splits on every character a whitespace regex would", () => {
    // The token scan replaced a `/\s+/` split, so it has to agree with one —
    // including the separators nobody types on purpose.
    for (const space of [" ", "\t", "\n", "\r", "\v", "\f", " ", " ", "　"]) {
      expect(withPrefix("md", `a${space}b`), JSON.stringify(space)).toBe("md:a md:b");
    }
    // A non-ASCII character that is *not* whitespace must stay inside its token.
    expect(withPrefix("before", "content-['→']")).toBe("before:content-['→']");
  });

  it("accepts clsx-style values", () => {
    expect(withPrefix("hover", ["a", false && "b", { c: true, d: false }])).toBe("hover:a hover:c");
  });

  it("supports arbitrary variants tailess does not model as keys", () => {
    expect(withPrefix("supports-[display:grid]", "grid")).toBe("supports-[display:grid]:grid");
    expect(withPrefix("has-[:checked]", "bg-blue-50")).toBe("has-[:checked]:bg-blue-50");
  });

  it("returns an empty string when there is nothing to prefix", () => {
    expect(withPrefix("md", "")).toBe("");
    expect(withPrefix("md", null)).toBe("");
    expect(withPrefix("md", [])).toBe("");
    expect(withPrefix("", "")).toBe("");
  });

  it("passes classes through unprefixed when the prefix is empty", () => {
    // ":text-lg" would match nothing, and dropping the classes would lose styles
    // silently — so hand them back as written and warn in dev.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(withPrefix("", "text-lg font-bold")).toBe("text-lg font-bold");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("withPrefix — a prefix that cannot form a class", () => {
  it("warns when the prefix contains whitespace", () => {
    // `data("state", "a b", …)` lands here. The browser reads the result as two
    // class names and the build scanner drops it, so nothing anywhere works.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    withPrefix("data-[state=a b]", "p-2");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("whitespace");
    // Names the escape Tailwind actually uses.
    expect(warn.mock.calls[0]?.[0]).toContain("data-[state=a_b]");
    warn.mockRestore();
  });

  it("warns once per prefix, not once per render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 50; i++) withPrefix("aria-x y", "p-2");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("still returns the classes so nothing crashes mid-render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(withPrefix("a b", "p-2")).toBe("a b:p-2");
    warn.mockRestore();
  });

  it("stays quiet for the arbitrary variants that legitimately look complex", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(withPrefix("supports-[display:grid]", "grid")).toBe("supports-[display:grid]:grid");
    expect(withPrefix("has-[:checked]", "bg-blue-50")).toBe("has-[:checked]:bg-blue-50");
    expect(withPrefix("group-[.open]", "rotate-90")).toBe("group-[.open]:rotate-90");
    expect(withPrefix("data-[state=open]", "p-2")).toBe("data-[state=open]:p-2");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
