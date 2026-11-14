import { useState } from "react";
import * as s from "./App.styles.js";
import { Button } from "./ui/Button.js";
import { Card } from "./ui/Card.js";
import { Meter } from "./ui/Meter.js";
import { Tabs } from "./ui/Tabs.js";

/**
 * There is not one class in this file. Each component's styles live beside it in a
 * `*.styles.ts`, and what a component hands them is the state it is in — never a class.
 *
 * Every variant on the page is still built at runtime, so Tailwind never sees one of them
 * in the source. The plugin in `vite.config.ts` is what puts them in the stylesheet, and
 * `npm run check` is what proves it did.
 */

const tabs = [
  { id: "recipes", label: "Recipes" },
  { id: "state", label: "State" },
  { id: "layout", label: "Layout" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const parts = ["Scanner", "Runtime", "Gate"];

export default function App() {
  const [tab, setTab] = useState<TabId>("recipes");
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <main className={s.page}>
      <div className={s.shell}>
        <header className={s.header}>
          <h1 className={s.title}>tailess</h1>
          <p className={s.lede}>
            No class is written in a component here. View source, then run{" "}
            <code className={s.code}>npm run check</code>.
          </p>
        </header>

        <Tabs value={tab} onChange={setTab} items={tabs} />

        {tab === "recipes" && (
          <Card title="A recipe per component">
            <p>A choice, a size that carries its own breakpoint, and a caller's own class.</p>
            <div className={s.actions}>
              <Button onClick={() => setCount((n) => n + 1)}>Clicked {count}×</Button>
              <Button tone="ghost">Ghost</Button>
              <Button size="lg">Large at md and up</Button>
              <Button tone="ghost" className={s.emphasis}>
                With a className
              </Button>
            </div>
            <Meter value={Math.min(count, 10)} max={10} />
          </Card>
        )}

        {tab === "state" && (
          <Card title="State in, classes out" tone={saving ? "accent" : "plain"}>
            <div className={s.actions}>
              <Button loading={saving} onClick={() => setSaving((on) => !on)}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button disabled>Disabled</Button>
            </div>

            <ul className={s.rows}>
              {parts.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    className={s.row({ selected: i === selected })}
                    onClick={() => setSelected(i)}
                  >
                    <span className={s.rowLabel}>{label}</span>
                    <span className={s.rowIndex(i)}>row {i + 1}</span>
                  </button>
                </li>
              ))}
            </ul>

            <details className={s.details} onToggle={(event) => setOpen(event.currentTarget.open)}>
              <summary className={s.summary}>
                <span className={s.summaryText} data-state={open ? "open" : "closed"}>
                  State the element carries
                </span>
              </summary>
              <div className={s.notes}>
                <p>The colour above follows an attribute, not a prop.</p>
                <p>These two lines are a grid only where grid is supported.</p>
              </div>
            </details>
          </Card>
        )}

        {tab === "layout" && (
          <Card title="Sized by the box, not the window">
            <div className={s.panel}>
              <div className={s.panelGrid}>
                <p>Two columns once the panel is wide.</p>
                <p>Not once the window is.</p>
              </div>
            </div>
            <div className={s.quote}>
              <p className={s.withCode}>
                A paragraph that contains <code>code</code>.
              </p>
              <p className={s.darkHover}>Compound variant, one call.</p>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
