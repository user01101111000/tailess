/// <reference types="node" />
import { relative } from "node:path";
import type { FileDiagnostic } from "../extract/collect.js";

/**
 * Problems already printed, so a dev server that rescans on every keystroke reports
 * each one once rather than on every rebuild.
 *
 * Module-level, like the extraction cache, so the two integrations share it when they
 * run in the same process.
 */
const reported = new Set<string>();

/** Forget what has been printed. Exposed for tests. */
export function clearReported(): void {
  reported.clear();
}

/**
 * Print what the scanner proved wrong, once each.
 *
 * Written to `console.warn` rather than thrown: every one of these is a mistake in a
 * class name, and failing the build over one would stop a developer from seeing the
 * rest of their page. The point is that it reaches the terminal and CI at all — the
 * runtime equivalents only fire once the offending line actually renders.
 */
export function reportDiagnostics(
  diagnostics: readonly FileDiagnostic[],
  root: string,
  mode: DiagnosticMode = "warn",
): void {
  if (mode === "off") return;

  for (const diagnostic of diagnostics) {
    const where = relative(root, diagnostic.file) || diagnostic.file;
    const key = `${where}\0${diagnostic.kind}\0${diagnostic.message}`;
    if (reported.has(key)) continue;
    reported.add(key);
    console.warn(`[tailess] ${where}: ${diagnostic.message}`);
  }

  // After the whole list rather than at the first finding, so one build shows
  // everything there is to fix. Keyed on what was *found*, not on what was printed: a
  // rebuild repeating a finding the dedupe swallowed still has an unstyled class in it.
  // A note about CSS that works is printed with the rest and fails nothing.
  const failing = diagnostics.filter((d) => d.informational !== true);
  if (mode === "error" && failing.length > 0) {
    const n = failing.length;
    throw new Error(
      `[tailess] ${n} build-time diagnostic${n === 1 ? "" : "s"}, listed above. ` +
        'Set diagnostics: "warn" to keep building through them.',
    );
  }
}

/**
 * What a build should do about the diagnostics.
 *
 * `"warn"` is the default and the right one for a dev server: every finding is a
 * mistake in a class name, and failing the build over one would stop a developer from
 * seeing the rest of their page. `"error"` is for CI, where an unstyled element that
 * only warns is an unstyled element that ships. `"off"` exists because a warning
 * nobody can silence is a warning everybody learns to scroll past.
 */
export type DiagnosticMode = "warn" | "error" | "off";
