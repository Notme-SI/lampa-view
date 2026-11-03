# 0.5.0 — Follow-up acceptance criteria

- Mobile hero: soften the lower artwork edge only in Minimal; centre Glass title/logo inside the fixed slot. Button, dots and first row must not jump between slides.
- Settings: Lampa View precedes Account; a separate noninteractive version row at the bottom displays 0.5 and is localised in all 12 languages.
- Home studios: pointer/touch/Enter open the native studio catalogue on desktop/mobile, with its heading logo; TV home studios stay decorative. Right/Down hero navigation remains unchanged.
- Glass: person header, comments, reactions and torrent banner metadata use the shared translucent material. Minimal stays unchanged. No live blur per comment/reaction.
- Torrent episode files: Online list proportions, vertically centred thumbnail, title, rating/date without separator dots, progress and synopsis; preserve size/extension, native actions, playback and playlist.
- iPhone: host lacks viewport-fit=cover and Apple standalone/status-bar metadata. Plugin CSS cannot guarantee extending the installed viewport under the status bar. Host/PWA work and physical validation remain.
- Thin vertical line in the mobile logo pane was not reproduced in Chromium; the original PNG contains no white edge. Physical iPhone verification remains; do not claim resolved.
- Build, mandatory checks, targeted Chromium/WebKit regressions, latest CI and Pages hash. Physical TV/iPhone not tested for this release.

- Glass search retains a stronger dark tint; only menu highlight transparency changes to match settings.

- Rename the Minimal theme label to Original using the existing 12-language message. Preserve its stored key `minimal` and current selection.
