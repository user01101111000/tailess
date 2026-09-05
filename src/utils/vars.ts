import { isDev } from "../internal/env.js";

/** A CSS custom property name, which is any identifier starting with `--`. */
export type CssVarName = `--${string}`;

/** What {@link vars} accepts: custom property names to values, or nothing. */
export type CssVarInput = Record<CssVarName, string | number | null | undefined>;

/**
 * What {@link vars} returns — assignable to React's `CSSProperties` and to the
 * `style` prop of every framework that takes a plain object.
 *
 * Partial because a property whose value is absent is dropped, so the returned
 * object genuinely does not have that key. A total `Record` would type
 * `vars({ "--w": maybeUndefined })["--w"]` as `string` and hand back `undefined`.
 */
export type CssVars = Partial<Record<CssVarName, string>>;

/** Keys already reported, so a warning in a render loop is printed once. */
const warnedKeys = new Set<string>();

function warnNotACustomProperty(key: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(
    `[tailess] vars() was given "${key}", which is not a CSS custom property. It is ` +
      'passed through, but vars() is for "--" names — put an ordinary style in `style`.',
  );
}

/**
 * Build a `style` object of CSS custom properties, for the values a class name
 * cannot carry.
 *
 * Every class tailess produces has to be enumerable at build time, which means the
 * *values* in it have to be written literally in your source. A width that comes
 * from data is not, and `w-[${percent}%]` has no CSS behind it however it is
 * built. The way through is to keep the class literal and move the value into a
 * custom property, which is what this is for:
 *
 * ```tsx
 * <div
 *   className={ss({ base: "w-[var(--w)]", md: "w-[var(--w-md)]" })}
 *   style={vars({ "--w": `${percent}%`, "--w-md": "50%" })}
 * />
 * ```
 *
 * Numbers are stringified, and a value that cannot produce a usable declaration —
 * `null`, `undefined`, `""`, `NaN`, `Infinity` — drops its property instead of
 * writing an invalid one, so a conditional variable reads the same way a
 * conditional class does. `0` is kept: it is a perfectly good value.
 *
 * @example
 * vars({ "--w": "42%", "--gap": 8 });        // => { "--w": "42%", "--gap": "8" }
 * vars({ "--w": "42%", "--h": undefined });  // => { "--w": "42%" }
 */
export function vars(map: CssVarInput): CssVars {
  const out: Record<string, string> = {};

  for (const key of Object.keys(map)) {
    const value = map[key as CssVarName];
    // Falsy-but-meaningful values are kept: `0` is a perfectly good custom property
    // value, so this tests only for the ones that cannot produce a usable
    // declaration. `NaN` and `Infinity` are among them — they stringify into a
    // declaration CSS happily parses and then discards at computed-value time, which
    // looks exactly like the property having been absent, so drop them and be
    // consistent rather than write `--w: NaN`.
    if (value == null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (isDev && !key.startsWith("--")) warnNotACustomProperty(key);
    out[key] = typeof value === "string" ? value : String(value);
  }

  return out as CssVars;
}
