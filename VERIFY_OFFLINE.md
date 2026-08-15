# Verify offline behavior

1. Run `build-standalone.bat`.
2. Disconnect the network or use browser DevTools > Network > Offline.
3. Open `dist/index.html` directly with `file://`.
4. Open a SQLite database.
5. Verify Overview, Data, Schema, Analyze and SQL.
6. Confirm the Network panel has no outgoing requests.
7. Confirm write SQL such as `DELETE FROM ...` is blocked before execution.

The generated CSP must include:

```text
connect-src 'none'
```
