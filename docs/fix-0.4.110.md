# 0.4.110 — Glass material and shared online controls

- Replace flat gray Glass fills with clearer surfaces, asymmetric thin highlights and a soft scene from the already decoded artwork. No extra artwork downloads; bounded small scene cache, defer work while navigating; original images stay untouched.
- Both themes keep the Minimal source/audio toolbar placement. Remove repeated Season/Audio sublabels from Glass.
- Seasons are a separate row below that toolbar with no SEASON heading. Up to four seasons remain buttons; five or more use one native selection menu in the same lower row. Preserve provider indices, ordering, selection, focus and Back.
- Portrait mobile episode grid has one full-width episode per row in both themes. Keep explicit horizontal browsing and larger desktop/TV grids.
- Verify Chromium/WebKit mobile, desktop, TV, 1/4/5 seasons, provider callbacks and theme changes. Run build, project checks, then verify published CI and Pages. Physical iPhone must not be claimed tested through WebKit emulation.

Validation before publication: build/ES5 parse passed; 346/346 Node tests and Python 7/7 + 3/3. Final ambience/scene unit checks passed after contrast normalization. Chromium/WebKit appearance checks passed on desktop, TV and portrait mobile, including a real decoded background scene, 1/4/5 seasons, both themes, single-column episodes and 12 languages. Native bright-banner/online Back scenarios passed on all six engine/profile combinations; home navigation and header checks passed. Physical iPhone has not been tested.
