/**
 * Read `map[key]`, but only for the map's *own* keys — falling back to
 * `fallback` otherwise.
 *
 * A plain `map[key] ?? fallback` is unsafe here: keys that collide with
 * `Object.prototype` members (`toString`, `constructor`, `valueOf`,
 * `hasOwnProperty`, …) resolve to the inherited function instead of falling
 * back, which would turn a variant prefix into stringified garbage like
 * `"function toString() { [native code] }:block"`. Guarding with `Object.hasOwn`
 * makes an unregistered key behave exactly like any other unknown key.
 */
export function ownOr<T>(map: Record<string, T>, key: string, fallback: T): T {
  if (Object.hasOwn(map, key)) {
    const value = map[key];
    if (value !== undefined) return value;
  }
  return fallback;
}
