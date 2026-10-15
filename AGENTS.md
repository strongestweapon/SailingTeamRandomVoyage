# Local version history

The user explicitly requested internal Git version management for this map tool.
After each meaningful, completed change, run the relevant checks and commit the
changed project files. This standing request authorizes local commits. Keep any
unrelated user edits separate. Do not amend earlier commits without a reason.

Keep this repository local. Publishing, pushing, or adding a remote requires a
separate user request. The bundled application contains private GPX coordinates.

Editable app sources are in `work/route-studio/dist/`. Rebuild the standalone
deliverable with `python3 work/build-studio.py`; do not edit only the bundled HTML.
Preserve original GPX files in Dropbox. `.gitignore` intentionally excludes large
source imagery, tile downloads, and exploratory renders; do not force-add them.

The system `/usr/bin/git` currently invokes an Xcode license prompt. Use the
already available `/Library/Developer/CommandLineTools/usr/bin/git` for Git
operations here. Do not accept licenses or change system configuration.

See `README.md` for the repository layout and validation commands. Retain the
existing browser-testing restriction: use the local VM/rendering checks; do not
work around blocked browser access using another browser, server, or CDP.
