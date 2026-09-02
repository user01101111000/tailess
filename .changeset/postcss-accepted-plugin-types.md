---
"tailess": patch
---

Make the PostCSS plugin assignable to `AcceptedPlugin` again for consumers using
`exactOptionalPropertyTypes`.

The plugin is typed structurally so tailess needs no dependency on `postcss` — the
host build always supplies it — and that only pays off if the shape really is one
PostCSS accepts. It wasn't, under the strict reading of optional properties: a bare
`from?: string` means "absent, or a string" and refuses a value that may be
*explicitly* `undefined`, which is precisely what PostCSS's own `ResultOptions.from`
is. A typed `postcss.config.ts` with that flag on stopped compiling, while the plugin
kept working perfectly at runtime — so nothing in the suite noticed. The same
oversight was in `CollectOptions`, whose two optional fields receive each plugin's own
optional options verbatim.

`exactOptionalPropertyTypes` is now on for the repo itself, so the strict reading is
what CI checks, and `test/postcss/assignable.test.ts` asserts the plugin extends
`AcceptedPlugin` — the mirror of the Vite suite that already existed. Every public
option was already spelled `| undefined` for exactly this reason; the internal
structural types now match.
