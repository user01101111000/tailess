# tailess

## 0.11.0

### Minor Changes

- 0614673: Add `supports` / `notSupports` for CSS feature queries, `group` / `peer` / `container` for
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
  supports("display: grid", "grid"); // → "supports-[display:_grid]:grid"
  supports("gap", "gap-4"); // → "supports-[gap]:gap-4"
  notSupports("display: grid", "flex"); // → "not-supports-[display:_grid]:flex"
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

  The checks are deliberately narrow in the other direction too. What makes a combined query
  combined is not the keyword but what sits between the terms: with a parenthesised group
  present, anything left over between the groups; with none at all, a second top-level `:`,
  since one feature query is one declaration and two colons mean two of them ran together.
  So `display: grid and gap: 1rem` warns while `anchor-name: --or`, `content: 'and'` and
  `url(/a/black-and-white.png)` stay quiet. A warning that fires on working code teaches
  people to ignore warnings.

  **Named variants** were the other thing only `withPrefix` could spell. `group-hover` and
  `peer-checked` are already keys, and so are `@md` and `@max-md` — but all of them reach the
  _nearest_ group, peer or container, which stops being enough the moment those nest. A row
  inside a card, a card inside a list, a container inside a container:

  ```ts
  group("row", "hover", "underline"); // → "group-hover/row:underline"
  peer("email", "invalid", "text-red-600"); // → "peer-invalid/email:text-red-600"
  container("sidebar", "@md", "grid-cols-2"); // → "@md/sidebar:grid-cols-2"
  ```

  All 36 element states were compiled against Tailwind in both the `group` and `peer`
  families, and all 26 container keys with a name, rather than assumed from the unnamed ones
  working.

  A `group` or `peer` name may hold letters, digits, `-` and `_`, and one check covers every
  other spelling because they all fail the same way — silently. An empty name, a `/` or a `:`
  produces no rule at all; a `.` produces one whose parent matcher reads as _two_ classes
  (`:where(.group\/a.b)` wants an element with both `group/a` and `b`); whitespace splits the
  class in two.

  A **container** name is held to a stricter alphabet, because Tailwind writes it into
  `container-name:` and into the `@container` prelude, where CSS requires a `<custom-ident>`.
  `container("2xl-panel", …)` compiles — the scanner enumerates it and a rule exists, so
  every check inside this repo is satisfied — and the browser then discards the whole
  `@container` block. A leading digit, a lone `-`, and the keywords `none`, `and`, `or`,
  `not` and the CSS-wide ones are all out. `not` is the worst of them: the prelude still
  parses, as an _unnamed negated_ query, so the rule applies to the nearest container with
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
  has("> img", "p-0"); // → "has-[>_img]:p-0"
  has("input[type=text]", "ring-2"); // → "has-[input[type=text]]:ring-2"
  notHas(":checked", "opacity-50"); // → "not-has-[:checked]:opacity-50"
  inside(".dark", "text-white"); // → "in-[.dark]:text-white"
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
  is the bracket form on both sides. It sweeps numeric literals the way it has always swept
  string ones, so `nth(open ? 3 : 4, …)` enumerates both branches — reading the position only
  when the whole argument was one number enumerated neither, and the digits inside a quoted
  `"3n+1"` are still never mistaken for positions of their own.

  `:nth-child()` counts from 1, so `nth(0, …)` compiles, passes every other check, and
  selects nothing; that, a fraction, and a negative number warn. The empty-value,
  unusable-character and literal-underscore checks that `has`, `inside` and `supports` each
  carried a copy of — or, in two cases, did not — now live in one place, which paid for about
  half of what the four new helpers added. That is what generalises the underscore warning:
  `has(".my_class", …)` compiles to `:has(:is(.my class))`, a rule that exists and matches
  something else, and only `supports` used to say so.

  **`variants()`** is a component recipe of the familiar shape, with one difference: every
  value is an `SsArg`, so a variant option can be an `ss` map. `lg: { base: "text-lg",
md: "px-6" }` is a variant that carries its own breakpoint, which a flat string cannot
  express and which is the reason this belongs here rather than in a separate library.

  ```ts
  const button = variants({
    base: { base: "rounded font-medium", hover: "brightness-110" },
    variants: {
      tone: { primary: "bg-blue-600", danger: "bg-red-600" },
      size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } },
    },
    compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
    defaults: { tone: "primary", size: "sm" },
  });

  type ButtonProps = VariantProps<typeof button>; // { tone?: …; size?: … }
  ```

  It is a wrapper over `ss`, not a second engine — 425 minified characters — which is what
  keeps it cheap and what makes the map-valued option work at all. Emission is `base`, then
  each variant in declaration order, then the compounds, then the caller's own arguments, so
  a trailing `className` still wins and the same props always produce the same string.
  `{ size: undefined }` leaves the default alone, which is what a component writes when it
  forwards an optional prop it did not receive.

  The scanner needed a rule unlike any other here, and this is the one place in the package
  where an object key is _not_ a prefix: `tone` and `size` name variants, `primary` and `lg`
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
  source. A width that comes from data is not one, and no spelling of `` w-[`${percent}%`] ``
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
  _every_ string literal at a call site, not only the ones that are classes. A query holding
  `calc(100% - 2rem)` therefore split into the token `calc(100%`, whose unmatched paren
  swallowed the rest of the directive — silently costing the CSS of every later class in
  that chunk, including classes from unrelated files. Candidates whose brackets do not close
  are now dropped, which no real utility is affected by.

  The same directive is CSS, so a candidate carrying an _odd_ number of `'` opened a string
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
  else in this package proves the _bridge_ — the scanner enumerates what the runtime builds,
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
  this package's — and exits 1 when a class has no rule, so it can gate CI. `@plugin` and
  `@config` are loaded the way Tailwind's own Node host loads them, which is both what lets
  a project using typography or a kept v3 config be checked at all and what makes the answer
  right: a variant only a plugin defines is counted, not reported as broken.

  The design turns on one comparison. The scanner over-approximates on purpose, so demanding
  a rule for every candidate would report a mountain of junk: `md:state` and `md:open` from a
  `data()` call's name and value, which the sweep reads as strings like any other. But junk
  does not resolve bare either, so the check asks whether the _utility inside_ each class
  works on its own first. `p-4` resolves and `md:p-4` does not, so the variant is what broke;
  `state` resolves as nothing, so it was never a class. Run against a file exercising every
  helper in the package — and against every example in the README — it reports zero.

  Getting that to zero took two fixes worth naming, because a gate that fails a healthy build
  is worse than no gate:

  - Asking "does this class have a rule" by substring said yes too often. `.xl\:text-2xl`
    starts with `.xl`, so the junk candidate `lg:xl` was reported against a build with
    nothing wrong with it — and, the other way round, `.md\:p-40` would have vouched for a
    broken `md:p-4`. The match now has to end where the selector does.
  - The scanner read an object inside _any_ call as a bucket map, so `ss(…, match(tone,
{ danger: "bg-red-50" }), …)` — the shape the README leads with — safelisted
    `danger:bg-red-50` and the check reported it. `dictionaryKeys` already had this rule
    written down for the same reason; the bucket sweep now follows it. A helper this package
    knows is found on its own, so nothing is lost, and the stylesheet carries less junk.

  `vars` produces no class names, so it is deliberately absent from the scanner's name list,
  from the prettier `tailwindFunctions` list, and from the plugin's concerns entirely.

  **The build-time checks now cover every helper that can trip them.** The unusable-value
  check was written for `supports` and stayed there, so `has('input[type="text"]', …)` — the
  same defect, the same silence — went unreported; the dead-class check skipped the named
  variants' class argument the same way. Both now run for all of them. This is the one
  failure `tailess check` cannot catch on its own either: the candidate is dropped from the
  list before it ever reaches the compiler, so nothing downstream can find it missing.

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
  Restating one in v3's units counts as restating it: `--breakpoint-md: 768px` is the width
  already exported as `48rem`, since a media query resolves `rem` against the initial font
  size — so pinning the v3 numbers, which is the standard migration, stays silent.

  A `@theme` is a _sequence of edits_, not a set of values, so the declarations are kept in
  source order and replayed over the defaults. `--breakpoint-md: 50rem` followed by
  `--breakpoint-*: initial` leaves `md` gone; the same two lines the other way round leave it
  working at 50rem, and a set could not tell them apart. The same replay is what makes the
  three reset spellings work — the namespace one, the whole-theme `--*: initial`, and the
  prefix form `--breakpoint-s-*: initial`, whose clear is a prefix match and so takes `sm`
  with it. Imported stylesheets are replayed before the importing file's own declarations,
  because `@import` has to precede every other rule.

  Reporting an _added_ breakpoint is the one case here that is informational rather than
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
  the number is and is not: every module here is side-effect free — `sideEffects` now lists
  only `./dist/cli.js`, which is the binary and calls `main()` — so it is the cost of
  importing everything. A project using only `ss` and `cn` bundles 5,170 characters — 47 of
  them the two new key families, which `ss` needs for its emission order — and one that adds
  `vars` pays 488, while one importing only `variants` bundles 5,634.

