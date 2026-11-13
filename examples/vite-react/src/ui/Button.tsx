import type { ComponentProps } from "react";
import { type ButtonStyle, button } from "./Button.styles.js";

type ButtonProps = ButtonStyle & ComponentProps<"button">;

/**
 * The component passes state in and gets a `className` back. A caller's own `className`
 * goes in after the state, as the last argument, so it still overrides.
 */
export function Button({ tone, size, loading, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={button({ tone, size, loading }, className)} {...rest} />;
}
