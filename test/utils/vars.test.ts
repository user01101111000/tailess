import { describe, expect, it, vi } from "vitest";
import { vars } from "../../src/utils/vars.js";

describe("vars", () => {
  it("returns the custom properties as a style object", () => {
    expect(vars({ "--w": "42%" })).toEqual({ "--w": "42%" });
  });

  it("stringifies numbers", () => {
    expect(vars({ "--gap": 8 })).toEqual({ "--gap": "8" });
  });

  it("keeps zero, which is a perfectly good value", () => {
    // The nullish check has to be exact: `0` and `false`-y are not the same thing.
    expect(vars({ "--offset": 0 })).toEqual({ "--offset": "0" });
  });

  it("drops a property whose value is absent, rather than writing an invalid one", () => {
    expect(vars({ "--w": "42%", "--h": undefined, "--d": null })).toEqual({ "--w": "42%" });
  });

  it("drops an empty string", () => {
    expect(vars({ "--w": "" })).toEqual({});
  });

  it("drops a number that cannot produce a usable declaration", () => {
    // `--w: NaN` parses and is then discarded at computed-value time, which looks
    // exactly like the property having been absent — so be absent, and keep the
    // stylesheet free of a declaration that can never mean anything.
    expect(vars({ "--w": Number.NaN })).toEqual({});
    expect(vars({ "--w": Number.POSITIVE_INFINITY })).toEqual({});
    expect(vars({ "--w": Number.NEGATIVE_INFINITY })).toEqual({});
  });

  it("returns an empty object for an empty map", () => {
    expect(vars({})).toEqual({});
  });

  it("returns a fresh object each call", () => {
    // It goes straight onto a `style` prop, so a shared object would let one
    // component's variables leak into another's.
    const a = vars({ "--w": "1px" });
    const b = vars({ "--w": "1px" });
    expect(a).not.toBe(b);
  });

  it("reads only own properties", () => {
    const proto = { "--inherited": "nope" };
    const map = Object.create(proto) as Record<`--${string}`, string>;
    map["--own"] = "yes";
    expect(vars(map)).toEqual({ "--own": "yes" });
  });

  it("warns about a name that is not a custom property, and passes it through", () => {
    // The type rejects this, so it only arrives from JS or through a cast — where
    // silently dropping it would break a style that would otherwise have worked.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const map = { width: "10px" } as unknown as Record<`--${string}`, string>;
    expect(vars(map)).toEqual({ width: "10px" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("not a CSS custom property");
    warn.mockRestore();
  });

  it("stays quiet for custom properties", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vars({ "--quiet": "1" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
