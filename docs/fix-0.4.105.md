# 0.4.105: stable TV cards and full-card artwork

- TV hero preview fits complete posters, two title lines and year at all interface sizes; entering the row keeps the expanded card profile and only animates cards.
- Kind and rating stay anchored to poster corners throughout resizing and remote busy periods.
- Full-card backdrop extends underneath cast/facts, fades before the following row, and leaves text legible in both themes.
- Cast/directors retain native credit order, without popularity or episode-count promotion. Portraits keep a high-resolution face crop rather than a full portrait cropped again in CSS.
- Build, unit checks and focused Chromium/WebKit scenarios pass before publishing; verify CI/Pages and actual Philips UI without changing Android display mode or watch data.

- Desktop Small equals the previous Normal; Normal/Bigger use 1.12/1.24. Mobile scale stays separate. First-slide font/layout and native resize completion recalculate geometry without advancing a slide or losing hero scroll position.

Validation: build/ES5 parse passed; 335/335 unit tests; server bootstrap 7/7 and online 3/3. All 26 required browser suites passed across the existing device/theme scenarios, including the new backdrop check and delayed native resize recreation. Physical Philips and published CI/Pages are checked after deployment.
