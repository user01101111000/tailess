import { describe, expect, expectTypeOf, it } from "vitest";
import type { SsInput, SsKey } from "../src/index.js";
import { ss, withPrefix } from "../src/index.js";

/**
 * A `@theme` that adds `--breakpoint-screen-wide`, or a `@custom-variant sidebar-open`, creates
 * a variant that genuinely works and that tailess cannot know about — the build check
 * even reports it. Before this, `ss({ "screen-wide": … })` was a compile error with no way out
 * short of `withPrefix`, which is the escape hatch, not an answer.
 */

declare module "../src/constants.js" {
  interface CustomKeys {
    "screen-wide": true;
    "sidebar-open": true;
  }
}

describe("keys a project declares for itself", () => {
  it("joins the union that ss accepts", () => {
    expectTypeOf<"screen-wide">().toExtend<SsKey>();
    expectTypeOf<"sidebar-open">().toExtend<SsKey>();
    expectTypeOf<SsInput>().toHaveProperty("screen-wide");
  });

  it("emits the prefix, so the class is the one the CSS defines", () => {
    expect(ss({ base: "p-4", "screen-wide": "p-12" })).toBe("p-4 screen-wide:p-12");
    expect(ss({ "sidebar-open": "translate-x-0" })).toBe("sidebar-open:translate-x-0");
  });

  it("still refuses a key nobody declared", () => {
    // @ts-expect-error "3xl" is neither built in nor declared here.
    const bad: SsInput = { "3xl": "p-16" };
    expect(bad).toBeDefined();
  });

  it("sorts a declared key after the built-in ones, not among them", () => {
    // It has no place in the built-in emission order, so it lands at the end — stable
    // and predictable, which is what `tailwind-merge` needs.
    expect(ss({ "screen-wide": "p-12", md: "p-6", base: "p-2" })).toBe(
      "p-2 md:p-6 screen-wide:p-12",
    );
  });

  it("leaves withPrefix as the escape hatch it was", () => {
    expect(withPrefix("screen-wide", "p-12")).toBe("screen-wide:p-12");
  });
});

describe("telling the runtime about them too", () => {
  it("stops calling a declared key unknown", async () => {
    // The type side is `declare module`; the runtime cannot see that, so a key that
    // typed cleanly would warn on every render. Naming it in `configure` is what
    // closes the loop.
    const { configure } = await import("../src/internal/settings.js");
    const seen: string[] = [];
    configure({ onWarn: (message) => seen.push(message) });

    ss({ "not-declared-anywhere": "p-1" } as never);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("is not a Tailwind breakpoint");

    seen.length = 0;
    configure({ keys: ["screen-wide", "sidebar-open"] });
    expect(ss({ "screen-wide": "p-12" })).toBe("screen-wide:p-12");
    expect(seen).toEqual([]);

    configure({
      keys: [],
      onWarn: (message) => {
        console.warn(message);
      },
    });
  });
});
