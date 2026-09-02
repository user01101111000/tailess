---
"tailess": minor
---

Report what the scanner can prove wrong while the project builds, instead of waiting
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
