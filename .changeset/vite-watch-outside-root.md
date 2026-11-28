---
"tailess": patch
---

`tailess/vite`: a new file in a `content` folder outside Vite's root, such as a monorepo's `packages/ui`, now reaches the stylesheet while the dev server runs.

Vite watches only its own root. Outside it, tailess watched the files it had already scanned one by one, and Tailwind's `@source` registers a glob, which Vite does not watch. So on Linux, a new file in such a folder raised no event. Its classes reached the stylesheet only when something else rebuilt it. Windows reports the new file anyway, which is why it seemed to work there.

The plugin now adds those folders to Vite's watcher.
