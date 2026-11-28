import { isDev } from "./env.js";
import { markerProperty } from "./marker.js";
import { firstTime, warn } from "./settings.js";

let started = false;

/**
 * Warn once, in dev, if the tailess build integration isn't wired up — and once it
 * is, start checking that each variant class on the page has a rule.
 *
 * tailess builds variant prefixes (`md:`, `hover:`) at runtime, so those class
 * names never appear literally in your source and Tailwind's scanner can't find
 * them. The Vite/PostCSS integration is what tells Tailwind about them. Without
 * it everything *looks* fine — the right class lands on the element, there's just
 * no CSS rule behind it — which is a miserable thing to debug. So we check for the
 * marker the integration injects and say exactly what's missing. With it, a class
 * built from something the build cannot read fails the same quiet way, one class
 * at a time; `rules.ts` names those.
 *
 * Called from {@link withPrefix}, i.e. only once a prefixed class is actually
 * produced. No-ops on the server and in production builds.
 */
export function verifyIntegration(): void {
  if (started || !isDev) return;

  // Claim the flag only once there is a document to check. A server-side render
  // reaches this too, and consuming the flag there would leave the browser pass —
  // the only one that can actually observe the marker — permanently silent. That
  // warning is this package's guarantee against unstyled elements, so it must not
  // be spendable by a call that was never able to perform the check.
  if (typeof window === "undefined" || typeof document === "undefined") return;
  started = true;

  const check = (): void => {
    // A document with no stylesheet at all has nothing to compare against — it is a
    // component test's jsdom or happy-dom, which load no CSS, and every test file there
    // was told its build was not wired up.
    if (document.styleSheets?.length === 0) return;
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(markerProperty)
      .trim();
    if (value !== "") {
      // Wired. Whether each class on the page got a rule is the next question, and the
      // code that answers it is loaded only now: a chunk of its own, which a production
      // bundle never requests. `CSS.escape` is what it matches a class to a rule with.
      if (typeof CSS !== "undefined") {
        import("./rules.js").then(
          (rules) => rules.watch(markerProperty, warn, firstTime),
          () => {},
        );
      }
      return;
    }

    warn(
      `[tailess] Your Tailwind CSS doesn't include tailess' generated classes, so
variants like "md:" and "hover:" will have no styles.

tailess builds those class names at runtime, so Tailwind's scanner never sees them
in your source. Add the one-line integration that tells Tailwind about them:

  Vite      vite.config.ts    import tailess from "tailess/vite"
                              plugins: [tailwindcss(), tailess()]

  Next.js   postcss.config.mjs
                              plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} }

Docs: https://github.com/user01101111000/tailess#setup
(Already handling this yourself? Declare ":root { ${markerProperty}: 1 }" in your CSS to silence this.)`,
    );
  };

  // Wait for stylesheets to actually be applied before deciding they're missing.
  const schedule = (): void => {
    setTimeout(check, 0);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}
