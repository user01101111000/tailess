import { container, data, group, has, inside, nth, on, ss, supports, variants } from "tailess";
import { hairline } from "./ui/tokens.styles.js";

/**
 * Every class `App.tsx` uses, and the only place on the page a class is written.
 *
 * Three kinds of export, and which one a style is depends on what can change about it:
 *
 * - nothing can     → a string, built once when this file loads (`ss(…)`, or a helper);
 * - a state can     → a recipe (`variants(…)`), called with that state;
 * - an input can    → a function with the classes literal inside it.
 */

// --- Nothing changes -------------------------------------------------------------------

export const page = ss({
  base: "min-h-dvh bg-white p-6 text-neutral-900",
  md: "p-10",
  dark: "bg-neutral-950 text-neutral-100",
});

export const shell = ss({ base: "mx-auto max-w-2xl space-y-6", md: "space-y-8" });
export const header = ss({ base: "space-y-2", md: "space-y-3" });
export const title = ss({ base: "text-2xl font-bold", md: "text-4xl" });
export const lede = ss({ base: "text-sm text-neutral-600", dark: "text-neutral-400" });
export const code = ss({ base: "rounded bg-neutral-100 px-1", dark: "bg-neutral-800" });

// No variant in it, so nothing builds it at runtime: Tailwind reads this literal itself.
export const actions = "flex flex-wrap items-center gap-3";

// What a caller passes a component as `className`. It lands last, so it overrides.
export const emphasis = "underline underline-offset-4";

export const rows = ss({ base: "divide-y divide-neutral-200", dark: "divide-neutral-800" });

// A named group, so the label reaches *this* row rather than the nearest one.
export const rowLabel = group("row", "hover", "underline");

// A container query: sized by the panel, not by the window.
export const panel = ss([hairline, "@container/panel rounded-xl p-4"]);
export const panelGrid = container("panel", "@md", "grid grid-cols-2 gap-4");

export const details = ss([hairline, "rounded-lg p-4"], { open: "shadow-sm" });
export const summary = "cursor-pointer select-none text-sm font-medium";

// State the element carries as an attribute. Both values are written out here, so both
// have CSS — the component only has to set `data-state`. Inside a bucket the same helper
// stacks on the bucket's variant: dark *and* open.
export const summaryText = ss(
  data("state", "open", "text-blue-700"),
  data("state", "closed", "text-neutral-500"),
  { dark: data("state", "open", "text-blue-300") },
);

// A feature query, written the way CSS spells it.
export const notes = supports("display: grid", "mt-3 grid gap-1");

export const quote = inside(".prose", "italic");
export const withCode = has("> code", "text-blue-700");
export const darkHover = on(["dark", "hover"], "text-white");

// --- A state changes -------------------------------------------------------------------

/**
 * On or off, per item. The component says which state each row is in — `row({ selected })`
 * — and never which classes that means.
 */
export const row = variants({
  base: {
    base: "group/row flex w-full items-center justify-between rounded-md px-2 py-3 text-left",
    hover: "bg-neutral-50",
    dark: { hover: "bg-neutral-900" },
  },
  variants: {
    selected: {
      true: {
        base: "bg-blue-50 font-medium",
        hover: "bg-blue-50",
        dark: { base: "bg-blue-950", hover: "bg-blue-950" },
      },
    },
  },
});

// --- An input changes ------------------------------------------------------------------

/**
 * A plain function, for what a recipe's options do not fit. The one rule still holds:
 * every class is a literal inside the call, so the scanner reads both branches.
 */
export const rowIndex = (index: number) => nth(index % 2 === 0 ? 1 : 2, "text-xs text-neutral-500");
