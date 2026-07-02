import type { TailessConfig } from "./types.js";

/**
 * Identity helper that gives you full type-checking and autocomplete when
 * authoring a `tailess.config.ts` file. The `const` type parameter preserves
 * the literal keys you declare so they flow into the generated helpers.
 *
 * @example
 * // tailess.config.ts
 * import { defineConfig } from "tailess";
 *
 * export default defineConfig({
 *   screens: { xs: "480px", "3xl": "1600px" },
 * });
 */
export function defineConfig<const C extends TailessConfig>(config: C): C {
  return config;
}
