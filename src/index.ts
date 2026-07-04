// Config
export { defaultConfig, defaultScreens, defaultStates } from "./config/defaults.js";
export { defineConfig } from "./config/define-config.js";
export { resolveConfig } from "./config/resolve.js";
export type {
  Register,
  RegisteredConfig,
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

import type { RegisteredConfig, TailessConfig } from "./config/types.js";
import { createTailess, type Tailess } from "./core/create.js";

/**
 * The instance backing every top-level helper. Starts zero-config and is swapped
 * in place by {@link configureTailess}, so `ss`, `on`, etc. always delegate to
 * the currently-active config without callers having to re-import anything.
 */
let activeInstance: Tailess<RegisteredConfig> = createTailess();

/**
 * Default zero-config `tailess` instance using Tailwind's built-in breakpoints
 * and standard state variants. Captured at import time and **not** affected by
 * later {@link configureTailess} calls — use {@link createTailess} for a fresh
 * custom instance, or the top-level helpers for the active one.
 */
export const st = activeInstance;

/**
 * Point the top-level helpers (`ss`, `on`, `responsive`, `until`, `between`) at a
 * custom config, so they apply your `base`, order your custom breakpoints, and
 * stop warning about custom keys at runtime. Call it **once**, before the helpers
 * are used (e.g. at your app's entry module).
 *
 * This is the runtime half; pair it with the {@link Register} type augmentation so
 * the same keys are also autocompleted and type-checked at the call site.
 *
 * @example
 * // app entry (runs before any component renders)
 * import { configureTailess } from "tailess";
 * import config from "./tailess.config";
 *
 * configureTailess(config);
 *
 * @returns the configured instance, in case you also want a directly-typed handle.
 */
export function configureTailess<const C extends TailessConfig>(config: C): Tailess<C> {
  const instance = createTailess(config);
  // The active instance is typed against whatever was registered via `Register`;
  // a freshly-configured instance is a superset at runtime, so this swap is safe.
  activeInstance = instance as unknown as Tailess<RegisteredConfig>;
  return instance;
}

/**
 * Conditionally join class names (via `clsx`) and resolve Tailwind conflicts
 * (via `tailwind-merge`), so the last utility in a conflicting group wins.
 *
 * Bound to the active config, so once you {@link configureTailess} a `base`, it is
 * prepended here too (matching every other top-level helper). With no config, `base`
 * is empty and this behaves as a plain `clsx` + `tailwind-merge`.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
 * // => "py-1 bg-blue-500 px-4"  (px-2 dropped in favor of px-4)
 */
export const cn: Tailess<RegisteredConfig>["cn"] = (...inputs) => activeInstance.cn(...inputs);

/**
 * Group Tailwind classes by breakpoint/state in a readable object instead of
 * interleaving prefixes inside a string. Each key is one of the active config's
 * breakpoints or states (plus `base` for unprefixed classes), so every key is
 * autocompleted and typo-checked at the call site.
 *
 * Typed against the default config until you register a custom one via the
 * {@link Register} interface (and {@link configureTailess} at runtime).
 *
 * @example
 * ss({ base: "text-xl flex", sm: "block", md: "text-2xl", hover: "opacity-100" });
 * // => "text-xl flex sm:block md:text-2xl hover:opacity-100"
 */
export const ss: Tailess<RegisteredConfig>["ss"] = (input) => activeInstance.ss(input);

/**
 * Build a mobile-first responsive class string from a `base` plus per-breakpoint
 * overrides. Breakpoint keys are typed from the active config.
 *
 * @example
 * responsive("text-sm", { md: "text-base", lg: "text-lg" });
 * // => "text-sm md:text-base lg:text-lg"
 */
export const responsive: Tailess<RegisteredConfig>["responsive"] = (base, variants) =>
  activeInstance.responsive(base, variants);

/**
 * Prefix classes with one or more configured state variants. State keys are typed
 * from the active config, so aliases (e.g. `groupHover` -> `group-hover`) resolve.
 *
 * @example
 * on(["dark", "hover"], "bg-black"); // => "dark:hover:bg-black"
 */
export const on: Tailess<RegisteredConfig>["on"] = (state, classes) =>
  activeInstance.on(state, classes);

/**
 * Apply classes below a breakpoint via Tailwind's `max-*` variant. The breakpoint
 * key is typed from the active config.
 *
 * @example
 * until("md", "hidden"); // => "max-md:hidden"
 */
export const until: Tailess<RegisteredConfig>["until"] = (key, classes) =>
  activeInstance.until(key, classes);

/**
 * Apply classes between two breakpoints (inclusive min, exclusive max). Both keys
 * are typed from the active config.
 *
 * @example
 * between("sm", "xl", "block"); // => "sm:max-xl:block"
 */
export const between: Tailess<RegisteredConfig>["between"] = (min, max, classes) =>
  activeInstance.between(min, max, classes);
