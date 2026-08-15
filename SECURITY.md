# Security

SQLite Explorer is designed to process user databases locally.

- Runtime network connections are blocked by CSP.
- v1.0 does not execute write SQL.
- The original database is not written back.
- Do not report sensitive database contents in public issues.

For dependency updates, keep versions pinned in `dependencies.json` and inspect the generated dependency manifest before release.
