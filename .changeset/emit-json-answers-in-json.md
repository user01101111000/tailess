---
"tailess": patch
---

`emit --out <file> --json` answers in JSON on stdout, and says when the file it wrote is
not a stylesheet.

It was the one `--json` path in the binary that printed prose, so
`tailess emit --content src --out dist/list.json --json | jq -e .ok` failed to parse on a
run that exited 0 — which reads as a broken pipeline rather than a pass. Stdout now
carries an acknowledgement object; the file still holds the candidate list itself, which
is what `--json` asks for.

The reason that distinction is worth a line rather than a footnote: `--json` changes what
`emit` *produces*, not just how it prints. A file named `.css` holding the candidate list,
imported into a stylesheet, enumerates nothing — every runtime-built class reaches the
element with no rule behind it, silently, which is the failure this package exists to
prevent. Pointing `--out` at a `.css` path under `--json` now says so on stderr, where it
cannot break the JSON on stdout. `--help` says plainly that `--json` changes the output
rather than only its format.

Found by installing the published package from npm and driving the binary as a consumer
would, rather than by calling `check/run.ts` directly.

Also: `CHANGELOG.md` is included in the published package. `files: ["dist"]` excluded it
and npm 7 dropped it from the always-included set, so the tarball carried no release notes
and the README's own `[Changelog](./CHANGELOG.md)` link pointed at nothing inside
`node_modules`.
