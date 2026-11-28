import type { ReactNode } from "react";
import { button, buttonRow } from "./button.styles";

export function Button({
  tone,
  children,
}: {
  tone?: "brand" | "ghost";
  children: ReactNode;
}) {
  return (
    <button type="button" className={button({ tone })}>
      {children}
    </button>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className={buttonRow}>{children}</div>;
}
