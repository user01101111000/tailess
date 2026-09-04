import { describe, expect, it, vi } from "vitest";
import { has, inside, notHas } from "../../src/utils/has.js";

/**
 * `has` and `in` are compound variants, so their plain-state spellings are keys —
 * `ss({ "has-checked": … })` covers the same 36 states `group-*` and `peer-*` do, and
 * `test/constants.test.ts` proves that against Tailwind's own registry. These helpers
 * are for the other form: an arbitrary selector, where the space a class name cannot
 * hold is the trap.
 */

describe("has", () => {
  it("builds a has-* variant from a selector", () => {
    expect(has(":checked", "bg-blue-50")).toBe("has-[:checked]:bg-blue-50");
  });

  it("escapes a space the way Tailwind spells one", () => {
    // Left alone this is two class names, neither of which means anything.
    expect(has("> img", "p-0")).toBe("has-[>_img]:p-0");
    expect(has("+ p", "p-2")).toBe("has-[+_p]:p-2");
  });

  it("escapes one underscore per space, not per run", () => {
    expect(has(">  img", "p-0")).toBe("has-[>__img]:p-0");
  });

  it("carries an attribute selector through, brackets and all", () => {
    expect(has("input[type=text]", "ring-2")).toBe("has-[input[type=text]]:ring-2");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(has(":checked", "ring-2 ring-blue-500")).toBe(
      "has-[:checked]:ring-2 has-[:checked]:ring-blue-500",
    );
  });

  it("returns an empty string for empty classes", () => {
    expect(has(":checked", false)).toBe("");
  });
});

describe("notHas", () => {
  it("builds the negated variant, spelled not-has-*", () => {
    expect(notHas(":checked", "opacity-50")).toBe("not-has-[:checked]:opacity-50");
  });

  it("prefixes every token", () => {
    expect(notHas("img", "p-2 gap-2")).toBe("not-has-[img]:p-2 not-has-[img]:gap-2");
  });
});

describe("inside", () => {
  it("builds an in-* variant", () => {
    expect(inside(".dark", "text-white")).toBe("in-[.dark]:text-white");
  });

  it("carries a bracketed attribute selector", () => {
    expect(inside("[data-theme=dark]", "bg-black")).toBe("in-[[data-theme=dark]]:bg-black");
  });

  it("returns an empty string for empty classes", () => {
    expect(inside(".dark", null)).toBe("");
  });
});

describe("a selector that cannot become a class", () => {
  function warnings(call: () => unknown): string[] {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      call();
      return spy.mock.calls.map((args) => String(args[0]));
    } finally {
      spy.mockRestore();
    }
  }

  it("warns about an empty selector", () => {
    const seen = warnings(() => has("", "p-1"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("empty selector");
    expect(has("", "p-1")).toBe("has-[]:p-1");
  });

  it("warns about a character no class name can carry", () => {
    // The candidate list is written into a stylesheet, so these are dropped there
    // while the runtime still puts the class on the element.
    expect(warnings(() => has('input[value="x"]', "p-2"))).toHaveLength(1);
    expect(warnings(() => notHas("a;b", "p-3"))).toHaveLength(1);
  });

  it("warns about an unclosed quote, which would poison the candidate list", () => {
    expect(warnings(() => inside("[title='x]", "p-4"))).toHaveLength(1);
  });

  it("stays quiet for a selector whose quotes do close", () => {
    expect(warnings(() => has("[title='x']", "p-5"))).toEqual([]);
  });

  it("stays quiet for ordinary selectors", () => {
    expect(warnings(() => has(":focus-within", "p-6"))).toEqual([]);
    expect(warnings(() => has("> :nth-child(2)", "p-7"))).toEqual([]);
    expect(warnings(() => inside(".prose", "p-8"))).toEqual([]);
  });

  it("names the helper that was called", () => {
    expect(warnings(() => notHas("", "p-9"))[0]).toContain("notHas(");
  });
});
