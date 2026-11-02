# 0.4.106 acceptance criteria

- Carousel artwork stays entirely in frame on desktop, TV and mobile; slide changes and return from a full card do not alter frame/first-row geometry.
- Measure layout independently of native activity entrance/exit transforms; test main → full → Back and an active ancestor animation, in both browser engines.
- Native Settings gear is visible between Search and Profile, opens Settings and is reachable by remote.
- Right from the full-card Watch button reaches the studio; Enter opens its native catalogue and Back restores focus. Studio focus is a glow without a rectangular ring.
- Exclude actors/directors without portraits for every media type, including anime, before roster limits. Keep native billing among the remaining people and reuse a known portrait for duplicate actor/director credits.
- Torrent release order follows the supplied example: season/episodes/quality and size/peers, full title, dubbing/subtitles, video/audio, source/date and Details. Preserve technical data and playback handlers.
- Build, required tests, publication CI/Pages; verify changed remote routes on Philips without changing Android display mode or watch data.

Validation: build and ES5 parsing passed; 336 unit tests, all 27 browser suites (Chromium/WebKit as configured), and 10 server tests passed. The return regression covers an ancestor entrance transform and native main/full/Back/slide navigation; header, studio focus/Back, portrait filtering and torrent order have targeted checks.
