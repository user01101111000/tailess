---
"tailess": minor
---

Add `supports` / `notSupports` for CSS feature queries, `group` / `peer` / `container` for
the named variants, and `vars` for the values a class name cannot carry.

**Feature queries** were reachable only as `withPrefix("supports-[display:grid]", …)`,
which put the one hard part on the caller: a class name cannot contain a space, so the
condition has to be written Tailwind's way, with `_`. Get it wrong and the result is two
class names, neither of which means anything and neither of which gets a rule. The helper
does that rewrite, so the query is written the way CSS spells it:

```ts
supports("display: grid", "grid");     // → "supports-[display:_grid]:grid"
supports("gap", "gap-4");              // → "supports-[gap]:gap-4"
notSupports("display: grid", "flex");  // → "not-supports-[display:_grid]:flex"
```

Negation is only ever `not-supports-*`. Tailwind has no `supports-not-*`: that spelling
emits no rule at all, or — for a query with no `:` — a rule testing a property named
`not-…`, which nothing supports and which therefore never applies.

Five ways of writing a query still cannot work, and every one of them is otherwise silent,
so all five warn in development. A combined query needs every term in its own parentheses,
and the check reads the whole shape rather than the first term, because `(a) and b` and
`a and (b)` are the same mistake — the first is in fact the worse one, since `and` must be
followed by a parenthesised term and the browser discards the rule outright. A top-level
`not` beside an `and` is a parse error whichever helper built it. An empty query builds
`supports-[]:…`, which nothing generates a rule for. A query carrying `"`, `{`, `}`, `\`
or `;` cannot be enumerated by the build at all, so the class reaches the element with no
rule behind it. And a literal `_` is indistinguishable from the one this helper writes for
a space, so `--my_var` silently becomes `--my var` — underscores in a custom-property name
inside `var(…)` are left alone, since Tailwind keeps those.

The checks are deliberately narrow in the other direction too: `and` and `or` count as
combinators only in a query that has a parenthesised group, so `anchor-name: --or` and
`url(/a/black-and-white.png)` stay quiet. A warning that fires on working code teaches
people to ignore warnings.

**Named variants** were the other thing only `withPrefix` could spell. `group-hover` and
`peer-checked` are already keys, and so are `@md` and `@max-md` — but all of them reach the
*nearest* group, peer or container, which stops being enough the moment those nest. A row
inside a card, a card inside a list, a container inside a container:

```ts
group("row", "hover", "underline");          // → "group-hover/row:underline"
peer("email", "invalid", "text-red-600");    // → "peer-invalid/email:text-red-600"
container("sidebar", "@md", "grid-cols-2");  // → "@md/sidebar:grid-cols-2"
```

All 36 element states were compiled against Tailwind in both the `group` and `peer`
families, and all 26 container keys with a name, rather than assumed from the unnamed ones
working.

A `group` or `peer` name may hold letters, digits, `-` and `_`, and one check covers every
other spelling because they all fail the same way — silently. An empty name, a `/` or a `:`
produces no rule at all; a `.` produces one whose parent matcher reads as *two* classes
(`:where(.group\/a.b)` wants an element with both `group/a` and `b`); whitespace splits the
class in two.

A **container** name is held to a stricter alphabet, because Tailwind writes it into
`container-name:` and into the `@container` prelude, where CSS requires a `<custom-ident>`.
`container("2xl-panel", …)` compiles — the scanner enumerates it and a rule exists, so
every check inside this repo is satisfied — and the browser then discards the whole
`@container` block. A leading digit, a lone `-`, and the keywords `none`, `and`, `or`,
`not` and the CSS-wide ones are all out. `not` is the worst of them: the prelude still
parses, as an *unnamed negated* query, so the rule applies to the nearest container with
inverted logic rather than doing nothing. All of this was checked against a real CSS
parser, not inferred.

The name check is a warning rather than a build diagnostic on purpose: `group`, `peer` and
`container` are ordinary identifiers, so the scanner will sometimes match a function of
your own by that name, and a build warning fired at someone else's code is worse than none.
Such a match costs nothing — its candidates resolve to no utility, and Tailwind drops
them — but only because of the third scanner fix below, which is what makes that true.

**`vars`** answers a question the package could not answer before. Every class tailess
produces has to be enumerable at build time, so the values inside it are literals in your
source. A width that comes from data is not one, and no spelling of ``w-[`${percent}%`]``
has CSS behind it. Keeping the class literal and moving the value into a custom property
is the way through, and that is all this is:

```tsx
<div
  className={ss({ base: "w-[var(--w)]", md: "w-[var(--w-md)]" })}
  style={vars({ "--w": `${percent}%` })}
