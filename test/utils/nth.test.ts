import { describe, expect, it, vi } from "vitest";
import { nth, nthLast, nthLastOfType, nthOfType } from "../../src/utils/nth.js";

/**
 * Both spellings were compiled against Tailwind before they were written down:
 * `nth-3` and `nth-[3]` are each `:nth-child(3)`, `nth-[3n_+_1]` is `:nth-child(3n + 1)`,
 * and all four families — `nth`, `nth-last`, `nth-of-type`, `nth-last-of-type` — take
 * either form.
 */

describe("nth", () => {
  it("puts a position in bare", () => {
    expect(nth(3, "bg-neutral-50")).toBe("nth-3:bg-neutral-50");
  });

  it("puts an expression in brackets", () => {
    expect(nth("3n+1", "border-t")).toBe("nth-[3n+1]:border-t");
    expect(nth("-n+3", "font-bold")).toBe("nth-[-n+3]:font-bold");
    expect(nth("odd", "bg-white")).toBe("nth-[odd]:bg-white");
  });

  it("escapes a space the way Tailwind spells one", () => {
    // `3n + 1` is how CSS reads best, and a class name cannot hold the spaces.
    expect(nth("3n + 1", "border-t")).toBe("nth-[3n_+_1]:border-t");
  });

  it("takes a digit string as an expression, matching the runtime's own split", () => {
    // `typeof value === "number"` is the rule, so a quoted 3 is the bracket form —
    // and the scanner has to make the same call or it predicts the wrong class.
    expect(nth("3", "p-1")).toBe("nth-[3]:p-1");
  });

  it("prefixes every token", () => {
    expect(nth(2, "mt-4 mb-2")).toBe("nth-2:mt-4 nth-2:mb-2");
  });

  it("returns an empty string for empty classes", () => {
    expect(nth(2, false)).toBe("");
  });
});

describe("the other three families", () => {
  it("counts from the end", () => {
    expect(nthLast(1, "border-b-0")).toBe("nth-last-1:border-b-0");
    expect(nthLast("-n+2", "text-sm")).toBe("nth-last-[-n+2]:text-sm");
  });

  it("counts same-type siblings", () => {
    expect(nthOfType(2, "mt-4")).toBe("nth-of-type-2:mt-4");
    expect(nthOfType("odd", "bg-white")).toBe("nth-of-type-[odd]:bg-white");
  });

  it("counts same-type siblings from the end", () => {
    expect(nthLastOfType(1, "mb-0")).toBe("nth-last-of-type-1:mb-0");
  });
});

describe("a position that can never match", () => {
  function warnings(call: () => unknown): string[] {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      call();
      return spy.mock.calls.map((args) => String(args[0]));
    } finally {
      spy.mockRestore();
    }
  }

  it("warns about zero, since :nth-child() counts from 1", () => {
    // `nth-0` compiles and passes every other check; the element is simply never
    // selected, which is the shape of silence this package exists to break.
    const seen = warnings(() => nth(0, "p-1"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("count from 1");
  });

  it("warns about a fraction, which puts a dot in the class name", () => {
    expect(warnings(() => nth(1.5, "p-2"))).toHaveLength(1);
  });

  it("warns about a negative position", () => {
    expect(warnings(() => nth(-2, "p-3"))).toHaveLength(1);
  });

  it("names the helper that was called", () => {
    expect(warnings(() => nthOfType(0, "p-4"))[0]).toContain("nthOfType(");
  });

  it("stays quiet for a real position", () => {
    expect(warnings(() => nth(7, "p-5"))).toEqual([]);
    expect(warnings(() => nthLast(9, "p-6"))).toEqual([]);
  });

  it("says nothing about a negative expression, which is legal", () => {
    // `-n+3` selects the first three; only a negative *number* is the mistake.
    expect(warnings(() => nth("-n+4", "p-7"))).toEqual([]);
  });

  it("still catches an expression no class name can carry", () => {
    expect(warnings(() => nth("", "p-8"))).toHaveLength(1);
    expect(warnings(() => nthLast('a"b', "p-9"))).toHaveLength(1);
  });
});
