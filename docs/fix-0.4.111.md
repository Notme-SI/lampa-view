# 0.4.111 — Gentle carousel zoom and mobile composition

- User steering: modest magnifying-glass zoom on every device; mobile title logo moves closer to the image. A small crop of the sides is authorized. Keep the top edge anchored to protect heads near the top.
- Desktop and TV reuse part of the gap above the first collection for a taller carousel. Preserve collection card size and full caption/year/watch area, and stable insertion/return/resize geometry.
- Mobile carousel uses image + information in normal document flow, without a fixed empty-height gap. Both themes keep controls and dots separated; a long title/description must not overlap the image or next collection.
- Hide the mobile header settings gear; keep the existing bottom settings navigation working. Desktop/TV retain their gear.
- Preserve 0.4.110 Glass, shared online layout, four-season threshold and one-column portrait episode grid. Build and test before publishing; verify final CI/Pages. No Android display-mode changes or watch-history edits.

Before publication: build/ES5 parse passed; 346/346 Node tests. Chromium/WebKit all-size desktop/TV first-screen checks, both-theme mobile return/slide checks, real banner-height comparison without moving the first row, and mobile bottom-settings navigation passed. Shared online/appearance/language checks passed on desktop, TV and mobile. The unchanged Python server suites passed in 0.4.110 (7/7 + 3/3).
