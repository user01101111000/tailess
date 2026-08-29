---
"tailess": patch
---

Close four gaps where the runtime built a class the scanner never enumerated. Each
one produced the exact failure this package exists to rule out: the class lands on the
element, no CSS is generated for it, and nothing says so — no console warning, no build
error, just a style that quietly does nothing.

**A `clsx` dictionary written with unquoted keys.** A dictionary names its classes in
the *keys*, so `{ hidden: !open }` puts no string literal in the source at all, and the
scanner only ever read string literals. Quoting the key was the sole reason the
documented `ss({ md: [{ "text-lg": on }] })` form worked; `until("md", { hidden: !open })`
— the idiomatic spelling, and the one the README's own condition examples lead you to —
found nothing. Every helper was affected, and the utilities spelled as bare identifiers
are the common ones: `hidden`, `flex`, `block`, `grid`, `underline`, `truncate`,
`italic`, `uppercase`, `relative`, `absolute`.

Which objects count is now the runtime's own rule rather than a guess. Inside an array
or a `cn()`/`clsx()` call an object is always a dictionary; inside any other call it is
not, so `match(size, { sm: "p-1" })` keeps its discriminant keys out of the safelist;
standing alone it depends on the caller, because that same object is a nested bucket map
in an `ss` bucket and a dictionary everywhere else.

**`data()` with a number or a boolean.** `data` accepts
`string | number | boolean | null | undefined`, but only a string *literal* was read
statically, so `data("checked", true, …)` fell through to the attribute-presence branch.
That was wrong twice over: `data-[checked=true]:` — what the runtime actually builds, and
what React writes for `data-checked={true}` — got no CSS, while the `data-[checked]:`
that was safelisted is a different selector, matching whenever the attribute merely
exists.

**A prefixing helper called inside an `ss` bucket.** `ss({ md: withPrefix("has-[:checked]",
"underline") })` builds `md:has-[:checked]:underline` at runtime: the inner call has
already made its prefix, and the bucket's key stacks on top. The scanner read the inner
call only unprefixed. It matters most for `withPrefix`, which is the documented escape
hatch for variants that take a value and therefore have no bucket key of their own.

**An entry stylesheet whose at-rule is not lower case.** CSS folds an at-rule's *name*,
so `@Import "tailwindcss"` is the same rule as `@import` — but it was matched
case-sensitively, so such a stylesheet was not recognised as a Tailwind entry and the
whole project lost its generated classes. The specifier stays case-sensitive, since it
resolves as a path.

The parity suite — which evaluates each source string with the real helpers and asserts
the runtime's output is a subset of the scanner's candidates — now covers all of these,
so a regression fails a test rather than a user's layout.
