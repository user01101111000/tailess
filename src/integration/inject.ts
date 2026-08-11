import { markerProperty } from "../internal/verify.js";

/**
 * Candidates per `@source inline(...)` directive. A single directive would work
 * fine — the limit only keeps the injected CSS from becoming one unreadable line
 * in devtools.
 */
const chunkSize = 200;

/** Custom property the runtime reads to confirm the integration is wired up. */
export { markerProperty };

/**
 * A `:root` rule the runtime can observe. Tailwind passes plain CSS through
 * untouched, so this survives compilation and lets a missing integration produce
 * a real error message instead of silently unstyled elements.
 */
export const markerRule = `:root{${markerProperty}:1}`;

/**
 * Split candidates into the `inline("…")` payloads of one or more `@source`
 * directives.
 *
 * `@source inline()` is Tailwind's own safelist directive, so these candidates go
 * through the exact same pipeline as classes found in source: unknown ones are
 * ignored rather than fatal, and variants/theme values resolve identically.
 */
export function sourceChunks(classes: readonly string[]): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < classes.length; i += chunkSize) {
    chunks.push(classes.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

/**
 * Build the CSS to prepend to a Tailwind stylesheet: the marker rule plus a
 * `@source inline(...)` directive for every class tailess builds at runtime.
 */
export function buildPrelude(classes: readonly string[]): string {
  let css = `${markerRule}\n`;
  for (const chunk of sourceChunks(classes)) css += `@source inline("${chunk}");\n`;
  return css;
}
