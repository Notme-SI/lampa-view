# 0.4.112 — Stable mobile carousel information panel

- Reserve separate mobile slots for branding, metadata and three synopsis lines in both themes. Short/wide/tall logos, fallback titles, translations and absent/short/long descriptions must not move the button, dots or first collection.
- Preserve logo aspect ratios and the 6% artwork zoom. Add a modest consistent image-to-branding gap, including Minimal, without restoring the old large blank area.
- Test actual geometry before/after content changes and asynchronous logo load in Chromium/WebKit, both themes and narrow/wide portrait viewports. Preserve desktop/TV first-screen fitting and existing return navigation.
- Run build and mandatory checks, publish the stable URL, verify final CI and Pages. Do not claim physical iPhone testing.

- Latest desktop reference: enlarge the actual carousel by using up to 8vh of the unfocused watch-footer reserve, keeping whole posters, names and years visible. Native card focus must scroll its entire watch footer into view. Increase desktop artwork magnification to 12%; retain mobile/TV at 6%, top anchored. Preserve return/resize geometry and TV layout.