## 0.10.0

### Minor Changes

- 4c74e0a: Report what the scanner can prove wrong while the project builds, instead of waiting
  for the line to render.

  The runtime already warns about an empty `between` range, a blank prefix and whitespace
  inside a variant — but only once that code path executes, in a browser, with a console
  open. A branch that did not run during development ships the bug either way. Every one
  of those mistakes is visible in the source, and the plugin was already reading every
  file, so it now says so on every build, for every call site, in terminal and CI output.

  It also catches something nothing warned about at all: two conflicting utilities inside
  **one** string, where `tailwind-merge` silently drops the first.

  ```
  [tailess] src/Card.tsx: "p-4" never reaches the element — "p-2" replaces it in the same
    string. Drop the unused one, or move the override into its own argument.
  ```

  That check is deliberately narrow, because overriding is a documented feature: a later
  argument beating an earlier one is how a caller's `className` wins, and it is never
  flagged. Neither is `["p-4", cond && "p-2"]`, where the first applies whenever the
  condition is false, nor an interpolated template, where nothing is statically known.
  Only two unconditional, conflicting classes in a single literal qualify — there the
  first provably cannot reach the element, whatever the props do.

  Diagnostics warn; they never fail a build. They cost nothing at runtime: none of this
  code is reachable from the package entry, and the browser bundle is byte-for-byte
  unchanged. Extraction and diagnosis share one read of each file and one cache entry, so
  an unchanged file still costs a `stat`.

  Checked against the suite that exercises all 233 keys and every helper form: 400
  expressions, four build paths, zero reported — the silent half is the half that matters.

