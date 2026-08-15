# AGENTS.md

This repository follows the conventions of `ttomohisa/htmlapps-template`.

## Read first
1. `APP_SPEC.md`
2. `app.config.json`
3. `dependencies.json`
4. `src/index.template.html`

## Source of truth
Edit `src/index.template.html`. Never hand-edit generated `dist/index.html`.

## Build
Use `build-standalone.bat` or `build-standalone.ps1`.
The build downloads only pinned dependencies, embeds them into the HTML, writes a dependency manifest, verifies the standalone contract, and optionally creates the self-extracting HTML.

## Runtime privacy
Do not add runtime `fetch`, XHR, WebSocket, EventSource, remote fonts, analytics, trackers, CDN scripts, remote images, or telemetry.
Keep `connect-src 'none'`.

## SQLite safety
v1.0 is read-only.
Do not add mutation SQL, database write-back, or autosave without changing `APP_SPEC.md` first.
Any inferred relationship must be clearly labelled as inferred.

## UI
Keep the visual language aligned with the template:
- light theme only
- restrained green accent
- no decorative hero slogan
- backgroundless EN/JA and help controls
- compact desktop layout
- native-feeling mobile bottom navigation

## Handoff
When changing the app:
- summarize user-visible changes
- state whether the build contract changed
- state any dependency version change
- state verification performed
