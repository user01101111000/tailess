---
"tailess": minor
---

Add container-query and `not-*` keys. 149 keys become 233, and both families are
autocompleted and typo-checked like every other one.

**Container queries** were the one Tailwind v4 feature `ss` could not express at all.
`@3xs` through `@7xl`, and `@max-3xs` through `@max-7xl`, size an element by its nearest
`@container` ancestor instead of the viewport — previously reachable only through
`withPrefix("@md", …)`. They sit right after the viewport ranges in emission order,
since that is what they are:

```ts
ss({ base: "grid", "@md": "grid-cols-2", "@max-sm": "hidden" });
// → "grid @md:grid-cols-2 @max-sm:hidden"
```

A *named* container (`@lg/sidebar`) carries a value, so it stays `withPrefix` territory
along with `data-*`, `has-*` and the rest.

**`not-*`** was listed among the variants that take a value, which it does not — it
compounds, exactly as `group-*` and `peer-*` do, just with a wider set. Tailwind negates
every element state, every media query and every breakpoint, so all 58 are keys now:
`not-hover`, `not-dark`, `not-md`.

Neither family is written out by hand. Container keys derive from one list of sizes and
`not-*` from the states it applies to, so the two spellings of a name cannot drift — the
same rule the `group-*` / `peer-*` pairs already followed. The suite that compares the
key list against Tailwind's own variant registry now covers `not-*` in both directions,
and the container keys are checked the way `max-*` always has been: by compiling them and
asserting a rule comes out.

The runtime grows 265 minified characters, about 100 gzipped — 2.7 kB to 2.8 kB — and the
size budget was raised deliberately to match.
