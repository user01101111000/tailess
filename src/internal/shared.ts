/**
 * The one value under `key` in this process, made by `create` the first time.
 *
 * The package ships an ES module build and a CommonJS one, and the CommonJS entries each
 * bundle their own copy of every module — so state kept at module level exists once per
 * copy. What has to be one thing for the process (the settings, the scanner's cache) is
 * kept on `globalThis` under a registered symbol instead, which every copy reaches.
 */
export function shared<T>(key: string, create: () => T): T {
  const store = globalThis as { [key: symbol]: T | undefined };
  const symbol = Symbol.for(key);
  const found = store[symbol];
  if (found !== undefined) return found;
  const made = create();
  store[symbol] = made;
  return made;
}
