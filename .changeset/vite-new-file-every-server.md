---
"tailess": patch
---

`tailess/vite`: a class in a newly created file now reaches every Vite server's stylesheet.
Nuxt is where this broke.

Nuxt runs a client and an SSR Vite server off one plugin instance, and a CSS transform
refreshes the class list too. Under Nuxt 4, the transform wrote the new list to the shared
sidecar before either watcher's refresh ran. Both watchers then found it already written
and re-emitted nothing. The browser's stylesheet kept the old list, so a class in a file
nothing imports yet stayed unstyled until the dev server restarted. An edit to an imported
file was not affected, because Tailwind sees that module itself.

Each server now remembers the list it last told its stylesheet about, and re-emits the
stylesheet whenever the list differs, whoever wrote the file. Under Nuxt 4 the new-file
case had failed 5 runs of 6, on Node 22 and on Node 26; it now passes 6 of 6.

This was found by the new framework examples in `examples/` — SvelteKit, Nuxt, React Router
and Astro — which CI now builds, gates and edits under a live dev server on every push and
every week.
