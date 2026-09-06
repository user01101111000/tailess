import { useState } from "react";
import {
  aria,
  container,
  data,
  group,
  has,
  inside,
  nth,
  on,
  ss,
  supports,
  type VariantProps,
  variants,
  vars,
} from "tailess";

/**
 * Every class on this page is built at runtime, which means Tailwind never sees one of
 * them in this file. The plugin in `vite.config.ts` is what puts them in the stylesheet,
 * and `npm run check` is what proves it did — delete the plugin and the page renders
 * with the right `class` attributes and no styles at all, which is the whole point.
 */

const button = variants({
  base: {
    base: "rounded-lg font-medium transition-colors",
    hover: "brightness-110",
    "focus-visible": "outline-2 outline-offset-2",
    disabled: "opacity-50",
  },
  variants: {
    tone: {
      primary: "bg-blue-600 text-white outline-blue-600",
      ghost: { base: "bg-transparent text-blue-700", hover: "bg-blue-50" },
    },
    size: {
      sm: "px-3 py-1.5 text-sm",
      // A variant option that carries its own breakpoint — the thing a flat string
      // cannot say, and the reason this lives here rather than in cva.
      lg: { base: "px-4 py-2 text-base", md: "px-6 py-3 text-lg" },
    },
  },
  compound: [{ tone: "primary", size: "lg", class: "shadow-md" }],
  defaults: { tone: "primary", size: "sm" },
});

type ButtonProps = VariantProps<typeof button> & {
  children: React.ReactNode;
  onClick?: () => void;
};

function Button({ tone, size, children, onClick }: ButtonProps) {
  return (
    <button type="button" className={button({ tone, size })} onClick={onClick}>
      {children}
    </button>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <main
      className={ss({
        base: "min-h-dvh bg-white p-6 text-neutral-900",
        md: "p-10",
        dark: "bg-neutral-950 text-neutral-100",
      })}
    >
      <div className={ss({ base: "mx-auto max-w-2xl", md: "space-y-8" })}>
        <header className={ss({ base: "space-y-2", md: "space-y-3" })}>
          <h1 className={ss({ base: "text-2xl font-bold", md: "text-4xl" })}>tailess</h1>
          <p className={ss({ base: "text-sm text-neutral-600", dark: "text-neutral-400" })}>
            Every class below is built at runtime. View source, then run{" "}
            <code className={ss({ base: "rounded bg-neutral-100 px-1", dark: "bg-neutral-800" })}>
              npm run check
            </code>
            .
          </p>
        </header>

        <section className={ss({ base: "flex flex-wrap gap-3" })}>
          <Button onClick={() => setCount((n) => n + 1)}>Clicked {count}×</Button>
          <Button tone="ghost">Ghost</Button>
          <Button size="lg">Large at md and up</Button>
          <Button tone="ghost" size="lg">
            Both
          </Button>
        </section>

        {/* A named group, so the child reaches *this* row rather than the nearest one. */}
        <ul className={ss({ base: "divide-y divide-neutral-200", dark: "divide-neutral-800" })}>
          {["Scanner", "Runtime", "Gate"].map((label, i) => (
            <li key={label} className="group/row flex items-center justify-between py-3">
              <span className={group("row", "hover", "underline")}>{label}</span>
              {/* nth() counts from 1, and the scanner reads both branches of the ternary. */}
              <span className={nth(i % 2 === 0 ? 1 : 2, "text-xs text-neutral-500")}>
                row {i + 1}
              </span>
            </li>
          ))}
        </ul>

        {/* A container query: sized by this box, not the viewport. */}
        <div className="@container/panel rounded-xl border border-neutral-200 p-4">
          <div className={container("panel", "@md", "grid grid-cols-2 gap-4")}>
            <p className={ss({ base: "text-sm" })}>Two columns once the panel is wide.</p>
            <p className={ss({ base: "text-sm" })}>Not once the window is.</p>
          </div>
        </div>

        <details
          className={ss({ base: "rounded-lg border border-neutral-200 p-4", open: "shadow-sm" })}
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary
            className={ss({ base: "cursor-pointer select-none text-sm font-medium" })}
            {...{ "data-state": open ? "open" : "closed" }}
          >
            <span className={data("state", open ? "open" : "closed", "text-blue-700")}>
              Attribute variants
            </span>
          </summary>
          <div className={ss({ base: "pt-3 text-sm text-neutral-600" })}>
            <p className={aria("expanded", "font-semibold")}>
              Both branches of the ternary above are enumerated, so both have CSS.
            </p>
            {/* A feature query, written the way CSS spells it. */}
            <p className={supports("display: grid", "mt-2 grid gap-1")}>
              Only where <code>display: grid</code> is supported.
            </p>
          </div>
        </details>

        {/* A value no class can carry: keep the class literal, put the number in a var. */}
        <div className={ss({ base: "h-2 rounded-full bg-neutral-200" })}>
          <div
            className={ss({ base: "h-2 w-[var(--fill)] rounded-full bg-blue-600" })}
            style={vars({ "--fill": `${Math.min(count, 10) * 10}%` })}
          />
        </div>

        <div className={inside(".prose", "italic")}>
          <p className={has("> code", "text-blue-700")}>
            A paragraph that contains <code>code</code>.
          </p>
          <p className={on(["dark", "hover"], "text-white")}>Compound variant, one call.</p>
        </div>
      </div>
    </main>
  );
}
