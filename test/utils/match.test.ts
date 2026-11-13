import { describe, expect, it } from "vitest";
import { match } from "../../src/utils/match.js";

describe("match", () => {
  it("returns the class mapped to the key", () => {
    const size = "md" as "sm" | "md" | "lg";
    expect(match(size, { sm: "text-sm", md: "text-base", lg: "text-lg" })).toBe("text-base");
  });

  it("merges multi-class values through cn", () => {
    const tone = "primary" as "primary" | "ghost";
    expect(match(tone, { primary: "px-2 px-4", ghost: "bg-transparent" })).toBe("px-4");
  });

  it("falls back when the key is missing at runtime", () => {
    const tone = "unknown" as "primary";
    expect(match(tone, { primary: "bg-blue-600" }, "bg-gray-200")).toBe("bg-gray-200");
  });

  it("returns an empty string when there is no match and no fallback", () => {
    const tone = "unknown" as "primary";
    expect(match(tone, { primary: "bg-blue-600" })).toBe("");
  });

  it("does not fall back when the mapped value is a present-but-false entry", () => {
    const state = "off" as "off" | "on";
    expect(match(state, { off: false, on: "block" }, "fallback")).toBe("");
  });

  it("falls back for Object.prototype keys instead of returning inherited members", () => {
    // Regression: `key in options` matched inherited keys, so "toString" resolved
    // to Object.prototype.toString rather than the fallback.
    const key = "toString" as "primary";
    expect(match(key, { primary: "bg-blue-600" }, "bg-gray-200")).toBe("bg-gray-200");
  });

  it("accepts more cases than the key's narrowed type", () => {
    // Regression: TypeScript narrows this `const` to "sm" at the call site, and a
    // `Record<K, …>` parameter then rejected `lg` as an excess property — which made
    // the ordinary `const size: "sm" | "lg" = "sm"` spelling a compile error.
    const size: "sm" | "lg" = "sm";
    expect(match(size, { sm: "p-2", lg: "p-8" })).toBe("p-2");
  });

  it("still requires every case of the key to be covered", () => {
    const size = "sm" as "sm" | "lg";
    // @ts-expect-error "lg" is missing from the lookup.
    expect(match(size, { sm: "p-2" })).toBe("p-2");
  });
});

/**
 * The discriminant was typed `string`, and the runtime never cared: a property read
 * stringifies its key. So a column count, a boolean and an optional prop all worked and
 * all failed to compile — which sent each of them to a ternary chain or a cast.
 */
describe("match, on what a component actually has", () => {
  it("takes a number", () => {
    const cols = 2 as 1 | 2 | 3;
    expect(match(cols, { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" })).toBe(
      "grid-cols-2",
    );
  });

  it("still requires every numbered case", () => {
    const cols = 2 as 1 | 2 | 3;
    // @ts-expect-error 3 is missing from the lookup.
    expect(match(cols, { 1: "grid-cols-1", 2: "grid-cols-2" })).toBe("grid-cols-2");
  });

  it("takes a boolean, looked up under the keys an object literal gives it", () => {
    const open = true as boolean;
    expect(match(open, { true: "rotate-180", false: "rotate-0" })).toBe("rotate-180");
    expect(match(!open, { true: "rotate-180", false: "rotate-0" })).toBe("rotate-0");
  });

  it("requires both halves of a boolean", () => {
    const open = true as boolean;
    // @ts-expect-error `false` is missing from the lookup.
    expect(match(open, { true: "rotate-180" })).toBe("rotate-180");
  });

  it("takes an optional prop, which falls back when nobody passed it", () => {
    const size = undefined as "sm" | "lg" | undefined;
    expect(match(size, { sm: "p-2", lg: "p-8" }, "p-4")).toBe("p-4");
    expect(match(size, { sm: "p-2", lg: "p-8" })).toBe("");
    const tone = null as "info" | null;
    expect(match(tone, { info: "bg-blue-50" }, "bg-white")).toBe("bg-white");
  });

  it("does not let a nullish key find a case spelled like it", () => {
    // `options[undefined]` reads the property named "undefined".
    const key = undefined as "undefined" | undefined;
    expect(match(key, { undefined: "p-2" }, "p-4")).toBe("p-4");
    const none = null as "null" | null;
    expect(match(none, { null: "p-2" }, "p-4")).toBe("p-4");
  });

  it("does not ask an optional prop for a case it cannot name", () => {
    const size = "sm" as "sm" | "lg" | undefined;
    // @ts-expect-error "lg" is still missing; only `undefined` asks for nothing.
    expect(match(size, { sm: "p-2" })).toBe("p-2");
  });
});