/>
```

A value that cannot produce a usable declaration — `null`, `undefined`, `""`, `NaN`,
`Infinity` — drops its property rather than writing an invalid one. `0` is kept. The
return type is partial, because that is what the function actually returns.

The escaping lives in one function that both the runtime and the scanner import, which is
the whole reason this is safe. The repo already carried two spellings of "space to
underscore" — per character in `withPrefix`, per run in the diagnostics — that agree on
every single-space condition and diverge on `display:  grid`. Had the two halves picked
differently, the class would reach the element and the candidate would be dropped by the
scanner's own safety check. The parity suite pins that they agree: give the scanner a
rewrite of its own and one case fails, drop its escape entirely and twelve do. It cannot
pin the rewrite itself — both halves move together by construction — so the semantics are
covered by unit tests instead.

Three fixes to the scanner came out of this, and all of them apply to every helper rather
than only the new ones.

`@source inline("…")` is parsed by matching parentheses, and the candidate sweep reads
*every* string literal at a call site, not only the ones that are classes. A query holding
`calc(100% - 2rem)` therefore split into the token `calc(100%`, whose unmatched paren
swallowed the rest of the directive — silently costing the CSS of every later class in
that chunk, including classes from unrelated files. Candidates whose brackets do not close
are now dropped, which no real utility is affected by.

The same directive is CSS, so a candidate carrying an *odd* number of `'` opened a string
that ran to the end of the payload, with the same effect — measured at 60 of 60 later
candidates losing their CSS. An apostrophe in any string a matched call touches did it, and
`console.group("user's session expired")` is a matched call now. Candidates whose quotes do
not close are dropped too. The test is balance rather than absence on purpose, since
`content-['x']` is a real utility.

And a whitespace escape is now decoded rather than merely stripped of its backslash.
`"p-4\tp-2"` is two classes; the scanner read it as the single token `p-4tp-2`, which
matches no utility, while the runtime split the real tab and emitted both. Any class
written with `\t`, `\n` or `\r` in it lost its CSS, under any helper.

`vars` produces no class names, so it is deliberately absent from the scanner's name list,
from the prettier `tailwindFunctions` list, and from the plugin's concerns entirely.

**One new build-time check**, and the first that reads your CSS rather than your source.
The breakpoint keys are compiled into the package — they have to be, since they are a
closed union the compiler checks and `screens` is read from JS for `matchMedia` — and a
`@theme` block can move all of that underneath them. Three of the four ways it can are
completely silent: `--breakpoint-sm: initial` leaves `ss({ sm: … })` compiling and emitting
a class nothing generates a rule for, `--breakpoint-*: initial` does that to all five at
once, and `--breakpoint-md: 50rem` keeps the classes working while `screens.md` goes on
telling your JS the old width. The fourth, adding `--breakpoint-3xl`, is at least a compile
error — but the error says nothing about `withPrefix("3xl", …)`, which does work, so it is
reported too.

Each of the four was confirmed against the real Tailwind compiler before it was written
down. The check follows relative `@import`s, so a theme split into its own file is found,
and it says nothing about a theme that restates a default or customises anything else.

A `@theme` is a *sequence of edits*, not a set of values, so the declarations are kept in
source order and replayed over the defaults. `--breakpoint-md: 50rem` followed by
`--breakpoint-*: initial` leaves `md` gone; the same two lines the other way round leave it
working at 50rem, and a set could not tell them apart. The same replay is what makes the
three reset spellings work — the namespace one, the whole-theme `--*: initial`, and the
prefix form `--breakpoint-s-*: initial`, whose clear is a prefix match and so takes `sm`
with it. Imported stylesheets are replayed before the importing file's own declarations,
because `@import` has to precede every other rule.

Reporting an *added* breakpoint is the one case here that is informational rather than
broken: that CSS works. It is reported because the compile error from `ss({ "3xl": … })`
says nothing about `withPrefix("3xl", …)`, which does.

Not covered: a `@config` pointing at a v3-style JS config can set `theme.screens` too. That
is a JavaScript file this never opens, so a project on `@config` gets no answer rather than
a wrong one.

The runtime grows 2,855 minified characters, about 1,143 gzipped — 2.8 kB to 4.0 kB — and
the size budget was raised deliberately to match. Most of that is warning text. Note what
the number is and is not: the package sets `sideEffects: false`, so it is the cost of
importing everything. A project using only `ss` and `cn` bundles 5,123 characters, exactly
as before, and one that adds `vars` pays 488.
