import { createTailess, type Tailess } from "../core/create.js";
import type { TailessConfig } from "./types.js";

/**
 * Define your tailess config **and** get back the fully-typed helpers in one call
 * — so a `tailess.config.ts` is all you write. Every key you declare in `screens`
 * or `states` flows straight into the returned `ss`, `on`, `responsive`, … as an
 * autocompleted, typo-checked argument.
 *
 * The returned value doubles as:
 * - the **config object** (its `screens` / `states` / `base` stay on top level, so
 *   the PostCSS plugin can read them when you `export default` it), and
 * - a **tailess instance** (`.ss`, `.on`, `.cn`, … plus the resolved `.config`).
 *
 * @example
 * // tailess.config.ts — the whole setup
 * import { defineConfig } from "tailess";
 *
 * export default defineConfig({
 *   screens: { xs: "480px", "3xl": "1600px" },
 *   states: { groupHover: "group-hover" },
 *   base: "antialiased",
 * });
 *
 * @example
 * // anywhere in your app — import the default and call its helpers
 * import t from "@/tailess.config";
 *
 * t.ss({ base: "text-sm", xs: "block", "3xl": "text-2xl", groupHover: "underline" });
 * // => "antialiased text-sm xs:block 3xl:text-2xl group-hover:underline"
 * //    ✅ "xs" / "3xl" / "groupHover" autocompleted — t.ss({ "4xl": ... }) is a type error
 *
 * // Prefer bare helpers? Re-export them from the same file:
 * // export const { ss, on, cn } = defineConfig({ ... });
 */
export function defineConfig<const C extends TailessConfig>(config: C): C & Tailess<C> {
  // Attach the raw config keys on top of the instance: the instance powers the
  // helpers, while the raw `screens`/`states`/`base` are what the PostCSS plugin
  // reads from the default export (it only mirrors keys you actually set).
  return Object.assign(createTailess(config), config);
}
