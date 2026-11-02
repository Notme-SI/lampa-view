# 0.4.109 — Glass / iOS 27 direction

- Replace the existing Glass material sheet; Minimal remains unchanged and remains the default.
- Distinct floating navigation, luminous neutral glass edges, translucent grouped surfaces and capsule controls across home, detail, online, torrents, search and settings. No fixed blue tint, no duplicated movie information in online.
- Remove opaque app/wrap underlays only in Glass; derive a quiet two-color ambience from already loaded artwork, without extra image requests, image processing pipelines or catalogue scans.
- Bound ambience samples/cache, defer them while navigating, and avoid blur on posters and repeated torrent/episode cards. Keep TV blur on small navigation/overlay surfaces only.
- Preserve native focus, Back, touch targets, languages, current image queues/cache, Timeline and Android display mode.
- Verify real Chromium/WebKit desktop, TV and mobile layouts, theme switching, reduced motion/transparency, native navigation and live Philips appearance/performance. Run project checks before publishing; check final CI and Pages.

References: https://www.apple.com/os/ios/ and https://support.apple.com/en-ie/guide/iphone/iphfed2c4091/27/ios/27

Before-publication validation: build and ES5 parsing passed; 345/345 Node tests, Python 7/7 + 3/3. Chromium/WebKit theme, language and online checks pass at desktop/TV/mobile sizes; both themes pass native home navigation and all three interface sizes. Header focus and native settings entry pass with a single neutral Glass border. Physical published-theme inspection and current CI/Pages results are recorded separately.
