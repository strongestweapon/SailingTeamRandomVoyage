# Project development and version history

The user explicitly requested internal Git version management for this map tool.
After each meaningful, completed change, run the relevant checks and commit the
changed project files. This standing request authorizes local commits. Keep any
unrelated user edits separate. Do not amend earlier commits without a reason.

On 2026-10-18 the user explicitly authorized publication to
https://github.com/strongestweapon/SailingTeamRandomVoyage.git, with README,
MIT license, .gitignore and development issue tracking. This named repository
is the authorized remote. Preserve the existing history and baseline tag; do not
force-push. Other destinations or changes of repository visibility need a separate request.
The bundled application includes the supplied voyage coordinates and timestamps.

Track development in that repository's GitHub Issues. Reuse existing issues;
record reproduction or acceptance criteria, link relevant commits, and close an
issue only after the work is verified. Identify retrospective completed work as
such. Keep docs/ISSUES.md consistent when adding or resolving tracked work.

Editable app sources are in `work/route-studio/dist/`. Rebuild the standalone
deliverable with `python3 work/build-studio.py`; do not edit only the bundled HTML.
Preserve original GPX files in Dropbox. `.gitignore` intentionally excludes large
source imagery, tile downloads, and exploratory renders; do not force-add them.

On the original macOS workspace, `/usr/bin/git` invokes an Xcode license prompt.
Use the available `/Library/Developer/CommandLineTools/usr/bin/git` there. On other
machines use their installed Git. Do not accept licenses or change system
configuration as a workaround.

See `README.md` and `CONTRIBUTING.md` for layout and validation. Retain the
existing browser-testing restriction: use the local VM/rendering checks; do not
work around blocked browser access using another browser, server, or CDP.
