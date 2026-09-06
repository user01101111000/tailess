---
"tailess": minor
---

Close the remaining thirty-three findings from the same adversarial review — the ones
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

**Half of what a consumer installs is gone.** Sourcemaps were 66% of the tarball, and
581 kB of that was the scanner's source inlined three times into CJS maps nothing can
debug — the argument `tsup.config.ts` already makes for the CLI's map, applied where it
is worth more. Packed 421,892 → 197,121 bytes. `*.tgz` is ignored, so hand-verifying a
release cannot leave a binary blob one `git add -A` from being in history.

**The release waits for CI.** It published on push to `main` while CI ran beside it,
re-verifying a strict subset — not the platform matrix, not the `engines` floor, not the
example, not Next.js, which are the three things CI's own comment says no unit test
reaches. An npm version cannot be unpublished. The `gate must fail` step also accepted
*any* non-zero exit as proof, where `check` has two failure codes. Both read-only
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
