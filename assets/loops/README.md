# Background film loops

The **Slideshow** scene plays every clip in this folder, one after another.
Nothing ships here: the encoded `.mp4`/`.jpg` files and `loops.local.js` are
generated on your machine by `tools/loops.py` from your own source videos and
are gitignored — the same rule as the personal scene pack, because this repo
is public and the clips' provenance is yours to assert, not ours.

## Adding your own

1. Put source `.mp4` files in `~/Desktop/Projects/outputs/Videos` (or edit
   `SRC` in `tools/loops.py`).
2. `python3 tools/loops.py probe` — inventories the sources, writes
   `_triage/triage.json` beside them and a begin/middle/end strip per clip.
3. Edit `triage.json` by hand: `keep`, `slug`, `title`, `note`, `tone`
   (`light`/`dark` — drives the chrome), `moods`, `rotate` (0/90/180/270,
   baked in), `focal` (which part survives cropping), `trim`, `loopFade`
   (seconds of self-crossfade for a seamless wrap; 0 for clips that cut
   between shots).
4. `python3 tools/loops.py encode` — writes the loops, posters and
   `loops.local.js` here. Reload the app.

Re-running `probe` never overwrites your edits — clips are matched by
content hash. `python3 tools/loops.py check` verifies the manifest against
the files on disk.

## Licensing — please read

Clips of Studio Ghibli films, and edits of them found on social sites, are
the studio's copyrighted work (and the editor's, such as it is). Keeping
them in a private folder for your own wallpaper is one thing; publishing
them is another. That is why nothing in this folder is committed.
