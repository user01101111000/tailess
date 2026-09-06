---
"tailess": minor
---

Close the gaps that let a broken build pass — and the one that broke a working one.

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
compiling *cannot* find, since a class carrying an unusable value never reaches Tailwind
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
and the plugin sorts *every* string argument of a listed function — but the first argument
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
