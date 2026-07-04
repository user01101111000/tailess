import { describe, expect, expectTypeOf, it } from "vitest";
import { defineConfig } from "../../src/config/define-config.js";
import { createTailess } from "../../src/core/create.js";

/**
 * `defineConfig` returns the config AND a typed instance, so a single
 * `tailess.config.ts` is the whole setup: `export default defineConfig({...})`
 * feeds the PostCSS plugin (raw keys on top level) and gives the app typed
 * helpers (`.ss`, `.on`, …).
 */
describe("defineConfig — config + instance in one", () => {
  it("keeps the raw config keys on top level (for the PostCSS default-export read)", () => {
    const t = defineConfig({ screens: { xs: "480px", "3xl": "1600px" } });
    // Only user-set keys, so the plugin mirrors exactly these into @theme.
    expect(t.screens).toEqual({ xs: "480px", "3xl": "1600px" });
  });

  it("exposes typed helpers bound to the config", () => {
    const t = defineConfig({
      screens: { "3xl": "1600px" },
      states: { groupHover: "group-hover" },
      base: "antialiased",
    });
    expect(t.ss({ base: "text-sm", "3xl": "text-2xl", groupHover: "underline" })).toBe(
      "antialiased text-sm 3xl:text-2xl group-hover:underline",
    );
    expect(t.cn("text-black")).toBe("antialiased text-black");
  });

  it("resolves defaults + custom keys on the instance config", () => {
    const t = defineConfig({ screens: { xs: "480px" } });
    expect(Object.keys(t.config.screens)).toEqual(["sm", "md", "lg", "xl", "2xl", "xs"]);
  });

  it("stays usable as a plain config passed to createTailess (backward compatible)", () => {
    const t = defineConfig({ screens: { xs: "480px" } });
    const st = createTailess(t);
    expect(st.ss({ xs: "flex" })).toBe("xs:flex");
  });

  it("custom keys are typed on the returned instance", () => {
    const t = defineConfig({
      screens: { "3xl": "1600px" },
      states: { groupHover: "group-hover" },
    });
    type Keys = keyof Parameters<typeof t.ss>[0];
    expectTypeOf<Keys>().toEqualTypeOf<
      | "base"
      | "sm"
      | "md"
      | "lg"
      | "xl"
      | "2xl"
      | "3xl"
      | "hover"
      | "focus"
      | "focus-visible"
      | "active"
      | "disabled"
      | "dark"
      | "groupHover"
    >();
  });
});
