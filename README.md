# Random Voyage · Map Studio

Local version history for the sailing-video GPX map editor. Open
`outputs/Random-Voyage-Map-Studio.html` to use the app. Usage and map attribution
are in `outputs/사용방법.txt` and `outputs/지도배경_자료출처.txt`.

The baseline includes four backgrounds, high-resolution online satellite imagery,
multiple route selection, transparent overlays, fixed-size map labels, 4K PNG
export, and 100–25,600% zoom. Ten GPX files provide 81 tracks. No remote is configured.
The app and its history include private route coordinates.

## Files

- `work/route-studio/dist/`: editable HTML, CSS, JavaScript, bundled route data and
  offline map imagery. These seven files are the authoritative app sources.
- `work/build-studio.py`: builds the standalone HTML, using only Python's standard
  library. No downloads are needed to rebuild it.
- `work/prepare_data.py`, `work/land-10m.geojson`: optional route-data regeneration;
  the script reads the original GPX files from their existing Dropbox directory.
- `work/build-background-assets.py`: optional offline-imagery regeneration;
  requires Pillow and the original NASA/Natural Earth downloads, excluded from Git.
  The already generated `backgrounds.js` is tracked and sufficient for normal builds.
- `work/qa-backgrounds.cjs`, `work/qa-label-placement.cjs`,
  `work/highres-qa/verify*.cjs`: local regression checks.
- `outputs/`: tracked current app, instructions, source credits and latest Ishigaki
  4K reference image. Other renders remain on disk but are excluded from version history.

## Build and check

Run commands from this directory:

```sh
python3 work/build-studio.py
```

The local checks use the installed Codex Node runtime and Sharp. They do not use
a browser or make network requests. They cover route/image registration, alpha,
background controls, tile-loader failure/abort handling, export snapshots, fonts,
zoom and the bundled output.

```sh
/Users/hojunsong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/qa-backgrounds.cjs
/Users/hojunsong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/qa-label-placement.cjs
/Users/hojunsong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/highres-qa/verify.cjs
/Users/hojunsong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node work/highres-qa/verify-bundle.cjs
```

`work/eox-test-z14.jpg` is a small EOX Sentinel-2 cloudless 2016 test fixture, CC BY
4.0; attribution is recorded in `outputs/지도배경_자료출처.txt`. Downloaded tile caches
and large global raster files are deliberately untracked.

## History

Use `/Library/Developer/CommandLineTools/usr/bin/git` on this machine. The initial
working version is tagged `v1.0.0`. Future completed changes receive separate local
commits. View history with `git log --oneline --decorate` using the Git binary above.
Inspect earlier files with `git show v1.0.0:<path>`; avoid resetting over new work.
Git history here is local version control, not an off-device backup.
