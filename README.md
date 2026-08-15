# SQLite Explorer

A single-HTML SQLite inspection tool that runs entirely in the browser.

- No database upload
- One distributable `dist/index.html`
- Works from `file://`
- Japanese / English UI
- Read-only in v1.0
- Version-pinned `sql.js` embedded at build time

Japanese documentation: [README.ja.md](README.ja.md)

## Features

- Database overview and row-count summary
- Paginated table browser
- CSV / JSON export
- Schema and ER diagram
- Declared foreign keys
- Inferred relationships from column names, types, and sampled value overlap
- Column profiler with NULL / distinct / top-value statistics
- Read-only SQL editor
- `EXPLAIN QUERY PLAN` visualization
- `PRAGMA quick_check`

## Build

Run on Windows 10/11:

```bat
build-standalone.bat
```

The first build downloads the pinned `sql.js` npm package into `.cache/`, embeds the required asset, and produces:

```text
dist/index.html
dist/index.self-extract.html
dist/dependency-manifest.json
```

`src/index.template.html` is the source of truth. Do not edit generated files in `dist/`.

## Offline model

The generated page has a CSP with `connect-src 'none'`. SQLite data and operations stay inside the page at runtime.

See [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md).

## License

MIT. `sql.js` is MIT licensed; SQLite itself is public domain. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
