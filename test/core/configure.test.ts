import { afterEach, describe, expect, it } from "vitest";
import { cn, configureTailess, ss } from "../../src/index.js";
import type { SsInput } from "../../src/utils/ss.js";

/**
 * `configureTailess` swaps the config backing every top-level helper, so
 * `import { ss } from "tailess"` picks up a custom `base`, ordering, and custom
 * keys without callers re-importing. Each test resets to zero-config so the
 * shared module-level instance doesn't leak between cases.
 *
 * Custom keys (`xs`, `groupHover`) are cast through the loose {@link SsInput}: in a
 * real project the `Register` augmentation makes them known to the top-level `ss`,
 * but this library's own test project registers nothing, so we assert the runtime
 * contract directly.
 */
describe("configureTailess — runtime config for top-level helpers", () => {
  afterEach(() => {
    configureTailess({});
  });

  it("prepends the configured base on the top-level ss", () => {
    configureTailess({ base: "antialiased" });
    expect(ss({ base: "text-black" })).toBe("antialiased text-black");
  });

  it("prepends the configured base on the top-level cn", () => {
    configureTailess({ base: "antialiased" });
    expect(cn("text-black")).toBe("antialiased text-black");
  });

  it("top-level cn is a plain clsx + tailwind-merge with no config", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("prefixes custom breakpoints on the top-level ss (custom keys follow the defaults)", () => {
    configureTailess({ screens: { xs: "480px", "3xl": "1600px" } });
    expect(ss({ base: "flex", xs: "block", "3xl": "text-4xl" } as SsInput)).toBe(
      "flex xs:block 3xl:text-4xl",
    );
  });

  it("resolves custom state aliases on the top-level ss", () => {
    configureTailess({ states: { groupHover: "group-hover" } });
    expect(ss({ base: "text-sm", groupHover: "underline" } as SsInput)).toBe(
      "text-sm group-hover:underline",
    );
  });

  it("returns a directly-typed instance handle", () => {
    const st = configureTailess({ base: "antialiased" });
    expect(st.cn("text-black")).toBe("antialiased text-black");
  });

  it("later calls replace the active config", () => {
    configureTailess({ base: "antialiased" });
    configureTailess({ base: "subpixel-antialiased" });
    expect(ss({ base: "text-black" })).toBe("subpixel-antialiased text-black");
  });
});