- 2c1f74f: Add container-query and `not-*` keys. 149 keys become 233, and both families are
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

  A _named_ container (`@lg/sidebar`) carries a value, so it stays `withPrefix` territory
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

## 0.9.3

### Patch Changes

- 60ca7d5: Close the last two ways the runtime could build a class the scanner never enumerated.

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
  is genuinely dynamic. Template interpolation stringifies the _number_, so the runtime
  builds `data-[n=1000]:` where the scanner had safelisted `data-[n]:`: the class in the
  DOM got no CSS, and the CSS that was generated matched whenever the attribute merely
  existed. The value is now resolved through `Number`, so the candidate is whatever the
  element will actually carry.

  Both were found by differential testing — running the real helpers and the real
  scanner over the same source and diffing — and both are pinned by cases in the parity
  suite, which fails on a regression rather than leaving it for a user to discover.

- 2ffbe13: Make the PostCSS plugin assignable to `AcceptedPlugin` again for consumers using
  `exactOptionalPropertyTypes`.

  The plugin is typed structurally so tailess needs no dependency on `postcss` — the
  host build always supplies it — and that only pays off if the shape really is one
  PostCSS accepts. It wasn't, under the strict reading of optional properties: a bare
  `from?: string` means "absent, or a string" and refuses a value that may be
  _explicitly_ `undefined`, which is precisely what PostCSS's own `ResultOptions.from`
  is. A typed `postcss.config.ts` with that flag on stopped compiling, while the plugin
  kept working perfectly at runtime — so nothing in the suite noticed. The same
  oversight was in `CollectOptions`, whose two optional fields receive each plugin's own
  optional options verbatim.

  `exactOptionalPropertyTypes` is now on for the repo itself, so the strict reading is
  what CI checks, and `test/postcss/assignable.test.ts` asserts the plugin extends
  `AcceptedPlugin` — the mirror of the Vite suite that already existed. Every public
  option was already spelled `| undefined` for exactly this reason; the internal
  structural types now match.

## 0.9.2

### Patch Changes

- 8a834e7: Fix two build-integration faults that only showed up after the first successful build.

  **`extensions` written with a leading dot silently froze the Vite dev watcher.** The scan
  normalizes the option (`".tsx"` → `"tsx"`); the plugin built a second set from the raw
  option to gate its watcher, and compared it against an already-normalized extension. So
  `extensions: [".tsx"]` — or any upper-case spelling — scanned correctly on the first
  transform and then matched nothing on every file-system event after it. The build was
  right, the dev server was right until you touched anything, and from then on every new
  `md:` or `hover:` class had no CSS until the process was restarted. Nothing was logged.
  Both paths now go through one exported `normalizeExtensions`, so they cannot drift again.

  **A glob in `content` defeated the warning meant to catch exactly that.** A root that is
  not a directory is treated as a single file, and `src/**/*.tsx` has a scannable
  extension, so the glob itself was recorded as a file that had been read. `files` came
  back non-empty with no classes in it — which is precisely the state the "content matched
  no files" warning tests for, so the one guard against a mistyped `content` was disabled
  by the most likely way of mistyping it. Globs were never expanded; `content` takes
  directories and files. A root is now counted only if it really is a file, and when the
  warning does fire on a wildcard path it says so, since `content` was glob-shaped in
  Tailwind v3 and that is the habit people arrive with.

- 313c79a: Close four gaps where the runtime built a class the scanner never enumerated. Each
  one produced the exact failure this package exists to rule out: the class lands on the
  element, no CSS is generated for it, and nothing says so — no console warning, no build
  error, just a style that quietly does nothing.

  **A `clsx` dictionary written with unquoted keys.** A dictionary names its classes in
  the _keys_, so `{ hidden: !open }` puts no string literal in the source at all, and the
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
  `string | number | boolean | null | undefined`, but only a string _literal_ was read
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

  **An entry stylesheet whose at-rule is not lower case.** CSS folds an at-rule's _name_,
  so `@Import "tailwindcss"` is the same rule as `@import` — but it was matched
  case-sensitively, so such a stylesheet was not recognised as a Tailwind entry and the
  whole project lost its generated classes. The specifier stays case-sensitive, since it
  resolves as a path.

  The parity suite — which evaluates each source string with the real helpers and asserts
  the runtime's output is a subset of the scanner's candidates — now covers all of these,
  so a regression fails a test rather than a user's layout.

## 0.9.1

### Patch Changes

