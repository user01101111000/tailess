import type { ResolvedConfig } from "./types.js";

/**
 * Default Tailwind CSS breakpoints. Kept in sync with Tailwind's out-of-the-box
 * `screens` so `tailess` behaves identically with zero configuration.
 */
export const defaultScreens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

/**
 * Default state variant prefixes.
 */
export const defaultStates = {
  hover: "hover",
  focus: "focus",
  "focus-visible": "focus-visible",
  active: "active",
  disabled: "disabled",
  dark: "dark",
} as const;

export const defaultConfig: ResolvedConfig = {
  screens: { ...defaultScreens },
  states: { ...defaultStates },
  base: undefined,
};
