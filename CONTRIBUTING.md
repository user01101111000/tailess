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

- Keep the runtime footprint tiny. tailess ships only `clsx` + `tailwind-merge` — **avoid
  adding new runtime dependencies** unless there is a strong, discussed reason.
- Helpers must be **general-purpose and framework-agnostic** (no React/Vue/etc. coupling).
- Every export must ship **proper TypeScript types**, and custom config keys must stay
  type-safe at the call site.
- Add or update **tests** for every change — the code and its test live in mirrored trees.
- The package must remain **tree-shakeable** (`sideEffects: false`); no top-level side effects.

## 🗂 Project Structure

Source lives in `src/`, tests mirror it in `test/`:

```text
src/
  config/     # config types, defaults, resolve, defineConfig
  core/       # createTailess factory
  utils/      # cn, ss, responsive, range, on, attrs, match, prefix
  internal/   # env / internal helpers (not exported)
  index.ts    # public entry — re-exports the public API

test/
  core/       # mirrors src/core
  utils/      # mirrors src/utils
```

When you add a new util at `src/utils/foo.ts`, add its test at `test/utils/foo.test.ts`
and export it from `src/index.ts` if it is part of the public API.

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
npm test            # Vitest
npm run build       # tsup: ESM + CJS + d.ts
```

Handy extras: `npm run lint:fix` (auto-fix formatting), `npm run test:coverage`,
`npm run test:watch`.

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

## 📝 Commit Messages

We recommend [Conventional Commits](https://www.conventionalcommits.org/) for readable
history, e.g. `feat: add until() helper`, `fix: stop ss() warning on falsy values`,
`docs: clarify match() fallback`. Note that — unlike some setups — the commit message does
**not** decide the version bump here; your **changeset** does.

## Final Note

Your involvement is highly appreciated! The more people contribute, the more powerful and
useful this toolkit becomes. Let's build something reliable and reusable for all of us. 🚀