- d953a2d: Drop the `clsx` runtime dependency. A fresh install now pulls `tailess` and
  `tailwind-merge`, nothing else.

  `src/internal/join.ts` does the same job in about forty lines. The point is not really
  the bytes — `clsx` is 237 gzipped — but it does not cost any either: the code compresses
  better next to the rest of the package than `clsx`'s standalone bundle does, so the swap
  came out 35 gzipped bytes _smaller_ (135 more minified characters, which is the number
  the size budget tracks). It is also no slower; on arrays and nested dictionaries it
  measures slightly faster, and `cn` and `ss` are unchanged end to end.

  A drop-in replacement is only worth having if it is genuinely identical, so `clsx` stays
  a devDependency and serves as the test oracle rather than being removed outright.
  `test/internal/join.test.ts` asserts the two produce byte-identical output across every
  shape, including the ones nobody writes on purpose: null-prototype objects, Proxies,
  boxed primitives, frozen objects, a getter that throws, symbol keys, `bigint` (which
  `clsx` types but drops at runtime), inherited enumerable keys, 200-deep nesting, and the
  circular array that overflows the stack in both — parity on a throw counts too. On top of
  that, 50,000 generated cases from a seeded PRNG, so any failure replays exactly.

  A second suite puts every public helper — `cn`, `ss`, `withPrefix`, `on`, `responsive`,
  `data`, `aria`, `until`, `between` — through twenty hostile values each and asserts none
  of them throws, because a crash during a render is worse than a wrong class. `join.ts`
  ends up at 100% statement, branch and function coverage.

  `ClassValue` is now declared by tailess instead of re-exported from `clsx`, with the same
  structure, so importing the type from `tailess` keeps working. `ClassArray` and
  `ClassDictionary` are exported alongside it. `ClassDictionary` stays `Record<string, any>`
  rather than tightening to `unknown`: TypeScript lets any object type flow into
  `Record<string, any>` but rejects an interface with no index signature for
  `Record<string, unknown>`, so the stricter type would have failed code that used to
  compile.

  `tailwind-merge` is deliberately kept. Roughly two thirds of Tailwind installs already
  have it, so for most projects it is a shared copy rather than an addition — and 77% of its
  size is the utility-conflict taxonomy, which is large because Tailwind is. Reimplementing
  that lands at the same size or gets merges quietly wrong, which is the exact failure this
  package exists to prevent.

## 0.9.0

### Minor Changes

- 7c1f00f: `ss` is now variadic and its buckets nest, so `cn(ss(…), cond && ss(…))` collapses into
  one `ss(…)` — with a small breaking change to the `clsx` dictionary form.

  **`ss` takes as many arguments as you like.** An argument is anything a bucket accepts:
  another map, a class string, a `clsx` array, or a condition producing one. That removes
  the wrapper that every non-trivial call site needed, and with it the second and third
  `ss()` inside it:

  ```tsx
  // before
  className={cn(
    ss({ base: "rounded-lg border p-4", md: "p-6" }),
    isDisabled && ss({ base: "opacity-50", sm: "bg-red-500" }),
    className,
  )}

  // after
  className={ss(
    { base: "rounded-lg border p-4", md: "p-6" },
    isDisabled && { base: "opacity-50", sm: "bg-red-500" },
    className,
  )}
  ```

  Keys are sorted inside each map; the arguments themselves are never reordered, so the
  last one wins exactly as it does in `cn`. That ordering is the point rather than a
  detail: sorting a bare string into the `base` bucket would place a caller's
  `className="md:p-10"` ahead of the component's own `md:p-6` and silently lose to it.
  Given only class values `ss` is `cn`, of which it is now a strict superset. `cn` itself
  is unchanged and still exported.

  **A bucket's value can be another map,** which stacks the prefixes. Each breakpoint gets
  its own group with the same keys and the same rules, which is how a compound variant is
  written without reaching for `on` or `between`:

  ```ts
  ss({
    md: { base: "p-6", hover: "p-8", "max-lg": "grid" },
    dark: { base: "text-white", hover: "text-blue-300" },
  });
  // → "md:p-6 md:max-lg:grid md:hover:p-8 dark:text-white dark:hover:text-blue-300"
  ```

  `md: "p-6"` and `md: { base: "p-6" }` are the same thing, so existing calls need no
  change to start nesting. Nesting is bounded at ten levels, which stops an object that
  reaches itself from taking the render down with a stack overflow.

  **Breaking: a `clsx` dictionary written as a bucket value now goes in an array.**

  ```ts
  ss({ md: { "text-lg": cond } }); // before
  ss({ md: [{ "text-lg": cond }] }); // after
  ```

  A bare object is now always a nested map, and an array is always classes. The shape
  decides, never the key names — telling the two apart by guessing whether `hover` is a
  variant or a class name would make the same source mean different things depending on
  what someone named a utility, which is the failure mode this package exists to rule out.
  TypeScript rejects the old form, so this surfaces as a compile error rather than a style
  that quietly stops appearing.

  **The scanner understands both shapes, and one bug it already had is fixed along the
  way.** Only `ss`' first argument was ever read, and an object had to _start_ its
  argument to be parsed at all — so `ss(base, isDisabled && { sm: "bg-red-500" })` produced
  no CSS for `sm:bg-red-500`, the exact silent failure this package is built to prevent.
  Every argument is now swept for object literals wherever they sit, both branches of a
  ternary included, and nested keys are followed to the same depth the runtime allows.
  `responsive`'s second argument got the same fix. The end-to-end suite compiles the new
  shapes through the real Tailwind compiler on both the Vite and PostCSS paths.

  A new suite pins the invariant behind all of this. It hands the scanner a source string,
  evaluates _that same string_ with the real helpers, and asserts every prefixed class the
  runtime produced is among the candidates the scanner found — so the two halves are checked
  against each other instead of each against a list that can drift.

  **`responsive`, `on`, `until` and `between` are unchanged and staying.** Each is now
  expressible as an `ss` shape — `between("sm", "lg", x)` is `ss({ sm: { "max-lg": x } })` —
  and the README says so, but they read well on their own and cost nothing when unused.

  New exported types: `SsValue`, `SsArg`. `SsInput` keeps its name and is now recursive.

  **Breaking: `tailess/vite` is exported only as a default, matching `tailess/postcss`.**
  Its CJS build is now `module.exports = tailess`, so `require("tailess/vite")` _is_ the
  plugin creator — previously it was a namespace object, which a `vite.config.cjs` would
  hand to Vite as something Vite rejects. `import tailess from "tailess/vite"`, the only
  form the docs have ever shown, is unaffected in both module systems; the undocumented
  `import { tailess } from "tailess/vite"` and `require("tailess/vite").default` are gone,
  and TypeScript flags both. The `.d.cts` is corrected to `export =` by the same post-build
  step that already did it for the PostCSS entry.

  That also removes the last warning from the build. Rollup's CJS writer warns on any entry
  with both a default and a named export, because it has to guess the shape; tsup exposes
  Rollup's input options but not `output.exports`, so there was nowhere to state the intent.
  The alternatives were measured and are worse: `silent` hides real warnings, dropping the
  tree-shaking pass turns the PostCSS plugin back into `{ default: fn }` and breaks every
  string-named config, and splitting the Vite entry into its own tsup config races `clean`
  and costs `dist/postcss/index.js` its shared chunk (3.4 kB to 22.1 kB).

  **Cost.** The single-map call keeps a dedicated path with no argument loop and measures
  within noise of before. The runtime grew 634 minified characters, 270 gzipped — 2.4 kB to
  2.6 kB — and the bundle-size budget was raised deliberately to match.

