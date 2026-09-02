---
"tailess": patch
---

Close the last two ways the runtime could build a class the scanner never enumerated.

**Helpers composed with one another.** A helper's result is an already-prefixed string
by the time its caller sees it, so the caller's prefix goes in front:
`until("md", on("hover", "p-2"))` is `max-md:hover:p-2`. That stacking was taught to
`ss` buckets in the previous release but not to the helpers themselves, so
`until`, `on`, `between`, `data`, `aria`, `withPrefix` and a `responsive` bucket value
each read a nested call only unprefixed. The class landed on the element with no rule
behind it — no warning, no build error. Every helper now funnels its class argument
through one place, so the rule is stated once instead of restated per case, and it
holds three prefixes deep: `on("hover", until("md", withPrefix("has-[:x]", …)))`.

**A `data()` value written in any other numeric spelling.** Only plain integers and
simple decimals were recognised, so `1e3`, `0x10`, `1_000`, `.5`, `+1`, `-0` and
`2e-2` fell through to the attribute-presence form — the branch meant for a value that
is genuinely dynamic. Template interpolation stringifies the *number*, so the runtime
builds `data-[n=1000]:` where the scanner had safelisted `data-[n]:`: the class in the
DOM got no CSS, and the CSS that was generated matched whenever the attribute merely
existed. The value is now resolved through `Number`, so the candidate is whatever the
element will actually carry.

Both were found by differential testing — running the real helpers and the real
scanner over the same source and diffing — and both are pinned by cases in the parity
suite, which fails on a regression rather than leaving it for a user to discover.
