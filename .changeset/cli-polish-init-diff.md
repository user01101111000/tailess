---
"tailess": patch
---

Smaller fixes to the CLI:

- `tailess init` shows its diff in time proportional to the change. The old diff built a
  table the square of the file's length: 6.7 s on a 10,000-line config, and out of memory
  at 30,000 — where `--json` printed nothing at all.
- The line `init` adds matches the file: its indent, one entry per line in a list written
  that way, its quote style, and no semicolon in a file without them.
- `tailess check src` says "unexpected argument src — for a directory, --content src"
  rather than "unknown command src", and `doctor doctor` no longer rejects a word in the
  list it prints.
- A flag on a command it does nothing for is an error: `init --content apps/web` wrote the
  current directory's config, and `doctor --strict` was the same doctor.
- `--help --json` and `--version --json` print one JSON object.
