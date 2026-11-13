import { type VariantProps, variants } from "tailess";
import { hairline } from "./tokens.styles.js";

/**
 * A component with parts. One recipe names them, every option says what it adds to each,
 * and a call hands back a class per part.
 */
export const card = variants({
  slots: {
    root: {
      base: [hairline, "rounded-xl bg-white p-4"],
      md: "p-6",
      dark: "bg-neutral-900",
    },
    title: { base: "text-base font-semibold", md: "text-lg" },
    body: { base: "mt-3 space-y-3 text-sm text-neutral-600", dark: "text-neutral-400" },
  },
  variants: {
    tone: {
      plain: {},
      accent: {
        root: { base: "border-blue-200 bg-blue-50", dark: "border-blue-900 bg-blue-950" },
        title: { base: "text-blue-800", dark: "text-blue-200" },
      },
    },
  },
  defaults: { tone: "plain" },
});

export type CardStyle = VariantProps<typeof card>;
