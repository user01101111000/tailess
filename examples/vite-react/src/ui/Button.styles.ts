import { type VariantProps, variants } from "tailess";
import { focusRing } from "./tokens.styles.js";

/**
 * Everything a button can look like, in one place.
 *
 * `Button.tsx` never mentions a class. It says which state the button is in — a tone, a
 * size, whether it is loading — and this turns that into a `className`.
 */
export const button = variants({
  base: {
    base: [
      focusRing,
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
    ],
    // The browser's own states need no prop at all: the key is the variant.
    disabled: "pointer-events-none opacity-50",
  },
  variants: {
    tone: {
      primary: { base: "bg-blue-600 text-white", hover: "bg-blue-700" },
      ghost: {
        base: "bg-transparent text-blue-700",
        hover: "bg-blue-50",
        dark: { base: "text-blue-300", hover: "bg-blue-950" },
      },
    },
    size: {
      sm: "h-8 gap-1.5 px-3 text-sm",
      // An option that carries its own breakpoint — the thing a flat string cannot say.
      lg: { base: "h-10 gap-2 px-4 text-base", md: "h-12 px-6 text-lg" },
    },
    // On or off. Only the difference goes under `true`: a variant nobody passed adds
    // nothing, so the resting look belongs in `base` rather than under `false`.
    loading: { true: "cursor-progress opacity-70" },
  },
  // Two states at once.
  compound: [{ tone: "primary", size: "lg", class: "shadow-md" }],
  defaults: { tone: "primary", size: "sm" },
});

/** The props the recipe takes, read back off it so the component never restates them. */
export type ButtonStyle = VariantProps<typeof button>;
