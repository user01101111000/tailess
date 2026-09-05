import { describe, expect, it, vi } from "vitest";
import { notSupports, supports } from "../../src/utils/supports.js";

describe("supports", () => {
  it("builds a feature-query variant", () => {
    expect(supports("display:grid", "grid")).toBe("supports-[display:grid]:grid");
  });

  it("escapes a space the way Tailwind spells one", () => {
    // Written as CSS spells it. Left alone this is two class names, neither of
    // which means anything, and no rule is generated for either.
    expect(supports("display: grid", "grid")).toBe("supports-[display:_grid]:grid");
  });

  it("escapes one underscore per space, not per run", () => {
    // Tailwind decodes each `_` back to a single space, so collapsing a run here
    // would produce a different condition than the one that was written — and,
    // worse, a different one than the scanner predicts.
    expect(supports("display:  grid", "grid")).toBe("supports-[display:__grid]:grid");
  });

  it("trims, so a stray space cannot change how Tailwind reads the query", () => {
    // A leading `_` decodes to a leading space, which flips Tailwind's parser onto
    // the branch that emits the condition verbatim instead of wrapping it.
    expect(supports("  (display:grid)  ", "grid")).toBe("supports-[(display:grid)]:grid");
  });

  it("keeps the bare property form, which tests the property itself", () => {
    expect(supports("gap", "gap-4")).toBe("supports-[gap]:gap-4");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(supports("display:flex", "flex gap-2")).toBe(
      "supports-[display:flex]:flex supports-[display:flex]:gap-2",
    );
  });

  it("takes a clsx-style value", () => {
    expect(supports("display:grid", ["grid", false && "hidden"])).toBe(
      "supports-[display:grid]:grid",
    );
  });

  it("returns an empty string for empty classes", () => {
    expect(supports("display:grid", false)).toBe("");
  });
});

describe("notSupports", () => {
  it("builds the negated variant, spelled not-supports-*", () => {
    // Tailwind has no `supports-not-*`: that spelling emits no rule at all.
    expect(notSupports("display:grid", "flex")).toBe("not-supports-[display:grid]:flex");
  });

  it("escapes spaces the same way", () => {
    expect(notSupports("backdrop-filter: blur(1px)", "bg-white")).toBe(
      "not-supports-[backdrop-filter:_blur(1px)]:bg-white",
    );
  });

  it("prefixes every token", () => {
    expect(notSupports("display:grid", "flex flex-col")).toBe(
      "not-supports-[display:grid]:flex not-supports-[display:grid]:flex-col",
    );
  });

  it("returns an empty string for empty classes", () => {
    expect(notSupports("display:grid", null)).toBe("");
  });
});

