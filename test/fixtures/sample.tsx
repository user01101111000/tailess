import { aria, between, cn, data, match, on, responsive, ss, until, withPrefix } from "tailess";

export function Card({ size, open }: { size: "sm" | "lg"; open: boolean }) {
  return (
    <div
      className={cn(
        ss({
          base: "text-xl flex",
          sm: "block",
          md: "text-2xl",
          "2xl": "tracking-wide",
          "max-md": "gap-2",
          hover: "opacity-100",
          dark: "bg-black",
          "group-hover": "underline",
        }),
        on("focus-visible", "ring-2"),
        on(["dark", "hover"], "bg-neutral-900"),
        responsive("text-sm", { lg: "text-lg", xl: "text-3xl" }),
        until("md", "hidden"),
        between("sm", "lg", "grid"),
        data("state", open ? "open" : "closed", "opacity-100"),
        data("disabled", null, "pointer-events-none"),
        aria("expanded", "rotate-180"),
        withPrefix("supports-[display:grid]", "grid"),
        match(size, { sm: "p-2", lg: "p-8" }),
        "px-2 px-4",
      )}
    />
  );
}
