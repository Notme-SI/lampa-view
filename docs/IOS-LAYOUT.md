# iOS Home Screen layout

These changes belong to Lampa View. The plugin overrides host CSS while it is
enabled; it does not edit Lampa or Lampac source files.

The approved reference combines the continuous, artwork-colored top and floating
search of the first screenshot with the full lower content area and lower dock
of the second screenshot. The four touch controls and the artwork proportions
remain the same.

`src/ios-frame.js` measures the CSS canvas (`100lvh`, with a `100vh` fallback).
That height drives the body, native page layers, scroll viewport and navigation
dock together. A smaller `VisualViewport` alone must not shorten the document:
with a translucent system bar it may describe a different rectangle. A focused
text input plus a substantially reduced visual viewport selects the temporary
keyboard frame. Closing the keyboard restores the CSS canvas.

The body width follows the current logical window width, so returning from
landscape cannot leave the content wider than the fixed search and dock.

The override is restricted to enabled mobile iOS Home Screen layouts. The probe,
classes and owned inline variables are removed when it is disabled. Pinch zoom
retains the browser's native positioning. Safe-area padding is reserved once
inside the controls; it is not subtracted from the canvas again.

Browser regression coverage includes mismatched canvas/visual viewport sizes,
native layer updates, keyboard open/close, foreground return, control resizing,
rotation, and both themes. The portrait layout of 0.5.121 was accepted on a real
iPhone running iOS 27.2.1, including the continuous top and the lower dock/content
area. Rotation and keyboard transitions have browser coverage; those transitions
have not yet been confirmed on the physical phone. Browser emulation alone cannot
establish whether the OS permits painting outside its web view.