describe("supports — a query that compiles but cannot work", () => {
  /** Run `call` with `console.warn` captured. */
  function warnings(call: () => unknown): string[] {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      call();
      return spy.mock.calls.map((args) => String(args[0]));
    } finally {
      spy.mockRestore();
    }
  }

  it("warns whichever side of a combined query is missing its parentheses", () => {
    // The two are the same mistake, and the check has to read the whole shape:
    // an anchored "does it start with a paren" test passes the first one, and the
    // unparenthesised operand is the worse of the two — `and` must be followed by a
    // parenthesised term, so the browser discards the rule rather than evaluating
    // it false.
    expect(warnings(() => supports("(display:grid) and gap:1rem", "p-1"))).toHaveLength(1);
    expect(warnings(() => supports("gap:1rem and (display:grid)", "p-2"))).toHaveLength(1);
  });

  it("warns when a top-level not is combined with and/or", () => {
    // `@supports not (a) and (b)` is a parse error whichever helper built it, and
    // the notSupports warning's own advice is one paren away from this.
    const viaSupports = warnings(() => supports("not (display:grid) and (gap:5rem)", "p-3"));
    expect(viaSupports).toHaveLength(1);
    expect(viaSupports[0]).toContain("not valid CSS");
  });

  it("stays quiet for a lone negation", () => {
    expect(warnings(() => supports("not (display:grid)", "p-4"))).toEqual([]);
  });

  it("catches an uppercase combinator, since CSS keywords are case-insensitive", () => {
    expect(warnings(() => supports("(display:grid) AND gap:6rem", "p-5"))).toHaveLength(1);
  });

  it("does not warn about and/or inside a value", () => {
    // A query with no parenthesised group cannot be a combined one, so `or` here is
    // part of a custom property name. A warning that fires on working code is worse
    // than no warning at all.
    expect(warnings(() => notSupports("anchor-name: --or", "p-6"))).toEqual([]);
    expect(warnings(() => supports("content: 'and'", "p-7"))).toEqual([]);
    const url = () => supports("background-image: url(/a/black-and-white.png)", "p-8");
    expect(warnings(url)).toEqual([]);
  });

  it("warns about an empty query, which builds a class nothing generates a rule for", () => {
    const seen = warnings(() => supports("", "p-9"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("empty feature query");
    expect(supports("", "p-9")).toBe("supports-[]:p-9");
  });

  it("warns about a character no class name can carry", () => {
    // The build enumerates candidates by writing them into a stylesheet, so these
    // are dropped there while the runtime still puts the class on the element —
    // the one failure this package exists to prevent.
    const semicolon = warnings(() => supports("display: grid;", "p-10"));
    expect(semicolon).toHaveLength(1);
    expect(semicolon[0]).toContain("cannot appear in a class name");
    expect(warnings(() => supports('(font-family: "My Font")', "p-11"))).toHaveLength(1);
  });

  it("warns about an underscore in a var() fallback, which Tailwind does decode", () => {
    // Only the custom-property *name* keeps its underscores; a fallback is decoded
    // like any other text, so `my_value` becomes `my value`.
    expect(warnings(() => supports("width: var(--a, my_value)", "p-12"))).toHaveLength(1);
  });

  it("warns when a combined query is not parenthesised term by term", () => {
    // Tailwind wraps this as one declaration — `@supports (display:grid and
    // (gap:1rem))` — which parses, generates a rule, and is false in every browser.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(supports("display:grid and (gap:1rem)", "grid")).toBe(
      "supports-[display:grid_and_(gap:1rem)]:grid",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("false in every browser");
    warn.mockRestore();
  });

  it("stays quiet when every term is parenthesised", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(supports("(display:flex) and (gap:2rem)", "flex")).toBe(
      "supports-[(display:flex)_and_(gap:2rem)]:flex",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns that notSupports cannot negate a combined query", () => {
    // `@supports not (a) and (b)` is a CSS parse error, so the rule is discarded
    // and even the selector never appears in the output.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    notSupports("(display:grid) and (gap:3rem)", "flex");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("not valid CSS");
    warn.mockRestore();
  });

  it("still warns for notSupports after the same query passed under supports", () => {
    // The two are not interchangeable: `(a) and (b)` is fine as a query and a parse
    // error once negated, so a clean check under one must not vouch for the other.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    supports("(display:grid) and (gap:4rem)", "grid");
    expect(warn).not.toHaveBeenCalled();
    notSupports("(display:grid) and (gap:4rem)", "flex");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("not valid CSS");
    warn.mockRestore();
  });

  it("warns about a literal underscore, which Tailwind reads as a space", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    supports("--my_var:1", "underline");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("underscore");
    warn.mockRestore();
  });

  it("does not cry wolf about an underscore inside var()", () => {
    // Tailwind leaves underscores alone there, so this spelling is already correct.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(supports("color:var(--brand_ink)", "underline")).toBe(
      "supports-[color:var(--brand_ink)]:underline",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stays quiet for an ordinary query", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(supports("container-type: inline-size", "block")).toBe(
      "supports-[container-type:_inline-size]:block",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns about a combined query with no parentheses at all", () => {
    // The shape the docs lead with, and the one a reader is most likely to write
    // before reading further. Tailwind wraps it as a single declaration, so the rule
    // exists and is false in every browser — nothing else reports it.
    const seen = warnings(() => supports("display: grid and gap: 1rem", "grid"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("false in every browser");
    expect(warnings(() => notSupports("display: flex and gap: 1rem", "block"))).toHaveLength(1);
  });

  it("reads a second colon as the tell, so one declaration is left alone", () => {
    // What separates the two is how many declarations were run together, not the
    // keyword: `--or` and `'and'` are single declarations that happen to contain one.
    expect(warnings(() => supports("anchor-name: --or", "p-13"))).toEqual([]);
    expect(warnings(() => supports("transition: color 1s and 2s", "p-14"))).toEqual([]);
    expect(warnings(() => supports("grid-template-columns: 1fr and 2fr", "p-15"))).toEqual([]);
  });

  it("warns about an unclosed quote, which drops the class from the build", () => {
    // The same check every other arbitrary-value helper runs. An odd `'` ends the
    // `@source inline("…")` string early and takes the rest of the chunk with it.
    const seen = warnings(() => supports("content: 'a", "p-16"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("cannot appear in a class name");
    expect(warnings(() => supports("content: 'a' 'b'", "p-17"))).toEqual([]);
  });
});
