import { twMerge } from "tailwind-merge";

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

const settings: TailessSettings = {
  merge: twMerge,
  keys: [],
  onWarn: (message) => {
    console.warn(message);
  },
};

/**
 * Change how tailess merges classes, or where its warnings go.
 *
 * Call it once, before anything renders — module scope of your entry file. Only the
 * keys given are changed.
 *
 * @example
 * import { configure } from "tailess";
 * import { extendTailwindMerge } from "tailwind-merge";
 *
 * configure({
 *   merge: extendTailwindMerge({ extend: { classGroups: { "font-size": ["text-hero"] } } }),
 * });
 */
export function configure(next: Partial<TailessSettings>): void {
  if (next.merge) settings.merge = next.merge;
  if (next.onWarn) settings.onWarn = next.onWarn;
  if (next.keys) settings.keys = next.keys;
}

/** True when the project declared this key itself, so it is not unknown after all. */
export function isCustomKey(key: string): boolean {
  return settings.keys.includes(key);
}

/** Merge a class string the way this project asked for. */
export function merge(classes: string): string {
  return settings.merge(classes);
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
  if (seen.has(key)) return false;
  if (seen.size >= limit) seen.clear();
  seen.add(key);
  return true;
}