## 0.8.0

### Minor Changes

- 4da7c2d: Fix silent class loss in markup files, complete the variant list, and roughly halve
  the runtime cost of `ss`.

  **The scanner no longer loses calls to surrounding markup.** It used to read every
  scanned file as JavaScript, so a quote that wasn't a string literal — an apostrophe in
  `<p>Let's go</p>`, or the delimiters of a Vue attribute like
  `:class="ss({ md: 'grid' })"` — opened a string that ran to the next quote in the file,
  and every `tailess` call in between produced no CSS. The class still landed on the
  element; there was just no rule behind it. In practice this meant Vue and HTML lost
  **all** candidates, and Svelte, JSX, Astro and Markdown lost everything after the first
  unpaired apostrophe. Calls are now located individually and their arguments parsed in
  place, so nothing desyncs.

  The trade is that a call written inside a comment or a string is now picked up too and
  contributes its classes. `@source inline(...)` discards a candidate that matches no
  utility, so a spare one costs a moment of compile time — a missed one costs a broken
  layout.

  **A comment inside an `ss({ … })` object no longer takes the next key with it.** The
  comment was glued onto the key that followed it, so

  ```ts
  ss({
    base: "flex",
    // wider gutters on desktop
    lg: "gap-8",
  });
  ```

  asked Tailwind for a candidate named `// wider gutters on desktop\n  lg:gap-8`, which has
  whitespace in it and was dropped — leaving `lg:gap-8` with no CSS while every other key
  worked. Annotating a breakpoint is common enough that this was worth its own fix. Leading
  trivia is now skipped before the key is read, and a `:` inside a comment is no longer
  mistaken for the key separator. An object left unterminated by a mid-save read is parsed
  as far as it goes rather than discarded whole. A lone `\r` now ends a line comment and an
  unterminated string as well, so a file with classic-Mac line endings no longer lets one
  `//` swallow the rest of itself. LF, CRLF, CR and a leading byte-order mark are covered
  by tests that assert all four produce identical output.

  **`ss` now accepts every static Tailwind variant.** The key list went from 87 to 138,
  adding the child combinators `*` and `**` and completing the `group-*` / `peer-*`
  families, which were missing 24 and 25 entries respectively (`peer-first`,
  `group-invalid`, `group-valid`, `peer-visited`, …). Both families are now derived from
  one shared list, and the test suite enumerates Tailwind's own variant registry and
  compares in both directions, so the list can no longer drift. New exported types:
  `ElementStateKey`, `StandaloneStateKey`, `GroupStateKey`, `PeerStateKey`.

  **Performance.** Measured on the built package: `ss` with three groups dropped from
  ~679 ns to ~313 ns per call, and `withPrefix` roughly halved to ~62 ns, by removing the
  per-key object allocation and `Array#sort` and replacing the regex split with a single
  pass.

  **Three more ways a class could quietly do nothing now say so.**

  - A variant prefix containing whitespace — which is what `data("state", "a b", …)` builds —
    produces `data-[state=a b]:p-2`. The browser reads that as two class names and the build
    scanner drops it for the same reason, so nothing anywhere works and nothing complains.
    It now warns in development, once per prefix, and names Tailwind's `_` escape.
  - `between("lg", "sm", …)` describes an empty range. It compiles to real CSS that no
    viewport can satisfy, so it passes every check and styles nothing; it now warns.
  - The integration check claimed its one-shot flag before testing for a `document`, so a
    server-side render could consume it and leave the browser pass — the only one able to
    observe the marker — permanently silent. The flag is now claimed only once there is a
    document to check.

  **A relative `content` path on Vite is resolved against Vite's root, not the working
  directory.** They are the same only when the build runs from the project it builds, so
  `vite build apps/web`, a monorepo task launched from the workspace root, or a `--config`
  pointing elsewhere all made a documented option — the README's own `content: ["src"]` —
  walk a directory that does not exist. The scan found nothing, the sidecar was still
  written with its marker so the runtime integration check reported success, and every
  runtime-built class lost its CSS with no warning anywhere. An explicit `content` that
  matches no files now warns as well, since that is always a mistake.

  **A dev-server restart no longer stops picking up new classes.** `configureServer`
  latched on the plugin instance, but Vite calls it again on every restart and reuses an
  instance passed through `inlineConfig.plugins`. The new server's watcher then had no
  tailess listeners, so newly written classes silently stopped reaching Tailwind until the
  process was restarted. The latch is now scoped to the watcher.

  **Registering `tailess/postcss` after `@tailwindcss/postcss` says so.** The wrong order
  produced a green build whose CSS was missing every runtime-built class — the one setup
  mistake with no other signal. Tailwind's licence banner is a one-property tell that it has
  already compiled, so the plugin recognises it and names the fix.

  **`extractClasses` can no longer throw.** `skipTemplate` recursed once per nested
  template, so pathological input overflowed the stack; a `RangeError` there escaped the CSS
  transform and failed the whole build. Nesting is now bounded, degrading to the same
  over-approximation the module uses everywhere else.

  **Windows sidecar writes retry.** Renaming onto a file another handle has open is reported
  as `EPERM`/`EACCES`/`EBUSY` on Windows even though it is usually momentary — Tailwind
  reading the sidecar, a virus scanner, the file indexer. A short bounded retry turns a
  spurious failure (and the unnecessary fall back to inlining) back into a normal write.

  **Plugin option types accept an explicit `undefined`,** so `content: isCI ? [...] :
undefined` compiles under `exactOptionalPropertyTypes` — which is what the implementations
  already did at runtime.

  **Build integration robustness.**

  - The generated stylesheet is written atomically and refreshes are serialized, so two
    overlapping writes can no longer interleave into a file that parses as neither list.
  - A failed write no longer fails the Vite build; it falls back to inlining the class
    list, as the PostCSS plugin already did.
  - The PostCSS plugin's directory watch is scoped to the extensions actually scanned
    instead of `**/*`, which had bundlers watching `node_modules`.
  - `withPrefix("", …)` returned `":class"`, which matches nothing. It now returns the
    classes unprefixed and warns in development.
  - Builds keep the `node:` prefix on Node imports instead of emitting bare `fs`/`path`.

  **`tailess/postcss` types now describe the module it actually is.** `require()` of the
  CJS build returns the plugin creator directly — the shape PostCSS needs, since Next.js
  and `postcss-load-config` hand a string-named plugin straight to PostCSS without
  unwrapping `.default`. The declarations claimed a default export instead, so a
  `node16` CJS consumer was told to reach for `.default`, which is `undefined` at runtime,
  and a `postcss.config.cts` could not type the import at all. They now use `export =`.
  The runtime is deliberately unchanged; a test asserts the shape so it stays that way.
  With the declarations fixed, `check:exports` no longer needs to suppress
  `false-export-default`, so that check now runs at full strictness.

