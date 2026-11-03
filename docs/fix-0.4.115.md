# 0.4.115 — Larger episode previews in list view

- Increase list episode frames from 10.5em to 12em wide, preserving 16:9. Mobile uses a bounded 100–136px column; keep room for title/summary and prevent overflow. Both themes share the layout.
- Remove the bullet between episode rating and air date in both initial and canonical-metadata rendering. Use flex spacing so text cannot concatenate.
- Upstream check: TMDB TV 247718, S2E7 (7492644), aired 2026-10-30. Its Russian overview is empty; English is present. Preserve the requested interface-language-only descriptions instead of inventing or hardcoding a synopsis.
- Preserve stable mobile panels, enlarged desktop hero, softer Minimal blending, responsive reset and clearer glossy Glass from 0.4.112–114.
- Build, mandatory tests, online layout/focus checks, latest CI, Pages hash and real UI verification. No physical iPhone test claims.

- Remove the inert source-audio placeholder when no native voice group is offered, including Russian originals. Preserve asynchronously arriving real voice groups and their native selection callbacks without source reload or autoplay.
