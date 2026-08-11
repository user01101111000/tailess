import type { ClassValue } from "clsx";
import type { ScreenKey, SsKey } from "./constants.js";

export type { ClassValue };

/**
 * Object accepted by {@link ss}: a `base` bucket for unprefixed classes, plus one
 * entry per Tailwind breakpoint (`sm`…`2xl`), `max-*` range, or state variant
 * (`hover`, `dark`, `group-hover`, …).
 *
 * Keys are a closed union, so every one is autocompleted and a typo is a compile
 * error rather than a class name that silently never matches anything.
 */
export type SsInput = { base?: ClassValue } & { [K in SsKey]?: ClassValue };

/** Breakpoint -> classes that apply at that breakpoint and up. */
export type ResponsiveMap = { [K in ScreenKey]?: ClassValue };
