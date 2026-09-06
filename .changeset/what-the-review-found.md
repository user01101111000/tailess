---
"tailess": minor
---

Fix eleven defects an adversarial review found in the work above — three of which broke
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
spliced *inside* it, leaving the file unparseable. And `css.postcss.plugins`, a documented
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
both slotted while their slot *names* are invisible — and the scanner read them as flat,
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
is 5,344, measured, along with `vars` (+411) and `variants` (+2,322).
