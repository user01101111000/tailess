---
"tailess": patch
---

Fix two build-integration faults that only showed up after the first successful build.

**`extensions` written with a leading dot silently froze the Vite dev watcher.** The scan
normalizes the option (`".tsx"` → `"tsx"`); the plugin built a second set from the raw
option to gate its watcher, and compared it against an already-normalized extension. So
`extensions: [".tsx"]` — or any upper-case spelling — scanned correctly on the first
transform and then matched nothing on every file-system event after it. The build was
right, the dev server was right until you touched anything, and from then on every new
`md:` or `hover:` class had no CSS until the process was restarted. Nothing was logged.
Both paths now go through one exported `normalizeExtensions`, so they cannot drift again.

**A glob in `content` defeated the warning meant to catch exactly that.** A root that is
not a directory is treated as a single file, and `src/**/*.tsx` has a scannable
extension, so the glob itself was recorded as a file that had been read. `files` came
back non-empty with no classes in it — which is precisely the state the "content matched
no files" warning tests for, so the one guard against a mistyped `content` was disabled
by the most likely way of mistyping it. Globs were never expanded; `content` takes
directories and files. A root is now counted only if it really is a file, and when the
warning does fire on a wildcard path it says so, since `content` was glob-shaped in
Tailwind v3 and that is the habit people arrive with.
