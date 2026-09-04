import {
  aria,
  between,
  container,
  data,
  group,
  match,
  notSupports,
  on,
  peer,
  responsive,
  ss,
  supports,
  until,
  withPrefix,
} from "tailess";

export function Card({
  size,
  open,
  disabled,
  className,
}: {
  size: "sm" | "lg";
  open: boolean;
  disabled: boolean;
  className?: string;
}) {
  return (
    <div
      className={ss(
        {
          base: "text-xl flex",
          sm: "block",
          md: "text-2xl",
          "2xl": "tracking-wide",
          "max-md": "gap-2",
          hover: "opacity-100",
          dark: { base: "bg-black", hover: "bg-neutral-900" },
          "group-hover": "underline",
          "focus-visible": "ring-2",
        },
        disabled && { base: "opacity-50 pointer-events-none", sm: "bg-red-500" },
        match(size, { sm: "p-2", lg: "p-8" }),
        // The helpers still work, and the scanner still reads them.
        responsive("text-sm", { lg: "text-lg", xl: "text-3xl" }),
        on("focus-within", "ring-offset-2"),
        until("md", "hidden"),
        between("sm", "lg", "grid"),
        data("state", open ? "open" : "closed", "opacity-100"),
        data("disabled", null, "pointer-events-none"),
        aria("expanded", "rotate-180"),
        withPrefix("supports-[display:grid]", "grid"),
        supports("display: grid", "gap-4"),
        notSupports("display: grid", "flex"),
        group("row", "hover", "underline"),
        peer("email", "invalid", "text-red-600"),
        container("sidebar", "@md", "grid-cols-2"),
        "px-2 px-4",
        className,
      )}
    />
  );
}
