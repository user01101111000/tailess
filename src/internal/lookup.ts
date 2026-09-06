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

/**
 * Write `map[key] = value` as an own property, whatever `key` is called.
 *
 * The write side of the same problem {@link ownOr} solves for reads, and the one key
 * where a plain assignment does something else entirely: `map["__proto__"] = v` invokes
 * the prototype setter instead of creating a property, so the entry vanishes and the
 * object's prototype is replaced. A slot or variant named `__proto__` is contrived, but
 * the result was a class the recipe declares being emitted nowhere with no error — the
 * silent failure this package exists to prevent, arrived at from the other direction.
 *
 * `defineProperty` rather than a null-prototype object, so what a caller receives is
 * still an ordinary object with `toString` and `hasOwnProperty` on it.
 */
export function own<T>(map: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(map, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
