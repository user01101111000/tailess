import { describe, expect, it } from "vitest";
import { extractClasses } from "../../src/extract/extract.js";

describe("extractClasses", () => {
  it("prefixes ss() buckets with their key and skips base", () => {
    expect(
      extractClasses(
        `ss({ base: "flex text-xl", md: "text-2xl font-bold", hover: "opacity-100" })`,
      ),
    ).toEqual(["hover:opacity-100", "md:font-bold", "md:text-2xl"]);
  });

  it("handles max-* keys in ss()", () => {
    expect(extractClasses(`ss({ "max-md": "hidden" })`)).toEqual(["max-md:hidden"]);
  });

  it("emits every branch of a conditional bucket", () => {
    expect(extractClasses(`ss({ md: isActive ? "text-2xl" : "text-xs" })`)).toEqual([
      "md:text-2xl",
      "md:text-xs",
    ]);
    expect(extractClasses(`ss({ md: isActive && "text-2xl" })`)).toEqual(["md:text-2xl"]);
    // A clsx dictionary lives inside an array, where nothing can confuse it with a
    // nested bucket map — and the brackets are exactly how the scanner tells.
    expect(extractClasses(`ss({ md: [{ "text-2xl": a, "text-xs": b }] })`)).toEqual([
      "md:text-2xl",
      "md:text-xs",
    ]);
    expect(extractClasses(`ss({ lg: ["gap-4", a && "grid-cols-3"] })`)).toEqual([
      "lg:gap-4",
      "lg:grid-cols-3",
    ]);
  });

  it("reads responsive() variants but leaves the literal base alone", () => {
    expect(extractClasses(`responsive("text-sm", { md: "text-lg", xl: "text-2xl" })`)).toEqual([
      "md:text-lg",
      "xl:text-2xl",
    ]);
  });

  it("handles on() with a single state and with a stacked array", () => {
    expect(extractClasses(`on("hover", "bg-blue-600 text-white")`)).toEqual([
      "hover:bg-blue-600",
      "hover:text-white",
    ]);
    expect(extractClasses(`on(["dark", "hover"], "bg-black")`)).toEqual(["dark:hover:bg-black"]);
  });

  it("handles until() and between()", () => {
    expect(extractClasses(`until("md", "hidden")`)).toEqual(["max-md:hidden"]);
    expect(extractClasses(`between("sm", "lg", "block")`)).toEqual(["sm:max-lg:block"]);
  });

  it("handles data() in both value and presence form", () => {
    expect(extractClasses(`data("state", "open", "opacity-100")`)).toEqual([
      "data-[state=open]:opacity-100",
    ]);
    expect(extractClasses(`data("disabled", null, "pointer-events-none")`)).toEqual([
      "data-[disabled]:pointer-events-none",
    ]);
    // A dynamic value can't be resolved, so fall back to the presence form.
    expect(extractClasses(`data("state", value, "underline")`)).toEqual(["data-[state]:underline"]);
  });

  it("reads a data() value that is a number or a boolean", () => {
    // `data` takes `string | number | boolean | …`. These are static too — they are
    // just not string *literals*, so the sweep that recovers strings finds nothing and
    // the presence form used to be emitted instead: the class the runtime puts on the
    // element gets no CSS, and the CSS that is generated matches whenever the
    // attribute merely exists. `data-checked={true}` is what React writes.
    expect(extractClasses(`data("count", 3, "opacity-100")`)).toEqual([
      "data-[count=3]:opacity-100",
    ]);
    expect(extractClasses(`data("checked", true, "underline")`)).toEqual([
      "data-[checked=true]:underline",
    ]);
    expect(extractClasses(`data("index", 0, "font-bold")`)).toEqual(["data-[index=0]:font-bold"]);
    expect(extractClasses(`data("open", false, "hidden")`)).toEqual(["data-[open=false]:hidden"]);
    expect(extractClasses(`data("ratio", -1.5, "grid")`)).toEqual(["data-[ratio=-1.5]:grid"]);
  });

  it("reads the keys of an unquoted clsx dictionary", () => {
    // A dictionary names its classes in the *keys*, so an unquoted one puts no string
    // literal in the source at all. Quoting was the only reason the documented
    // `[{ "text-lg": on }]` form ever worked.
    expect(extractClasses(`until("md", { hidden: collapsed })`)).toEqual(["max-md:hidden"]);
    expect(extractClasses(`on("hover", { underline: yes })`)).toEqual(["hover:underline"]);
    expect(extractClasses(`aria("expanded", { hidden: yes })`)).toEqual(["aria-expanded:hidden"]);
    expect(extractClasses(`ss({ md: ["p-4", { hidden: yes }] })`)).toEqual(["md:hidden", "md:p-4"]);
    // Shorthand is `{ hidden: hidden }`, which emits the same class.
    expect(extractClasses(`on("hover", { underline })`)).toEqual(["hover:underline"]);
  });

  it("does not read a lookup's keys as classes", () => {
    // `match`'s second argument is keyed by a discriminant, not by class name, so its
    // keys must not be safelisted the way a dictionary's are.
    expect(extractClasses(`on("hover", match(tone, { block: "a", flex: "b" }))`)).toEqual([
      "hover:a",
      "hover:b",
    ]);
  });

  it("stacks a bucket key onto a helper called inside the bucket", () => {
    // The inner call has already built its prefix by the time the bucket sees the
    // string it returned, so the key stacks on top. `has-*` takes a value and so is
    // not one of the keys, which leaves `withPrefix` with no other spelling.
    expect(extractClasses(`ss({ md: withPrefix("has-[:checked]", "underline") })`)).toContain(
      "md:has-[:checked]:underline",
    );
    expect(extractClasses(`ss({ md: on("hover", "underline") })`)).toContain("md:hover:underline");
    expect(extractClasses(`ss({ dark: { md: aria("expanded", "rotate-180") } })`)).toContain(
      "dark:md:aria-expanded:rotate-180",
    );
  });

  it("handles aria() and withPrefix()", () => {
    expect(extractClasses(`aria("expanded", "rotate-180")`)).toEqual(["aria-expanded:rotate-180"]);
    expect(extractClasses(`withPrefix("supports-[display:grid]", "grid")`)).toEqual([
      "supports-[display:grid]:grid",
    ]);
  });

  it("finds calls nested inside other calls", () => {
    expect(extractClasses(`cn(ss({ md: "flex" }), on("hover", "underline"))`)).toEqual([
      "hover:underline",
      "md:flex",
    ]);
  });

  it("finds method-style calls", () => {
    expect(extractClasses(`t.ss({ md: "flex" })`)).toEqual(["md:flex"]);
  });

  it("de-duplicates and sorts", () => {
    expect(extractClasses(`ss({ md: "flex" }); ss({ md: "flex" }); ss({ lg: "grid" })`)).toEqual([
      "lg:grid",
      "md:flex",
    ]);
  });

  it("ignores classes it cannot know statically", () => {
    expect(extractClasses("ss({ md: size })")).toEqual([]);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the interpolation is the subject of the test
    expect(extractClasses("ss({ md: `text-${size}` })")).toEqual([]);
    expect(extractClasses("ss({ ...shared })")).toEqual([]);
    expect(extractClasses("ss({ [key]: 'flex' })")).toEqual([]);
  });

  // Over-approximating on purpose: a candidate that matches no utility is
  // dropped by `@source inline(...)`, while a missed one costs a real style.
  // See the note on `scanCalls` for why context tracking can't be trusted in the
  // markup-ish files this scans.
  it("also picks up calls written inside strings and comments", () => {
    expect(extractClasses(`// ss({ md: "flex" })`)).toEqual(["md:flex"]);
    expect(extractClasses(`const doc = 'ss({ md: "flex" })'`)).toEqual(["md:flex"]);
  });

  it("never loses a call to an apostrophe in surrounding markup", () => {
    // `Let's` is not a string literal, but a JS-only scanner reads it as one and
    // swallows everything up to the next quote — including the call below it.
    expect(extractClasses(`<p>Let's go</p>\n<div class={ss({ md: "grid" })}>x</div>`)).toEqual([
      "md:grid",
    ]);
    expect(
      extractClasses(`<h2>Here's what's new</h2>\n<b class={on("hover", "underline")}>y</b>`),
    ).toEqual(["hover:underline"]);
  });

  it("reads calls inside quoted markup attributes (Vue, HTML, Alpine)", () => {
    expect(
      extractClasses(`<div :class="ss({ base: 'flex', md: 'grid' })">It's here</div>`),
    ).toEqual(["md:grid"]);
    expect(extractClasses(`<div v-bind:class="on('hover', 'underline')" />`)).toEqual([
      "hover:underline",
    ]);
  });

  it("keeps reading after a call it cannot parse", () => {
    // An unbalanced or malformed call must not take the rest of the file with it.
    expect(extractClasses(`ss({ md: "flex"\n\nss({ lg: "grid" })`)).toContain("lg:grid");
    expect(extractClasses(`const s = "oops;\nss({ md: "flex" })`)).toContain("md:flex");
  });

  it("ignores cn() and match(), whose classes are already literal in source", () => {
    expect(extractClasses(`cn("px-2", "px-4")`)).toEqual([]);
    expect(extractClasses(`match(size, { sm: "text-sm", lg: "text-lg" })`)).toEqual([]);
  });

  it("keeps candidates with brackets, parens and single quotes", () => {
    expect(extractClasses(`ss({ md: "w-[calc(100%-2rem)] grid-cols-[repeat(2,1fr)]" })`)).toEqual([
      "md:grid-cols-[repeat(2,1fr)]",
      "md:w-[calc(100%-2rem)]",
    ]);
    expect(extractClasses(`ss({ before: "content-['x']" })`)).toEqual(["before:content-['x']"]);
  });

  it("drops candidates that would break the @source inline directive", () => {
    // Braces trigger Tailwind's brace expansion; a double quote would close the
    // string; a backslash or semicolon would break out of the declaration.
    expect(extractClasses(`ss({ md: "content-['{}'] a\\\\b" })`)).toEqual([]);
    expect(extractClasses(`ss({ md: 'content-["x"]' })`)).toEqual([]);
  });

  it("returns nothing for source with no tailess calls", () => {
    expect(extractClasses(`export const x = 1;`)).toEqual([]);
    expect(extractClasses("")).toEqual([]);
  });
});

