This pinned snapshot reproduces the native small-screen menu served by
`lampac.rest` on 2026-11-15. Unlike the older shared fixture, this host moves the
live Menu DOM into `.menu-modal` inside a native Modal at widths up to 480px.

`snapshot.json` records the source URLs and uncompressed SHA-256 hashes. The
files are gzip-compressed to avoid duplicating several megabytes of fixture
text. `native-browser.cjs` loads them without network access. Lampa's existing
license attribution in `THIRD-PARTY.md` also applies to this runtime snapshot.
