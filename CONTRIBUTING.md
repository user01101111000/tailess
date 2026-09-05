# Contributing to tailess

Thanks for your interest in improving **tailess**! 🎉
This package is open for contributions from everyone. If you want to add new helpers,
improve types, fix bugs, or sharpen the docs, please follow the guidelines below so we
keep the toolkit small, type-safe, and stable.

## 🔧 What You Can Contribute

You may contribute:

- New class-composition helpers (in the spirit of `ss`, `responsive`, `on`, `match`…)
- Improvements to existing helpers or their TypeScript types
- Bug fixes
- Additional tests and edge-case coverage
- Documentation updates (README, JSDoc, this guide)

### Important Requirements

- Keep the runtime footprint tiny. tailess has exactly one runtime dependency,
  `tailwind-merge` — **avoid adding another** unless there is a strong, discussed reason.
  (`clsx` is vendored as `src/internal/join.ts` rather than depended on.)
- Helpers must be **general-purpose and framework-agnostic** (no React/Vue/etc. coupling).
- Every export must ship **proper TypeScript types**, and custom config keys must stay
  type-safe at the call site.
- Add or update **tests** for every change — the code and its test live in mirrored trees.
- Every module must stay **side-effect free** so it tree-shakes. `sideEffects` lists only
  `./dist/cli.js`, which is the binary and calls `main()`; nothing else may.

## 🗂 Project Structure

Source lives in `src/`, tests mirror it in `test/`:

```text
src/
  utils/        # the runtime helpers — ss, cn, on, has, nth, variants, vars…
  extract/      # the scanner: scan.ts tokenises, extract.ts enumerates candidates,
                # diagnose.ts proves what cannot work, collect.ts walks the files
  integration/  # inject.ts writes the @source inline(…) prelude, theme.ts reads
                # @theme / @custom-variant, entry.ts finds the Tailwind entry,
                # sidecar.ts and report.ts serve the plugins
  check/        # the `tailess` binary: run.ts drives it, verify.ts is the comparison
  internal/     # shared, not exported — escaping, lookup, env, selector
  vite/         # the Vite plugin
  postcss/      # the PostCSS plugin
  constants.ts  # the 305 keys and the breakpoint table
  types.ts      # the public types
  index.ts      # public entry — re-exports the public API
  cli.ts        # argv in, exit code out; everything else lives in check/run.ts
```

`test/` mirrors it directory for directory. The one thing worth knowing about the shape:
`utils/` is what runs in the browser, and everything else runs in the build. They meet at
one invariant, which the next section is about.

## ⛓ The one invariant

**Every class the runtime can build must be a candidate the scanner enumerates.**

The runtime writes `md:p-4` at render time; Tailwind never sees that in your source, so
the scanner has to predict it and hand it over via `@source inline(…)`. When the two
disagree the class still lands on the element — with no rule behind it. No console error,
no build error, nothing: the styles just do not apply. That is the failure this whole
package exists to prevent, and it is why the checklists below are not optional.

`test/extract/runtime-parity.test.ts` is the file that holds the two halves together.
Every helper has a case there that calls the runtime and the scanner on the same source
and asserts they agree.

### Adding a helper

A helper touches seven places. Miss the second one and everything is green while every
class it builds is unstyled.

1. `src/utils/<name>.ts` — the helper, with `@example` JSDoc.
2. `src/extract/scan.ts` — add its name to `helperNames`. **The scanner finds calls by
   identifier; without this it does not exist.**
3. `src/extract/extract.ts` — a `case` in `enumerate()` that builds the same class the
   runtime does, from the source text.
4. `src/extract/diagnose.ts` — a `case` in `check()` if any argument can be proven wrong
   (a dead class, an unusable arbitrary value).
5. `test/extract/runtime-parity.test.ts` — a case pinning that 2 and 3 agree with 1.
6. `src/index.ts` — the export, plus its types.
7. `README.md` — the API section, and the two editor lists in *Sorting classes* and
   *Editor setup*. Add it to the prettier `tailwindFunctions` list **only** if every one
   of its string arguments is a class list; the plugin sorts all of them, and sorting a
   selector rewrites it.

### Adding a key

1. `src/constants.ts` — the key, in the family it belongs to.
2. `test/constants.test.ts` — it is verified against the real Tailwind compiler there, so
   a key that does not compile fails rather than shipping.
3. `README.md` — the Keys table, its per-family count, the total in three places, and the
   badge at the top. All hand-maintained today.

## 🛠 How to Contribute