describe("extractClasses, variadic ss()", () => {
  it("reads every argument, not just the first", () => {
    expect(extractClasses(`ss({ md: "p-6" }, { hover: "shadow-md" }, className)`)).toEqual([
      "hover:shadow-md",
      "md:p-6",
    ]);
  });

  it("reads a map behind a condition", () => {
    // The whole point of the argument sweep: this map does not start the argument,
    // and missing it would land the class on the element with no CSS behind it.
    expect(extractClasses(`ss(base, isDisabled && { sm: "bg-red-500" })`)).toEqual([
      "sm:bg-red-500",
    ]);
  });

  it("reads both branches when the argument is a ternary of maps", () => {
    expect(extractClasses(`ss(a, open ? { md: "p-6" } : { md: "p-2" })`)).toEqual([
      "md:p-2",
      "md:p-6",
    ]);
  });

  it("ignores plain class arguments, which Tailwind already sees itself", () => {
    expect(extractClasses(`ss("px-2 px-4", cond && "hidden", className)`)).toEqual([]);
  });

  it("reads a map spread across several lines and arguments", () => {
    expect(
      extractClasses(`ss(
        {
          base: "rounded border",
          md: "p-6",   // still read
        },
        loading && { base: "animate-pulse", dark: "bg-neutral-800" },
        "text-sm",
      )`),
    ).toEqual(["dark:bg-neutral-800", "md:p-6"]);
  });
});

