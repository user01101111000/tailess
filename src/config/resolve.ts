import { defaultConfig } from "./defaults.js";
import type { ResolvedConfig, TailessConfig } from "./types.js";

/**
 * Merge a user config onto the built-in defaults. Custom `screens`/`states`
 * keys are additive; keys that collide override the default value.
 */
export function resolveConfig(config: TailessConfig = {}): ResolvedConfig {
  return {
    screens: { ...defaultConfig.screens, ...config.screens },
    states: { ...defaultConfig.states, ...config.states },
    base: config.base ?? defaultConfig.base,
  };
}
