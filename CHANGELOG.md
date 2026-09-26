# tailess

## 0.13.0

### Minor Changes

- [#72](https://github.com/user01101111000/tailess/pull/72) [`35b2815`](https://github.com/user01101111000/tailess/commit/35b2815e45d9d985f8766577cb40f29fea071ba5) Thanks [@user01101111000](https://github.com/user01101111000)! - A component built by `variants` takes its caller's extra classes as a `ClassArg`, not an
  `ss` map — and says so at runtime when a map gets through.
  
  `button({}, { md: "w-auto" })` and `card({}, { root: { md: "p-10" } })` type-checked,
  built `md:w-auto` and `md:p-10` at runtime, and put them on the element with no CSS
  behind them: the build reads the recipe and `ss(…)` calls, never the calls of the
  component a recipe builds. Nothing warned, and `tailess check --strict` passed. Those
  calls are now compile errors; `button({}, ss({ md: "w-auto" }))` is the spelling that
  works, since that `ss` call is literal and the build reads it where it is written. A
  map that arrives through plain JavaScript or a cast warns in development.
  
  `ClassArg` — every `SsArg` except a map — is exported for a wrapper component that
  forwards its own `className`. Code this now rejects was already shipping unstyled
  classes, which is why it is a type change in a minor rather than a major.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`352e7ca`](https://github.com/user01101111000/tailess/commit/352e7caece9e0298cc2a73f2910decb2ba410963) Thanks [@user01101111000](https://github.com/user01101111000)! - A runtime-built class with a double quote in it reaches Tailwind, and one with a `{`, `}`
  or `\` — which cannot — is named by a new build check (`uncarried-class`) instead of
  vanishing.
  
  `ss({ md: 'after:content-["x"]' })` was dropped from the candidate list, because
  `@source inline("…")` cannot carry a `"` and Tailwind reads neither `\"` nor `\22` inside
  it. Such classes now go in a single-quoted directive of their own. A `{`, `}` or `\`
  genuinely cannot travel — Tailwind reads them as brace expansion or an escape — and a
  prefixed class holding one was unstyled with no signal, since the literal in the source
  (`after:content-['{']`) is not the class on the element (`md:after:content-['{']`). The
  build check now names each one; eleven things are checked.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`9ffbbdf`](https://github.com/user01101111000/tailess/commit/9ffbbdf7af27d9ae0a3c5b9cfe2f2eb5bccfdc61) Thanks [@user01101111000](https://github.com/user01101111000)! - The dependency ranges now admit only versions tailess works with: `tailwindcss` 4.1 or
  later, and `tailwind-merge` 3.7 or later.
  
  - **`peerDependencies.tailwindcss` is `^4.1.0`** (was `^4.0.0`). The plugins inject
    `@source inline(…)`, which Tailwind parses from 4.1.0; on 4.0.x every build failed
    with Tailwind's own "`@source` paths must be quoted", naming neither tailess nor the
    version, and 29 of the typed keys have no rule there. `tailess check` now says so
    outright — "tailess needs tailwindcss 4.1 or later, and this project has 4.0.17" —
    instead of blaming a moved breakpoint.
  - **`tailwind-merge` is `^3.7.0`** (was `^3.3.1`). Below 3.5.0 it does not know the
    Tailwind 4.2 logical utilities, so `ss({ base: "mbs-2" }, { base: "mbs-1" })` kept
    both and the earlier one won in the CSS; below 3.7.0 the same happened to
    `bg-radial` / `bg-conic`. npm dedupes to whatever an app already locks, which is how
    the old floor was reached in practice.

### Patch Changes

- [#72](https://github.com/user01101111000/tailess/pull/72) [`35f7c93`](https://github.com/user01101111000/tailess/commit/35f7c93c113cd6029cc0ab1107dd30e27e1ce956) Thanks [@user01101111000](https://github.com/user01101111000)! - A source file saved with a UTF-8 byte order mark gets its build-time checks. The BOM sat in
  front of the first-line import the checks are anchored to, so every check in the file —
  the renamed-import one included — went quiet. Common with Windows editors.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`9dcd845`](https://github.com/user01101111000/tailess/commit/9dcd84591481c13273cf7aa7363e957506f0d99f) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check --css` naming a file that does not exist, or a folder, says so and exits 2
  with `"error": "no-stylesheet"`; it printed Node's raw `ENOENT`/`EISDIR` under
  `"error": "crashed"`. The `stylesheet` of an `unsupported-prefix` result and the `out` of
  `emit --out --json` use forward slashes on every OS, like the other JSON paths. `--help`
  lists a Tailwind `prefix()` among the reasons for exit 2.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`1ca4ce6`](https://github.com/user01101111000/tailess/commit/1ca4ce64f4ab5a9ca5d0795980fa3f79f43cec8d) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check` agrees with the build in three more places:
  
  - `--strict` fails on the stylesheet's own build-time checks — a `@theme` that removes a
    breakpoint — which both plugins fail a `diagnostics: "error"` build on. It never ran
    them, and exited 0. Notes (a variant or breakpoint the project added) are printed and
    fail nothing, as in the build.
  - `--ignore` applies to the search for entry stylesheets too, so a stale one under
    `--content` can be left out; since a class passes when any entry has its rule, it used
    to vouch for the app's broken classes. The README now says so, and recommends `--css`.
  - The "plugin may not be running" guess reads configs the way `doctor` does, and counts
    only real build configs: an `.npmrc` at a monorepo root was one, and failed a correctly
    wired app under `--strict`. With no build config in the working directory, the nearest
    one above each `--content` root answers.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`5495d4b`](https://github.com/user01101111000/tailess/commit/5495d4bd4e7e973e7af983b5b41333856f106e62) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check` no longer goes green because of a stylesheet that generates no
  utilities.
  
  A class counted as broken only when *every* stylesheet under `--content` failed it, and a
  stylesheet that generates nothing fails nothing. So a design-token file
  (`@import "tailwindcss/theme"`), a v3 leftover (`@tailwind utilities`) or a reset file
  beside the app's entry cleared every broken class in the project — the gate passed while
  `md:p-4` had no rule in the real build. A stylesheet now vouches for a class only by
  containing its rule, and one that generates no utilities at all has no say. When no
  stylesheet generates any — `--css` pointed at a partial, or a `prefix(…)` hiding in an
  imported file — the check exits 2 (`"error": "no-utilities"`) instead of passing.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`8f02532`](https://github.com/user01101111000/tailess/commit/8f02532877bf8eded1e0fb9bb497de1e4ee5e6a2) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check` resolves a stylesheet `@import` from a package the way Tailwind does,
  including a style-only package and a scoped one.
  
  A project whose entry stylesheet imports `tw-animate-css` — which shadcn/ui's Tailwind
  v4 setup does — could not be checked at all: the build resolved the import, and the
  gate exited 2 with `Package subpath './package.json' is not defined by "exports"`,
  because it looked the manifest up through the package's own exports map. A scoped
  package (`@import "@acme/tokens"`) failed as `Cannot find module '@acme/package.json'`.
  The package is now found on disk, and the `style` condition is followed on the root and
  on a subpath (`@import "@acme/ui/theme"`).

- [#72](https://github.com/user01101111000/tailess/pull/72) [`7eca9c9`](https://github.com/user01101111000/tailess/commit/7eca9c99ae57ccc6c807435174d25197ed74b9fb) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check` compiles through Tailwind's own Node host (`@tailwindcss/node`, which
  `@tailwindcss/postcss` and `@tailwindcss/vite` both run) when the project has it, so it
  loads `@import`, `@plugin` and `@config` exactly as the build does.
  
  An ESM-only `@plugin` package — an exports map with only an `import` condition — made the
  gate exit 2 with `could not resolve` while the build loaded it, and a TypeScript
  `@config` or `@plugin` worked only on a Node that strips types natively, which excludes
  the 20.19 floor. A project without `@tailwindcss/node` keeps the previous loaders.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`d63c3c2`](https://github.com/user01101111000/tailess/commit/d63c3c2922baa1e842f9e9d74f92ebd5681aa114) Thanks [@user01101111000](https://github.com/user01101111000)! - A `variants` component says so, in development, when `class` or `className` arrives in its
  props — cva and tailwind-variants read them there, and here they were dropped without a
  word; extra classes are the second argument. The migration table names this and the one
  other call-site difference: tailwind-variants applies a boolean's `false` option when the
  prop is omitted, tailess (like cva) does not — add `defaults: { disabled: false }` to keep
  it. It used to say a port was the rename "and nothing else".

- [#72](https://github.com/user01101111000/tailess/pull/72) [`bb8990e`](https://github.com/user01101111000/tailess/commit/bb8990e82f6c9c6af77cc6b443b18c4bf479b114) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check`, `emit`, `doctor` and `init` write paths with forward slashes in `--json`
  on every OS, as the documented contract shows; a Windows runner wrote `src\Card.tsx`. An
  empty value for `--content`, `--css`, `--out`, `--extensions` or `--ignore` — what an unset
  shell variable expands to — is now a usage error (exit 2) instead of silently scanning the
  whole working directory or auto-detecting the stylesheet. `emit` names an unexpanded
  wildcard the way `check` already did. The scanner no longer reads a TypeScript object type
  (`{ … } as { md: string }`, `(x: { md: string }) => …`) as a bucket map and warns about its
  `string`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`ef926ae`](https://github.com/user01101111000/tailess/commit/ef926ae72192d6d0aea5d2f1e10d1613768c6c20) Thanks [@user01101111000](https://github.com/user01101111000)! - Smaller fixes to the CLI:
  
  - `tailess init` shows its diff in time proportional to the change. The old diff built a
    table the square of the file's length: 6.7 s on a 10,000-line config, and out of memory
    at 30,000 — where `--json` printed nothing at all.
  - The line `init` adds matches the file: its indent, one entry per line in a list written
    that way, its quote style, and no semicolon in a file without them.
  - `tailess check src` says "unexpected argument src — for a directory, --content src"
    rather than "unknown command src", and `doctor doctor` no longer rejects a word in the
    list it prints.
  - A flag on a command it does nothing for is an error: `init --content apps/web` wrote the
    current directory's config, and `doctor --strict` was the same doctor.
  - `--help --json` and `--version --json` print one JSON object.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`8197757`](https://github.com/user01101111000/tailess/commit/81977574001b8642af62024b53da387254c49c74) Thanks [@user01101111000](https://github.com/user01101111000)! - A cold scan no longer pays twice for files that never mention tailess. The build checks
  masked every scanned file two or three times before learning it did not import the
  package; they now skip such a file outright. On a 1,003-file project (308 using tailess)
  the checks take 29 ms instead of 99 ms in 0.12.1.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`1dafd89`](https://github.com/user01101111000/tailess/commit/1dafd897859ddb4e3033e4fd174a61efa4ddb8fe) Thanks [@user01101111000](https://github.com/user01101111000)! - The build reads a `variants` compound list written with a TypeScript assertion or in
  parentheses.
  
  `compound: [ … ] as const`, `compoundVariants: [ … ] satisfies ReadonlyArray<…>` and
  `compound: ([ … ])` each lost every compound class from the candidate list, because the
  scanner only unwrapped text that started with `[` and ended with `]`. The runtime still
  applied the classes, so they reached the element with no CSS, and no check said so.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`522aa90`](https://github.com/user01101111000/tailess/commit/522aa9048bb20ce3dc4d6eace72aece7d98a1d18) Thanks [@user01101111000](https://github.com/user01101111000)! - The README's `tailess.d.ts` for declaring your own keys adds to the package's types
  instead of replacing them.
  
  Copied as printed, the file had no import or export, so TypeScript read it as a global
  script and `declare module "tailess"` became an ambient declaration that shadowed the
  package: every `import { ss } from "tailess"` failed with "has no exported member". The
  snippet now starts with `export {};`, says why, and a test compiles it verbatim against
  the built declarations.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`75edbd8`](https://github.com/user01101111000/tailess/commit/75edbd86ee5310fd4229b1b9a9b18143376f0431) Thanks [@user01101111000](https://github.com/user01101111000)! - The build reads cva's one-argument call with an `ss` map — `variants({ base: "flex",
  md: "p-4" })`, no `variants` key — as the base it is. The runtime already did; the scanner
  took the object for a config, read only its `base` key, and every breakpoint in it had no
  CSS.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`9dc8c62`](https://github.com/user01101111000/tailess/commit/9dc8c62b9137dec7e59a6ed331d2ed111b877c72) Thanks [@user01101111000](https://github.com/user01101111000)! - The build reads both branches of a ternary in `data()` values and in `on()` state
  stacks, whatever the branches are.
  
  - `data("level", open ? 1 : 2, …)`, `data("active", on ? true : false, …)` and
    `data("state", open ? "open" : null, …)` each left one branch — or both — with no CSS:
    only string literals were read, and a number or boolean only when it was the whole
    argument.
  - `on(["dark", cond ? "hover" : "focus"], …)` enumerated `dark:hover:focus:`, a stack
    the runtime never builds, instead of `dark:hover:` and `dark:focus:`; and
    `on(cond ? ["dark", "hover"] : "focus", …)` enumerated three single states instead of
    one stack and one state.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`f9f090a`](https://github.com/user01101111000/tailess/commit/f9f090a6efb04b2991a7a6644cb5fbb8571fffe8) Thanks [@user01101111000](https://github.com/user01101111000)! - The build follows helpers composed up to six deep, not two.
  
  `ss({ dark: on("hover", data("state", "open", aria("selected", "bg-blue-50"))) })` and
  `on("focus", on("hover", until("md", withPrefix("[&>li]", "p-2"))))` lost the one class
  the runtime builds — the innermost stack — because following nested calls stopped at the
  third helper; the scanner emitted prefixes glued to the inner helper's arguments instead,
  and `tailess check` passed. The bound still keeps a chain linear: a 5,000-call file scans
  in the same time as before.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`dc28631`](https://github.com/user01101111000/tailess/commit/dc28631e539a092a2351f2135ac4772fd3f2d5a8) Thanks [@user01101111000](https://github.com/user01101111000)! - A built recipe's definition is a snapshot all the way down. Compound rules, defaults and
  every `ss` map inside an option or a base were still the caller's own objects, so writing
  to one after building changed the recipe, made a child built later disagree with its
  parent, and could build classes that were never in the source.
  
  `component.slots` is each part's own classes, frozen — `{ root: "rounded-lg border
  dark:border-neutral-800", … }`. It was the internal list the component spreads on every
  call: `ss(card.slots.root)` read a map inside it as a clsx dictionary, and a write the
  types allowed corrupted every later render. The parts are read-only in the types too.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`bacf827`](https://github.com/user01101111000/tailess/commit/bacf82709c1a03a919c29fab585cd43b089319f5) Thanks [@user01101111000](https://github.com/user01101111000)! - The build-time checks reach more of the files they should, and stay quiet where they
  cannot be right:
  
  - A renamed helper is reported in a re-export (`export { ss as tw } from "tailess"` — the
    worst place for it, since every importing file loses its classes), a CommonJS
    destructuring (`const { ss: tw } = require("tailess")`), and an import that does not
    start its line (`"use client"; import …`, minified code). A type-only rename, which
    binds nothing callable, is no longer reported.
  - Files that bind the package with `const t = require("tailess")` or `await import()` get
    the source checks; they were silently off.
  - Two conflicting utilities in one string are not reported in a project that calls
    `configure({ merge })`: the check can only run the default merge, and it failed
    `check --strict` on the README's own `extendTailwindMerge` recipe.
  - The README says the checks need a direct import from `"tailess"`, not a local barrel.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`2669758`](https://github.com/user01101111000/tailess/commit/2669758608c28c4e0347445b993a382f7080df7e) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess doctor` and `tailess init` find the config your build actually uses, and stop
  failing working projects:
  
  - PostCSS configs in `package.json`'s `postcss` key and every `.postcssrc` spelling
    (`.yml`, `.yaml`, `.js`, `.cjs`, `.mjs`, `.ts`) are read. They exited 2 — "no
    postcss.config here" — on wired, working projects. JSON and YAML configs are read but
    never edited, and the line to add is printed in their own syntax.
  - Astro, Nuxt and SolidStart configs are read for `vite.plugins`, instead of exiting 2 with
    advice about monorepos. `init` says what to add rather than editing them.
  - A plugin list built in a local preset (`plugins: sharedPlugins()` from `./vite.shared`) is
    followed. It failed a working build, and `init` then registered the plugin twice. A
    preset that cannot be read is reported as such, not as unwired.
  - Of two Vite configs, the one Vite loads is read. A Vite project that compiles Tailwind
    through `postcss.config` is answered for that file, as the README recommends.
  - A config that never loads Tailwind's own plugin gets a note: nothing compiles Tailwind
    there, which `doctor` used to call healthy.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`134ba22`](https://github.com/user01101111000/tailess/commit/134ba2274975ab53d8df2ae6e2d6c4f4750e5a8f) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess doctor`, `tailess init` and `check --strict` read a config the way its loader
  does, rather than looking for the plugin's name:
  
  - A PostCSS config that imports or requires `tailess/postcss` and never lists it, or lists
    it as `false`, is not wired. Nor is one that lists it after `@tailwindcss/postcss`:
    `doctor` exits 1 and says to move it first, and `init` leaves it for you to reorder. All
    three built with no variant CSS and passed both gates.
  - `init` adds `require("tailess/postcss")()` — or an import and a call — to a PostCSS list
    of plugin instances, the README's own form. It used to add the string, which
    postcss-load-config rejects ("Invalid PostCSS Plugin found at: plugins[0]").
  - A Vite `tailess()` counts only in the config's own `plugins`, not in
    `build.rollupOptions.plugins` or `css.postcss.plugins` — and `init` no longer writes it
    there when the top-level list is a variable. The first lost every variant class in dev
    with nothing printed; the second failed the build.
  - `tailess/postcss` beside `@tailwindcss/vite` is not wired, as the README says.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`0b25d3b`](https://github.com/user01101111000/tailess/commit/0b25d3bf5d264f3d53422889f8a373c58df8025d) Thanks [@user01101111000](https://github.com/user01101111000)! - The build check for a bucket the scanner cannot read now fires inside `variants()` and
  inside nested maps, as the README promises for everything under a prefixed key.
  
  `variants({ variants: { size: { lg: { md: size } } } })`, a `base: { md: size }`, a
  compound `class: { md: size }`, a slot's `{ md: size }` and `ss({ dark: { md: size } })`
  were all silent: the recipe helper had no case in the diagnostics, and a value that was
  itself a map was skipped rather than walked. Each built a prefixed class with no rule.
  An unprefixed value — `base: size`, a slot or option set to a variable — stays quiet, as
  in `ss`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`3a47203`](https://github.com/user01101111000/tailess/commit/3a472031e514169b1c312d332ce93b6ef8fa770a) Thanks [@user01101111000](https://github.com/user01101111000)! - The "a bucket the scanner cannot read" check reads each part of a value that becomes a
  class. A literal anywhere in the value used to vouch for all of it, so
  `ss({ md: cond ? size : "p-2" })`, `ss({ md: [size, "flex"] })`, `ss({ md: size ?? "p-2" })`
  and a shorthand `ss({ base: "p-1", md })` each built a class nothing enumerated and said
  nothing. The part that cannot be read is named in the message.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`c5ba894`](https://github.com/user01101111000/tailess/commit/c5ba89411162b1d8107bfe1a396a9e16894ef9c0) Thanks [@user01101111000](https://github.com/user01101111000)! - Both plugins warn when an `extensions` list matches no files, not only a `content` one.
  `extensions: ["*.tsx"]` — a glob where a name belongs — left `content` at its default and
  every prefixed class unstyled, with the marker present and nothing printed.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`66cee3f`](https://github.com/user01101111000/tailess/commit/66cee3f767d7ea5cea316e63551ba649cf71e7b7) Thanks [@user01101111000](https://github.com/user01101111000)! - `resetWarnings` is exported from `tailess`, as the 0.12.0 changelog said it was. It clears
  the once-per-process memo behind the development warnings, for a test that asserts on the
  same warning twice; `configure({ onWarn })` still clears it for you.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`d541580`](https://github.com/user01101111000/tailess/commit/d541580ec82dc3e0dd97302d87be6dfe9c667552) Thanks [@user01101111000](https://github.com/user01101111000)! - `extend` says so when it cannot inherit. Given a plain config object — a shared
  `{ base, variants }` — it inherited nothing while the prop types said its variants were
  there; that is now a type error, and a dev warning when a cast gets it through. A slotted
  recipe extending a flat one (only reachable through a cast) spread the parent's `ss`-map
  options by slot name and kept its groups as props; it now warns and inherits none of it,
  the same as the opposite direction already did.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`6d8f653`](https://github.com/user01101111000/tailess/commit/6d8f653eb5a53063de4703ca56585c385ee6a26e) Thanks [@user01101111000](https://github.com/user01101111000)! - Both plugins and `tailess check` find the stylesheet Tailwind compiles when it is reached
  through a workspace package — the shadcn/ui monorepo template's
  `@import "@workspace/ui/globals.css"` — and the Vite plugin through an alias as well
  (`@import "@/styles/tailwind.css"`). They followed only relative `@import`s, three hops
  deep, so such an app's stylesheet got no injection: every runtime-built class unstyled,
  and the dev warning told the reader to add a plugin that was already there. Relative
  chains are now followed eight hops deep.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`ca7628d`](https://github.com/user01101111000/tailess/commit/ca7628d7921b06b1698024d54be879c77f23ca28) Thanks [@user01101111000](https://github.com/user01101111000)! - Event handlers, jQuery and inline lookup objects no longer fail `tailess check` or draw
  build-time warnings.
  
  - `stream.on("end", …)`, `socket.on("message", …)` and `$(el).on("click", …)` were read
    as tailess's `on()`, so the strings inside the handler became `end:animate-spin` and
    `click:hidden` — and `check` exited 1 on healthy code, saying the classes had no rule.
    Through a receiver, `on()` now enumerates only stacks of the Tailwind states it
    accepts, so `t.on("hover", …)` through a namespace import still works.
  - `ss("rounded", { primary: "bg-blue-600", danger: "bg-red-600" }[tone])` is a lookup
    that picks one value, but its keys were read as variants (`primary:bg-blue-600`) and,
    inside `on()`, as a clsx dictionary with a bucket key.
  - A call through an expression — `$(el).on(…)`, `getSocket().on(…)` — had no identifier
    before its dot and was checked as a bare call.
  - In a file that imports tailess, every bare call with a helper's name was checked, so
    Solid's `on(accessor, (c) => ({ open: c > 0 }))` beside `import { ss }` was reported.
    A bare call is now checked only under a name the file imports from `"tailess"`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`93513e3`](https://github.com/user01101111000/tailess/commit/93513e37bf4140bbcc0b844bf8114af07348eb9f) Thanks [@user01101111000](https://github.com/user01101111000)! - A framework's own build output no longer fails the build-time checks. SolidStart 1's
  `.vinxi/build` and Qwik's `server/` hold minified bundles with
  `import{ss as s}from"tailess"`, and each helper there was reported as a renamed import, so
  `check --strict` and `diagnostics: "error"` went red after a successful build (SolidStart
  on the first one). `.vinxi`, `.nitro`, `.react-router`, `.tanstack` and `.angular` are
  skipped by default, and a file a bundler wrote — a source-map comment, or a minified line —
  is not checked, only scanned.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`8d83f8f`](https://github.com/user01101111000/tailess/commit/8d83f8fff8ac75e431f7164ae8d4eb9719690c5d) Thanks [@user01101111000](https://github.com/user01101111000)! - The exported key lists (`screenKeys`, `maxScreenKeys`, `containerKeys`, `maxContainerKeys`,
  `stateKeys`) and `screens` are frozen. They are the lists the runtime itself reads, so a
  JavaScript caller's in-place `screenKeys.reverse()` made `between("sm", "lg", …)` warn
  that its range was empty and changed the order `responsive()` emits. The types already
  said `readonly`; now the values agree.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`bc4e30c`](https://github.com/user01101111000/tailess/commit/bc4e30cd9d144f8cb42d17fad05ca9ab2156c8f7) Thanks [@user01101111000](https://github.com/user01101111000)! - The documented CI gate is `npx tailess check --strict`, and the example's `npm run check`
  is that command.
  
  The README gave `- run: npx tailess check` as the gate and the example's `verify` script
  ran `tailess check --content src`; both exit 0 with the plugin deleted from the config,
  because the check compiles the stylesheet with the candidates the plugin *would* inject
  and only warns that no config calls it. CI's negative test passed `--strict`, so it proved
  a different command from the one the docs tell people to run. The README now says why
  `--strict` is the CI setting, the example script uses it, and CI runs the script itself.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`2362934`](https://github.com/user01101111000/tailess/commit/2362934ffa05e937b74a328c4969066f688e5044) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess init --write` no longer turns a working config into one Vite cannot load. Three
  shapes did, after exiting 0 and with `doctor` calling the result wired:
  
  - An `import tailess from "tailess/vite"` already in the file — left behind by a deleted or
    commented-out call — got a second one ("Identifier `tailess` has already been
    declared"). The existing binding is reused now, `import { default as tw }` included.
  - A CommonJS `vite.config.cjs` (or a `.js` one written with `require`) got an ESM
    `import` on line 1. It gets `const tailess = require("tailess/vite");` now.
  - An import carrying `with { type: "json" }` or `assert { … }`, or TypeScript's
    `import x = require()`, was split in two by the new line.
  
  The edit is also parsed with the project's own Vite before it is written, and refused if
  the config parsed before and would not after.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`e068c1b`](https://github.com/user01101111000/tailess/commit/e068c1b2ea88a0365d1436cfca404ebd2cf31618) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check --json` prints one JSON object on stdout even when a Tailwind plugin prints
  while it loads.
  
  Compiling runs the project's `@plugin`s inside the CLI, and daisyUI 5 prints its banner
  with `console.log` — so on every daisyUI project stdout was the banner and then the JSON,
  and `tailess check --json | jq -e .ok` failed to parse on a passing run. Under `--json`,
  anything a plugin prints now goes to stderr while the stylesheets compile.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`5f24aaa`](https://github.com/user01101111000/tailess/commit/5f24aaac83c7b3951dea4ec72efc11609071e2fc) Thanks [@user01101111000](https://github.com/user01101111000)! - A stylesheet that `@import`s a web font before Tailwind — Google Fonts' own snippet,
  `@import url("https://fonts.googleapis.com/…"); @import "tailwindcss";` — keeps the font.
  Both plugins put their injection at the very top, and its marker rule then stood ahead of
  the font's `@import`, which CSS ignores after a rule: the font vanished from dev and
  production CSS with only a minifier warning. The injection now goes after the file's
  leading `@charset`, `@import`, `@layer` and other block-less statements.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`93513e3`](https://github.com/user01101111000/tailess/commit/93513e37bf4140bbcc0b844bf8114af07348eb9f) Thanks [@user01101111000](https://github.com/user01101111000)! - A `variants()` recipe over 20,000 characters is read however its argument list opens.
  Only the object-first spelling got the larger limit, so a recipe opening with a comment,
  or in the cva form with a template-literal, shared-constant or `ss()` base, was dropped
  whole — every responsive and state class unstyled, with `check` green.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`658c54c`](https://github.com/user01101111000/tailess/commit/658c54c1108337ecfcae3fed572b73c79a7e980b) Thanks [@user01101111000](https://github.com/user01101111000)! - The build reads a helper call whose arguments run past 20,000 characters, when they
  plainly start as code.
  
  A `variants()` recipe the size of a tailwind-variants port — a dozen variants, each
  option an `ss` map per part — is one call, and past 20,000 characters the scanner
  dropped it whole: every responsive and state class in it reached the element with no
  CSS, `tailess check` reported "nothing to check", and nothing warned. The cap exists for
  prose ("turn it on (or off"), whose `(` never opened a call; an argument list that starts
  with an object, an array or a string now gets a far larger one.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`aa1ad67`](https://github.com/user01101111000/tailess/commit/aa1ad672e923fa8c65536a7a28c692ec128312a2) Thanks [@user01101111000](https://github.com/user01101111000)! - The README's recipe for publishing a component library styles every class in the
  consumer, not only the prefixed ones.
  
  `tailess emit` writes the classes tailess *builds* — `md:p-4`, `dark:hover:bg-black`.
  The literals — `base` classes, flat variant options, `match` values, plain `className`
  strings — are left to Tailwind's scan, which in an app reads your source and in a
  consumer never reads `node_modules`. Shipping only the emitted file, as the recipe said,
  left every one of them unstyled in every consumer, with nothing warning in either build.
  The recipe now ships a `styles.css` at the package root that also names the bundle as a
  source (`@source "./dist"`), so the consumer's single `@import` covers both — built end
  to end in a new test.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`fdab551`](https://github.com/user01101111000/tailess/commit/fdab551848d88f9f27f4db8e7851f8842ca4cb26) Thanks [@user01101111000](https://github.com/user01101111000)! - The scanner follows symlinked and junctioned folders and files, as Tailwind's own scanner
  does. A `shared/` folder linked into an app had its literal classes styled by Tailwind and
  every tailess-built one unstyled, with `tailess check` green. A link back up the tree ends,
  and a folder reached through two links is read once.
  
  A file edited within two seconds of being scanned is read again on the next scan rather
  than trusted on its mtime and size. On NTFS most back-to-back rewrites keep the same mtime,
  and FAT's resolution is two seconds, so a same-length edit — a formatter, a codemod — kept
  the old classes until the dev server restarted.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`60ae238`](https://github.com/user01101111000/tailess/commit/60ae23877929548ba610c14430ac515ab41f40e4) Thanks [@user01101111000](https://github.com/user01101111000)! - The build-time checks no longer report a call that does not run: one in a `//` or block
  comment (a JSDoc "do not write `ss({ md: size })`"), in an HTML comment in a `.vue`,
  `.svelte`, `.astro` or `.html` file, or in a Markdown code fence or code span. Each of
  these failed `tailess check --strict` and `diagnostics: "error"` builds on working code.
  Class enumeration still reads them, since an extra candidate costs nothing.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`f16f38e`](https://github.com/user01101111000/tailess/commit/f16f38e6b6445ca9df4d7527682504407f3d317d) Thanks [@user01101111000](https://github.com/user01101111000)! - `configure()` reaches every copy of tailess in the process. The ES module and CommonJS
  builds each kept their own settings, so an ESM app rendering a CommonJS component library
  configured only its own copy: the library's `cn` ran the default merge, a declared key
  warned as unknown, and warnings skipped the configured `onWarn`. The scanner's cache and the
  build-time warning memo are shared the same way between the CommonJS entries, so
  `clearCache()` from `tailess/build` reaches the plugins' cache.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`48ecfb9`](https://github.com/user01101111000/tailess/commit/48ecfb92a540d301ef1d31a730441e57788fabc5) Thanks [@user01101111000](https://github.com/user01101111000)! - A source directory named `build`, `out`, `coverage` or `dist` is scanned.
  
  Those names were skipped at any depth, so a Next.js route at `app/build/page.tsx` or a
  feature folder at `src/coverage/` lost every runtime-built class while Tailwind still
  styled the literals on the same page — and `tailess check`, reading the same walk, passed.
  They are now skipped only where a build writes them: at the top of a scanned directory,
  or beside a `package.json`. A name listed in `ignore` is still skipped wherever it is.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`5423060`](https://github.com/user01101111000/tailess/commit/5423060b5b5eb150e7c3dce2d1b2acc46b4ec5ca) Thanks [@user01101111000](https://github.com/user01101111000)! - Overlapping content roots — `src` and `src/components`, or the project and one of its
  folders — read each file once. A file reached twice was counted twice, and every
  diagnostic in it was reported twice, in the build output and in `check --json`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`29c3de5`](https://github.com/user01101111000/tailess/commit/29c3de571a9e6260787fa8238854cf06a6dca029) Thanks [@user01101111000](https://github.com/user01101111000)! - Both plugins check their options when created, since they often come from an untyped
  `postcss.config.mjs`, `.postcssrc.json` or `vite.config.js`. `diagnostics: "ERROR"` (or
  `true`) used to behave as `"warn"` — a CI gate that never failed — and now throws, naming
  the option. So do an empty `cacheDir`, which put the generated stylesheet in the project
  root, and a list option that is not a list of strings. A single string where a list belongs
  is read as a list of one: `content: "src"` used to crash the build with "options.roots.map
  is not a function", and `ignore: "src"` skipped the directories `s`, `r` and `c`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`8e8d10f`](https://github.com/user01101111000/tailess/commit/8e8d10f6c14ad4539a898a98146e0611d7e81649) Thanks [@user01101111000](https://github.com/user01101111000)! - The plugins' types work in two more setups:
  
  - `tailess/postcss` exports `TailessPostcssPlugin`, the type its call returns. A typed
    `postcss.config.ts` in a `composite` project, or a package exporting the plugin, failed to
    emit declarations: "has or is using private name 'Plugin'".
  - Under `moduleResolution: node10` the subpath entries resolve to the CommonJS declarations,
    which say what `require()` really returns. Without `esModuleInterop`, the spelling that
    type-checked — `import tailess from "tailess/postcss"` — crashed at runtime, and the one
    that runs — `import tailess = require("tailess/postcss")` — was a type error.
  
    The trade-off: node10 cannot tell a CommonJS build from an ESM one, so a config compiled
    with `module: "ESNext"` — which loads the ESM entry, where the default import runs — now
    needs `allowSyntheticDefaultImports` (or `esModuleInterop`) under TypeScript 5.x to accept
    `import tailess from "tailess/vite"`. Vite's node10 templates set it; TypeScript 6 has it
    on always.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`f828f0a`](https://github.com/user01101111000/tailess/commit/f828f0a87639dafa52b1a588ec503b80b3209c9c) Thanks [@user01101111000](https://github.com/user01101111000)! - The PostCSS plugin warns when `content` matches no files, as the Vite plugin always has
  and as the README says both do — including the note that a glob is not expanded.
  
  A v3-style `content: ["src/**/*.tsx"]` under Next.js or the PostCSS CLI scanned nothing,
  and every prefixed class went unstyled with no warning, while the stylesheet still carried
  the marker that keeps the runtime's own "plugin not wired" check quiet. The warning now
  lives in one place both plugins call.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`f394393`](https://github.com/user01101111000/tailess/commit/f39439358d6823cdc3218fe654a33d8473b310a8) Thanks [@user01101111000](https://github.com/user01101111000)! - Two `tailess/postcss` instances with different `content`, `extensions` or `ignore` in one
  working directory — a monorepo root running two apps' pipelines, a multi-compiler build —
  no longer share one generated stylesheet. Each got the other's candidate list, concurrently
  and again on a rebuild, with the marker present and nothing printed. Each configuration now
  writes its own file, and a refresh checks the file still holds its list rather than
  trusting that it wrote it last.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`df6f4cc`](https://github.com/user01101111000/tailess/commit/df6f4cc17f0a9d2bdda06f6bc0ce34b5a16ab45a) Thanks [@user01101111000](https://github.com/user01101111000)! - The PostCSS plugin reports `@import "tailwindcss" prefix(tw)` written in the entry
  stylesheet itself, and fails the build over it under `diagnostics: "error"`.
  
  It rebuilt each `@import` as its bare specifier before the theme check read it, so the
  prefix on the entry's own import was dropped — only a prefix one file deeper was reported.
  Every Next.js or PostCSS project with a Tailwind prefix got a fully unstyled app and none
  of the promised build output, and a CI gate on `diagnostics: "error"` stayed green. The
  Vite plugin, which hands the whole stylesheet to the check, already reported it.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`ec174b2`](https://github.com/user01101111000/tailess/commit/ec174b20ce7a46921db381a77cee598b25ca72a3) Thanks [@user01101111000](https://github.com/user01101111000)! - The "Your Tailwind CSS doesn't include tailess' generated classes" check no longer fires
  in component tests. jsdom and happy-dom — under Vitest or Jest — load no stylesheet, so the
  marker could never be there, and every test file of a correctly wired project printed the
  whole message. A document with no stylesheet at all is now skipped; a page whose CSS lacks
  the marker still warns.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`8647267`](https://github.com/user01101111000/tailess/commit/864726752a67a05bedfbeb64fecaca0fe992c3d2) Thanks [@user01101111000](https://github.com/user01101111000)! - `has('[data-state="open"]', …)`, `supports('font-family: "Inter"', …)` and the like no
  longer warn in development or at build time. The plugin has carried a class holding `"`
  since the double-quote fix, but the unusable-value check still called every `"` unusable,
  so working code failed `tailess check --strict` and `diagnostics: "error"` builds. It now
  reports only what really cannot be carried: `{`, `}`, `\`, `;`, an unclosed quote, or both
  kinds of quote. A quoted `nth` position (`nthOfType('"2n"', …)`) — a selector the browser
  discards — keeps a warning of its own.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`a7c8b27`](https://github.com/user01101111000/tailess/commit/a7c8b27c7cb5c6e8d620d31880e52123728ca758) Thanks [@user01101111000](https://github.com/user01101111000)! - The README's Requirements table states the Node floor `engines` enforces — 20.19 — rather
  than the Node 18 it promised before 0.12.0 raised it. On Node 18, yarn 1 and
  `npm --engine-strict` refuse the install outright.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`0ce5897`](https://github.com/user01101111000/tailess/commit/0ce5897e354ef7667b910ba49ee262281d5ef898) Thanks [@user01101111000](https://github.com/user01101111000)! - Four regressions in `variants()` from this release's own fixes. A recipe whose map
  contains itself no longer throws `RangeError` at import — the snapshot keeps the cycle and
  `ss` cuts it with one warning. `button(props, props.className)` no longer warns that
  `className` was dropped, since it was passed on. An extra `{ base: "mt-2" }` or `{}` is no
  longer reported as getting no CSS: it builds no prefixed class. And the one-argument
  overload refuses any config-shaped object — `{ extend, base }` compiled and rendered the
  base alone, inheriting nothing.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`346a2b4`](https://github.com/user01101111000/tailess/commit/346a2b43018d9c4c586ef6af25ad5ac6f74be3a0) Thanks [@user01101111000](https://github.com/user01101111000)! - The scanner finds more of the calls the runtime makes, so fewer classes land unstyled:
  an optional call (`t.ss?.(…)`), a comment between a helper's name and its parenthesis,
  TypeScript type arguments (`variants<Props>(…)`), and a comment between a key and its
  colon (`lg /* desktops */: "p-3"`). String values decode `\xHH`, `\uHHHH` and `\u{…}`
  escapes and backslash line continuations the way the runtime does — a CRLF continuation
  used to end the string early and drop the next argument's classes — and template literals
  decode their escapes too. The unknown-key warning no longer calls a working Tailwind
  variant such as `aria-checked` "not a Tailwind breakpoint or state variant"; it says the
  key is not one of `ss()`'s and points to `configure({ keys })`.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`10e088f`](https://github.com/user01101111000/tailess/commit/10e088fc84584802cb86c679914abdf242c27d55) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess check` — and the exported `hasRule` / `selectorFor` — find a class with
  characters outside ASCII the way Tailwind writes it.
  
  Every character past ASCII was escaped, while Tailwind (like `CSS.escape`) writes it as it
  is. So `data("state", "geöffnet", …)` or `has("[lang='日本']", …)` failed the gate on
  working code, and a broken class with an arrow or a checkmark in its `content` passed,
  because its utility "did not resolve" either. Control characters are hex-escaped, as
  `CSS.escape` does.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`5f8895f`](https://github.com/user01101111000/tailess/commit/5f8895f0edb6ff16362e5e40026889bb057f3309) Thanks [@user01101111000](https://github.com/user01101111000)! - `ss` cuts a map that contains itself where the cycle closes, and says so once. The depth
  bound only slowed a cycle down: a map reaching itself from two keys walked 2¹⁰ paths, from
  four keys 4¹⁰ — around nine seconds for one call, in production too — and warned once per
  path on every call. A map shared by two keys, which is not a cycle, is emitted under both.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`03a92fa`](https://github.com/user01101111000/tailess/commit/03a92fa2276b84b6b7cfff9305a2d70f83d3ad62) Thanks [@user01101111000](https://github.com/user01101111000)! - The build check for an `ss` map written where a flat class value goes now reads
  `responsive()`'s breakpoints and `match()`'s options, and the README no longer claims the
  types refuse it.
  
  `responsive("p-2", { md: { hover: "p-4" } })` builds `md:hover` and
  `match(size, { sm: { md: "p-4" } })` builds `md`. Neither is a utility, so `tailess
  check` skipped both as junk, the runtime said nothing, and the element shipped unstyled.
  The README said the types refuse an `ss` map handed to a helper; they cannot — a `clsx`
  dictionary is any object — so the build check is what catches it, and now it does there
  too. A real dictionary, `{ md: { hidden: !open } }`, stays quiet.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`ad41287`](https://github.com/user01101111000/tailess/commit/ad41287219c79d501650c536481aaad47e32d326) Thanks [@user01101111000](https://github.com/user01101111000)! - A `variants` compound rule that names a group the recipe does not declare never applies,
  and says so once in development. cva and tailwind-variants differ here: they match such a
  rule against whatever props are passed, so a port that keys a rule on an undeclared prop
  loses those classes — the warning names the rule.
  
  Only the declared groups were checked against a rule, so a typo (`sizee: "lg"`) or a
  group renamed since the rule was written counted as met, and the rule's classes landed on
  every instance meeting its other conditions. The types refuse such a key in a literal
  config; this is for plain JavaScript, casts and configs built at runtime.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`0381826`](https://github.com/user01101111000/tailess/commit/0381826b5d31375b1e4dde3fba2598f0b75c6106) Thanks [@user01101111000](https://github.com/user01101111000)! - `diagnostics: "error"` no longer fails a build over a theme note about CSS that works.
  
  Following "Keys your own CSS adds" — `--breakpoint-3xl`, a `@custom-variant`, the keys
  declared — under the `diagnostics: "error"` the README recommends for CI failed the
  production build, with a message saying `ss({ "3xl": … })` "will not compile" to a
  project where it compiled. A moved breakpoint width failed it too, on a note that itself
  said the classes are fine. Those three cases are now marked `informational` on the
  `Diagnostic` (a new optional field in `tailess/build`), printed in every mode, and never
  counted as a failure; the message says to declare the key or use `withPrefix`. A removed
  breakpoint — classes with no rule — still fails the build.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`a9e256a`](https://github.com/user01101111000/tailess/commit/a9e256ab581df6ea34d2d6b1bc600b5e92052e62) Thanks [@user01101111000](https://github.com/user01101111000)! - Type fixes:
  
  - `ss` and `variants` accept `readonly` class lists — `["flex", "gap-2"] as const`, a
    `readonly string[]` prop — which the runtime already read like any other list.
  - A recipe's props must be an object. With no variants they were typed `{}`, which a string
    satisfies, so `bare(className)` compiled and the class was dropped.
  - A mistake in a recipe's `compound` rules is reported with the mistake in it —
    "'tones' does not exist … Did you mean to write 'tone'?" — at the rule. Every such error
    read "'variants' does not exist in type 'SsInput'", because `variants(base)` was the last
    overload TypeScript tried.
  - The README states the TypeScript floor: 5.0, for `const` type parameters.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`a165e3d`](https://github.com/user01101111000/tailess/commit/a165e3df57d12621542febd63ed67fd35df0a3a6) Thanks [@user01101111000](https://github.com/user01101111000)! - A key nobody declared never ties with the first key `configure({ keys })` declares; it is
  emitted after every declared key, in the order written. The first declared key's rank was
  exactly the one every undeclared key got, so the two kept their written order — and across
  nested buckets that reach the same variants, which padding survived the merge depended on
  how the object literal was typed. The README's emission-order sentence now names every
  family, containers and declared keys included.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`33f9402`](https://github.com/user01101111000/tailess/commit/33f94029e98b2b2d44247f44d607d5c48232ac24) Thanks [@user01101111000](https://github.com/user01101111000)! - The literal-underscore warning no longer advises a spelling that fails. It said to use
  `withPrefix` for a real `\_`, and the class that builds — `withPrefix("has-[.my\_class]", …)`
  — carries a backslash, which the scanner cannot hand to Tailwind, so it was unstyled with
  `check --strict` green. The warning now points at a class written out in `String.raw`, which
  Tailwind's own scan reads and compiles; and the build check names a prefixed class whose
  backslash or brace is in the prefix — `withPrefix`, `data()` — not only in the class.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`3993b3e`](https://github.com/user01101111000/tailess/commit/3993b3eb5ed14a27595da1781cc2674c06eafa84) Thanks [@user01101111000](https://github.com/user01101111000)! - A slotted option that names a part the recipe does not have is a type error even when it
  also names one that exists: `{ root: "p-2", titel: "text-xl" }` compiled, and `text-xl`
  reached no part. Parts inherited through `extend` still count.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`3ba5795`](https://github.com/user01101111000/tailess/commit/3ba5795f303be19cbf4dd7b728640be2a085594b) Thanks [@user01101111000](https://github.com/user01101111000)! - `variants()` types the same with `strictNullChecks` off — TypeScript's default — as with
  it on. A regression from 0.11.0.
  
  The "was a parent recipe passed to `extend`?" check asked it of a type parameter that
  defaults to `undefined`, and without `strictNullChecks` `undefined` is assignable to every
  object type, so every recipe in such a project inherited `Record<string, …>` as its
  variants. Boolean and numeric variant props stopped compiling (`{ disabled: true }`,
  `{ cols: 2 }`), a misspelt variant compiled, and the README's
  `ComponentProps<"button"> & VariantProps<typeof button>` rejected `onClick` and
  `tabIndex`. The published declarations are now compiled in the suite under three sets of
  compiler options.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`4b42948`](https://github.com/user01101111000/tailess/commit/4b42948cf3c6a090a7729de1a587b715f6de9658) Thanks [@user01101111000](https://github.com/user01101111000)! - The Vite plugin handles `@import "tailwindcss"` written in a Vue or Svelte `<style>` block,
  or in an inline `<style>` in `index.html`. Tailwind compiles those, but the plugin read
  only the path before `?`, saw `App.vue`, and skipped it — every runtime-built class
  unstyled, with nothing printed. It now uses the same test Tailwind's own plugin does.

- [#72](https://github.com/user01101111000/tailess/pull/72) [`1103f3d`](https://github.com/user01101111000/tailess/commit/1103f3debd0eca305c48791bb59dc90bfd25fa29) Thanks [@user01101111000](https://github.com/user01101111000)! - `postcss --watch` and webpack's watch mode settle after an edit. postcss-cli reloads the
  config for every rebuild and postcss-loader re-evaluates it per build, so each rebuild got
  a fresh plugin, which rewrote the class list even when the file already held it. The
  rewrite touched a file Tailwind reports as a dependency, the watcher rebuilt, and did it
  again — about 12 rebuilds a second for as long as it ran (the README's object-form config
  under postcss-cli; any form under webpack). The file is now written only when its bytes
  differ.

## 0.12.1

### Patch Changes

- [`a6911f2`](https://github.com/user01101111000/tailess/commit/a6911f2ea3b2ae7f285e057675e253421e816015) Thanks [@user01101111000](https://github.com/user01101111000)! - `emit --out <file> --json` answers in JSON on stdout, and says when the file it wrote is
  not a stylesheet.
  
  It was the one `--json` path in the binary that printed prose, so
  `tailess emit --content src --out dist/list.json --json | jq -e .ok` failed to parse on a
  run that exited 0 — which reads as a broken pipeline rather than a pass. Stdout now
  carries an acknowledgement object; the file still holds the candidate list itself, which
  is what `--json` asks for.
  
  The reason that distinction is worth a line rather than a footnote: `--json` changes what
  `emit` *produces*, not just how it prints. A file named `.css` holding the candidate list,
  imported into a stylesheet, enumerates nothing — every runtime-built class reaches the
  element with no rule behind it, silently, which is the failure this package exists to
  prevent. Pointing `--out` at a `.css` path under `--json` now says so on stderr, where it
  cannot break the JSON on stdout. `--help` says plainly that `--json` changes the output
  rather than only its format.
  
  Found by installing the published package from npm and driving the binary as a consumer
  would, rather than by calling `check/run.ts` directly.
  
  Also: `CHANGELOG.md` is included in the published package. `files: ["dist"]` excluded it
  and npm 7 dropped it from the always-included set, so the tarball carried no release notes
  and the README's own `[Changelog](./CHANGELOG.md)` link pointed at nothing inside
  `node_modules`.

## 0.12.0

### Type changes

Three changes to the `variants` types in this release are breaking for code that reads
the types back rather than calling the API. They were not called out when it shipped:

- `VariantProps<typeof recipe>` of a `{ true, false }` group is `boolean | "true" | "false"`,
  not `"true" | "false"` — the boolean-variant change below. Code that returns such a prop
  as the string union needs `String(…)` or a narrower annotation.
- `VariantsConfig["compound"]` (and `compoundVariants`) is a `ReadonlyArray`, so a
  `compound: [...] as const` is accepted — and `config.compound.push(…)` is not.
- `VariantComponent<V>` has a required `readonly config: unknown`, which is what `extend`
  reads. A hand-built component or a test double typed as one needs it too.

### Minor Changes

- [#56](https://github.com/user01101111000/tailess/pull/56) [`24a7d88`](https://github.com/user01101111000/tailess/commit/24a7d88ddd1e76075a3d422f497a3062687520ba) Thanks [@user01101111000](https://github.com/user01101111000)! - `tailess emit`, a gate you can point at your build, and an app that proves both.

  **`tailess emit` writes the stylesheet the plugins inject.** It unlocks two things that
  were simply not possible before.

  The first is every host that compiles Tailwind without a PostCSS chain — Tailwind's own
  CLI, Rspack's native pipeline, Bun's bundler, the standalone binary. They were unsupported
  with no escape hatch. Now they run one command and `@import` the result:

  ```bash
  npx tailess emit --content src --out src/tailess.css
  ```

  The second is publishing a component library. A consumer's scan skips `node_modules`, and
  pointed at your package it would be reading a bundled `dist` where the helper names are
  gone — so shipping components built on tailess did not work. Enumerate the classes at your
  build time and ship the file instead; your consumer adds one `@import` and needs neither
  the plugin nor a scan of your source. Verified end to end: a project with **no tailess
  plugin in the pipeline at all** gets CSS for every class, `md:p-4` and
  `has-[>_img]:p-0` included.

  **The gate can be made to agree with the build.** `tailess check` took only `--content`
  and `--css`, so a project that narrowed `extensions` or `ignore` had a plugin enumerating
  one set of files and a gate reading another — wrong in both directions, and silently. It
  now takes `--extensions` and `--ignore` too, both repeatable and comma-separated.

  **Every finding names its file.** The report was a list of class names, and the documented
  way to locate one was grepping escaped selectors in the built CSS by hand. `--json` gives
  a CI job the same thing as one object, `--max` controls the cap (`0` lists everything —
  on a `@theme` that moved a breakpoint the list _is_ the project), and `--version` exists.

  **A real app, in `examples/vite-react`.** Vite, React, every helper, every class built at
  runtime. Two things about it matter more than being a demo. It is the only place a real
  Vite build runs anywhere in this repo — everything else calls the plugin's hooks directly,
  which cannot catch a plugin shaped wrong for its host. And CI asserts the _negative_:
  after removing `tailess()` from the config, the build still succeeds and the page still
  renders the right `class` attributes, so the gate is what has to go red. If it does not,
  the job fails.

  **CONTRIBUTING.md described a source tree that does not exist.** It documented
  `src/config/` with a `defineConfig`, `src/core/` with a `createTailess` factory, and a
  matching `test/core/` — none of which are real, over half the package unmentioned, and
  two package facts wrong besides (`clsx` has not been a dependency since it was vendored,
  and `sideEffects` is not `false`). It now describes the actual tree, states the invariant
  the whole package turns on, and carries the checklist a helper actually needs: miss the
  scanner's name list and everything is green while every class it builds is unstyled.

  **An editor section, and a `.vscode/settings.json` to copy.** Moving a `className` into
  `ss({ … })` turns off Tailwind IntelliSense — no completion, no colour swatches, no hover,
  and no unknown-class warning, which was the only thing catching a typo _inside_ a class
  string. `tailwindCSS.classFunctions` turns it back on, and unlike the prettier list it is
  safe to give every helper: the extension reads, it never rewrites.

  **A migration table for cva and tailwind-variants**, which `variants()` is meant to
  replace and which the docs did not name once. Three renamed keys, what you gain, what is
  deliberately absent (`twMergeConfig`, and responsive variant selection at the call site),
  and the one difference that will
  bite: a boolean variant is keyed by the strings `"true"`/`"false"`, where cva and tv give
  you a `boolean`.

  One fix that came out of building the example: the `renamed-import` diagnostic fired on
  Markdown, because the scanner reads `.md` for classes and this example README documents
  `import { ss as tw }` as the thing not to do. An import statement in Markdown or HTML is
  prose; `.mdx` is deliberately excluded from that, since its imports really do run. And the
  "is the plugin wired up" check now requires the plugin to be _called_ — a leftover import
  after a deleted `tailess()` is exactly the case it exists to catch, and reading for the
  word alone called that wired.

- [#56](https://github.com/user01101111000/tailess/pull/56) [`2bd055b`](https://github.com/user01101111000/tailess/commit/2bd055b95237ad7fbfd94aa3262bf3372b153544) Thanks [@user01101111000](https://github.com/user01101111000)! - Close the gaps that let a broken build pass — and the one that broke a working one.

  `tailess check` shipped as a CI gate that could not fail on the failures that matter
  most, and the plugins had no way to make a proven-wrong class stop a build at all. Both
  are fixed here, along with a Tailwind option that silently unstyles every page.

  **A Tailwind `prefix(…)` is now detected instead of silently unstyling everything.**
  `@import "tailwindcss" prefix(tw)` makes the working class `tw:hover:underline`; tailess
  builds `hover:underline`, for which Tailwind generates no rule at all. Nothing reported
  it: the plugin ran, the marker was written, the integration check passed, and not one
  runtime-built class on the page had CSS. Both plugins now report it as the total failure
  it is, and `tailess check` names it and exits `2` rather than listing every class in the
  project as broken under a heading blaming a moved breakpoint.

  **A helper imported under another name is now a build-time diagnostic.** The scanner
  finds calls by identifier, so `import { ss as tw } from "tailess"` is a single line that
  removes every class in that file from the candidate list — while the file compiles,
  type-checks, and renders exactly the `class` attribute that was written. It was the
  widest silent failure left and the only one provable from the import statement alone.
  Renaming `cn` or `match` still costs nothing, because the scanner never looks for them.

  **`tailess check` exits `2` when it scanned nothing.** A mistyped `--content`, a task
  runner in the wrong directory, or a glob where a directory was expected all used to print
  a cheerful line and exit `0` forever after — a gate that had silently stopped gating, and
  in CI indistinguishable from a passing one. A scan that finds real files but no tailess
  calls still exits `0`, and now says how many files it read, so the two are distinguishable
  in a log. The exit codes are documented.

  **`tailess check` reports the build-time diagnostics it already computed.** It collected
  them on the way past and dropped them, which was exactly backwards: they are the failures
  compiling _cannot_ find, since a class carrying an unusable value never reaches Tailwind
  to be found missing. They print by default; `--strict` makes them fail the gate too.

  **`tailess check` says when no build config mentions tailess.** The plugin not being wired
  up is the first failure the troubleshooting section lists and the one that unstyles an
  entire application — and the check could not see it, because it scans your source itself
  rather than reading what your build produced. A project with the plugin deleted passed
  green. It is a heuristic, so it warns by default and fails only under `--strict`.

  **Both plugins take a `diagnostics` option** — `"warn"` (the default), `"error"` or
  `"off"`. Everything the scanner can prove wrong used to be `console.warn` and nothing
  else, so an unstyled build passed CI by design. `"error"` prints the whole list and then
  fails, which is what a CI build wants; `"off"` exists because a warning nobody can silence
  is a warning everybody learns to scroll past.

  **The prettier configuration in the README was rewriting selectors.** `tailwindFunctions`
  listed `has`, `notHas`, `inside`, `supports`, `notSupports` and the four `nth*` helpers,
  and the plugin sorts _every_ string argument of a listed function — but the first argument
  of those is a selector or a feature query. `has("table [data-open]", …)` was rewritten to
  `has("[data-open] table", …)`: Tailwind knows `table` as a utility and `[data-open]` as
  unknown, so it moved them, and the selector came to mean the opposite of what it said.
  On format-on-save, silently. The list now holds only the helpers whose string arguments
  are all class lists.

  **CI built after it tested, so the suite that asserts on `dist/` never ran.** It guards
  the shape of the string-named PostCSS entry — the thing Next.js loads — and skips itself
  when there is no build, which on a fresh checkout is always. It has now been green by
  never executing for its whole life. The workflows build first, and the suite fails loudly
  instead of skipping when it finds no `dist/` in CI.

  **The release workflow pins `changesets/action` to a commit** rather than the moving `v1`
  tag. That step runs with `id-token: write` and the npm token in its environment.

  Two smaller things: `src/integration/report.ts` held literal NUL bytes in a template
  string, which made it a binary file to grep, GitHub diffs and most editors — they are now
  written as `\0`. And the scanner's helper-name list is exported and the call pattern built
  from it, so the diagnostics and the scanner cannot drift apart about which names matter.

- [#56](https://github.com/user01101111000/tailess/pull/56) [`8b0536a`](https://github.com/user01101111000/tailess/commit/8b0536a33d091554f4f9f221c5f12c074f90e1b9) Thanks [@user01101111000](https://github.com/user01101111000)! - Hold the claims to the code: peer dependency, coverage floor, and CI that runs.

  **`tailwindcss` is a peer dependency** at `^4.0.0`. The plugins and the CLI resolve it
  from the consumer's tree, so it always was one in fact — but nothing declared it, and
  nothing warned a project on Tailwind 3, or a future 5, until the CSS was quietly wrong.

  **`engines` is now `>=20.19`**, and CI loads the built package on exactly that version.
  It promised Node 18, which has been end-of-life since April 2025; 20.19 is what Vite 8
  requires, so it is what a Tailwind v4 toolchain already needs. Nothing that could run
  before is stranded — but this is a support-floor change, so it is called out here rather
  than buried.

  **CI runs before merge, not after.** It triggered only on `main`, so every failure was
  found at merge time. It now runs on `dev`, on any pull request, and on demand — a feature
  branch is covered from the moment its pull request is open, which is the thing to do
  early. Windows runs on both ends of the Node range rather than one, since it is the
  platform the path handling actually differs on.

  **Next.js is built.** It is the first setup the README documents and the reason
  `scripts/postbuild.mjs` exists — its `export =` correction is what makes a string-named
  `"tailess/postcss"` resolve for Next — and nothing had ever built one. A new CI job
  scaffolds a Next app, builds it, and asserts the runtime-built classes have rules in the
  stylesheet Next emitted. Verified both ways: with the plugin removed the build still
  succeeds and the check goes red, which is the whole point.

  **A weekly job runs the suite against the _latest_ Tailwind**, not the pinned one. The
  305 keys are a contract with Tailwind's variant registry, and the lockfile meant a
  release that renamed or dropped a variant would reach a consumer's project before it
  reached this one.

  **Coverage is enforced**, not merely collected. It ran on every CI job and was checked
  nowhere, so a change could delete a suite's worth of it in silence.

  **The binary is run as a process.** Every test imported `check/run.ts` directly, so
  `src/cli.ts` — argv slicing, the subcommand alias, the shebang, the catch that returns
  2 — was covered by nothing. CI now asserts six exit codes from the built binary.

  **The scanner has a fuzz suite.** It reads every file in a consumer's project and it is
  a tokeniser, not a parser, so the inputs that matter are minified bundles and half-saved
  files. Two properties, over a deterministic 2,000-sample corpus: it never throws, and it
  never emits a candidate that could not be a class name — one of those poisons the rest of
  its `@source inline` chunk, measured at 60 lost classes.

  **The README is held to the code.** Its key counts were hand-maintained in five places
  with nothing checking them, which is exactly how the docs site came to say 149. A test
  now sums the Keys table against the real key set, checks every count in the prose,
  resolves every table-of-contents anchor, holds the exported-types list to what
  `src/index.ts` actually exports — it had fallen eight names behind — and compiles every
  code example through the real Tailwind.

  **The performance table is reproducible.** `npm run bench` produces it. Writing that
  script found that the old numbers were measured with a benchmark bug: taking the best of
  three scans without clearing the cache measured one cold scan and two warm ones, then
  reported the warm number as the cold one. The cache is fine — 287 ms cold, 52 ms warm on
  the machine named in the README — but the number that was published was not the number
  that was measured.

  **Governance that was missing entirely:** `SECURITY.md` (including what `tailess check`
  executes from your project, which is the part worth knowing), `CODE_OF_CONDUCT.md`,
  `CODEOWNERS`, issue and pull-request templates, and a Dependabot config that watches the
  Actions pinned by SHA. A stability policy in `CONTRIBUTING.md` says what `0.x` actually
  promises per surface, how deprecation works, and how to publish a prerelease — with the
  version-drift trap written down, since it has bitten this repository twice.

  **`llms.txt` and `AGENTS.md`.** A large share of Tailwind classes are now written by
  coding agents, and every default habit one has — hoisting a class into a `const`,
  building `text-${size}`, aliasing an import — produces code that compiles, type-checks,
  renders the right `class` attribute and has no styles. The one rule is now written where
  a tool will read it.

- [#56](https://github.com/user01101111000/tailess/pull/56) [`ea5b747`](https://github.com/user01101111000/tailess/commit/ea5b74743d3a444d429e511886a089de53017569) Thanks [@user01101111000](https://github.com/user01101111000)! - Close the gaps in the library itself: slots, `extend`, `configure`, and keys you declare.

  **`variants()` grew the four things that sent teams to `tailwind-variants` instead.**

  `slots` builds a multi-part component. A Dialog is root, overlay, panel, title and close;
  before this it was one `variants()` call per part, with the shared variants written out
  five times. Declare the parts instead of `base`, and every option says what it adds to
  each one:

  ```ts
  const card = variants({
    slots: {
      root: "rounded-lg border",
      title: "font-semibold",
      body: "text-sm",
    },
    variants: {
      size: { lg: { root: { base: "p-5", md: "p-8" }, title: "text-xl" } },
    },
  });
  const { root, title, body } = card({ size: "lg" });
  ```

  Each part merges on its own, so an override on `root` cannot disturb `title`, and a
  slot's value is an `SsArg` like anywhere else — a part can carry its own breakpoints.

  `extend` builds on another recipe, merging **per option** rather than per group, so a
  product package adding one `tone` keeps the ones it inherited rather than replacing the
  group. Types merge too. Slotted recipes extend the same way, gaining parts.

  A boolean variant takes a `boolean` — `<Button disabled={isDisabled}>` — which is what a
  component already has and what `cva` and `tv` hand back. The string spellings still work,
  since `"true"` and `"false"` really are the option keys.

  A compound rule matches a list: `{ tone: ["danger", "warning"], size: ["md", "lg"] }`.
  That was four rules kept in step by hand, and the count is multiplicative.

  `compoundVariants`, `defaultVariants` and `className` are accepted as aliases, so a `cva`
  recipe ports by changing the function name and nothing else.

  The scanner learned slots, which is the half that matters. An option's value is a slot
  map, not a class value, and reading it as an `ss` map emitted `root:md:p-8` — junk — while
  missing the `md:p-8` the runtime builds.

  **`configure({ merge, onWarn, keys })`.** `cn` called a bare `twMerge`, with no way to
  reach `extendTailwindMerge` — so in a project with its own `@utility` or theme scale,
  `cn("text-sm", "text-hero")` emitted both and the winner was decided by CSS source order
  rather than by argument order, which is the one guarantee `cn` makes. `onWarn` is where a
  development warning goes: throw to make it fatal in CI, collect it in a test, or silence
  it, because a warning nobody can silence is one everybody learns to scroll past.

  **Keys your own CSS adds.** The built-in keys are closed on purpose — that is what makes
  a typo a compile error. But a `@theme` adding `--breakpoint-3xl`, or a `@custom-variant`,
  creates a variant that genuinely works and that tailess cannot know about; the build check
  already reported it and the only answer was `withPrefix`. Augment `CustomKeys` and it
  joins the union, and name it in `configure({ keys })` so the runtime — which cannot see a
  type — stops calling it unknown on every render.

  **A ninth build-time check: an `ss` map handed to a helper that takes a flat class value.**
  Composition runs one way — a helper nests inside an `ss` bucket, never the reverse — and
  every helper's class argument is a `ClassValue`, where an object is a `clsx` dictionary.
  So `on("hover", { base: "underline", md: "font-bold" })` builds `"hover:base hover:md"`.
  The types refuse it; this catches the cast and the untyped boundary that get past them.

  **The six warning memos are bounded.** They were sets of every value ever seen, and a dev
  server or an SSR process in development sees a fresh one on every request — `has(userInput)`
  is enough. They clear rather than stop accepting, so the worst case is a warning printing
  twice, not a real one never printing.

  Runtime cost: routing `cn` and `ss` through `internal/settings.ts` puts them at **5,683
  characters**, from 5,177 on the last release — the figure of 5,170 that stood in this
  paragraph was `main`'s, and nothing had re-measured it. `variants` on top of that is 2,920.
  The size budget moved deliberately, and every number is now measured in the test that pins
  it rather than carried forward by hand.

  Four things were considered and deliberately not built, each for a reason now in the
  README: responsive variant selection at the call site (the scanner reads your recipe,
  never the call sites of the component it builds, so it would enumerate every option under
  all thirteen breakpoints or let the class land with no CSS); memoizing `ss` (React builds
  the object fresh on every render, and `tailwind-merge` already caches the expensive half);
  exporting the whole theme as JS (a second copy of your theme is a copy that drifts —
  `var(--color-brand)` is the answer); and folding a static call into a literal at build
  time (it means rewriting your JavaScript, which is a much larger promise than adding CSS).

- [#56](https://github.com/user01101111000/tailess/pull/56) [`976c240`](https://github.com/user01101111000/tailess/commit/976c240da420fbb2295dddd481bd12a2ab4558c3) Thanks [@user01101111000](https://github.com/user01101111000)! - Close the remaining thirty-three findings from the same adversarial review — the ones
  below blocker, which is where the promises this release makes turned out not to be kept.

  **`configure` kept three of them badly.** `keys` said declared keys get "a stable
  position, in the order given" and gave every one of them the same rank, so the emitted
  order was whatever order the object literal happened to use — two components declaring
  the same two keys the other way round emitted them the other way round, and which one won
  a `tailwind-merge` conflict depended on how someone typed an object. `onWarn` could not
  see a warning that had already fired, so "collect it in a test", one of its three
  documented uses, passed vacuously the moment anything earlier in the process had tripped
  that warning; passing `onWarn` clears that history now, and `resetWarnings` is exported.
  And the README's own `configure` example did not compile under `exactOptionalPropertyTypes`,
  because `Partial<T>` refuses an explicitly undefined value and a conditional setting is
  exactly that — `ConfigureOptions` replaces it, and the example is compiled against the
  built types. The README also now says the settings are process-global rather than leaving
  "before anything renders" to imply it.

  **Four warning sites had no memo** while the changeset claimed all of them did — including
  `ss()`'s unknown key, the highest-frequency site in the package, where a project
  mid-migration got a console line per render and, under the documented fatal `onWarn`, a
  throw per render.

  **`variants` handed out its caller's own objects** behind a `readonly` declaration.
  Writing to `component.config` made a child built later inherit a definition its parent
  does not have, and adding an option to `component.variants` produced a class the runtime
  builds and the scanner can never enumerate. Both are snapshots. A slot or group named
  `__proto__` was dropped and reassigned the accumulator's prototype; `compound` and
  `defaults` were typed against the child's own variants only, so relating a new variant to
  an inherited one — most of the point of `extend` — was a compile error whose only escape
  was `as any` over the whole config; `variants("flex")` threw from `Object.keys`; and an
  `extend` cycle threw a bare `RangeError` naming nothing.

  **The scanner lost a class in one more shape and a diagnostic misdirected in another.**
  `nth(cond ? 2 : "odd", …)` dropped its numeric branch, because the guard that keeps the
  digits inside `"3n+1"` from being read as positions was "if any string was found, ignore
  all numbers"; it blanks the strings and sweeps the rest now. And `bucket-as-dictionary`
  asserted the nesting mistake even when the key was a name someone plausibly gave a class
  of their own — `first`, `open`, `disabled`, the vocabulary of a `clsx` dictionary — where
  the class is dead for a different reason and the suggested rewrite builds something else.
  For those keys it names both readings.

  **`check --strict` failed a correctly wired project** whenever the plugin list is composed
  outside a `*.config.*` file, which is what a monorepo or a shared preset looks like; the
  guess abstains now rather than failing a build it cannot see through, and no longer
  reports `checked: N` for a check it never ran. `--json` was silently ignored by `doctor`
  and `init`, every failure printed the whole usage text, and `-v` was undocumented.

  **The tarball is smaller.** Sourcemaps were 66% of the tarball, and
  581 kB of that was the scanner's source inlined three times into CJS maps nothing can
  debug — the argument `tsup.config.ts` already makes for the CLI's map, applied where it
  is worth more. As published, 296,329 → 254,662 bytes packed and 1,078,071 → 906,217
  unpacked — corrected from a 421,892 → 197,121 measured on a build that never shipped.
  `*.tgz` is ignored, so hand-verifying a release cannot leave a binary blob one
  `git add -A` from being in history.

  **The release waits for CI.** It published on push to `main` while CI ran beside it,
  re-verifying a strict subset — not the platform matrix, not the `engines` floor, not the
  example, not Next.js, which are the three things CI's own comment says no unit test
  reaches. An npm version cannot be unpublished. The `gate must fail` step also accepted
  _any_ non-zero exit as proof, where `check` has two failure codes. Both read-only
  workflows declare `permissions: contents: read`.

  **And the documents were held to the code once more.** The count of build-time checks was
  eleven in three published places and is ten — now asserted against the `kind` union, since
  a hand-maintained number is how the docs site came to say 149. The migration table said
  `className` is not accepted in a compound rule while the diff three lines below it uses
  one. A changeset told the changelog that `slots` and `extend` are deliberately absent from
  the release that adds both. Another said `ss` + `cn` was "unchanged at 5,170 characters",
  a figure nothing had re-measured — it is 5,683, and every number in that budget is now
  measured rather than carried forward. "CI runs on the branch the work happens on" is
  softened to what the trigger list does. And "the last one is the only check that reads
  your CSS" stopped being true when this release added a second.

- [#56](https://github.com/user01101111000/tailess/pull/56) [`d194cae`](https://github.com/user01101111000/tailess/commit/d194cae0f93fb1469f3870f501853cd65b4019c8) Thanks [@user01101111000](https://github.com/user01101111000)! - Tooling: `init`, `doctor`, `tailess/build`, and two checks that replace a lint plugin.

  **`tailess init` and `tailess doctor`.** Setup is the one failure nothing else can catch:
  wiring the plugin is four hand-edited variants across two config shapes, ordering matters
  in one of them, and getting it wrong produces no build error at all — the build succeeds,
  the class attributes are correct, and nothing on the page has styles.

  ```bash
  npx tailess doctor        # exits 1 when the plugin is not wired up, and says how to fix it
  npx tailess init          # shows the edit it would make
  npx tailess init --write  # makes it
  ```

  `init` reads the project, picks the right integration, and inserts the plugin — for
  PostCSS, _first_ in the list, because it has to write the candidate list before Tailwind
  reads it. It refuses to guess: a config with no `plugins` list it recognises is left
  alone, and `doctor` prints the line to add by hand. The diff it shows before writing is a
  real LCS diff, because showing a wrong one and then editing someone's build config on the
  strength of it is worse than not offering the command.

  **`tailess/build` — the scanner, as a library.** Everything here that is not the runtime
  rests on one question, _which classes can this source build at runtime?_, and the two
  plugins and the binary were the only ways to ask. A webpack or rspack loader, an esbuild
  plugin, an Astro or Nuxt module, an editor extension, a lint rule, a company's own CI
  script: all of them needed it, and all of them had to reach into `dist/` internals.

  ```ts
  import { collect, buildPrelude, diagnose } from "tailess/build";
  ```

  Node-only, so it is a subpath rather than part of `tailess` itself — the runtime pulls in
  no Node types at all, and that stays true.

  **Two more build-time checks, in place of an ESLint plugin.** The rules worth
  having were the ones the type system cannot express, and both are now diagnostics that
  need no install, no config, and run in CI for everyone:

  - **A bucket the scanner cannot read.** `ss({ md: size })` is perfectly well typed and
    completely unstyled, and it is the package's most common support case. Reported for a
    _prefixed_ key only: `base` adds no prefix, so its value passes through and Tailwind
    finds the literal wherever it really lives.
  - **An `ss` map handed to a helper** that takes a flat class value, from the previous
    release, which catches the other half of the same confusion.

  An ESLint plugin would add editor squiggles and autofix on top of these. That is a
  separate package's worth of work and reaches only the people who install and configure
  it; the diagnostics reach everybody on the next build.

  **`tailess emit --json`** prints the candidate list itself, with the file each class came
  from, rather than the stylesheet it would be wrapped in. The documented way to answer
  "did the scanner see my class?" was reading escaped selectors out of the built CSS.

  **And no codemod, because there is nothing left for one to do.** `variants` now accepts
  `cva`'s own call shape — the base classes as a first argument — on top of the
  `compoundVariants`, `defaultVariants` and `className` aliases from the previous release.
  Porting a `cva` codebase is `cva(` → `variants(` and nothing else.

- [#56](https://github.com/user01101111000/tailess/pull/56) [`e576831`](https://github.com/user01101111000/tailess/commit/e57683184faa716e13a0becd23e46c97313e4583) Thanks [@user01101111000](https://github.com/user01101111000)! - Fix eleven defects an adversarial review found in the work above — three of which broke
  a working project.

  **The build no longer fails a file that has nothing to do with tailess.** `on`, `data`,
  `group`, `has`, `inside`, `between` and `responsive` are ordinary identifiers, and the
  scanner matches them on any receiver and inside any string — deliberately, because an
  extra candidate costs a moment of compile time while a missing one costs a broken layout.
  The new diagnostics borrowed that looseness and should not have:
  `socket.on("presence", ({ open, dark }) => …)`, in a file with no tailess import and no
  class in it, was reported as building an unstyled class — failing `check --strict` and,
  with `diagnostics: "error"`, the build. Reporting is now gated on the file importing from
  `"tailess"`, a call reached through something that is not a tailess namespace is skipped,
  and a destructuring parameter is no longer read as a `clsx` dictionary. Enumeration is
  unchanged. The trade is a project reaching the helpers through its own re-export: it keeps
  full enumeration and `check` still proves the far end, but loses the source-level
  warnings. A warning that fires on working code is worse, because it teaches people to
  stop reading them.

  **`renamed-import` no longer fires on a line that does not run.** A commented-out import,
  and one quoted inside a docs sample, were both reported — asserting the strongest failure
  the package has, in the same output that said every class has CSS.

  **`tailess init --write` no longer writes a config that does not load.** Three ways it
  could, each exiting 0 and printing a plausible diff. A file not beginning with `import` —
  a leading comment is ordinary in a build config — got the `tailess()` call and no import,
  so Vite threw `ReferenceError` and the dev server would not start. A multi-line first
  import, which is what a formatter produces past its print width, had the new import
  spliced _inside_ it, leaving the file unparseable. And `css.postcss.plugins`, a documented
  Vite option that can precede the top-level array, took the Vite plugin instead — leaving
  the project unwired after a success message. Positions are now found in a comment- and
  template-masked copy of the source and spliced by index, the whole first import is matched
  rather than its first line, more than one candidate list is refused outright, and the
  result is read back with `wired()` before anything is written. It also keeps a CRLF file
  on CRLF, and adds no dangling comma to an empty list.

  **`wired()` is no longer fooled by a comment.** `// we removed tailess() from the plugins
array` — the likeliest leftover of exactly the deletion this check exists to catch — made
  `doctor` and `init` call an unwired project wired and exit 0. Quoting `"tailess/postcss"`
  in a comment did the same, with no call required at all. This is the one failure that
  unstyles a whole application with no build error, and all three commands built to catch it
  went green.

  **A flat recipe can no longer extend a slotted one.** It compiled as returning `string`,
  returned an object of parts — `class="[object Object]"`, and `.split()` on it threw — and
  dropped every class the child declared, since a flat value has no part to spread into. The
  type refuses it now; through a cast the runtime stops at the boundary, keeps the child's
  own classes, and says what it ignored.

  **A variant group with numbered options works.** `{ cols: { 1: …, 2: … } }` — a column
  count, a gap or an elevation scale — was unusable: numeric keys leave `keyof O & string`
  empty, so 0.11.0 accepted no value at all and the boolean-variant support added above then
  classified the group as boolean, making `true` type-check and do nothing while `2`, the
  only spelling that worked, was a compile error. Both `2` and `"2"` are accepted now, as
  `true` and `"true"` already were, and for the same reason: the key really is the string.

  **A slotted recipe whose slots are not written inline keeps its classes.** `variants({
slots, … })` with the map hoisted to a const, and `slots: { ...shared, title: … }`, are
  both slotted while their slot _names_ are invisible — and the scanner read them as flat,
  emitting `root:md:p-8`, junk matching no utility, in place of the `md:p-8` the runtime
  builds. Whether option values are per-slot now turns on the presence of the `slots` field,
  never on whether its names could be read.

  **`--json` answers on every exit path.** A crash printed the help text to stderr and
  nothing to stdout, and `emit`'s no-files path printed prose where `check` printed JSON for
  the identical condition — so a job doing `tailess check --json | jq -e .ok` got a parse
  error on exactly the exit code the README calls the one worth an alert. Every path of
  every command now prints one object in one shape, including a throw from the parser. CI
  asserts it.

  **`llms.txt` no longer overstates what the build catches.** It said the plugin reports
  every shape it lists; three of the six — a spread, a computed key, a computed prefix —
  produce no diagnostic at all, and since the scanner enumerates nothing for them there is
  no candidate for `check` to fail on either. It said eleven checks; there are ten. And its
  example of correct nesting, `ss({ hover: on("hover", …) })`, builds `hover:hover:underline`
  — a doubled variant, in the one file written to be copied by a tool. `AGENTS.md` now says
  plainly that a green `check` does not prove those three shapes are styled.

  The bundle budget moves 12,200 -> 13,000 for the two `variants` fixes. While measuring it,
  the note claiming a consumer using only `ss` and `cn` bundles 5,170 characters "unchanged"
  through several earlier raises turned out to be neither — nothing had re-measured it. It
  was 5,344 at that point on the branch, with `vars` (+411) and `variants` (+2,322); the
  release as shipped measures 5,683, `vars` +419 and `variants` +2,920.

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
