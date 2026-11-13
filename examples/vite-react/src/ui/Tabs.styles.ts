import { aria, on, ss } from "tailess";
import { focusRing } from "./tokens.styles.js";

/** Nothing about the list changes, so it is a plain string — built once, when this loads. */
export const list = ss({
  base: "flex gap-1 border-b border-neutral-200",
  dark: "border-neutral-800",
});

/**
 * Which tab is selected is state the DOM already has: a tab carries `aria-selected` for
 * the screen reader's sake. Styling off that attribute means no prop reaches this file at
 * all — the markup says it once, and the look follows.
 */
export const tab = ss({
  base: [
    focusRing,
    "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-neutral-500",
    aria("selected", "border-blue-600 text-blue-700"),
  ],
  hover: "text-neutral-900",
  // A helper inside a bucket stacks on the bucket's own variant: dark *and* selected.
  dark: [on("hover", "text-neutral-100"), aria("selected", "border-blue-400 text-blue-300")],
});
