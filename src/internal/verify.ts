import { isDev } from "./env.js";

/**
 * Custom property the build integration injects into your Tailwind stylesheet.
 * Its only job is to be observable from the browser, so a missing integration
 * fails loudly instead of silently producing classes that have no CSS.
 */
export const markerProperty = "--tailess";

let started = false;

/**
 * Warn once, in dev, if the tailess build integration isn't wired up.
 *
 * tailess builds variant prefixes (`md:`, `hover:`) at runtime, so those class
 * names never appear literally in your source and Tailwind's scanner can't find
 * them. The Vite/PostCSS integration is what tells Tailwind about them. Without
 * it everything *looks* fine — the right class lands on the element, there's just
 * no CSS rule behind it — which is a miserable thing to debug. So we check for the
 * marker the integration injects and say exactly what's missing.
 *
 * Called from {@link withPrefix}, i.e. only once a prefixed class is actually
 * produced. No-ops on the server and in production builds.
 */
export function verifyIntegration(): void {
  if (started || !isDev) return;
  started = true;

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const check = (): void => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(markerProperty)
      .trim();
    if (value !== "") return;

    console.warn(
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
