// Ambient declaration only — tailess pulls in no Node types at runtime.
declare const process: { env: { NODE_ENV?: string } };

/**
 * True unless we're demonstrably in a production build. Gates the dev-only
 * warnings.
 *
 * `process.env.NODE_ENV` is written out verbatim so bundlers can statically
 * replace it: Vite, webpack, Next and Rollup all substitute that exact expression
 * at build time, which is what makes the warnings work in a browser bundle where
 * `process` doesn't exist. Reading it through a `typeof process` guard instead
 * would defeat the substitution and silently disable every warning on the client.
 *
 * If nothing replaced it and there's no `process` (a bare `<script type=module>`,
 * say), the access throws and we assume production — quiet is the safer default
 * for a library.
 */
export const isDev: boolean = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();

/*
 * A note on what this costs, since it looks like it could be cheaper.
 *
 * The `try`/`catch` makes `isDev` opaque to minifiers, so the dev-only warning
 * bodies — the long "integration missing" message most of all, about 1 kB gzipped —
 * survive into production bundles where they can never run. Two ways to erase them
 * were measured, and both were rejected:
 *
 * - Repeating `process.env.NODE_ENV !== "production"` at each warning site does fold
 *   away, but only with the literal written *first*; behind `isDev &&` the minifier
 *   keeps it. Written first it is evaluated before the `try`/`catch` has vouched for
 *   `process`, so loading the package unbundled — a bare `<script type="module">` —
 *   throws `ReferenceError` on import.
 * - Hoisting that read to a module-level `const` is safe and does not throw, but it
 *   also stops folding, and it puts a `process.env` read on the render path. Under
 *   Node — which is to say under SSR — that measured 4x slower per `ss()` call.
 *
 * Neither trade is worth 1 kB: one risks breaking the package outright, the other
 * taxes every server render. The warnings ship, unreachable, and that is deliberate.
 * `test/internal/production-bundle.test.ts` pins the size so the cost cannot grow
 * unnoticed, and pins the messages so they cannot vanish from development builds.
 */
