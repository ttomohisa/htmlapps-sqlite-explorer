# Contributing

Please read `AGENTS.md` and `APP_SPEC.md`.

- Make changes in `src/index.template.html`.
- Preserve no-runtime-network behavior.
- Keep v1.1.0 read-only.
- Test Japanese and English.
- Test desktop and mobile widths.
- Run `scripts\check-repository.ps1` and the standalone build before submitting changes.

Repository validation also requires Node.js 22 or later for the built-in test
runner (no npm packages). `node --test scripts/test-query-results.cjs` runs the
ordinary result-rendering and replacement regressions against the source.
The repository check repeats them against the built standalone HTML and the
root `sqlite-explorer.html`, checking application-source parity. When changing
the app, rebuild and copy `dist/index.html` to `sqlite-explorer.html` before the
final check. The standalone builder itself still works without Node.js.

These tests use fictitious values and IO doubles, not a real database or browser.
They do not replace manual browser checks of the file picker, desktop/mobile
layout, or the embedded SQLite runtime.
