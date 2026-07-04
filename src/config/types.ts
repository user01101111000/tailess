import type { ClassValue } from "clsx";

/**
 * A single responsive breakpoint value, e.g. `"640px"`.
 * The key (`sm`, `md`, custom keys...) becomes the Tailwind variant prefix.
 */
export type Screens = Record<string, string>;

/**
 * State/variant prefixes that {@link TailessConfig} exposes to helpers,
 * e.g. `hover`, `focus`, `dark`, or any custom key you register.
 */
export type States = Record<string, string>;

/**
 * User-facing configuration. Everything is optional — values you provide are
 * deep-merged onto the built-in defaults, and every key you add here becomes
 * available (and type-safe) inside the generated helper functions.
 */
export interface TailessConfig {
  /**
   * Responsive breakpoints. Custom keys are additive on top of the defaults
   * (`sm`, `md`, `lg`, `xl`, `2xl`).
   *
   * @example
   * { screens: { xs: "480px", "3xl": "1600px" } }
   */
  screens?: Screens;

  /**
   * State variant prefixes usable via the `on(...)` helper. Custom keys are
   * additive on top of the defaults (`hover`, `focus`, `active`, `dark`, ...).
   */
  states?: States;

  /**
   * Extra classes always prepended by `cn(...)`-based helpers of this instance.
   * Useful for base tokens shared across a design system.
   */
  base?: ClassValue;
}

/**
 * Fully-resolved config after merging user input with defaults. All fields are
 * required so helpers never have to null-check.
 */
export interface ResolvedConfig {
  screens: Screens;
  states: States;
  base: ClassValue;
}

/**
 * Type-registration hook for the **top-level** helpers (`ss`, `on`, `responsive`,
 * `until`, `between` imported straight from `"tailess"`).
 *
 * By default these helpers only know the built-in keys, because a pre-built
 * export can't read your runtime `tailess.config.ts`. Augment this interface once
 * to teach them your custom keys — set `config` to `typeof yourConfig`:
 *
 * @example
 * // tailess.d.ts (anywhere in your project's include path)
 * import type config from "./tailess.config";
 *
 * declare module "tailess" {
 *   interface Register {
 *     config: typeof config;
 *   }
 * }
 *
 * // now `ss({ xs: "..." })` autocompletes and type-checks, straight from "tailess".
 *
 * Pair it with a one-time {@link configureTailess} call so the runtime instance
 * uses the same config (applies `base`, orders custom breakpoints, no dev warnings).
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target, empty by design
export interface Register {}

/**
 * The config the top-level helpers are typed against: whatever was registered via
 * {@link Register}, or the wide default {@link TailessConfig} (built-in keys only)
 * when nothing has been registered.
 */
export type RegisteredConfig = Register extends { config: infer C extends TailessConfig }
  ? C
  : TailessConfig;
