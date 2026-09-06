/// <reference types="node" />

/**
 * The scanner, as a library.
 *
 * Everything in this package that is not the runtime rests on one question — *which
 * classes can this source build at runtime?* — and until now the only ways to ask were
 * the two plugins and the binary. A webpack or rspack loader, an esbuild plugin, an
 * Astro or Nuxt module, an editor extension, a lint rule, a company's own CI script:
 * every one of them needs the same answer, and every one of them had to reach into
 * `dist/` internals or reimplement it.
 *
 * This is that surface, exported deliberately and covered by the same tests as the
 * plugins. It is Node-only — it walks the file system — which is why it is a subpath
 * rather than part of `tailess` itself: the runtime pulls in no Node types at all, and
 * that has to stay true.
 *
 * @example
 * import { collect, buildPrelude } from "tailess/build";
 *
 * const { classes, diagnostics } = await collect({ roots: ["src"] });
 * const css = buildPrelude(classes);   // the @source inline(...) Tailwind needs
 */

export type { CollectOptions, CollectResult, FileDiagnostic } from "./extract/collect.js";
export {
  clearCache,
  collect,
  defaultExtensions,
  defaultIgnore,
  isScannable,
  normalizeExtensions,
} from "./extract/collect.js";
export type { Diagnostic } from "./extract/diagnose.js";
export { diagnose } from "./extract/diagnose.js";
export { extractClasses } from "./extract/extract.js";
export {
  hasUtilitiesAtRule,
  importSpecifiers,
  isTailwindEntry,
  isTailwindSpecifier,
  tailwindPrefixIn,
} from "./integration/entry.js";
export { buildPrelude, markerProperty, markerRule } from "./integration/inject.js";
export type { DiagnosticMode } from "./integration/report.js";
export { clearReported, reportDiagnostics } from "./integration/report.js";
export type { BreakpointDecl, CollectedTheme } from "./integration/theme.js";
export {
  breakpointsIn,
  collectBreakpoints,
  collectTheme,
  customVariantsIn,
  hasJsConfig,
  themeDiagnostics,
} from "./integration/theme.js";
export { hasRule, selectorFor } from "./internal/selector.js";
