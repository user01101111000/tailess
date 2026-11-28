/**
 * Custom property the build integration injects into your Tailwind stylesheet.
 * Its only job is to be observable from the browser, so a missing integration
 * fails loudly instead of silently producing classes that have no CSS.
 *
 * A module of its own so the build integration can name it without importing the
 * browser check in `verify.ts` — and through that the lazily loaded `rules.ts`, which
 * the plugin and CLI bundles then emitted as a chunk nothing ever loads.
 */
export const markerProperty = "--tailess";

/**
 * Set beside the marker when the build saw the project call `configure()` with a merge or
 * keys — see `configuresRender`. A browser where that call never ran renders with the
 * defaults instead, and `rules.ts` says so. Derived from the marker's name there, so the
 * lazily loaded check needs no import to find it.
 */
export const configureProperty = `${markerProperty}-configure`;
