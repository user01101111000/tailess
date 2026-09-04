---
"tailess": minor
---

Add `supports` / `notSupports` for CSS feature queries, `group` / `peer` / `container` for
the named variants, `has` / `notHas` / `inside` for the selector ones, and `vars` for the
values a class name cannot carry — plus the `has-*` and `in-*` key families, which take
the key count from 233 to 305, the four `nth-*` position helpers, `variants()` for
component recipes, and a `tailess check` CLI that proves the whole thing.

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

**`has` and `in`** were the last two compound variants with no coverage at all. Tailwind
compounds both with exactly the 36 states `group-*` and `peer-*` use, so they are key
families rather than helpers: `ss({ "has-checked": … })` for a descendant in that state,
`ss({ "in-focus": … })` for an ancestor. That takes the key count from 233 to 305, and the
suite that compares tailess' list against Tailwind's own variant registry now proves both
families in both directions — the same guard `group-*` and `peer-*` have always had.

The selector form has no enumerable values, so it gets helpers, and they carry the space
trap a class name cannot hold:

```ts
has("> img", "p-0");               // → "has-[>_img]:p-0"
has("input[type=text]", "ring-2"); // → "has-[input[type=text]]:ring-2"
notHas(":checked", "opacity-50");  // → "not-has-[:checked]:opacity-50"
inside(".dark", "text-white");     // → "in-[.dark]:text-white"
```

`inside` is named that way because `in` is a reserved word. Which negation you get is
worth stating, because both spellings compile and they are not the same thing:
`not-has-[:checked]` is `:not(:has(…))` — no checked descendant — while `has-not-[:checked]`
is `:has(:not(…))`, a descendant that is not checked. `notHas` builds the first; the second
is `has(":not(:checked)", …)`.

**The `nth` family** closes the last functional variants with no coverage. A number is a
position and goes in bare; a string is an `An+B` expression or a keyword and goes in
brackets, escaped like every other arbitrary value — `nth("3n + 1", …)` is
`nth-[3n_+_1]:`. The scanner makes the same split from the source text, so a quoted `"3"`
is the bracket form on both sides.

`:nth-child()` counts from 1, so `nth(0, …)` compiles, passes every other check, and
selects nothing; that, a fraction, and a negative number warn. The empty-value and
unusable-character checks that `has`, `inside` and `supports` each carried a copy of now
live in one place, which paid for about half of what the four new helpers added.

**`variants()`** is a component recipe of the familiar shape, with one difference: every
value is an `SsArg`, so a variant option can be an `ss` map. `lg: { base: "text-lg",
md: "px-6" }` is a variant that carries its own breakpoint, which a flat string cannot
express and which is the reason this belongs here rather than in a separate library.

```ts
const button = variants({
  base: { base: "rounded font-medium", hover: "brightness-110" },
  variants: { size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } } },
  compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
  defaults: { tone: "primary", size: "sm" },
});
```

It is a wrapper over `ss`, not a second engine — 425 minified characters — which is what
keeps it cheap and what makes the map-valued option work at all. Emission is `base`, then
each variant in declaration order, then the compounds, then the caller's own arguments, so
a trailing `className` still wins and the same props always produce the same string.
`{ size: undefined }` leaves the default alone, which is what a component writes when it
forwards an optional prop it did not receive.

The scanner needed a rule unlike any other here, and this is the one place in the package
where an object key is *not* a prefix: `tone` and `size` name variants, `primary` and `lg`
name options, and only the leaves hold classes. Reading the config as an `ss` map would
have enumerated `tone:size:primary:bg-blue-600` and — far worse — missed the map inside an
option, which is exactly the class that needs enumerating. So the three places a class can
hide are walked explicitly and the rest of the config is left alone. `compound` needed its
own unwrapping: it is a real array of rule objects, where everywhere else an object inside
an array is a `clsx` dictionary, which is why the shared reader deliberately skips brace
groups inside brackets.

Both halves are pinned by the parity suite, which evaluates the recipe and calls it:
skipping `compound` fails one case, and skipping the variant groups fails three.

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

**`tailess check`** is new, and it is the first thing here that can fail a build. Everything
else in this package proves the *bridge* — the scanner enumerates what the runtime builds,
the plugin hands the list to Tailwind. Nothing proved the far end: that Tailwind actually
generated a rule. A `@theme` that dropped a breakpoint, a `@config` the theme check
deliberately stays quiet about, an arbitrary value Tailwind rejects, or a future Tailwind
that renames a variant all leave the bridge intact and the element unstyled.

```
$ npx tailess check
[tailess] 1 of 3 runtime-built classes reach the element with no rule behind them:

  md:p-4
    "p-4" resolves on its own, so the variant is what fails.
```

It compiles the project with the consumer's own Tailwind — resolved from their tree, not
this package's — and exits 1 when a class has no rule, so it can gate CI.

The design turns on one comparison. The scanner over-approximates on purpose, so demanding
a rule for every candidate would report a mountain of junk: `md:state` and `md:open` from a
`data()` call's name and value, which the sweep reads as strings like any other. But junk
does not resolve bare either, so the check asks whether the *utility inside* each class
works on its own first. `p-4` resolves and `md:p-4` does not, so the variant is what broke;
`state` resolves as nothing, so it was never a class. Run against a file exercising every
helper in the package, it reports zero.

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

`@custom-variant` is read on the same pass. Defining one gives a working variant with no
key, so `ss({ midnight: … })` will not compile and the compile error says nothing about
`withPrefix("midnight", …)`, which does work — the same shape as an added breakpoint.
Redefining a name that already is a key is deliberately not reported: Tailwind replaces the
variant, the key still resolves, and whether the new meaning was intended is not something
a build check can judge.

A `@config` pointing at a v3-style JS config can set `theme.screens` and register variants
of its own. That is a JavaScript file this never opens, so one anywhere in the stylesheet
chain silences the whole check — no answer rather than a confidently wrong one.

The runtime grows 4,770 minified characters, about 1,766 gzipped — 2.8 kB to 4.6 kB — and
the size budget was raised deliberately to match. Most of that is warning text. Note what
the number is and is not: the package sets `sideEffects: false`, so it is the cost of
importing everything. A project using only `ss` and `cn` bundles 5,170 characters — 47 of
them the two new key families, which `ss` needs for its emission order — and one that adds
`vars` pays 488, while one importing only `variants` bundles 5,634.
