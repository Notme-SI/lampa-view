# 0.4.107 acceptance criteria

- Carousel title/studio logos survive repeated rotations, memory eviction and returning from a full card; retain canonical metadata instead of expiring blob URLs, pin current branding and retry transient failures.
- Keep bounded image/source caches and original artwork; no catalogue-wide loading.
- Episode descriptions allow five lines and more space before the next grid row in both themes.
- Remove decorative stars next to numeric ratings, including online/torrent banners and episode cards.
- Request episode names/synopses in the selected Lampa language; do not silently substitute an English synopsis when the localized one is absent.
- Build, required tests, CI/Pages and live browser/Philips revisit check; preserve Android display mode and viewing data.

- Native torrent episode files also show catalogue synopsis and numeric rating, retaining file size/extension, Timeline and playback handlers.

Validation: build/ES5 parsing, 340 unit tests and 10 server tests passed. Chromium/WebKit checks passed for artwork cache pressure and logo revisits, online interface, native torrent files including mobile taps/scrolling/playback, watch menus, native torrent playback, themes/languages and banner proxy. Carousel return geometry also passed after the changes.
