---
"tailess": minor
---

Fix silent class loss in markup files, complete the variant list, and roughly halve
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
