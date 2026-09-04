import { describe, expect, expectTypeOf, it } from "vitest";
import type { ResponsiveMap, ScreenKey, SsInput, StateKey } from "../src/index.js";
import {
  aria,
  between,
  cn,
  container,
  data,
  group,
  has,
  inside,
  match,
  maxScreenKeys,
  notHas,
  notSupports,
  nth,
  nthLast,
  nthLastOfType,
  nthOfType,
  on,
  peer,
  responsive,
  screenKeys,
  screens,
  ss,
  stateKeys,
  supports,
  until,
  variants,
  vars,
  withPrefix,
} from "../src/index.js";

describe("public API", () => {
  it("exports every helper as a plain function — no config, no factory", () => {
    for (const fn of [
      ss,
      cn,
      responsive,
      on,
      until,
      between,
      match,
      data,
      aria,
      withPrefix,
      supports,
      notSupports,
      vars,
      group,
      peer,
      container,
      has,
      notHas,
      inside,
      nth,
      nthLast,
      nthOfType,
      nthLastOfType,
      variants,
    ]) {
      expect(typeof fn).toBe("function");
    }
  });

  it("ss groups classes by breakpoint/state in canonical order", () => {
    expect(ss({ base: "flex text-xl", md: "text-2xl", hover: "opacity-100" })).toBe(
      "flex text-xl md:text-2xl hover:opacity-100",
    );
  });

  it("cn is clsx + tailwind-merge with nothing prepended", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm", false, "font-bold")).toBe("text-sm font-bold");
  });

  it("exposes Tailwind's breakpoints for use from JS", () => {
    expect(screenKeys).toEqual(["sm", "md", "lg", "xl", "2xl"]);
    expect(screens.md).toBe("48rem");
    expect(maxScreenKeys).toEqual(["max-2xl", "max-xl", "max-lg", "max-md", "max-sm"]);
  });

  it("exposes the state variant keys, with no duplicates", () => {
    expect(stateKeys).toContain("hover");
    expect(stateKeys).toContain("group-hover");
    expect(stateKeys).toContain("dark");
    expect(new Set(stateKeys).size).toBe(stateKeys.length);
  });
});

describe("types", () => {
  it("restricts ss keys to base + built-in breakpoints/states", () => {
    expectTypeOf<SsInput>().toHaveProperty("base");
    expectTypeOf<SsInput>().toHaveProperty("md");
    expectTypeOf<SsInput>().toHaveProperty("max-md");
    expectTypeOf<SsInput>().toHaveProperty("group-hover");

    // @ts-expect-error "3xl" is not a built-in Tailwind breakpoint.
    const bad: SsInput = { "3xl": "text-2xl" };
    expect(bad).toBeDefined();
  });

  it("restricts breakpoint and state arguments", () => {
    expectTypeOf<ScreenKey>().toEqualTypeOf<"sm" | "md" | "lg" | "xl" | "2xl">();
    expectTypeOf<StateKey>().toExtend<string>();
    expectTypeOf<ResponsiveMap>().toHaveProperty("md");

    // @ts-expect-error "3xl" is not a built-in Tailwind breakpoint.
    until("3xl", "hidden");
    // @ts-expect-error "hoverr" is not a Tailwind state variant.
    on("hoverr", "underline");
  });
});
