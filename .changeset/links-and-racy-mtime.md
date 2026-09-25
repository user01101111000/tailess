---
"tailess": patch
---

The scanner follows symlinked and junctioned folders and files, as Tailwind's own scanner
does. A `shared/` folder linked into an app had its literal classes styled by Tailwind and
every tailess-built one unstyled, with `tailess check` green. A link back up the tree ends,
and a folder reached through two links is read once.

A file edited within two seconds of being scanned is read again on the next scan rather
than trusted on its mtime and size. On NTFS most back-to-back rewrites keep the same mtime,
and FAT's resolution is two seconds, so a same-length edit — a formatter, a codemod — kept
the old classes until the dev server restarted.
