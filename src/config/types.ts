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
