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
