import { ss } from "tailess";

/**
 * What more than one component shares.
 *
 * A shared fragment is a *finished string*: `ss()` builds it right here, where the scanner
 * can read every class in it, and whoever uses it drops it somewhere that adds no prefix —
 * a `base` bucket, an array, a trailing argument. Under a prefixed key (`md: focusRing`) it
 * would be a variable the scanner cannot read, and the build says so.
 */
export const focusRing = ss({
  "focus-visible": "outline-2 outline-offset-2 outline-blue-600",
});

/** The border every boxed thing on the page has, in both themes. */
export const hairline = ss({ base: "border border-neutral-200", dark: "border-neutral-800" });