## 0.7.0

### Minor Changes

- 2a9b5b1: Make the generated classes actually get CSS, in both Vite and Next.js — and drop the
  custom-key config in favour of Tailwind's own breakpoints and variants.

  ## Fixed: prefixed classes had no CSS

  `tailess` builds `md:`/`hover:` prefixes at runtime, so Tailwind's scanner never sees
  them and emits nothing. The old PostCSS plugin was supposed to bridge that gap. Two
  bugs meant it often didn't:

  - **Vite was never wired up at all.** All of `@tailwindcss/vite`'s plugins are
    `enforce: "pre"`, so Tailwind compiles CSS _before_ Vite's PostCSS stage. The
    injected `@source inline(...)` arrived too late and was emitted into the output
    stylesheet as dead text. There is now a real Vite plugin — **`tailess/vite`** —
    registered `order: "pre"` so it wins regardless of where you put it in `plugins`.

  - **New classes needed a dev-server restart.** Tailwind bakes `@source inline(...)`
    into its compiler when that compiler is created, and only recreates it when one of
    its own _build dependencies_ has a newer mtime — source files aren't build
    dependencies, so the candidate list froze at whatever the first build saw. Both
    plugins now keep the list in a small generated stylesheet that your entry
    `@import`s, which _is_ a dependency Tailwind tracks. Rewriting it is a guaranteed
    trigger, and the rebuild uses the exact current list, so deleting a class removes
    its CSS too.

  Verified end to end against projects created by `create-next-app` and `create-vite`,
  plus a split-entry setup and Vite-via-PostCSS: five build configurations and repeated
  cold-start dev runs on Turbopack, webpack and Vite, asserting on the generated CSS
  each time.

  Three more fixes along the way: a stylesheet that reaches Tailwind through a chain of
  `@import`s (`app.css` → `tailwind.css`) is now recognised instead of silently getting
  nothing; stylesheets Tailwind never compiles are left alone rather than having
  `@source` leak into their output; and the dev-only warnings now work in browser
  bundles, where `process` doesn't exist.

  `match()` also accepts more cases than the key's narrowed type, so the ordinary
  `const size: "sm" | "lg" = "sm"` spelling no longer fails to compile.

  ## Added: it tells you when the integration is missing

  The integration injects `:root { --tailess: 1 }`, and in development the runtime
  checks for it the first time it builds a prefixed class. If it's absent you get one
  console warning naming the exact line to add, instead of silently unstyled elements.
  Declare the property yourself to silence it.

  ## Removed (breaking): custom breakpoints and states

  `ss`, `on`, `responsive`, `until` and `between` are now plain functions typed to
  Tailwind's built-in keys, which autocomplete with no setup:

  ```ts
  import { ss } from "tailess";

  ss({
    base: "text-xl flex",
    md: "text-2xl",
    "max-md": "gap-2",
    "group-hover": "underline",
  });
  ```

  Gone: `defineConfig`, `createTailess`, `resolveConfig`, `st`, `defaultConfig`,
  `defaultScreens`, `defaultStates`, and the `Tailess` / `TailessConfig` /
  `ResolvedConfig` / `Screens` / `States` types — along with the `tailess.config.ts`
  file, its `jiti` peer dependency, and the `@theme` injection that supported it. The
  `base` config option is gone too; pass shared tokens explicitly.

  **Migrating.** Replace `t.ss(...)` / `st.ss(...)` with the imported `ss(...)` and
  delete `tailess.config.ts`. Custom keys have no equivalent for now: use
  `withPrefix("3xl", …)` plus your own `@theme` and `@source inline(...)`, or keep the
  class literal.

  `ss` now also accepts `max-*` keys directly (`ss({ "max-md": "hidden" })`), and state
  keys are Tailwind's own names, so an alias like `groupHover` becomes `group-hover`.

