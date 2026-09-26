---
"tailess": patch
---

The documented CI gate is `npx tailess check --strict`, and the example's `npm run check`
is that command.

The README gave `- run: npx tailess check` as the gate and the example's `verify` script
ran `tailess check --content src`; both exit 0 with the plugin deleted from the config,
because the check compiles the stylesheet with the candidates the plugin *would* inject
and only warns that no config calls it. CI's negative test passed `--strict`, so it proved
a different command from the one the docs tell people to run. The README now says why
`--strict` is the CI setting, the example script uses it, and CI runs the script itself.
