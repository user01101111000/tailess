import { type ClassValue, clsx } from "clsx";
import { verifyIntegration } from "../internal/verify.js";

/**
 * Apply a Tailwind variant prefix to every class token in `value`.
 *
 * This is the low-level primitive every other prefixing helper is built on. Use
 * it directly for variants tailess doesn't model as keys — arbitrary selectors,
 * `supports-*`, `has-*`, compound `group-[...]`, and so on.
 *
 * @example
 * withPrefix("md", "text-lg font-bold");   // => "md:text-lg md:font-bold"
 * withPrefix("supports-[display:grid]", "grid"); // => "supports-[display:grid]:grid"
 */
export function withPrefix(prefix: string, value: ClassValue): string {
  const tokens = clsx(value).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  let out = "";
  for (const token of tokens) {
    if (out !== "") out += " ";
    out += `${prefix}:${token}`;
  }

  // A prefixed class only has CSS if the build integration told Tailwind about it.
  verifyIntegration();

  return out;
}