## 0.6.0

### Minor Changes

- 2fa84de: Simplify setup: install the package, use the helpers — and reach for a config only
  when you want custom keys. Removes the "env"-style machinery in favor of one clear path.

  **Removed** (breaking):

  - The PostCSS plugin no longer generates a `tailess-env.d.ts`. The `types` option and
    the auto-written `Register` augmentation are gone.
  - `configureTailess()` and the `Register` / `RegisteredConfig` types are removed.

  **How custom keys work now.** Write a `tailess.config.ts` with `defineConfig` and
  re-export its helpers — your custom breakpoints/states are autocompleted and
  type-checked at every call site, with **no generated file** and no global setup:

  ```ts
  // tailess.config.ts
  import { defineConfig } from "tailess";

  const t = defineConfig({ screens: { "3xl": "1600px" } });
  export default t; // the PostCSS plugin reads this
  export const { ss, on, cn } = t; // fully-typed helpers for your app
  ```

  ```tsx
  import { ss } from "@/tailess.config";
  ss({ base: "text-sm", "3xl": "text-2xl" }); // ✅ "3xl" autocompleted + typed
  ```

  The zero-config path is unchanged: `import { ss } from "tailess"` still gives you
  Tailwind's default breakpoints/states with full autocomplete, no setup. The PostCSS
  plugin still scans your source and injects `@source inline(...)` so runtime-built
  classes get their CSS, and still mirrors custom breakpoints into `@theme`.

## 0.5.0

### Minor Changes

- Make custom config keys flow into the helpers with the least setup possible — you
  write only the config file.

  **The PostCSS plugin now generates types for you.** It already reads your config to
  mirror breakpoints into `@theme`; it now also writes a `tailess-env.d.ts` with a
  `Register` augmentation, so a bare `import { ss } from "tailess"` autocompletes and
  type-checks your custom keys with **zero** hand-written types. Configurable via the
  plugin's `types` option (`false` to disable, or a path string); reading a TypeScript
  config needs `jiti`, same as `@theme` mirroring. The write is skipped when unchanged,
  so it never triggers a watch-mode rebuild loop.

  ```ts
  // tailess.config.ts — the entire setup
  import { defineConfig } from "tailess";
  export default defineConfig({ screens: { xs: "480px", "3xl": "1600px" } });
  ```

  ```ts
  import { ss } from "tailess";
  ss({ xs: "block", "3xl": "text-2xl" }); // custom keys autocompleted + typed
  ```

  `defineConfig` also now returns the config **and** a fully-typed tailess instance in
  one call, so the config file can double as your tailess module (`import t from
"./tailess.config"; t.ss(...)`) without a separate `createTailess` call. It stays
  assignable to the old `C` return type, so `createTailess(defineConfig(...))` keeps
  working.

## 0.4.0

### Minor Changes

