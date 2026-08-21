import { clsx } from "clsx";
import { describe, expect, it } from "vitest";
import { join } from "../../src/internal/join.js";
import type { ClassValue } from "../../src/types.js";

/**
 * `join` exists so the package ships no runtime dependency for ~240 bytes of
 * behaviour. That is only worth doing if it behaves *identically* to what it
 * replaced, so `clsx` stays a devDependency and is used here as the oracle: every
 * case below asserts the two agree, rather than asserting against a hand-written
 * expectation that could encode the same mistake twice.
 */
const cases: Array<[label: string, value: ClassValue]> = [
  ["a plain string", "px-2"],
  ["several classes in one string", "px-2 py-1 flex"],
  ["an empty string", ""],
  ["a number", 42],
  ["zero", 0],
  ["the string zero", "0"],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["a bigint (clsx drops it)", 10n],
  ["true", true],
  ["false", false],
  ["null", null],
  ["undefined", undefined],
  ["an empty array", []],
  ["a flat array", ["px-2", "py-1"]],
  ["an array with holes in it", ["px-2", false, null, undefined, "", 0, "py-1"]],
  ["a nested array", ["px-2", ["py-1", ["flex", "grid"]]]],
  ["a deeply nested array", [[[["a"]]], "b"]],
  ["an empty object", {}],
  ["a dictionary", { flex: true, hidden: false, "px-2": 1 }],
  ["a dictionary of only falsy values", { a: 0, b: "", c: null, d: undefined, e: false }],
  ["a dictionary with odd keys", { "w-[calc(100%-2rem)]": true, "before:content-['x']": true }],
  ["a dictionary inside an array", [{ "text-lg": true }, "gap-4"]],
  ["arrays and dictionaries mixed", ["a", { b: true, c: false }, ["d", { e: 1 }]]],
  ["a number inside a dictionary value", { "p-2": 3 }],
  ["a string value in a dictionary", { "p-2": "yes" }],
];

describe("join matches clsx", () => {
  for (const [label, value] of cases) {
    it(label, () => {
      expect(join(value)).toBe(clsx(value));
    });
  }

  it("matches on multiple arguments", () => {
    const args: ClassValue[] = ["px-2", false, ["py-1", { flex: true }], null, 7, "gap-4"];
    expect(join(...args)).toBe(clsx(...args));
    expect(join()).toBe(clsx());
    expect(join(args)).toBe(clsx(args));
  });

  it("counts an inherited enumerable key, exactly as clsx does", () => {
    // `for...in` walks the prototype chain. Nobody writes this on purpose, but a
    // drop-in that quietly disagrees here is not a drop-in.
    const proto = { inherited: true };
    const value = Object.create(proto) as Record<string, unknown>;
    value.own = true;
    expect(join(value)).toBe(clsx(value));
    expect(join(value)).toContain("inherited");
  });

  it("agrees on randomly generated values", () => {
    // Deterministic PRNG: a fuzz that cannot be reproduced is not much of a test.
    let seed = 0x2f6e2b1;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return Math.abs(seed) / 2 ** 31;
    };
    const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    const leaves: ClassValue[] = ["p-2", "flex", "", 0, 1, false, true, null, undefined, 9n];

    const gen = (depth: number): ClassValue => {
      const kind = rand();
      if (depth > 2 || kind < 0.5) return pick(leaves);
      if (kind < 0.75) return Array.from({ length: Math.floor(rand() * 4) }, () => gen(depth + 1));
      const o: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(rand() * 4); i += 1)
        o[pick(["a", "b", "c-1", "d:e"])] = pick(leaves);
      return o;
    };

    for (let i = 0; i < 2000; i += 1) {
      const args = Array.from({ length: Math.floor(rand() * 4) }, () => gen(0));
      expect(
        join(...args),
        JSON.stringify(args, (_, v) => (typeof v === "bigint" ? `${v}n` : v)),
      ).toBe(clsx(...args));
    }
  });
});
