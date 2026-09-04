import { ownOr } from "../internal/lookup.js";
import type { SsArg } from "../types.js";
import { ss } from "./ss.js";

/** The options one variant offers, e.g. `{ sm: "text-sm", lg: "text-lg" }`. */
export type VariantOptions = Record<string, SsArg>;

/** Every variant a component takes, e.g. `{ tone: {…}, size: {…} }`. */
export type VariantGroups = Record<string, VariantOptions>;

/**
 * The props a built component accepts — one optional key per variant, whose value is
 * one of that variant's own options. A typo in either half is a compile error.
 *
 * Each is spelled `| undefined` for the same reason the plugin options are: under
 * `exactOptionalPropertyTypes` a bare optional refuses a value that may be
 * *explicitly* undefined, and `{ size: props.size }` — a component forwarding an
 * optional prop it did not receive — is precisely that. The runtime already treats it
 * as "leave the default alone", so the type has to let it through.
 */
export type VariantProps<V extends VariantGroups> = {
  [K in keyof V]?: (keyof V[K] & string) | undefined;
};

/** What {@link variants} is given. */
export interface VariantsConfig<V extends VariantGroups> {
  /** Classes every instance gets, before any variant applies. */
  base?: SsArg;
  /** The variants themselves. */
  variants: V;
  /** Extra classes for a *combination* of variants, applied after the singles. */
  compound?: Array<VariantProps<V> & { class: SsArg }>;
  /** What each variant is when the caller does not say. */
  defaults?: VariantProps<V>;
}

/** A component built by {@link variants}. */
export type VariantComponent<V extends VariantGroups> = (
  props?: VariantProps<V>,
  ...rest: SsArg[]
) => string;

/**
 * Build a component's `className` from a set of typed variants.
 *
 * The shape a `cva`-style recipe has, with one difference that matters here: every
 * value is an {@link SsArg}, so a variant option can be an `ss` map rather than a flat
 * string. That is what lets a variant carry breakpoints and states of its own —
 * `lg: { base: "text-lg", md: "px-6" }` — which a plain string cannot express and
 * which is exactly what tailess is for.
 *
 * Emission order is `base`, then each variant in the order it was declared, then the
 * compound rules, then whatever the caller passed. Later wins, as everywhere else, so
 * a trailing `className` still overrides — see {@link cn}.
 *
 * @example
 * const button = variants({
 *   base: { base: "rounded font-medium", hover: "brightness-110" },
 *   variants: {
 *     tone: { primary: "bg-blue-600", danger: "bg-red-600" },
 *     size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } },
 *   },
 *   compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
 *   defaults: { tone: "primary", size: "sm" },
 * });
 *
 * button();                            // the defaults
 * button({ size: "lg" });              // => "… text-lg px-4 md:px-6"
 * button({ tone: "danger" }, className);
 */
export function variants<const V extends VariantGroups>(
  config: VariantsConfig<V>,
): VariantComponent<V> {
  const { base, variants: groups, compound, defaults } = config;
  const names = Object.keys(groups);

  return (props, ...rest) => {
    // Spread would let an explicitly-`undefined` prop erase a default, and
    // `{ size: undefined }` is what a component writes when it forwards an optional
    // prop it did not receive.
    const chosen: Record<string, string | undefined> = { ...defaults };
    if (props) {
      for (const name of Object.keys(props)) {
        const value = props[name];
        if (value !== undefined) chosen[name] = value;
      }
    }

    const parts: SsArg[] = [base];

    for (const name of names) {
      const value = chosen[name];
      if (value === undefined) continue;
      // `ownOr` rather than an index read, so a variant option named `toString` or
      // `constructor` cannot pull something off the prototype and into a className.
      parts.push(ownOr<SsArg>(groups[name] as Record<string, SsArg>, value, undefined));
    }

    if (compound) {
      for (const rule of compound) {
        let matched = true;
        for (const name of names) {
          const wanted = (rule as Record<string, unknown>)[name];
          if (wanted !== undefined && wanted !== chosen[name]) {
            matched = false;
            break;
          }
        }
        if (matched) parts.push(rule.class);
      }
    }

    return ss(...parts, ...rest);
  };
}
