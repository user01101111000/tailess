---
"tailess": patch
---

A mistake in a slotted `variants()` recipe now reads as one on TypeScript 7.

TypeScript 7 reports a call no overload accepts against the last overload alone, and that was the flat config's. So every mistake in a recipe with `slots` came out as the flat config's complaint, at a key that was right:

- a typo in a part name read "'root' does not exist in type 'SsInput'";
- an unknown key read "'slots' does not exist".

The flat overload now steps aside whenever a config has `slots`. The error is the slotted overload's, at the mistake:

- "'sise' does not exist in type 'CompoundRule<…>'";
- `Type '"md"' is not assignable to type '"sm"'`.

On TypeScript 6, the overload list it prints no longer includes the flat config's entry.

The same change closes a gap. A slotted config held in a variable — for example one that extends a recipe without slots — could still resolve to the flat overload. It compiled, typed as returning a `string`, while the runtime built parts and warned. It is refused now, as the same config written inline always was.
