import { data, on, ss, variants } from "tailess";

// Every class on the page lives here. The page hands over state — never a class.

export const page = ss({
  base: "min-h-screen bg-white p-4 text-gray-900",
  md: "p-10",
  "3xl": "p-16",
  dark: "bg-gray-950 text-gray-100",
});

export const title = ss({ base: "text-2xl font-semibold", md: "text-4xl" });

export const toggle = ss(
  { base: "mt-6 rounded-md border px-3 py-1.5 text-sm", md: "px-4" },
  on(["hover", "focus-visible"], "underline"),
  data("state", "open", "bg-sky-600 text-white"),
);

/** A part with parts: one recipe, a class per slot. */
export const panel = variants({
  slots: { root: "mt-6 rounded-lg border p-4", heading: "font-medium" },
  variants: {
    tone: {
      info: { root: { base: "border-sky-300", hover: "border-sky-500" } },
      warn: { root: { base: "border-amber-300", hover: "border-amber-500" } },
    },
  },
  defaults: { tone: "info" },
});

/** Built on every render, in the browser too: both branches are literals. */
export function note(open: boolean): string {
  return ss({ base: "mt-2 text-sm", md: open ? "font-semibold" : "font-normal" });
}
