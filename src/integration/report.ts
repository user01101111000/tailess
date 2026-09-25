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
 * Say so when an explicit `content` option matched no files — once per list of roots.
 *
 * Always a mistake: a wrong path, an extension list that excludes the project's own
 * files, or a glob. Left quiet it looks exactly like a project that uses no tailess at
 * all, right up until the page renders unstyled — with the marker present, so the
 * runtime's own "plugin not wired" check stays quiet too. Shared by both plugins, which
 * the README promises behave the same.
 *
 * `against` names what relative paths were resolved from: Vite's root, or the
 * working directory a PostCSS host runs in.
 */
export function reportEmptyScan(scanned: readonly string[], against: string): void {
  const key = `empty\0${scanned.join("\0")}`;
  if (reported.has(key)) return;
  reported.add(key);
  // Naming the glob case explicitly: `content` was glob-shaped in Tailwind v3, so it is
  // the first thing a reader reaches for, and "matched no files" on its own reads like a
  // wrong path rather than a wrong kind of path.
  const glob = scanned.some((path) => path.includes("*"))
    ? ' Wildcards are not expanded — pass a directory ("src") or a file, not a glob.'
    : "";
  console.warn(
    `[tailess] the "content" option matched no files, so no variant class will have ` +
      `CSS. Scanned: ${scanned.join(", ")}. Paths are resolved against ${against}.${glob}`,
  );
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
