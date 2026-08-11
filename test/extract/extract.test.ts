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
    expect(extractClasses(`ss({ md: { "text-2xl": a, "text-xs": b } })`)).toEqual([
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

  it("ignores calls in strings and comments", () => {
    expect(extractClasses(`// ss({ md: "flex" })`)).toEqual([]);
    expect(extractClasses(`const doc = 'ss({ md: "flex" })'`)).toEqual([]);
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
