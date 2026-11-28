import { ss, variants } from "tailess";

// The design system's classes. A component hands this its state — never a class.

export const button = variants({
  base: "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium",
  variants: {
    tone: {
      brand: { base: "bg-violet-700 text-white", hover: "bg-violet-800" },
      ghost: { base: "border border-gray-300", hover: "bg-gray-100", dark: { hover: "bg-gray-800" } },
    },
    size: {
      sm: "px-2 py-1 text-xs",
      md: { md: "px-4 py-2" },
    },
  },
  defaults: { tone: "brand", size: "md" },
});

export const buttonRow = ss({ base: "flex flex-wrap gap-3", md: "gap-4" });
