import { describe, expect, it } from "vitest";
import { readOptions } from "../../src/integration/options.js";
import tailessPostcss from "../../src/postcss/index.js";
import tailessVite from "../../src/vite/index.js";

/**
 * Plugin options come from `postcss.config.mjs`, a `.postcssrc.json` or an untyped
 * `vite.config.js`, where nothing checks their shape. Each wrong shape failed badly: a
 * crash with no option named, a list read one letter at a time, or a CI gate that
 * quietly never failed.
 */
describe("reading plugin options", () => {
  const read = (options: unknown) => readOptions(options, "tailess/postcss");

  it("takes a single string where a list belongs as a list of one", () => {
    // `content: "src"` crashed the build with "options.roots.map is not a function", and
    // `ignore: "src"` skipped the directories "s", "r" and "c".
    expect(read({ content: "src", ignore: "fixtures", extensions: "tsx" })).toEqual({
      content: ["src"],
      ignore: ["fixtures"],
      extensions: ["tsx"],
    });
    expect(read({ extensions: new Set(["tsx", "vue"]) })).toEqual({ extensions: ["tsx", "vue"] });
  });

  it("refuses a diagnostics mode it does not know, rather than warning instead", () => {
    // `"ERROR"` and `true` both behaved as "warn": a CI gate that never failed.
    expect(() => read({ diagnostics: "ERROR" })).toThrow(
      /tailess\/postcss: "diagnostics" must be "warn", "error" or "off", got "ERROR"/,
    );
    expect(() => read({ diagnostics: true })).toThrow(/"diagnostics"/);
    expect(read({ diagnostics: "error" })).toEqual({ diagnostics: "error" });
  });

  it("refuses an empty cacheDir, which put the stylesheet in the project root", () => {
    expect(() => read({ cacheDir: "" })).toThrow(/"cacheDir" must be a directory path/);
    expect(() => read({ cacheDir: 1 })).toThrow(/"cacheDir"/);
  });

  it("names the option when a list is not a list of strings", () => {
    expect(() => read({ content: 5 })).toThrow(/"content" must be a list of strings, got 5/);
    expect(() => read({ extensions: ["tsx", 1] })).toThrow(/"extensions"/);
  });

  it("reads no options as the defaults, and refuses options that are not an object", () => {
    for (const none of [undefined, null, true, false]) expect(read(none)).toEqual({});
    expect(() => read("src")).toThrow(/options must be an object, got "src"/);
  });

  it("leaves correct options as they are", () => {
    const options = { content: ["src"], diagnostics: "off", cacheDir: ".cache" };
    expect(read(options)).toEqual(options);
  });
});

describe("both plugins check their options when created", () => {
  it.each([
    ["tailess/postcss", (options: unknown) => tailessPostcss(options as never)],
    ["tailess/vite", (options: unknown) => tailessVite(options as never)],
  ])("%s names the wrong option", (name, create) => {
    expect(() => create({ diagnostics: "ERROR" })).toThrow(`[tailess] ${name}: "diagnostics"`);
    expect(() => create({ content: "src" })).not.toThrow();
  });
});
