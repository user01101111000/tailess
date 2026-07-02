import { describe, expect, it } from "vitest";
import { extractClasses } from "../../src/extract/extract.js";

describe("extractClasses", () => {
  it("recovers the prefixed classes ss builds at runtime (the core v4 problem)", () => {
    const code = `
      ss({
        base: "text-xl flex",
        sm: "block",
        md: "text-2xl text-red-500",
        hover: "opacity-100",
      })
    `;
    expect(extractClasses(code)).toEqual([
      "hover:opacity-100",
      "md:text-2xl",
      "md:text-red-500",
      "sm:block",
    ]);
  });

  it("does not emit base classes (they already appear literally)", () => {
    expect(extractClasses(`ss({ base: "flex text-xl" })`)).toEqual([]);
  });

  it("over-approximates both branches of a ternary", () => {
    expect(extractClasses(`ss({ md: isActive ? "text-2xl" : "text-sm" })`)).toEqual([
      "md:text-2xl",
      "md:text-sm",
    ]);
  });

  it("handles conditional object and array class values", () => {
    expect(
      extractClasses(
        `ss({ md: { "text-2xl": on, "text-xs": off }, lg: ["gap-4", x && "grid-cols-3"] })`,
      ),
    ).toEqual(["lg:gap-4", "lg:grid-cols-3", "md:text-2xl", "md:text-xs"]);
  });

  it("resolves state aliases from config", () => {
    const code = `ss({ groupHover: "underline" })`;
    expect(extractClasses(code, { states: { groupHover: "group-hover" } })).toEqual([
      "group-hover:underline",
    ]);
  });

  it("handles responsive() variants (base is skipped)", () => {
    expect(extractClasses(`responsive("text-sm", { md: "text-lg", xl: "text-2xl" })`)).toEqual([
      "md:text-lg",
      "xl:text-2xl",
    ]);
  });

  it("handles on() with a single state and a stacked array", () => {
    expect(extractClasses(`on("hover", "bg-blue-600 text-white")`)).toEqual([
      "hover:bg-blue-600",
      "hover:text-white",
    ]);
    expect(extractClasses(`on(["dark", "hover"], "bg-black")`)).toEqual(["dark:hover:bg-black"]);
  });

  it("resolves aliases inside on()", () => {
    expect(
      extractClasses(`on("groupHover", "underline")`, { states: { groupHover: "group-hover" } }),
    ).toEqual(["group-hover:underline"]);
  });

  it("handles until() and between()", () => {
    expect(extractClasses(`until("md", "hidden")`)).toEqual(["max-md:hidden"]);
    expect(extractClasses(`between("sm", "lg", "block")`)).toEqual(["sm:max-lg:block"]);
  });

  it("handles data() value and presence forms", () => {
    expect(extractClasses(`data("state", "open", "opacity-100")`)).toEqual([
      "data-[state=open]:opacity-100",
    ]);
    expect(extractClasses(`data("disabled", null, "pointer-events-none")`)).toEqual([
      "data-[disabled]:pointer-events-none",
    ]);
  });

  it("handles aria() and withPrefix()", () => {
    expect(extractClasses(`aria("expanded", "rotate-180")`)).toEqual(["aria-expanded:rotate-180"]);
    expect(extractClasses(`withPrefix("md", "text-lg font-bold")`)).toEqual([
      "md:font-bold",
      "md:text-lg",
    ]);
  });

  it("deduplicates across multiple call sites", () => {
    const code = `ss({ md: "flex" }); on("md", "flex");`;
    expect(extractClasses(code)).toEqual(["md:flex"]);
  });

  it("cannot recover dynamic values, and does not crash on them", () => {
    expect(extractClasses(`ss({ md: someVar, sm: \`text-\${size}\` })`)).toEqual([]);
  });

  it("scans real JSX with a className prop", () => {
    const code = `
      export function Card() {
        return <div className={ss({ base: "p-4", md: "p-8", hover: "shadow-lg" })} />;
      }
    `;
    expect(extractClasses(code)).toEqual(["hover:shadow-lg", "md:p-8"]);
  });
});
