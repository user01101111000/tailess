---
"tailess": minor
---

`tailess emit`, a gate you can point at your build, and an app that proves both.

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
on a `@theme` that moved a breakpoint the list *is* the project), and `--version` exists.

**A real app, in `examples/vite-react`.** Vite, React, every helper, every class built at
runtime. Two things about it matter more than being a demo. It is the only place a real
Vite build runs anywhere in this repo — everything else calls the plugin's hooks directly,
which cannot catch a plugin shaped wrong for its host. And CI asserts the *negative*:
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
and no unknown-class warning, which was the only thing catching a typo *inside* a class
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
"is the plugin wired up" check now requires the plugin to be *called* — a leftover import
after a deleted `tailess()` is exactly the case it exists to catch, and reading for the
word alone called that wired.
