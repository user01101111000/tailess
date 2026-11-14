import { variants, vars } from "tailess";

/**
 * Three parts and nothing that varies — a recipe does not need variants to have slots.
 * Called once, here, since the answer can never change.
 */
export const meter = variants({
  slots: {
    track: { base: "h-2 overflow-hidden rounded-full bg-neutral-200", dark: "bg-neutral-800" },
    // The width comes from data, and a class cannot carry a value that is not written in
    // the source. So the class stays literal and names a custom property…
    fill: "h-full w-[var(--fill)] rounded-full bg-blue-600 transition-[width] duration-200",
    label: "mt-1 text-xs tabular-nums text-neutral-500",
  },
})();

/** …and this is the `style` that sets it. The number never touches a class name. */
export const fill = (ratio: number) =>
  vars({ "--fill": `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%` });
