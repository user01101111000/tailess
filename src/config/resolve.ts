import { defaultConfig } from "./defaults.js";
import type { ResolvedConfig, TailessConfig } from "./types.js";

/**
 * Merge a user config onto the built-in defaults, producing a fully-populated
 * {@link ResolvedConfig} that helpers can read without null-checks. Custom
 * `screens`/`states` keys are additive (appended after the defaults); keys that
 * collide override the default value, and `base` falls back to the default when
 * omitted. Called internally by {@link createTailess}; exported for advanced use.
 *
 * @example
 * resolveConfig({ screens: { xs: "480px" }, base: "antialiased" });
 * // => { screens: { sm, md, lg, xl, "2xl", xs: "480px" }, states: {...defaults}, base: "antialiased" }
 */
export function resolveConfig(config: TailessConfig = {}): ResolvedConfig {
  return {
    screens: { ...defaultConfig.screens, ...config.screens },
    states: { ...defaultConfig.states, ...config.states },
    base: config.base ?? defaultConfig.base,
  };
}
