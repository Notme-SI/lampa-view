# 0.4.104 — presentation rebuild

Scope: rebuild the presentation layer without replacing native playback, Timeline, synchronization or providers.

Acceptance:
- Glass uses neutral translucent surfaces, restrained borders and a centered content column.
- Portrait mobile Glass shows one large episode per row with readable title/overview; no duplicated film synopsis.
- Source, view, season and audio controls follow a compact two-row layout and preserve native callbacks and indices.
- TV Small starts at the old Bigger size; Normal and Bigger visibly increase posters, episode frames and text in both themes.
- Badges use real readable font sizes instead of stacked CSS/JS scaling; long release pills fit their background.
- Existing viewing data is preserved. Desktop, remote focus, mobile touch and all native interface sizes pass checks.
- Build, mandatory tests, CI and Pages pass before completion. Physical TV validation is reported separately; do not interrupt playback or change Android resolution.

Implementation is limited to presentation modules and focused native-runtime checks. Remove superseded presentation rules while consolidating their replacements.

Confirmed root cause: interfaceSize initialized before device detection; Auto mode could keep desktop scale on a real TV. Initialize layout first and update the shared profile when detection changes. Removed fixed .72 JS scaling combined with CSS .85 scaling of badges.

Additional accepted scope: seamless artwork reuse and informative torrent releases.
- Saved source index restores disk-cached images outside the network queue; decoded hero eviction can reuse ready compressed bytes directly.
- Visible posters start during navigation (four TV / six other requests); prefetch remains idle-only and bounded.
- Keep an existing cover during quality changes; cached DOM mounts do not replay opacity fades.
- Release names are readable above the summary, rather than buried in the small source/date footer. Keep codec, HDR, audio, size, peers and native full details; show exact dimensions when available.

Local verification: build and ES5 parse pass; all 25 mandatory browser suites pass in Chromium/WebKit (affected suites rerun after final changes); Python bootstrap 7/7 and online 3/3 pass. The full unit run passed 333 tests and caught one obsolete expectation that visible covers must wait for remote idle; updated it to the requested immediate visible loading, preserving offscreen/cancellation assertions, and both TV performance tests pass. CI will rerun the complete 334-test suite unchanged in scope.
Physical Philips validation was deliberately not performed during the user's playback. Android render mode remains unchanged.