1. **Fork** the project and clone your fork.
2. Install dependencies: `npm install`.
3. Create a new branch from `main` (e.g. `feat/until-helper` or `fix/ss-warning`).
4. Add your helper/fix following the existing structure, **with tests**.
5. Run the full check suite locally (see below) and make sure it is green.
6. **Add a changeset**: `npm run changeset` — pick the bump type and write a short summary
   (this is how the release is versioned; see [Versioning & Releases](#-versioning--releases)).
7. Open a **Pull Request** against `main`.
8. PRs are merged with **Squash and Merge**.
9. After approval and merge, the release is published automatically by CI via changesets.

## ✅ Before You Open a PR

Run these locally — CI runs the exact same steps and must pass:

```sh
npm run lint        # Biome: lint + format check
npm run typecheck   # tsc --noEmit (checks src and test)
npm run build       # tsup: ESM + CJS + d.ts — before the tests, see below
npm test            # Vitest
```

**Build before you test.** `test/integration/plugin-shape.test.ts` asserts on `dist/` and
skips itself when there is none, so running the suite first leaves the check guarding the
string-named PostCSS entry green by never executing. CI builds first for the same reason,
and that suite now fails loudly rather than skipping when it finds no build there.

Handy extras: `npm run lint:fix` (auto-fix formatting), `npm run test:coverage`,
`npm run test:watch`, and `node dist/cli.js check --content src` to run the gate against
this repo itself.

## 🧭 What counts as stable

tailess is `0.x`, so semver's own answer is "nothing" — which is not useful. What the
project actually promises:

| Surface | Promise |
| --- | --- |
| The runtime helpers and their signatures | A breaking change is a **minor**, called out at the top of the changeset with the line to change. |
| The key set | Keys are only ever **added**. One is removed only if Tailwind removes the variant. |
| `tailess/vite`, `tailess/postcss` and their options | Same as the helpers. The plugin's *shape* — a default export that is the creator itself — never changes; a named export there breaks every string-named PostCSS config. |
| `tailess check` exit codes | `0`, `1` and `2` mean what the README says and will not be renumbered. New failures reuse the existing three. |
| `tailess/build` | Newer and narrower. Expect it to grow; anything removed gets a minor and a note. |
| Anything reachable only through `dist/` internals | Not a surface. It may change in a patch. |

**Deprecation.** A helper on the way out keeps working for at least one minor, with a
dev-time warning naming its replacement, before it is removed.

**Tailwind.** `tailwindcss` is a peer dependency at `^4.0.0`. A weekly CI job runs the
whole suite against the *latest* Tailwind rather than the pinned one, because the 305
keys are a contract with Tailwind's variant registry and a change there would otherwise
reach a consumer before it reached us.

**Node.** `engines` says what is tested, not the lowest that happens to work — the floor
tracks what a Tailwind v4 toolchain already requires. CI loads the built package on
exactly that version.

## 📦 Versioning & Releases

tailess uses [**Changesets**](https://github.com/changesets/changesets), **not** commit
messages, to drive versioning. Every PR that changes published behavior must include a
changeset:

```sh
npm run changeset
```

Pick the bump type when prompted:

- **patch** — bug fixes, internal changes with no API impact
- **minor** — new helpers or backwards-compatible features
- **major** — breaking changes to the public API

This creates a small markdown file under `.changeset/`. Commit it with your PR. On merge to
`main`, Changesets opens a release PR (or publishes to npm), bumps the version, and updates
`CHANGELOG.md` automatically.

> **Do not edit `CHANGELOG.md` by hand** — it is generated from your changesets.

Docs-only or tooling-only PRs that don't affect the published package don't need a changeset.

### Trying a release before it is one

An npm version cannot be unpublished, so anything large goes out on a tag first:

```sh
npx changeset pre enter next   # subsequent releases publish as 0.x.y-next.N under `next`
npx changeset pre exit         # back to `latest`
```

Install it with `npm i tailess@next`. Use it for a change big enough that you want it in
a real project before it reaches everyone — the slots work, or anything touching the
scanner.

**Check the version before merging a release PR.** `changeset version` computes the next
number from `package.json`, not from npm, so a branch that is behind `main` will compute
one that is already published and the release fails at `npm publish`. `git merge main`
first.

## 📝 Commit Messages

We recommend [Conventional Commits](https://www.conventionalcommits.org/) for readable
history, e.g. `feat: add until() helper`, `fix: stop ss() warning on falsy values`,
`docs: clarify match() fallback`. Note that — unlike some setups — the commit message does
**not** decide the version bump here; your **changeset** does.

## Final Note

Your involvement is highly appreciated! The more people contribute, the more powerful and
useful this toolkit becomes. Let's build something reliable and reusable for all of us. 🚀
