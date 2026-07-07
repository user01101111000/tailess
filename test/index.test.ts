import { describe, expect, it } from "vitest";
import { between, cn, on, responsive, ss, st, until } from "../src/index.js";

/**
 * The top-level helpers are bound to a fixed, zero-config instance: Tailwind's
 * built-in breakpoints/states, no `base`. Custom keys are the job of
 * `defineConfig` (see test/config/define-config.test.ts), not these — so here we
 * only assert the zero-config runtime contract every helper delegates to.
 */
describe("top-level helpers — the zero-config instance", () => {
  it("ss groups classes by breakpoint/state in mobile-first order", () => {
    expect(ss({ base: "flex text-xl", md: "text-2xl", hover: "opacity-100" })).toBe(
      "flex text-xl md:text-2xl hover:opacity-100",
    );
  });

  it("cn is a plain clsx + tailwind-merge (no base prepended)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm", false, "font-bold")).toBe("text-sm font-bold");
  });

  it("responsive emits breakpoints in mobile-first order", () => {
    expect(responsive("text-sm", { md: "text-lg", xl: "text-2xl" })).toBe(
      "text-sm md:text-lg xl:text-2xl",
    );
  });

  it("on stacks state variants; until/between build max-width ranges", () => {
    expect(on(["dark", "hover"], "bg-black")).toBe("dark:hover:bg-black");
    expect(until("md", "hidden")).toBe("max-md:hidden");
    expect(between("sm", "lg", "block")).toBe("sm:max-lg:block");
  });

  it("st is the zero-config default instance backing the helpers", () => {
    expect(st.config.base).toBeUndefined();
    expect(Object.keys(st.config.screens)).toEqual(["sm", "md", "lg", "xl", "2xl"]);
    expect(st.ss({ base: "flex", md: "text-2xl" })).toBe("flex md:text-2xl");
  });
});