describe("extractClasses, nested ss() buckets", () => {
  it("stacks a nested key onto its parent", () => {
    expect(extractClasses(`ss({ dark: { hover: "bg-black" } })`)).toEqual(["dark:hover:bg-black"]);
  });

  it("reads a nested base as the parent prefix alone", () => {
    expect(extractClasses(`ss({ dark: { base: "text-white", hover: "text-blue-300" } })`)).toEqual([
      "dark:hover:text-blue-300",
      "dark:text-white",
    ]);
  });

  it("emits nothing extra for a value that is only a map", () => {
    // `md:p-8` would resolve, so an over-approximation here ships a rule nothing
    // uses. Only `md:hover:p-8` can actually be produced.
    expect(extractClasses(`ss({ md: { hover: "p-8" } })`)).toEqual(["md:hover:p-8"]);
  });

  it("reads a nested map behind a condition, and the classes beside it", () => {
    // `md:p-8` is the over-approximation: once a value holds anything besides the
    // map, the token sweep runs over all of it. Narrowing the sweep to the text
    // *outside* the braces is the obvious fix and the wrong one — it would silently
    // drop `ss({ md: match(size, { sm: "p-1" }) })`, where the classes live inside
    // an object that is an argument, not a bucket.
    expect(extractClasses(`ss({ md: wide ? { hover: "p-8" } : "p-2" })`)).toEqual([
      "md:hover:p-8",
      "md:p-2",
      "md:p-8",
    ]);
  });

  it("still reads a lookup called inside a bucket", () => {
    expect(extractClasses(`ss({ md: match(size, { sm: "p-1", lg: "p-8" }) })`)).toEqual([
      "md:lg:p-8",
      "md:p-1",
      "md:p-8",
      "md:sm:p-1",
    ]);
  });

  it("handles a nested max-* range", () => {
    expect(extractClasses(`ss({ md: { "max-lg": "grid" } })`)).toEqual(["md:max-lg:grid"]);
  });

  it("nests more than one level", () => {
    expect(extractClasses(`ss({ md: { dark: { hover: "bg-black" } } })`)).toEqual([
      "md:dark:hover:bg-black",
    ]);
  });

  it("keeps an object inside an array as clsx classes", () => {
    expect(extractClasses(`ss({ md: [{ "text-lg": a }, cond && "gap-4"] })`)).toEqual([
      "md:gap-4",
      "md:text-lg",
    ]);
  });

  it("survives an unterminated object read mid-save", () => {
    expect(extractClasses(`ss({ md: { hover: "p-8"`)).toEqual(["md:hover:p-8"]);
  });
});
