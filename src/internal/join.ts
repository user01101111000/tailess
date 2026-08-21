import type { ClassDictionary, ClassValue } from "../types.js";

/**
 * Flatten one `clsx`-style value into a space-separated class string.
 *
 * Split from {@link join} so the single-value calls — which is what `ss` and
 * `withPrefix` make, once per bucket — skip the argument loop entirely.
 */
function flatten(value: ClassValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${value}`;
  // Everything else that isn't an object — boolean, bigint, symbol, function —
  // contributes nothing. `bigint` is in the type because `clsx` puts it there;
  // it drops one at runtime too, and matching that is the point of this file.
  if (typeof value !== "object" || value === null) return "";

  let out = "";

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i];
      if (!item) continue;
      const part = flatten(item);
      if (part === "") continue;
      out = out === "" ? part : `${out} ${part}`;
    }
    return out;
  }

  // `for...in`, not `Object.keys`, because that is what `clsx` does: an inherited
  // enumerable key counts. The difference only shows up for an object built with
  // `Object.create`, but "only shows up rarely" is exactly the kind of divergence
  // that makes a drop-in replacement not one.
  for (const key in value as ClassDictionary) {
    if (!(value as ClassDictionary)[key]) continue;
    out = out === "" ? key : `${out} ${key}`;
  }
  return out;
}

/**
 * Join `clsx`-style class values into one string: strings and numbers are kept,
 * arrays are flattened, an object contributes each key whose value is truthy, and
 * anything falsy is dropped.
 *
 * This is `clsx`, reimplemented so the package carries no runtime dependency for
 * ~240 bytes of behaviour. `test/internal/join.test.ts` asserts the two agree on
 * every shape, including the odd ones, and fuzzes them against each other — `clsx`
 * stays a devDependency purely to be that oracle.
 *
 * @example
 * join("px-2", cond && "px-4", ["flex", { hidden: !open }]);
 */
export function join(...inputs: ClassValue[]): string {
  // The overwhelmingly common call is one value; `cn` passes its whole argument
  // array as that value, which flattens to the same string either way.
  if (inputs.length === 1) {
    const only = inputs[0];
    return only ? flatten(only) : "";
  }

  let out = "";
  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];
    if (!input) continue;
    const part = flatten(input);
    if (part === "") continue;
    out = out === "" ? part : `${out} ${part}`;
  }
  return out;
}
