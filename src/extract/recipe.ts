import { arrayBody, configKeys, declaresKey, objectLiterals, parseObject } from "./scan.js";

/**
 * Every place a class value sits in one `variants(…)` call, as raw source text.
 *
 * The one call site whose object keys are *not* prefixes. `tone` and `size` name
 * variants, `primary` and `lg` name options, and neither reaches a class — only the
 * leaves do. Reading the config as an `ss` map would enumerate
 * `tone:size:primary:bg-blue-600` and, worse, miss the map inside an option that does
 * need enumerating. So each of the places a class can hide is walked to explicitly, and
 * everything else in the config is left alone.
 *
 * It lives apart from both of its callers because they have to agree on it. The
 * enumeration reads each value as an `ss` argument; the diagnostics read the very same
 * values for what can be proven wrong in them. This walk used to be written out once in
 * each, and the two copies had already drifted: the scanner's read a recipe's classes
 * for the merge and the checks' did not, so `base: "p-4 p-2"` was reported in `ss` and
 * passed over in a recipe. A recipe is where a design system keeps most of its classes,
 * and two walks only have to disagree once for a check to go quiet about them.
 *
 * @param args The call's top-level arguments, as a scanned `RawCall` carries them.
 */
export function recipeValues(args: readonly string[]): string[] {
  const out: string[] = [];

  // `cva`'s shape puts the base classes first and the config second. Which argument is
  // which is decided by the keys only a config can have — `variants`, `slots`, `extend`
  // and the rest of `configKeys` — exactly as the runtime decides it. A base value has
  // none of them, including when it is an `ss` map, which a string-only test would have
  // read as the config. `variants` alone used to be the test, back when it was required;
  // a recipe with parts and no variants, or a child that only extends, is a config all
  // the same — and read as a base value, its `slots` and `defaults` became buckets.
  const first = objectLiterals(args[0] ?? "")[0];
  const isConfig = first !== undefined && configKeys.some((key) => declaresKey(first, key));
  const cva = args.length > 1 && !isConfig;

  // A first argument that is not a config is the base, whether or not a config follows.
  // cva's one-argument call — `variants("flex")`, or an ss map with no `variants` key —
  // is a base and nothing else, which is how the runtime reads it. Taken for a config,
  // only its `base` key was read and every breakpoint in it was lost.
  if (!isConfig) out.push(args[0] ?? "");
  if (args.length === 1 && !isConfig) return out;

  const [config] = objectLiterals(args[cva ? 1 : 0] ?? "");
  if (config === undefined) return out;

  // Whether an option's value is one level deeper — `{ root: …, title: … }` rather than
  // a class value — turns on the *presence* of a `slots` field, never on whether its
  // names could be read. `variants({ slots, … })` with the map hoisted to a const, and
  // `slots: { ...shared, title: … }`, both leave the names invisible while the recipe is
  // still slotted; reading those as flat emitted `root:md:p-8` — junk matching no
  // utility — and lost the `md:p-8` the runtime does build.
  const slotted = declaresKey(config, "slots");

  /**
   * Take one per-slot value, or a plain class value when there are no slots.
   *
   * A recipe that inherits its parts rather than declaring them — `extend` pointing at a
   * slotted recipe, with no `slots` of its own — used to break the parity here: the
   * scanner read it as flat while the runtime followed the parent's slots. It is the
   * runtime that changed. That shape is refused by the types and, when a cast gets it
   * through, `resolve` stops at the boundary and stays flat rather than switching what
   * the component returns — so the flat reading is now the right one on both sides, and
   * this needs no second guess about which it is looking at.
   */
  const part = (text: string): void => {
    if (!slotted) {
      out.push(text);
      return;
    }
    // Every key, not only those a readable `slots:` named. A key that is not a slot
    // yields a candidate the runtime never builds, which `@source inline(…)` ignores; a
    // slot whose name could not be read would otherwise lose its classes outright.
    for (const group of objectLiterals(text)) {
      for (const slot of parseObject(group)) out.push(slot.value);
    }
  };

  for (const { key, value } of parseObject(config)) {
    if (key === "base") {
      out.push(value);
    } else if (key === "slots") {
      for (const group of objectLiterals(value)) {
        for (const slot of parseObject(group)) out.push(slot.value);
      }
    } else if (key === "variants") {
      for (const group of objectLiterals(value)) {
        for (const option of parseObject(group)) {
          for (const choices of objectLiterals(option.value)) {
            for (const leaf of parseObject(choices)) part(leaf.value);
          }
        }
      }
    } else if (key === "compound" || key === "compoundVariants") {
      // A real array of rule objects, which is not what an array means anywhere else
      // here: inside an `ss` value an object is a `clsx` dictionary, so `objectLiterals`
      // deliberately skips brace groups within brackets. Unwrap the one level so the
      // rules themselves are visible to it.
      for (const rule of objectLiterals(arrayBody(value))) {
        for (const field of parseObject(rule)) {
          // `className` is the `cva`/`tv` spelling, accepted so a ported recipe does
          // not lose its compound classes without a word.
          if (field.key === "class" || field.key === "className") part(field.value);
        }
      }
    }
  }

  return out;
}
