// Config
export { defaultConfig, defaultScreens, defaultStates } from "./config/defaults.js";
export { defineConfig } from "./config/define-config.js";
export { resolveConfig } from "./config/resolve.js";
export type { ResolvedConfig, Screens, States, TailessConfig } from "./config/types.js";
export type { Tailess } from "./core/create.js";
// Core factory
export { createTailess } from "./core/create.js";

// Utilities (config-free helpers usable anywhere)
export { aria, data } from "./utils/attrs.js";
export { cn } from "./utils/cn.js";
export { match } from "./utils/match.js";
export { withPrefix } from "./utils/prefix.js";
export type { ResponsiveMap } from "./utils/responsive.js";
export type { SsInput } from "./utils/ss.js";

import { createTailess } from "./core/create.js";

/**
 * Default zero-config `tailess` instance using Tailwind's built-in breakpoints
 * and standard state variants. Use {@link createTailess} for custom keys.
 */
export const st = createTailess();

/** Group classes by breakpoint/state in a readable object (default config). */
export const ss = st.ss;
/** Build a mobile-first responsive class string (default config). */
export const responsive = st.responsive;
/** Prefix classes with one or more state variants (default config). */
export const on = st.on;
/** Apply classes below a breakpoint via `max-*` (default config). */
export const until = st.until;
/** Apply classes between two breakpoints (default config). */
export const between = st.between;
