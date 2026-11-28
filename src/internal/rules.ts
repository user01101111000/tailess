/**
 * The dev-time check that every variant class on the page has a CSS rule.
 *
 * tailess builds `md:p-6` at runtime, and the build only hands Tailwind the classes it can
 * read at the call site. One built from a variable, a spread or a computed key lands on the
 * element with no rule behind it, and nothing says so — `tailess check` reports a variable
 * or a template, but a spread or a computed key enumerates nothing for it to fail. The
 * browser can tell, though: the class is on the page, and no stylesheet names it.
 *
 * This module is loaded with `import()` by `verify.ts`, in the browser, in development,
 * once the page has loaded and the marker shows the integration is wired. Dev-only code a
 * bundle can reach ships to production — `env.ts` explains why it cannot be dropped — and
 * this is too much code to ship unused, so it is a chunk of its own that a production
 * bundle never requests. It imports nothing for the same reason: what it needs from the
 * rest of the runtime is handed to {@link watch}, so no shared chunk is split off to carry
 * it into every page.
 */

type Warn = (message: string) => void;
type FirstTime = (seen: Set<string>, key: string) => boolean;
type Configured = () => boolean;

/**
 * How long a class has to be on the page without a rule before it is reported. A save
 * that adds one re-renders before the rebuilt stylesheet arrives — half a second under
 * Vite and Turbopack, up to two and a half under webpack, measured — and that class is
 * fine; it is only late.
 */
const settle = 5000;

/**
 * A class a selector names, spelled as the browser serializes it — which is how
 * `CSS.escape` spells one, so the two compare directly: `2xl:flex` is `\32 xl\:flex` on
 * both sides, and a rule for `md:p-60` is no rule for `md:p-6`.
 */
const className = /\.((?:\\[\da-f]{1,6} ?|\\[\s\S]|[\w-]|\P{ASCII})+)/giu;

interface Sheet {
  /** How many top-level rules it had when read — a sheet edited in place is read again. */
  length: number;
  classes: Set<string>;
  marker: boolean;
}

const read = new WeakMap<CSSStyleSheet, Sheet>();

function parse(sheet: CSSStyleSheet, marker: string): Sheet {
  const parsed: Sheet = { length: sheet.cssRules.length, classes: new Set(), marker: false };
  const walk = (list: ArrayLike<CSSRule>): void => {
    for (const rule of Array.from(list) as Array<CSSStyleRule & CSSImportRule>) {
      if (rule.selectorText) {
        for (const match of rule.selectorText.matchAll(className)) {
          parsed.classes.add(match[1] ?? "");
        }
        parsed.marker ||= rule.style.getPropertyValue(marker) !== "";
      }
      // Nested rules — `@media`, `@layer`, native nesting — and an `@import`'s sheet. A
      // web font's `@import url(https://…)` from another origin throws on read; caught
      // here, it does not take the stylesheet importing it, Tailwind's, down with it.
      try {
        walk(rule.cssRules ?? rule.styleSheet?.cssRules ?? []);
      } catch {}
    }
  };
  walk(sheet.cssRules);
  return parsed;
}

/**
 * The classes named in each stylesheet this page can read — or nothing, when none of them
 * carries the marker. Then the integration is missing, which `verify.ts` reports, or
 * Tailwind's output comes from another origin — Laravel serves it from the Vite dev
 * server — and cannot be read. Either way nothing here could be proved.
 */
function readSheets(marker: string): Set<string>[] | undefined {
  const sheets: Set<string>[] = [];
  let wired = false;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      let parsed = read.get(sheet);
      if (parsed?.length !== sheet.cssRules.length) {
        parsed = parse(sheet, marker);
        read.set(sheet, parsed);
      }
      sheets.push(parsed.classes);
      wired ||= parsed.marker;
    } catch {
      // Another origin's stylesheet, which the browser will not let a script read.
    }
  }
  return wired ? sheets : undefined;
}

/**
 * Check the page now and whenever it changes, and warn — once per class — about each
 * variant class that has been on it without a rule for {@link settle} milliseconds.
 *
 * And once, first: whether the `configure()` the build saw ran here too. The build marks
 * an app that calls it with a merge or keys beside the marker (`marker.ts`); this runs
 * after the page has loaded and rendered, so a call that has not run by now did not run
 * before the render it was for. Called only on the server — a root layout alone — it
 * leaves this side merging with the defaults and blind to the keys, and React's
 * hydration error is all anyone saw of that.
 */
export function watch(
  marker: string,
  warn: Warn,
  firstTime: FirstTime,
  configured: Configured,
): void {
  const wanted = getComputedStyle(document.documentElement).getPropertyValue(`${marker}-configure`);
  if (wanted.trim() !== "" && !configured()) {
    warn(
      "[tailess] This project calls configure() with a merge or keys, but it has not run in " +
        "this browser, so ss() and cn() here merge with the defaults and do not know your " +
        "keys. Where a server rendered the page with your settings, the two differ, and " +
        "React reports a hydration mismatch. Import the module that calls configure() in the " +
        "browser too, before anything renders — on Next.js, from instrumentation-client.ts. " +
        "https://github.com/user01101111000/tailess#on-nextjs-and-anywhere-else-that-renders-on-the-server",
    );
  }

  const reported = new Set<string>();
  const suspects = new Map<string, number>();
  // At most one check a second, however often the page changes.
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(check, 1000);
  };

  function check(): void {
    scheduled = false;
    const sheets = readSheets(marker);
    if (!sheets) return;

    // Every class with a colon in it: each variant, which is what tailess builds, and an
    // arbitrary property. A class with no colon is plain Tailwind's business, and one
    // Tailwind does not generate is as likely to be a hook for a script as a mistake.
    const onPage = new Set<string>();
    for (const element of Array.from(document.querySelectorAll('[class*=":"]'))) {
      for (const cls of Array.from(element.classList)) if (cls.includes(":")) onPage.add(cls);
    }
    for (const cls of suspects.keys()) if (!onPage.has(cls)) suspects.delete(cls);

    const now = Date.now();
    const missing: string[] = [];
    for (const cls of onPage) {
      if (reported.has(cls)) continue;
      const escaped = CSS.escape(cls);
      if (sheets.some((classes) => classes.has(escaped))) {
        suspects.delete(cls);
        continue;
      }
      const since = suspects.get(cls) ?? now;
      suspects.set(cls, since);
      if (now - since < settle) continue;
      suspects.delete(cls);
      if (firstTime(reported, cls)) missing.push(`"${cls}"`);
    }

    if (missing.length > 0) {
      warn(
        `[tailess] No CSS rule for ${missing.join(", ")}, which the page uses. Either ` +
          "Tailwind does not know the class, or the build never read it: it reads only " +
          "classes written as literals at the call site, not ones from a variable, a " +
          "template, a spread or a computed key. " +
          "https://github.com/user01101111000/tailess#what-the-scanner-can-and-cannot-see",
      );
    }
    if (suspects.size > 0) schedule();
  }

  // A class changing, an element arriving, a stylesheet replaced by a hot update. Text
  // changing inside an element is none of those, and a ticking clock would otherwise
  // re-read every stylesheet once a second for as long as the page is open.
  new MutationObserver((records) => {
    if (records.some((record) => record.type === "attributes" || record.addedNodes.length)) {
      schedule();
    }
  }).observe(document, { subtree: true, childList: true, attributeFilter: ["class"] });
  schedule();
}
