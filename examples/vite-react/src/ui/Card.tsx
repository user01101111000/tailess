import type { ReactNode } from "react";
import { type CardStyle, card } from "./Card.styles.js";

type CardProps = CardStyle & { title: string; children: ReactNode; className?: string };

export function Card({ tone, title, children, className }: CardProps) {
  // One call, one class per part. Extra classes are keyed by the part they are for.
  const s = card({ tone }, { root: className });
  return (
    <section className={s.root}>
      <h2 className={s.title}>{title}</h2>
      <div className={s.body}>{children}</div>
    </section>
  );
}
