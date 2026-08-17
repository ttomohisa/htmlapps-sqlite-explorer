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

## Self-extracting variant

Open `dist/index.self-extract.html` directly and confirm that:

- the Japanese loader text is readable rather than mojibake;
- the favicon matches `dist/index.html`;
- the loader disappears and the SQLite Explorer opens normally;
- the browser console contains no decompression or CSP errors.

`scripts/verify-self-extract.ps1` also enforces an ASCII-only loader, embedded favicon inheritance, and byte-for-byte restoration of `dist/index.html`.
