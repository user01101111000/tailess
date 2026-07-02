import { describe, expect, it } from "vitest";
import { createTailess } from "../../src/core/create.js";

describe("createTailess", () => {
  it("works with zero config using default breakpoints", () => {
    const st = createTailess();
    expect(st.responsive("text-sm", { md: "text-lg" })).toBe("text-sm md:text-lg");
  });

  it("threads custom screen keys into responsive()", () => {
    const st = createTailess({ screens: { "3xl": "1600px" } });
    expect(st.responsive("text-sm", { "3xl": "text-2xl" })).toBe("text-sm 3xl:text-2xl");
    expect(st.config.screens["3xl"]).toBe("1600px");
  });

  it("prepends config.base in cn()", () => {
    const st = createTailess({ base: "antialiased" });
    expect(st.cn("text-black")).toBe("antialiased text-black");
  });

  it("resolves custom states via on()", () => {
    const st = createTailess({ states: { groupHover: "group-hover" } });
    expect(st.on("groupHover", "block")).toBe("group-hover:block");
  });

  it("threads custom keys and config.base into ss()", () => {
    const st = createTailess({
      base: "antialiased",
      screens: { "3xl": "1600px" },
      states: { groupHover: "group-hover" },
    });
    expect(st.ss({ base: "text-sm", "3xl": "text-2xl", groupHover: "underline" })).toBe(
      "antialiased text-sm 3xl:text-2xl group-hover:underline",
    );
  });

  it("stacks multiple states via on()", () => {
    const st = createTailess();
    expect(st.on(["dark", "hover"], "bg-black")).toBe("dark:hover:bg-black");
  });

  it("threads custom screen keys into until() and between()", () => {
    const st = createTailess({ screens: { "3xl": "1600px" } });
    expect(st.until("md", "hidden")).toBe("max-md:hidden");
    expect(st.between("sm", "3xl", "block")).toBe("sm:max-3xl:block");
  });

  it("exposes match() for variant selection", () => {
    const st = createTailess();
    const size = "md" as "sm" | "md" | "lg";
    expect(st.match(size, { sm: "text-sm", md: "text-base", lg: "text-lg" })).toBe("text-base");
  });

  it("exposes data() and aria() attribute variants", () => {
    const st = createTailess();
    expect(st.data("state", "open", "opacity-100")).toBe("data-[state=open]:opacity-100");
    expect(st.aria("expanded", "rotate-180")).toBe("aria-expanded:rotate-180");
  });
});
