---
"tailess": patch
---

A built recipe's definition is a snapshot all the way down. Compound rules, defaults and
every `ss` map inside an option or a base were still the caller's own objects, so writing
to one after building changed the recipe, made a child built later disagree with its
parent, and could build classes that were never in the source.

`component.slots` is each part's own classes, frozen — `{ root: "rounded-lg border
dark:border-neutral-800", … }`. It was the internal list the component spreads on every
call: `ss(card.slots.root)` read a map inside it as a clsx dictionary, and a write the
types allowed corrupted every later render. The parts are read-only in the types too.
