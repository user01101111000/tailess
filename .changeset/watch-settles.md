---
"tailess": patch
---

`postcss --watch` and webpack's watch mode settle after an edit. postcss-cli reloads the
config for every rebuild and postcss-loader re-evaluates it per build, so each rebuild got
a fresh plugin, which rewrote the class list even when the file already held it. The
rewrite touched a file Tailwind reports as a dependency, the watcher rebuilt, and did it
again — about 12 rebuilds a second for as long as it ran (the README's object-form config
under postcss-cli; any form under webpack). The file is now written only when its bytes
differ.
