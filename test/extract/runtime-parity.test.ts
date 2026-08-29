import { describe, expect, it } from "vitest";
import { extractClasses } from "../../src/extract/extract.js";
import {
  aria,
  between,
  cn,
  data,
  match,
  on,
  responsive,
  ss,
  until,
  withPrefix,
} from "../../src/index.js";

/**
 * The one invariant this package exists to hold: **every class the runtime can
 * emit must be a candidate the scanner found**. A class on the element with no
 * rule behind it is invisible — no console error, no build warning, just an
 * unstyled element — so the two halves are checked against each other directly
 * rather than each against a hand-written list that can drift.
 *
 * Each case is a source string. It is handed to the scanner *as text*, then
 * evaluated with the real helpers and the bindings a call site would have. The
 * scanner over-approximates by design, so the assertion is one-directional:
 * runtime output must be a subset of the candidates, never the reverse.
 */
const helpers = { ss, cn, match, on, until, between, responsive, data, aria, withPrefix } as const;

/** Run `src` with `env` bound, using the same text the scanner was given. */
function evaluate(src: string, env: Record<string, unknown>): string {
  const names = [...Object.keys(helpers), ...Object.keys(env)];
  const values = [...Object.values(helpers), ...Object.values(env)];
  return new Function(...names, `return ${src}`)(...values) as string;
}

const cases: Array<{ src: string; env?: Record<string, unknown> }> = [
  // Nesting, at every depth and under every kind of key.
  { src: `ss({ base: "flex", md: "p-6", lg: { base: "p-8", hover: "shadow-lg" } })` },
  { src: `ss({ dark: { md: { hover: "bg-black" } } })` },
  {
    src: `ss({ md: { base: "p-6", hover: "p-8", "max-lg": "grid" }, dark: { hover: "text-blue-300" } })`,
  },
  { src: `ss({ sm: { "max-lg": "block" } })` },
  { src: `ss({ "2xl": { hover: "brightness-125" } })` },
  { src: `ss({ md: "w-[calc(100%-2rem)]", lg: { hover: "grid-cols-[repeat(2,1fr)]" } })` },

  // Maps that do not start their argument — the shape the scanner used to miss.
  {
    src: `ss({ base: "rounded" }, loading && { base: "animate-pulse", dark: "bg-neutral-800" })`,
    env: { loading: true },
  },
  { src: `ss(a, open ? { md: "p-6" } : { md: "p-2" })`, env: { a: "x", open: true } },
  { src: `ss(a, open ? { md: "p-6" } : { md: "p-2" })`, env: { a: "x", open: false } },
  { src: `ss({ md: isOpen && { hover: "p-8" } })`, env: { isOpen: true } },
  { src: `ss({ md: wide ? { hover: "p-8" } : "p-2" })`, env: { wide: true } },
  { src: `ss({ md: wide ? { hover: "p-8" } : "p-2" })`, env: { wide: false } },

  // Values that are classes rather than maps, including the ones that look alike.
  { src: `ss({ md: [{ "text-lg": cond }, other && "gap-4"] })`, env: { cond: true, other: true } },
  { src: `ss({ md: match(size, { sm: "p-1", lg: "p-8" }) })`, env: { size: "sm" } },
  { src: `ss({ md: cn("p-1", cond && "p-2") })`, env: { cond: true } },
  { src: `ss(rows[0], { md: "p-4" })`, env: { rows: ["z"] } },
  { src: `ss("px-2", cond && "px-4", { md: "p-6" })`, env: { cond: true } },

  // A whole className, the way one is actually written.
  {
    src: `ss({ base: "flex", md: wide ? "p-6" : "p-2", "2xl": { hover: "brightness-125" } }, disabled && { sm: "contrast-125", "peer-checked": "saturate-150" }, ["shadow-sm", wide && "shadow-lg"], match(tone, { info: "bg-blue-50" }), className)`,
    env: { wide: true, disabled: true, tone: "info", className: "underline" },
  },

  // The other helpers, including one behind a condition.
  { src: `responsive("text-sm", cond && { md: "text-lg" })`, env: { cond: true } },
  { src: `on(["dark", "hover"], "bg-black")` },
  { src: `between("sm", "lg", "grid")` },
  { src: `until("md", "hidden")` },

  // A `clsx` dictionary names its classes in the *keys*, so an unquoted one puts no
  // string literal in the source at all. Every case below used to emit a class with
  // no CSS behind it; the quoted spelling worked only by accident, because the key
  // happened to look like a string to the sweep.
  { src: `until("md", { hidden: collapsed })`, env: { collapsed: true } },
  { src: `on("hover", { underline: yes })`, env: { yes: true } },
  { src: `on(["dark", "hover"], { hidden: yes })`, env: { yes: true } },
  { src: `between("sm", "lg", { grid: yes })`, env: { yes: true } },
  { src: `aria("expanded", { hidden: yes })`, env: { yes: true } },
  { src: `data("state", "open", { hidden: yes })`, env: { yes: true } },
  { src: `withPrefix("has-[:checked]", { underline: yes })`, env: { yes: true } },
  { src: `responsive("text-sm", { md: { hidden: yes } })`, env: { yes: true } },
  { src: `ss({ md: ["p-4", { hidden: yes }] })`, env: { yes: true } },
  { src: `ss({ md: cn("p-4", { hidden: yes }) })`, env: { yes: true } },
  { src: `ss({ lg: ["ring-2", { hidden: !open }] })`, env: { open: false } },
  { src: `ss({ md: [{ truncate: long }] })`, env: { long: true } },

  // `data`'s value is `string | number | boolean | …`, and a number or a boolean is
  // every bit as static as a string — it is just not a string *literal*.
  { src: `data("count", 3, "opacity-100")` },
  { src: `data("checked", true, "underline")` },
  { src: `data("index", 0, "font-bold")` },
  { src: `data("open", false, "hidden")` },

  // A helper called inside a bucket has already built its own prefix, so the
  // bucket's key stacks on top of it. `has-*` takes a value and so is not one of
  // the keys, which leaves `withPrefix` with no other spelling.
  { src: `ss({ md: withPrefix("has-[:checked]", "underline") })` },
  { src: `ss({ md: on("hover", "underline") })` },
  { src: `ss({ md: aria("expanded", "rotate-180") })` },
  { src: `ss({ md: until("lg", "hidden") })` },
  { src: `ss({ dark: { md: data("state", "open", "hidden") } })` },
];

describe("what the runtime builds, the scanner finds", () => {
  for (const { src, env = {} } of cases) {
    const bindings = Object.entries(env)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    it(`${src}${bindings ? `  [${bindings}]` : ""}`, () => {
      const candidates = new Set(extractClasses(src));
      // Unprefixed classes are literal in the source, so Tailwind finds those itself;
      // the prefixed ones are the ones only this bridge can supply.
      const emitted = evaluate(src, env)
        .split(/\s+/)
        .filter((cls) => cls !== "" && cls.includes(":"));

      expect(emitted.length).toBeGreaterThan(0);
      expect(emitted.filter((cls) => !candidates.has(cls))).toEqual([]);
    });
  }
});
