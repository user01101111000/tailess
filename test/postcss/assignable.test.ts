import type { AcceptedPlugin, Plugin } from "postcss";
import { expectTypeOf, it } from "vitest";
import tailess, { type TailessPostcssOptions } from "../../src/postcss/index.js";

/**
 * The PostCSS plugin is typed structurally so tailess needs no dependency on
 * `postcss` — the host build always supplies it. That only helps if the shape really
 * is assignable to PostCSS's own `AcceptedPlugin`, because otherwise a typed
 * `postcss.config.ts` stops compiling for every consumer, and nothing else in the
 * suite would notice: the plugin still *works* perfectly at runtime.
 *
 * The mirror of `test/vite/assignable.test.ts`, and it exists because this drifted
 * once. Under `exactOptionalPropertyTypes` a bare `from?: string` refuses a value
 * that may be explicitly `undefined` — which is precisely what PostCSS's own
 * `ResultOptions.from` is — so the plugin quietly stopped being an `AcceptedPlugin`
 * for anyone with that flag on. `tsconfig.json` here has it on, so this test is
 * checked under the strict reading.
 */
it("is assignable to PostCSS's AcceptedPlugin and Plugin", () => {
  const plugin = tailess();
  expectTypeOf(plugin).toExtend<AcceptedPlugin>();
  expectTypeOf(plugin).toExtend<Plugin>();

  const plugins: AcceptedPlugin[] = [tailess(), tailess({ content: ["src"] })];
  expectTypeOf(plugins).toExtend<AcceptedPlugin[]>();
});

it("accepts an option passed conditionally", () => {
  // Every option is `| undefined` so `content: isCI ? [...] : undefined` compiles
  // under `exactOptionalPropertyTypes`, which is what the implementation accepts.
  const isCI = false;
  const options: TailessPostcssOptions = {
    content: isCI ? ["src"] : undefined,
    ignore: isCI ? ["fixtures"] : undefined,
    extensions: isCI ? ["tsx"] : undefined,
    cacheDir: isCI ? "node_modules/.cache" : undefined,
  };
  expectTypeOf(tailess(options)).toExtend<AcceptedPlugin>();
});
