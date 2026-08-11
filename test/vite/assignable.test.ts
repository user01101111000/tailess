import type { Plugin, PluginOption } from "vite";
import { expectTypeOf, it } from "vitest";
import tailess, { type TailessVitePlugin } from "../../src/vite/index.js";

/**
 * The plugin is typed structurally so tailess needs no dependency on Vite. That
 * only helps if the shape really is assignable to Vite's own `Plugin` — otherwise
 * `plugins: [tailess()]` is a type error in every consumer's config.
 */
it("is assignable to Vite's Plugin and PluginOption", () => {
  expectTypeOf<TailessVitePlugin>().toExtend<Plugin>();
  expectTypeOf<TailessVitePlugin>().toExtend<PluginOption>();

  const plugins: PluginOption[] = [tailess(), tailess({ content: ["src"] })];
  expectTypeOf(plugins).toExtend<PluginOption[]>();
});
