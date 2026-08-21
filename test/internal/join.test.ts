import { clsx } from "clsx";
import { describe, expect, it } from "vitest";
import { aria, between, cn, data, on, responsive, ss, until, withPrefix } from "../../src/index.js";
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

  it("agrees on the shapes nobody writes on purpose", () => {
    // Everything reachable through a `ClassValue`, including the values that make
    // both implementations throw. Parity on a throw matters as much as parity on a
    // result: a drop-in that swallows an error the original raised is not one.
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.flex = true;
    const inherited = Object.create({ base: true }) as Record<string, unknown>;
    inherited.own = true;
    const circular: unknown[] = ["a"];
    circular.push(circular);
    const selfKeyed: Record<string, unknown> = { a: true };
    selfKeyed.self = selfKeyed;
    const deep = (n: number): unknown => (n === 0 ? "leaf" : [deep(n - 1)]);

    const shapes: Array<[string, unknown]> = [
      // A sparse array is not listed: both implementations index into the array, so
      // a hole reads as `undefined` and behaves exactly like the explicit one in
      // "an array with holes in it" above.
      ["a null-prototype object", nullProto],
      ["an inherited enumerable key", inherited],
      ["a frozen object", Object.freeze({ "p-2": true })],
      [
        "a getter that throws",
        {
          get boom(): string {
            throw new TypeError("nope");
          },
        },
      ],
      ["a Proxy", new Proxy({ grid: true }, {})],
      ["a boxed String", new String("px-2")],
      [
        "a class instance",
        new (class Widget {
          flex = true;
        })(),
      ],
      ["a symbol key beside a string key", { [Symbol("s")]: true, real: true }],
      ["a Map", new Map([["a", 1]])],
      ["a Set", new Set(["a"])],
      ["a Date", new Date(0)],
      ["a RegExp", /x/g],
      ["a function", () => "a"],
      ["a Symbol", Symbol("x")],
      ["negative zero", -0],
      ["a 100k-character string", "x".repeat(100_000)],
      ["a 5000-element array", Array.from({ length: 5000 }, (_, i) => `c-${i}`)],
      ["nesting 200 deep", deep(200)],
      // Both overflow the stack here. That is deliberate: capping the depth would
      // trade a loud, catchable RangeError for a silently dropped class, and a
      // self-referencing class list is a bug in the caller either way.
      ["a circular array", circular],
      ["an object holding itself", selfKeyed],
      ["numeric keys", { 0: true, 1: false, 2: "yes" }],
      ["an empty-string key", { "": true, a: true }],
      ["a key containing a space", { "a b": true }],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["a string with a newline", "a\nb"],
    ];

    /** Run and capture, so a throw compares as a value rather than escaping. */
    const run = (fn: (value: never) => string, value: unknown): string => {
      try {
        return `= ${fn(value as never)}`;
      } catch (error) {
        return `throws ${(error as Error).constructor.name}`;
      }
    };

    for (const [label, value] of shapes) {
      expect(run(join, value), label).toBe(run(clsx as (value: never) => string, value));
    }
  });

  it("agrees on 50,000 generated values", () => {
    // xorshift32 seeded from the loop counter, so a CI failure replays exactly.
    const prng = (seed: number) => {
      let s = seed >>> 0 || 1;
      return () => {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        return s / 4294967296;
      };
    };

    const leaves: ClassValue[] = [
      "p-2",
      "flex",
      "md:grid",
      "w-[calc(100%-2rem)]",
      "",
      " ",
      "0",
      0,
      1,
      -1,
      2.5,
      false,
      true,
      null,
      undefined,
      9n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "é→🎉",
    ];
    // The prototype-ish keys are here on purpose: `join` only ever reads, and this
    // pins that `__proto__` or `constructor` behaves like any other key.
    const keys = ["a", "b", "c-1", "d:e", "", " ", "0", "toString", "constructor", "__proto__"];

    const gen = (rand: () => number, depth: number): ClassValue => {
      const kind = rand();
      if (depth > 4 || kind < 0.45) return leaves[Math.floor(rand() * leaves.length)] as ClassValue;
      if (kind < 0.72) {
        return Array.from({ length: Math.floor(rand() * 5) }, () => gen(rand, depth + 1));
      }
      const o: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(rand() * 5); i += 1) {
        o[keys[Math.floor(rand() * keys.length)] as string] =
          leaves[Math.floor(rand() * leaves.length)];
      }
      return o;
    };

    // Collected rather than asserted per case: 50,000 `expect` calls are slow, and
    // one list of every divergence is a better failure message than the first.
    const mismatches: string[] = [];
    for (let seed = 1; seed <= 50_000; seed += 1) {
      const rand = prng(seed * 2654435761);
      const args = Array.from({ length: Math.floor(rand() * 5) }, () => gen(rand, 0));
      const mine = join(...args);
      const theirs = clsx(...args);
      if (mine !== theirs) {
        mismatches.push(`seed ${seed}: ${JSON.stringify(mine)} vs ${JSON.stringify(theirs)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("every helper that reaches join survives hostile input", () => {
  // `join` is called from `cn`, `ss` and `withPrefix`, and the rest of the API runs
  // through those three. None may throw on a value a caller could plausibly pass:
  // a crash during a render is worse than a wrong class.
  const hostile: unknown[] = [
    null,
    undefined,
    false,
    true,
    0,
    "",
    Number.NaN,
    9n,
    Symbol("s"),
    () => {},
    new Map(),
    new Date(0),
    /r/,
    [],
    {},
    [[]],
    [{}],
    Object.create(null),
    new Proxy({}, {}),
    [null, [undefined, [false]]],
  ];

  const helpers: Array<[string, (value: never) => string]> = [
    ["cn", (v) => cn(v)],
    ["ss", (v) => ss(v)],
    ["an ss bucket", (v) => ss({ md: v })],
    ["withPrefix", (v) => withPrefix("md", v)],
    ["on", (v) => on("hover", v)],
    ["responsive", (v) => responsive(v, { md: v })],
    ["data", (v) => data("state", "open", v)],
    ["aria", (v) => aria("expanded", v)],
    ["until", (v) => until("md", v)],
    ["between", (v) => between("sm", "lg", v)],
  ];

  /** `String(Object.create(null))` throws, and a label must never be the thing that fails. */
  const describe_ = (value: unknown): string => {
    if (value === null) return "null";
    if (typeof value === "object") return Object.prototype.toString.call(value);
    if (typeof value === "symbol") return "a symbol";
    if (typeof value === "bigint") return `${value}n`;
    return String(value);
  };

  for (const [name, fn] of helpers) {
    it(`${name}() returns a string for every one of them`, () => {
      for (const value of hostile) {
        expect(typeof fn(value as never), `${name} given ${describe_(value)}`).toBe("string");
      }
    });
  }

  it("carries arrays and dictionaries through the whole pipeline", () => {
    expect(cn("px-2", ["py-1", { flex: true }], "px-4")).toBe("py-1 flex px-4");
    expect(ss({ md: ["p-6", false, { "gap-4": 1 }] })).toBe("md:p-6 md:gap-4");
    expect(ss({ base: [], md: [[]] })).toBe("");
    expect(withPrefix("md", ["a", [null, "b"]])).toBe("md:a md:b");
    expect(on(["dark", "hover"], { "bg-black": true })).toBe("dark:hover:bg-black");
    expect(ss("a", ["b"], { md: "c" }, null)).toBe("a b md:c");
    expect(ss({ dark: { hover: ["a", { b: true }] } })).toBe("dark:hover:a dark:hover:b");
    expect(withPrefix("md", 42)).toBe("md:42");
  });
});
