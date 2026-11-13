import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/check/run.js";
import { clearCache } from "../../src/extract/collect.js";
import { extractClasses } from "../../src/extract/extract.js";
import { aria, cn, data, group, match, nth, on, ss, variants, vars } from "../../src/index.js";
import { clearReported } from "../../src/integration/report.js";
import tailess from "../../src/postcss/index.js";
import { missingRules } from "../helpers/css.js";

/**
 * A design system keeps its classes in files of their own — `Button.styles.ts` beside
 * `Button.tsx` — and the component hands those files the state it is in, never a class.
 *
 * That moves every class one import away from the element it lands on, which is exactly
 * the distance at which this package's failure is invisible: the right `class` attribute
 * with no rule behind it. So the whole arrangement is run here the way a project runs it.
 * The styles are written to disk as separate files, scanned and compiled by the real
 * Tailwind, and then *the same text* is evaluated with the real helpers and driven through
 * every state a component could pass. Whatever the runtime builds has to have a rule.
 */

/** The styles, as the bodies of the files below. Evaluated as written, further down. */
const tokens = `
const focusRing = ss({ "focus-visible": "outline-2 outline-offset-2" });
`;

const buttonStyles = `
const button = variants({
  base: { base: [focusRing, "rounded-lg font-medium"], disabled: "opacity-50" },
  variants: {
    tone: {
      primary: { base: "bg-blue-600", hover: "bg-blue-700" },
      ghost: { hover: "bg-blue-50", dark: { hover: "bg-blue-950" } },
    },
    size: { sm: "px-3", lg: { base: "px-4", md: "px-6" } },
    loading: { true: { base: "cursor-progress", "not-disabled": "opacity-70" } },
  },
  compound: [{ tone: "primary", size: "lg", class: { lg: "shadow-md" } }],
  defaults: { tone: "primary", size: "sm" },
});
`;

const cardStyles = `
const card = variants({
  slots: {
    root: { base: "rounded-xl border", md: "p-6", dark: "border-neutral-800" },
    title: { md: "text-lg" },
  },
});
const panel = variants({ extend: card, slots: { footer: { "max-md": "hidden" } } });
const dangerButton = variants({ extend: button, defaults: { tone: "ghost" }, base: { active: "scale-95" } });
`;

const tabsStyles = `
const tab = ss({
  base: ["px-3 py-2", aria("selected", "text-blue-700")],
  hover: "text-neutral-900",
  dark: [on("hover", "text-neutral-100"), aria("current", "page", "text-blue-300")],
});
const disclosure = ss(
  data("state", "open", "block"),
  data("state", "closed", "hidden"),
  { dark: data("state", "open", "text-white") },
);
const rowLabel = group("row", "hover", "underline");
const cell = (day) =>
  ss(
    { base: "size-9", hover: "bg-neutral-100" },
    day.today && { base: "bg-blue-600", hover: "bg-blue-700" },
    day.weekend && { "max-sm": "opacity-60" },
    match(day.span, { 1: "col-span-1", 2: { "col-span-2": true } }),
    nth(day.even ? 2 : 1, "font-medium"),
  );
const meter = variants({ slots: { track: { dark: "bg-neutral-800" }, fill: "w-[var(--fill)]" } })();
const fill = (ratio) => vars({ "--fill": ratio > 0 && \`\${ratio * 100}%\` });
`;

/** A component: it imports the styles and passes them state. No class is written here. */
const component = `
import * as s from "./Button.styles";
import * as c from "./Card.styles";
import * as t from "./Tabs.styles";

export function Button({ tone, size, loading, className, ...rest }) {
  return <button className={s.button({ tone, size, loading }, className)} {...rest} />;
}

export function Card({ title, children, className }) {
  const part = c.card({}, { root: className });
  return <section className={part.root}><h2 className={part.title}>{title}</h2>{children}</section>;
}

export function Day(day) {
  return <td className={t.cell(day)} style={t.fill(day.load)}>{day.label}</td>;
}
`;

/** One styles file: its imports, then every declaration exported. */
const asModule = (imports: string, body: string): string =>
  `${imports}\n${body.replace(/^const /gm, "export const ")}`;

let dir = "";

beforeEach(async () => {
  clearCache();
  clearReported();
  dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-styles-"));
  await writeFile(join(dir, "tokens.styles.ts"), asModule(`import { ss } from "tailess";`, tokens));
  await writeFile(
    join(dir, "Button.styles.ts"),
    asModule(
      `import { variants } from "tailess";\nimport { focusRing } from "./tokens.styles";`,
      buttonStyles,
    ),
  );
  await writeFile(
    join(dir, "Card.styles.ts"),
    asModule(
      `import { variants } from "tailess";\nimport { button } from "./Button.styles";`,
      cardStyles,
    ),
  );
  await writeFile(
    join(dir, "Tabs.styles.ts"),
    asModule(
      `import { aria, data, group, match, nth, on, ss, variants, vars } from "tailess";`,
      tabsStyles,
    ),
  );
  await writeFile(join(dir, "components.tsx"), component);
  await writeFile(join(dir, "app.css"), `@import "tailwindcss";`);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  clearCache();
  clearReported();
});

/** Compile the fixture's entry stylesheet through the plugin and the real Tailwind. */
async function compile(): Promise<string> {
  const result = await postcss([
    tailess({ content: [dir], cacheDir: join(dir, ".cache") }),
    tailwindcss({ base: dir, optimize: false }),
  ]).process(`@import "tailwindcss";`, { from: join(dir, "app.css") });
  return result.css;
}

