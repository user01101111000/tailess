import { describe, expect, it, vi } from "vitest";
import { container, group, peer } from "../../src/utils/named.js";

describe("group", () => {
  it("builds a named group variant", () => {
    expect(group("row", "hover", "underline")).toBe("group-hover/row:underline");
  });

  it("works with a compound element state", () => {
    expect(group("card", "focus-within", "ring-2")).toBe("group-focus-within/card:ring-2");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(group("row", "hover", "underline font-bold")).toBe(
      "group-hover/row:underline group-hover/row:font-bold",
    );
  });

  it("takes a clsx-style value", () => {
    expect(group("row", "hover", ["underline", false && "hidden"])).toBe(
      "group-hover/row:underline",
    );
  });

  it("returns an empty string for empty classes", () => {
    expect(group("row", "hover", false)).toBe("");
  });
});

describe("peer", () => {
  it("builds a named peer variant", () => {
    expect(peer("email", "invalid", "text-red-600")).toBe("peer-invalid/email:text-red-600");
  });

  it("prefixes every token", () => {
    expect(peer("terms", "checked", "font-bold underline")).toBe(
      "peer-checked/terms:font-bold peer-checked/terms:underline",
    );
  });

  it("returns an empty string for empty classes", () => {
    expect(peer("email", "invalid", null)).toBe("");
  });
});

describe("container", () => {
  it("builds a named container query", () => {
    expect(container("sidebar", "@md", "grid-cols-2")).toBe("@md/sidebar:grid-cols-2");
  });

  it("works in the max direction", () => {
    expect(container("main", "@max-lg", "hidden")).toBe("@max-lg/main:hidden");
  });

  it("prefixes every token", () => {
    expect(container("sidebar", "@lg", "grid gap-4")).toBe("@lg/sidebar:grid @lg/sidebar:gap-4");
  });

  it("returns an empty string for empty classes", () => {
    expect(container("sidebar", "@md", undefined)).toBe("");
  });
});

describe("a name Tailwind cannot use", () => {
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

  it("warns about an empty name, which produces no rule at all", () => {
    const seen = warnings(() => group("", "hover", "underline"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("letters, digits");
  });

  it("warns about whitespace, which splits the class in two", () => {
    // Two warnings here, both true: `withPrefix` also refuses a prefix containing a
    // space. Assert on the specific one rather than the count, since the generic one
    // is not this helper's to suppress.
    const seen = warnings(() => group("my row", "hover", "underline"));
    expect(seen.some((m) => m.includes("letters, digits"))).toBe(true);
  });

  it("warns about a slash or a colon, which Tailwind reads as syntax", () => {
    expect(warnings(() => group("a/b", "hover", "underline"))).toHaveLength(1);
    expect(warnings(() => peer("a:b", "checked", "underline"))).toHaveLength(1);
  });

  it("warns about a dot, whose parent matcher reads as two classes", () => {
    // `group-hover/a.b` compiles, but the selector it emits is
    // `:where(.group\/a.b)` — an element needing *both* `group/a` and `b`.
    expect(warnings(() => group("a.b", "hover", "underline"))).toHaveLength(1);
  });

  it("names the helper that was called", () => {
    expect(warnings(() => container("bad name", "@md", "grid"))[0]).toContain("container(");
  });

  it("stays quiet for letters, digits, hyphens and underscores", () => {
    expect(warnings(() => group("row-2", "hover", "underline"))).toEqual([]);
    expect(warnings(() => peer("email_field", "invalid", "underline"))).toEqual([]);
    expect(warnings(() => container("Sidebar2", "@md", "grid"))).toEqual([]);
  });

  it("holds a container name to the stricter CSS identifier rules", () => {
    // A container name is not only part of the class: Tailwind writes it into
    // `container-name:` and the `@container` prelude, where CSS demands a
    // `<custom-ident>`. These compile — the scanner and the parity check both see a
    // rule — and the browser then discards the whole `@container` block.
    for (const name of ["2xl-panel", "123", "0", "1a", "7f3a9c", "-1", "-"]) {
      expect(
        warnings(() => container(name, "@md", "grid")),
        name,
      ).toHaveLength(1);
    }
  });

  it("rejects the container-query keywords, which are read as syntax", () => {
    // `not` is the worst: the prelude still parses, as an *unnamed negated* query, so
    // the rule applies to the nearest container with inverted logic.
    for (const name of ["none", "and", "or", "not", "initial", "inherit", "default"]) {
      expect(
        warnings(() => container(name, "@md", "grid")),
        name,
      ).toHaveLength(1);
    }
  });

  it("allows those same names for group and peer, which only build a class", () => {
    // Tailwind escapes the name into a selector here, so a leading digit is fine:
    // `.group-hover\/123\:underline:is(:where(.group\/123):hover *)` is valid CSS.
    expect(warnings(() => group("123", "hover", "underline"))).toEqual([]);
    expect(warnings(() => peer("0", "checked", "underline"))).toEqual([]);
    expect(warnings(() => group("none", "hover", "underline"))).toEqual([]);
  });

  it("allows a dashed ident as a container name", () => {
    expect(warnings(() => container("--panel", "@md", "grid"))).toEqual([]);
  });
});
