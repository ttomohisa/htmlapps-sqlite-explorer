# Changelog

## 1.1.0 - 2026-08-25
- Added database-wide value search.
- Added table filtering, sortable columns, column visibility controls, and resizable headers.
- Added Smart Cell Inspector with JSON/date/URL/UUID/Base64/BLOB detection and image previews.
- Added Record Relationship Explorer for declared and inferred relationships.
- Added Database Health score with structural checks, `quick_check`, and `foreign_key_check`.
- Added ER diagram focus mode and lightweight database fingerprinting.

## Unreleased

- Gzip-compressed the embedded `sql-asm.js` payload and removed the outer Base64 layer around the asset bundle, reducing standalone HTML size without changing the UI or offline behavior.
- Added compatibility fallbacks for Windows PowerShell environments without `Get-FileHash` and `::new()` constructor syntax.
- Hardened the self-extract loader against Windows PowerShell 5.1 encoding corruption, inherited the standalone favicon, and added regression verification.
- Reworked the Overview table ranking into a denser Table scale summary with row, column, index, foreign-key, and primary-key status.
- Added direct navigation from Overview table rows to the Data Explorer and a View all tables action.

## 1.0 - 2026-08-15

- Initial SQLite Explorer implementation.
- Added Database Overview.
- Added table browsing and CSV/JSON export.
- Added schema/DDL and ER diagram.
- Added declared and inferred relationships.
- Added column profiler.
- Added read-only SQL and query-plan view.
- Added bilingual and mobile-first navigation.
- Added template-compatible standalone/self-extract build.