- ba3287a: Let the top-level helpers use your custom config — via a `Register` type
  augmentation and a runtime `configureTailess()`.

  Previously the helpers imported straight from `"tailess"` (`ss`, `on`,
  `responsive`, `until`, `between`) were locked to the zero-config default: a custom
  key like `xs` from your `tailess.config.ts` was a type error with no autocomplete,
  and at runtime it fell back to the default config (no `base`, dev warning). Custom
  keys only worked through a `createTailess(config)` instance.

  Now you can wire the top-level helpers to your config in two one-time steps:

  ```ts
  // tailess.d.ts — teaches the types your keys
  import type config from "./tailess.config";
  declare module "tailess" {
    interface Register {
      config: typeof config;
    }
  }

  // app entry — teaches the runtime your config
  import { configureTailess } from "tailess";
  import config from "./tailess.config";
  configureTailess(config);
  ```

  After that, `ss({ xs: "block", groupHover: "underline" })` autocompletes,
  type-checks, applies your `base`, and stops warning at runtime — no per-file
  instance import required. New exports: `configureTailess`, plus the `Register` and
  `RegisteredConfig` types.

  The top-level `cn` now also honors the configured `base` (it delegates to the
  active instance instead of being a raw re-export), so `base` tokens are prepended
  consistently across every top-level helper. With no config this is unchanged — a
  plain `clsx` + `tailwind-merge`.

  Also fixes the top-level helpers' hover docs: they now surface the full JSDoc
  (description + `@example`) instead of a one-line summary that overrode it, and
  fills in full JSDoc + examples on every `Tailess` instance method (`cn`,
  `responsive`, `on`, `until`, `between`, `match`, `data`, `aria`).

## 0.3.0

### Minor Changes

- 0c0471d: Config breakpoints now drive Tailwind's generated media queries.

  Previously the `screens` values in your tailess config were only used as variant
  prefix _keys_ — the pixel values were never emitted, so overriding a default
  (`md: "867px"`) or adding a custom key (`3xl: "1600px"`) had no effect on the CSS
  Tailwind produced.

  The `tailess/postcss` plugin now mirrors your config's `screens` into a `@theme`
  block as `--breakpoint-<key>` declarations. Keys you set win (override or add);
  keys you don't set keep Tailwind's own defaults. The plugin's `config` option
  also accepts an inline `TailessConfig` object, not just a path.

### Patch Changes

- 5ecf0d7: Fix variant keys that collide with `Object.prototype` members.

  Resolving a state/variant key looked it up with `map[key] ?? key`, which returns
  an inherited function for keys like `toString`, `constructor`, `valueOf`, or
  `hasOwnProperty` instead of falling back. `on("toString", "block")` produced
  `"function toString() { [native code] }:block"` rather than treating the key as a
  literal prefix.

  Lookups now read own properties only (`Object.hasOwn`), so any unregistered key —
  including prototype names — behaves like a normal unknown key across `on`, `ss`,
  `match`, the `until`/`between` warnings, and the class scanner.

- 267b294: Fix missing autocomplete for breakpoint/state keys on the default helpers.

  The top-level `ss`, `responsive`, `on`, `until`, and `between` are bound to the
  zero-config instance, whose config type is the wide `Record<string, string>`.
  `keyof` on that is `string`, so `"sm" | "md" | ... | string` collapsed to plain
  `string` and every literal key suggestion was lost — you got no autocomplete and
  unknown keys were silently accepted.

  Key resolution now filters out the `string`/`number` index signature via a
  `LiteralKeys` helper, so the default breakpoints (`sm`/`md`/`lg`/`xl`/`2xl`) and
  states always autocomplete, and any custom keys from a `createTailess(config)`
  instance are added on top. Unknown keys are now a compile-time error, matching
  the existing dev-time runtime warning.

## 0.2.0

### Minor Changes

- 08a3cfa: Add `tailess/postcss` — a PostCSS plugin that makes tailess work with Tailwind v4.

  Tailwind v4 only generates CSS for class names that appear literally in source,
  but tailess builds variant prefixes (`md:`, `hover:`, …) at runtime — so the full
  class names were never seen and no CSS was emitted.

  The plugin scans your source, enumerates the classes tailess produces, and injects
  them into Tailwind via `@source inline(...)`. Setup is a single line in
  `postcss.config` — no CSS `@source`, no generated file, no scan step — and it
  registers source directories as watch dependencies for live dev updates.
  TypeScript configs load via `jiti` when installed (optional peer dependency).

  See the "Tailwind v4 setup" section in the README.

## 0.1.0

### Minor Changes

- c3664c2: Initial release. Type-safe, config-driven Tailwind CSS class helpers:

  - `ss` — group classes by breakpoint/state in a readable object
  - `cn` — join classes and resolve Tailwind conflicts (`clsx` + `tailwind-merge`)
  - `responsive` — mobile-first responsive strings, plus `until` / `between` for `max-*` ranges
  - `on` — state variants, with array support for stacked variants (`dark:hover:`)
  - `data` / `aria` — attribute variants for headless UI libraries
  - `match` — exhaustive, compile-time-checked variant selection
  - `createTailess` factory and `defineConfig` for type-safe `tailess.config.ts` files
