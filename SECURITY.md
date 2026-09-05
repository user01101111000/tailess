# Security

## Reporting a vulnerability

Report privately through GitHub's
[security advisories](https://github.com/user01101111000/tailess/security/advisories/new)
rather than in a public issue. You should hear back within a week.

Please include what an attacker gets and what they need to already have — that is the
part that decides how urgent it is.

## What is in scope

The **build side** is where the risk lives, because it runs on a developer's machine and
in CI, and it reads files:

- `tailess/vite`, `tailess/postcss` and the `tailess` binary read your source files and
  your stylesheets, and follow relative `@import`s up to three levels deep.
- `tailess check` **executes** two things from your project: your Tailwind installation,
  and any `@plugin` or `@config` your stylesheet names. That is what Tailwind's own build
  does, and it is the only way to compile your project honestly — but it means running
  `tailess check` in a repository you do not trust runs that repository's code.
- `tailess init --write` edits a build config file. It shows the edit first, and without
  `--write` it changes nothing.

The **runtime** — `ss`, `cn` and the rest — builds strings. It touches no network, no
file system and no `eval`, and it has one dependency, `tailwind-merge`.

## What is not

- Class names built from unsanitised user input. `ss({ md: userInput })` puts that text
  into a `class` attribute; that is your framework's escaping to do, and the scanner
  [reports it](README.md#build-time-checks) as unreadable anyway.
- Anything Tailwind itself generates. Report that to
  [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss).

## Supply chain

Releases are published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so every version on npm is traceable to the commit and the workflow that built it. The
publishing step is pinned to a commit SHA rather than a moving tag, since it runs with
the npm token in its environment.

## Supported versions

The latest minor. This is a `0.x` package: fixes go into the next release rather than
being backported.
