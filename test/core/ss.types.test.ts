import { describe, expect, expectTypeOf, it } from "vitest";
import { createTailess, ss } from "../../src/index.js";

/**
 * Guards the public autocomplete contract for `ss()`. Runtime `it()` bodies
 * check behaviour; the `expectTypeOf`/`@ts-expect-error` assertions are enforced
 * by `npm run typecheck` (tsc covers `test/`), which is where key typing lives.
 */
describe("ss() key typing — the autocomplete contract", () => {
  it("default ss() exposes exactly the built-in breakpoint and state keys", () => {
    type Keys = keyof Parameters<typeof ss>[0];
    expectTypeOf<Keys>().toEqualTypeOf<
      | "base"
      | "sm"
      | "md"
      | "lg"
      | "xl"
      | "2xl"
      | "hover"
      | "focus"
      | "focus-visible"
      | "active"
      | "disabled"
      | "dark"
    >();

    // Behaviour: default keys resolve to their prefixes, in order.
    expect(ss({ base: "flex", md: "text-base", hover: "underline" })).toBe(
      "flex md:text-base hover:underline",
    );
  });

  it("createTailess() adds custom keys on top of the defaults", () => {
    const st = createTailess({
      screens: { "3xl": "1600px" },
      states: { groupHover: "group-hover" },
    });

    type Keys = keyof Parameters<typeof st.ss>[0];
    expectTypeOf<Keys>().toEqualTypeOf<
      | "base"
      | "sm"
      | "md"
      | "lg"
      | "xl"
      | "2xl"
      | "3xl"
      | "hover"
      | "focus"
      | "focus-visible"
      | "active"
      | "disabled"
      | "dark"
      | "groupHover"
    >();

    expect(st.ss({ "3xl": "text-2xl", groupHover: "underline" })).toBe(
      "3xl:text-2xl group-hover:underline",
    );
  });

  it("rejects keys that were never configured (compile-time)", () => {
    const st = createTailess({ screens: { "3xl": "1600px" } });

    // Type-only: never executed, so no dev-mode runtime warnings fire.
    function _unknownKeysAreErrors() {
      // @ts-expect-error — "nope" is not a default key
      ss({ nope: "x" });
      // @ts-expect-error — "4xl" was never configured on this instance
      st.ss({ "4xl": "x" });
    }
    void _unknownKeysAreErrors;

    expect(true).toBe(true);
  });
});
