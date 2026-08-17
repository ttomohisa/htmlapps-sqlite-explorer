# APP_SPEC.md

## Product
SQLite Explorer v1.0

## Goal
A privacy-friendly single-HTML app that lets a user open an unfamiliar SQLite database and quickly understand its structure and data without uploading it.

## Non-negotiable constraints
- `src/index.template.html` is the source of truth.
- Release artifact is `dist/index.html`.
- Runtime network access is blocked.
- Must work from `file://` and static hosting.
- Japanese and English live in the same HTML.
- No dark mode.
- v1.0 is read-only and never writes back to the source database.
- Third-party dependencies are pinned and embedded by the build.
- The self-extract loader is ASCII-only, inherits the embedded favicon from `dist/index.html`, and restores the standalone HTML byte-for-byte.

## v1.0 scope
1. Database Overview
2. Paginated table browser
3. Schema / DDL viewer
4. ER diagram
5. Declared foreign keys
6. Relationship inference
7. Column profiler
8. Read-only SQL editor
9. EXPLAIN QUERY PLAN
10. CSV / JSON export
11. PRAGMA quick_check

## Relationship inference
Only candidates that look like foreign-key columns are evaluated.
Confidence combines:
- column/table naming match
- SQLite affinity compatibility
- sampled value overlap

Declared foreign keys are solid lines; inferred relationships are dashed lines.
Inference is advisory and must never be presented as guaranteed truth.

## Read-only SQL
Allow:
- SELECT
- WITH
- EXPLAIN
- explicitly whitelisted read-only PRAGMA statements

Block all other statements.

## Mobile UX
Below 820px:
- no shrunken desktop sidebar
- bottom navigation for Overview / Data / Schema / Analyze / SQL
- file information appears in a compact mobile bar
- primary actions remain touch-friendly

## Acceptance criteria
- Template placeholders each occur exactly once.
- CSP contains `connect-src 'none'`.
- No external runtime script/style URLs.
- Opening a valid SQLite file populates Overview.
- Table data pages without loading the entire table into DOM.
- Relationship inference does not replace declared FK data.
- Write SQL is rejected before execution.
- Language switch updates visible navigation/help text.
- `dist/index.self-extract.html` has readable loader text, the same embedded favicon as `dist/index.html`, and restores `dist/index.html` byte-for-byte.
