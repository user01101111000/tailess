import { useState } from "react";
import * as s from "../page.styles";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "tailess on React Router" }];
}

export default function Home() {
  const [open, setOpen] = useState(false);
  const parts = s.panel({ tone: open ? "warn" : "info" });

  return (
    <main className={s.page}>
      <h1 className={s.title}>tailess on React Router</h1>
      <button
        type="button"
        className={s.toggle}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close" : "Open"}
      </button>
      <section className={parts.root}>
        <h2 className={parts.heading}>Rendered on the server, built again in the browser</h2>
        <p className={s.note(open)}>Every class on this page comes from app/page.styles.ts.</p>
      </section>
    </main>
  );
}
