---
"tailess": patch
---

`tailess check`, `emit`, `doctor` and `init` write paths with forward slashes in `--json`
on every OS, as the documented contract shows; a Windows runner wrote `src\Card.tsx`. An
empty value for `--content`, `--css`, `--out`, `--extensions` or `--ignore` — what an unset
shell variable expands to — is now a usage error (exit 2) instead of silently scanning the
whole working directory or auto-detecting the stylesheet. `emit` names an unexpanded
wildcard the way `check` already did. The scanner no longer reads a TypeScript object type
(`{ … } as { md: string }`, `(x: { md: string }) => …`) as a bucket map and warns about its
`string`.
