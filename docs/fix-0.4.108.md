# 0.4.108 acceptance criteria

- Studio/network click opens its native catalogue with a studio logo above the results; preserve native route, pagination and Back focus.
- Full-card description has exactly one focus border; mouse parked over it, moving to cast and returning from its dialog leave no active or residual border.
- Filter actions have semantic classes, never positional styling; selected value and keyboard focus are distinct, all options align, defaults are selected correctly.
- Add quality-descending ordering of the current results page from explicit release data or the existing bounded quality cache. Unknown quality stays last; no extra provider/catalogue scans or invented resolution.
- Build, required tests, CI/Pages and targeted live browser/Philips checks, preserving system mode and watch data.

- TV home transitions batch geometry reads before animation writes, skip initial/offscreen animations, reuse unchanged rail geometry, and allow bounded near-viewport poster prefetch during remote movement.

Validation before publication: build and ES5 checks passed; 341 Node tests and 10 Python checks passed. Chromium/WebKit coverage includes catalogue controls, pixel comparison after description blur, quality ordering, carousel return, artwork cache, home stage, interface size and complete poster rails. Physical Philips comparison uses the unchanged Android display mode; final published-build checks are recorded separately.

- Reproduced next-screen blank posters during real browser scrolling. Extend bounded look-ahead to roughly one screen, continue it during wheel navigation, with one background request in motion or two at idle. Cover this with desktop/TV unit scenarios and Chromium/WebKit delayed native visibility checks.

- Late plugin startup decorates and tracks an already built native main page once, without reloading its catalogue. Cover the real initial-load ordering before plugin insertion.
