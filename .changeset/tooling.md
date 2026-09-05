---
"tailess": minor
---

Tooling: `init`, `doctor`, `tailess/build`, and two checks that replace a lint plugin.

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
PostCSS, *first* in the list, because it has to write the candidate list before Tailwind
reads it. It refuses to guess: a config with no `plugins` list it recognises is left
alone, and `doctor` prints the line to add by hand. The diff it shows before writing is a
real LCS diff, because showing a wrong one and then editing someone's build config on the
strength of it is worse than not offering the command.

**`tailess/build` — the scanner, as a library.** Everything here that is not the runtime
rests on one question, *which classes can this source build at runtime?*, and the two
plugins and the binary were the only ways to ask. A webpack or rspack loader, an esbuild
plugin, an Astro or Nuxt module, an editor extension, a lint rule, a company's own CI
script: all of them needed it, and all of them had to reach into `dist/` internals.

```ts
import { collect, buildPrelude, diagnose } from "tailess/build";
```

Node-only, so it is a subpath rather than part of `tailess` itself — the runtime pulls in
no Node types at all, and that stays true.

**A tenth and eleventh build-time check, in place of an ESLint plugin.** The rules worth
having were the ones the type system cannot express, and both are now diagnostics that
need no install, no config, and run in CI for everyone:

- **A bucket the scanner cannot read.** `ss({ md: size })` is perfectly well typed and
  completely unstyled, and it is the package's most common support case. Reported for a
  *prefixed* key only: `base` adds no prefix, so its value passes through and Tailwind
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