/** The styles above, built by the real helpers from the very text that was scanned. */
function evaluate() {
  const helpers = { aria, cn, data, group, match, nth, on, ss, variants, vars };
  const body = `${tokens}${buttonStyles}${cardStyles}${tabsStyles}
    return { button, card, panel, dangerButton, tab, disclosure, rowLabel, cell, meter, fill };`;
  return new Function(...Object.keys(helpers), body)(...Object.values(helpers)) as {
    button: (props?: Record<string, unknown>, ...rest: unknown[]) => string;
    dangerButton: (props?: Record<string, unknown>, ...rest: unknown[]) => string;
    card: (props?: unknown, extra?: Record<string, unknown>) => Record<string, string>;
    panel: (props?: unknown, extra?: Record<string, unknown>) => Record<string, string>;
    tab: string;
    disclosure: string;
    rowLabel: string;
    cell: (day: Record<string, unknown>) => string;
    meter: Record<string, string>;
    fill: (ratio: number) => Record<string, string>;
  };
}

/** Every class in `values` that carries a variant, which is what the bridge has to supply. */
const prefixed = (values: readonly string[]): string[] => [
  ...new Set(
    values
      .flatMap((value) => value.split(/\s+/))
      .filter((cls) => cls.includes(":") && !cls.startsWith("w-[")),
  ),
];

describe("styles in their own file", () => {
  it("gives every class a component can be handed a rule, in every state", async () => {
    const css = await compile();
    const s = evaluate();

    // Every state a component could pass, not a sample of them: the options multiply,
    // and a compound rule or an inherited default only shows up in one combination.
    const built: string[] = [s.tab, s.disclosure, s.rowLabel, ...Object.values(s.meter)];
    for (const recipe of [s.button, s.dangerButton]) {
      for (const tone of ["primary", "ghost", undefined]) {
        for (const size of ["sm", "lg", undefined]) {
          for (const loading of [true, false, undefined]) {
            built.push(recipe({ tone, size, loading }));
            built.push(recipe({ tone, size, loading }, "mt-2", "underline"));
          }
        }
      }
    }
    for (const recipe of [s.card, s.panel]) {
      built.push(...Object.values(recipe()));
      built.push(...Object.values(recipe({}, { root: "mt-4" })));
    }
    for (const today of [true, false]) {
      for (const weekend of [true, false]) {
        for (const span of [1, 2]) {
          for (const even of [true, false]) built.push(s.cell({ today, weekend, span, even }));
        }
      }
    }

    const classes = prefixed(built);
    // The states really were exercised: these only exist in one combination each.
    expect(classes).toContain("lg:shadow-md");
    expect(classes).toContain("not-disabled:opacity-70");
    expect(classes).toContain("max-md:hidden");
    expect(classes).toContain("active:scale-95");
    expect(classes).toContain("dark:aria-[current=page]:text-blue-300");
    expect(classes).toContain("dark:data-[state=open]:text-white");
    expect(classes).toContain("nth-2:font-medium");
    expect(classes.length).toBeGreaterThan(25);

    expect(missingRules(css, classes)).toEqual([]);
  });

  it("finds all of it in the styles files, and nothing in the component", () => {
    // The component passes state, so there is nothing in it for a scan to miss — which
    // is the property that makes the arrangement safe to refactor behind.
    expect(extractClasses(component)).toEqual([]);
    expect(extractClasses(buttonStyles).length).toBeGreaterThan(5);
  });

  it("carries a value from data in a custom property, not in a class", () => {
    const s = evaluate();
    expect(s.meter.fill).toBe("w-[var(--fill)]");
    expect(s.fill(0.42)).toEqual({ "--fill": "42%" });
    // A condition that is false drops the property, as a false class is dropped.
    expect(s.fill(0)).toEqual({});
  });

  it("passes the gate a project would put in CI, with the build-time checks on", async () => {
    const code = await run({
      command: "check",
      content: [dir],
      css: undefined,
      cwd: dir,
      strict: true,
      extensions: [],
      ignore: [],
      json: true,
      max: 0,
      out: undefined,
      write: false,
    });
    expect(code).toBe(0);
  });

  it("is why a bucket map belongs in the styles file and not at the call site", async () => {
    // The recipe is read where it is defined. A map handed to the component it built is
    // a class the runtime assembles in a file the scanner has no reason to look for it
    // in — and the same map inside `ss()` is found, because that *is* a call it knows.
    // The types refuse the first; this is the plain-JavaScript component that gets past.
    await writeFile(
      join(dir, "Wide.jsx"),
      `import { ss } from "tailess";\nimport * as s from "./Button.styles";\n` +
        `export const Wide = () => <button className={s.button({ size: "lg" }, { xl: "px-10" })} />;\n` +
        `export const Tall = () => <button className={s.button({ size: "lg" }, ss({ "2xl": "py-4" }))} />;\n`,
    );
    clearCache();
    const css = await compile();
    const s = evaluate();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // The class is built, lands on the element, and has no rule: the failure itself.
      expect(s.button({ size: "lg" }, { xl: "px-10" })).toContain("xl:px-10");
      expect(missingRules(css, ["xl:px-10"])).toEqual(["xl:px-10"]);
      // Nothing at build time can see it, so the runtime is what says so.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain("got an ss map ({ xl })");

      expect(s.button({ size: "lg" }, ss({ "2xl": "py-4" }))).toContain("2xl:py-4");
      expect(missingRules(css, ["2xl:py-4"])).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
