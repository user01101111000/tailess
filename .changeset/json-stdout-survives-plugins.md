---
"tailess": patch
---

`tailess check --json` prints one JSON object on stdout even when a Tailwind plugin prints
while it loads.

Compiling runs the project's `@plugin`s inside the CLI, and daisyUI 5 prints its banner
with `console.log` — so on every daisyUI project stdout was the banner and then the JSON,
and `tailess check --json | jq -e .ok` failed to parse on a passing run. Under `--json`,
anything a plugin prints now goes to stderr while the stylesheets compile.
