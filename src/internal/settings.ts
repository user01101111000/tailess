import { twMerge } from "tailwind-merge";
import { isDev } from "./env.js";

/**
 * The two things a project may need to change about how tailess behaves at runtime.
 *
 * Everything else here is deliberately not configurable: the keys are a closed union
 * the compiler checks, and the emission order is what makes the output deterministic.
 * These two are different — both have an answer that depends on the project, and
 * neither has one this package can pick correctly on its own.
 */
export interface TailessSettings {
  /**
   * How conflicting classes are resolved. Defaults to `tailwind-merge`'s `twMerge`.
   *
   * `tailwind-merge` only knows Tailwind's own utilities, so a project with its own
   * `@utility` or theme scale needs `extendTailwindMerge` — otherwise `cn("text-sm",
   * "text-hero")` emits both and the winner is decided by CSS source order rather than
   * by argument order, which is the one guarantee this package makes about `cn`.
   *
   * Pass `(classes) => classes` to skip merging entirely.
   */
  merge: (classes: string) => string;
  /**
   * Where a development warning goes. Defaults to `console.warn`.
   *
   * Pass a function that throws to make them fatal in CI, one that collects to assert
   * on them in a test, or `() => {}` to silence them — a warning nobody can silence is
   * a warning everybody learns to scroll past.
   */
  onWarn: (message: string) => void;
  /**
   * Keys your own CSS defines, so `ss` stops calling them unknown.
   *
   * The type side of this is the `CustomKeys` interface, which a `declare module` fills
   * in. The runtime cannot see that, so a `@theme` breakpoint declared there would type
   * cleanly and then warn on every render. Name them here too and it goes quiet.
   *
   * They are emitted after the built-in keys, in the order given — there is no place for
   * them in Tailwind's own ordering, and a stable position is what `tailwind-merge`
   * needs.
   */
  keys: readonly string[];
}

/**
 * How far past the built-in keys a declared one sorts, or `undefined` for a key nobody
 * declared.
 *
 * This is what makes the "in the order given" promise true. Every declared key used to
 * share one rank, and the sort is stable, so the emitted order was whatever order the
 * object literal happened to use — two components declaring the same two keys the other
 * way round emitted them the other way round, and which one won a `tailwind-merge`
 * conflict depended on how someone typed an object. That is the non-determinism the rest
 * of `ss` exists to remove.
 */
export function customRank(key: string): number | undefined {
  const at = settings.keys.indexOf(key);
  return at === -1 ? undefined : at;
}

const settings: TailessSettings = {
  merge: twMerge,
  keys: [],
  onWarn: (message) => {
    console.warn(message);
  },
};

/**
 * What {@link configure} accepts.
 *
 * Spelled out rather than `Partial<TailessSettings>`, because under
 * `exactOptionalPropertyTypes` a bare optional refuses a value that may be *explicitly*
 * undefined — and `onWarn: process.env.CI ? fatal : undefined` is the natural way to
 * write a conditional setting, and was what the README's own example did.
 */
export type ConfigureOptions = {
  [K in keyof TailessSettings]?: TailessSettings[K] | undefined;
};

/**
 * Change how tailess merges classes, or where its warnings go.
 *
 * Call it once, before anything renders — module scope of your entry file. Only the
 * keys given are changed.
 *
 * The settings are process-global: there is one of each per module instance, and the
 * last call wins for every render already in flight. Calling it per request, or per
 * tenant in a shared SSR process, is not supported — two requests configuring different
 * `merge` functions produce wrong output for one of them, with no error.
 *
 * @example
 * import { configure } from "tailess";
 * import { extendTailwindMerge } from "tailwind-merge";
 *
 * configure({
 *   merge: extendTailwindMerge({ extend: { classGroups: { "font-size": ["text-hero"] } } }),
 * });
 */
export function configure(next: ConfigureOptions): void {
  if (next.merge) settings.merge = next.merge;
  if (next.keys) settings.keys = next.keys;
  if (next.onWarn) {
    settings.onWarn = next.onWarn;
    // Changing where warnings go is exactly the moment the dedup history stops meaning
    // anything. Without this, "collect it in a test" — one of the three documented uses —
    // passes vacuously the moment the code under test, a fixture, or an earlier test in
    // the same process has already tripped that warning: the collector stays empty and
    // the assertion looks like it holds. The same trap makes the fatal-in-CI mode miss
    // every repeat of a value it has already seen.
    resetWarnings();
  }
}

/** Every memo `firstTime` guards, so they can be cleared together. */
const memos = new Set<Set<string>>();

/**
 * Forget which warnings have already been reported.
 *
 * Called for you by `configure({ onWarn })`. Exported for a test that needs to assert on
 * the same warning twice.
 */
export function resetWarnings(): void {
  for (const memo of memos) memo.clear();
}

/** True when the project declared this key itself, so it is not unknown after all. */
export function isCustomKey(key: string): boolean {
  return settings.keys.includes(key);
}

/** Merge a class string the way this project asked for. */
export function merge(classes: string): string {
  const merged = settings.merge(classes);
  // A custom `merge` is newly the consumer's code this release, and one that falls off
  // the end of a branch hands React `class="undefined"` rather than crashing — a wrong
  // class attribute with nothing to debug, which is the failure mode this package treats
  // as unacceptable everywhere else. Dev-only: TypeScript catches the common case, and
  // the production hot path should not pay for a mistake it already refuses.
  if (isDev && typeof merged !== "string") {
    warn(
      `[tailess] configure({ merge }) returned ${typeof merged}, not a string — that goes ` +
        "straight into the class attribute. The unmerged classes are used instead.",
    );
    return classes;
  }
  return merged;
}

/** Report a development warning the way this project asked for. */
export function warn(message: string): void {
  settings.onWarn(message);
}

/**
 * Remember `key`, and say whether it is new — so a warning in a render loop prints once.
 *
 * The cap is what keeps the set from being a leak. A dev server, or an SSR process in
 * development, can run for days and see a fresh value on every request — `has(userInput)`
 * is enough — and an unbounded set of every value ever seen would grow with it. Clearing
 * rather than refusing to add keeps the warnings working: the worst that happens is one
 * of them prints a second time after a wrap.
 */
const limit = 500;

export function firstTime(seen: Set<string>, key: string): boolean {
  memos.add(seen);
  if (seen.has(key)) return false;
  if (seen.size >= limit) seen.clear();
  seen.add(key);
  return true;
}
