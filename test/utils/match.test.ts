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
});
