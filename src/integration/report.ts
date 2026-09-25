/// <reference types="node" />
import { relative } from "node:path";
import type { FileDiagnostic } from "../extract/collect.js";
import { shared } from "../internal/shared.js";

/**
 * Problems already printed, so a dev server that rescans on every keystroke reports
 * each one once rather than on every rebuild.
 *
 * Process-level, like the extraction cache, so the two integrations — and each CommonJS
 * entry's own copy of this module — share it when they run in the same process.
 */
const reported = shared("tailess.reported.1", () => new Set<string>());

/** Forget what has been printed. Exposed for tests. */
export function clearReported(): void {
  reported.clear();
}

/**
 * Say so when an explicit `content` or `extensions` option matched no files — once per
 * list of roots.
 *
 * Always a mistake: a wrong path, an extension list that excludes the project's own
 * files, or a glob. Left quiet it looks exactly like a project that uses no tailess at
 * all, right up until the page renders unstyled — with the marker present, so the
 * runtime's own "plugin not wired" check stays quiet too. Shared by both plugins, which
 * the README promises behave the same. With neither option set, an empty scan is a
 * stylesheet in a project with no source to read, and says nothing.
 *
 * `against` names what relative paths were resolved from: Vite's root, or the
 * working directory a PostCSS host runs in. `extensions` is the list the caller set,
 * when it set one: with the default `content`, it is the only thing that can be wrong.
 */
export function reportEmptyScan(
  scanned: readonly string[],
  against: string,
  extensions?: Iterable<string>,
): void {
  const listed = extensions === undefined ? undefined : [...extensions].map(String);
  const key = `empty\0${scanned.join("\0")}\0${listed?.join("\0") ?? ""}`;
  if (reported.has(key)) return;
  reported.add(key);
  // Naming the glob case explicitly: `content` was glob-shaped in Tailwind v3, so it is
  // the first thing a reader reaches for, and "matched no files" on its own reads like a
  // wrong path rather than a wrong kind of path.
  const glob = [...scanned, ...(listed ?? [])].some((path) => path.includes("*"))
    ? ' Wildcards are not expanded — pass a directory ("src") or a file, and extensions ' +
      'as names ("tsx"), not globs.'
    : "";
  const option = listed === undefined ? '"content" option' : '"content" and "extensions" options';
  const only = listed === undefined ? "" : ` with an extension in [${listed.join(", ")}]`;
  console.warn(
    `[tailess] the ${option} matched no files, so no variant class will have CSS. ` +
      `Scanned: ${scanned.join(", ")}${only}. Paths are resolved against ${against}.${glob}`,
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
