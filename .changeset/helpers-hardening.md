---
"tailess": minor
---

A pass over the helpers: one crash, one warning fired at working code, a check that
recipes were missing, and four places where the types refused code the runtime was happy
with.

**`aria` takes a value.** `aria("expanded", …)` is `[aria-expanded="true"]`, which covers
the boolean states and none of the others — `aria-current="page"`, `aria-sort`,
`aria-orientation` had no spelling short of `withPrefix`. `aria("current", "page", …)`
builds `aria-[current=page]:`, the way `data` always has, `null` for bare presence
included. The two-argument form is unchanged, and the scanner tells the two apart by the
argument count — not counting the empty slot a formatter's trailing comma leaves behind.

**`responsive(base, null)` threw.** The default parameter only covered `undefined`, so
`cond ? map : null` read a key off `null` and took the render down. A falsy map now drops
whole, and the type says so — `cond && { md: … }` was a compile error.

**`match` takes what a component has.** The discriminant was typed `string`; a number
(`cols: 1 | 2 | 3`), a boolean and an optional prop all worked at runtime and none
compiled. All three do now, and every case still has to be covered. `null`/`undefined`
take the fallback — and no longer find a case that happens to be spelled `"undefined"`.

**`vars` drops `false`.** `vars({ "--w": open && "42%" })` is how the docs say a
conditional variable reads. It was a compile error, and from JavaScript it wrote
`--w: false`.

**`on` takes a declared key.** A `@custom-variant` named in `CustomKeys` worked in
`ss({ … })` and was a compile error in `on(…)`.

**A recipe is checked for dead classes.** The walk over a recipe's class values was
written twice — once in the scanner, once in the checks — and the second copy only looked
for a bucket it could not read. `variants({ base: "p-4 p-2" })` was reported in `ss` and
passed over in a recipe. Both read one walk now (`extract/recipe.ts`), so the two cannot
drift again. Projects running `check --strict` or `diagnostics: "error"` may see new
findings; each one is a class that never reaches the element.

**A recipe built with a spread is no longer reported for a bucket that is not one.**
`variants({ ...card, variants: { size: { lg: { root: rootLarge } } } })` — a spread can
bring in `slots`, which makes `root` a part's name and `rootLarge` a perfectly good class
value under it. It was reported as a `root` bucket the scanner could not read. Where a
recipe is not all in view, only what is true of either shape is said.

Also: the `bucket-as-dictionary` check now knows the container keys, so
`on("hover", { "@md": … })` is reported like `{ md: … }` is.
