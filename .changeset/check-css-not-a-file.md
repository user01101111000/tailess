---
"tailess": patch
---

`tailess check --css` naming a file that does not exist, or a folder, says so and exits 2
with `"error": "no-stylesheet"`; it printed Node's raw `ENOENT`/`EISDIR` under
`"error": "crashed"`. The `stylesheet` of an `unsupported-prefix` result and the `out` of
`emit --out --json` use forward slashes on every OS, like the other JSON paths. `--help`
lists a Tailwind `prefix()` among the reasons for exit 2.
