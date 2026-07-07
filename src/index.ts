// Config
export { defaultConfig, defaultScreens, defaultStates } from "./config/defaults.js";
export { defineConfig } from "./config/define-config.js";
export { resolveConfig } from "./config/resolve.js";
export type {
  ResolvedConfig,
  Screens,
  States,
  TailessConfig,
} from "./config/types.js";
export type { Tailess } from "./core/create.js";
// Core factory
export { createTailess } from "./core/create.js";

// Utilities (config-free helpers usable anywhere)
export { aria, data } from "./utils/attrs.js";
export { match } from "./utils/match.js";
export { withPrefix } from "./utils/prefix.js";
export type { ResponsiveMap } from "./utils/responsive.js";
export type { SsInput } from "./utils/ss.js";

import { createTailess, type Tailess } from "./core/create.js";

/**
 * The zero-config `tailess` instance backing every top-level helper. It uses
 * Tailwind's built-in breakpoints (`sm`…`2xl`) and standard state variants
 * (`hover`, `focus`, `dark`, …) — no setup required.
 *
 * To use **custom** breakpoints/states, don't reach for this instance: write a
 * `tailess.config.ts` with {@link defineConfig} and re-export its helpers, so your
 * custom keys are autocompleted and type-checked at every call site:
 *
 * @example
 * // tailess.config.ts
 * import { defineConfig } from "tailess";
 * const t = defineConfig({ screens: { "3xl": "1600px" } });
 * export default t;                 // the PostCSS plugin reads this
 * export const { ss, on, cn } = t;  // typed helpers for your app
 */
const defaultInstance: Tailess = createTailess();

/** Default zero-config instance. Alias of the instance the top-level helpers use. */
export const st = defaultInstance;

/**
 * Conditionally join class names (via `clsx`) and resolve Tailwind conflicts (via
 * `tailwind-merge`), so the last utility in a conflicting group wins.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
 * // => "py-1 bg-blue-500 px-4"  (px-2 dropped in favor of px-4)
 */
export const cn: Tailess["cn"] = defaultInstance.cn;

/**
 * Group Tailwind classes by breakpoint/state in a readable object instead of
 * interleaving prefixes inside a string. Keys are the built-in breakpoints/states
 * (plus `base` for unprefixed classes), all autocompleted and typo-checked.
 *
 * Need custom keys? Use {@link defineConfig} in a `tailess.config.ts` and import
 * the re-exported `ss` from there — it knows your custom keys with no extra setup.
 *
 * @example
 * ss({ base: "text-xl flex", sm: "block", md: "text-2xl", hover: "opacity-100" });
 * // => "text-xl flex sm:block md:text-2xl hover:opacity-100"
 */
export const ss: Tailess["ss"] = defaultInstance.ss;

/**
 * Build a mobile-first responsive class string from a `base` plus per-breakpoint
 * overrides. Breakpoints are emitted in mobile-first order and merged via `cn`.
 *
 * @example
 * responsive("text-sm", { md: "text-base", lg: "text-lg" });
 * // => "text-sm md:text-base lg:text-lg"
 */
export const responsive: Tailess["responsive"] = defaultInstance.responsive;

/**
 * Prefix classes with one or more state variants. Passing an array stacks them to
 * express compound variants like `dark:hover:`.
 *
 * @example
 * on(["dark", "hover"], "bg-black"); // => "dark:hover:bg-black"
 */
export const on: Tailess["on"] = defaultInstance.on;

/**
 * Apply classes below a breakpoint via Tailwind's `max-*` variant.
 *
 * @example
 * until("md", "hidden"); // => "max-md:hidden"
 */
export const until: Tailess["until"] = defaultInstance.until;

/**
 * Apply classes between two breakpoints (inclusive min, exclusive max).
 *
 * @example
 * between("sm", "xl", "block"); // => "sm:max-xl:block"
 */
export const between: Tailess["between"] = defaultInstance.between;
