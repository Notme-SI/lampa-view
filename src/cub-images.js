const proxyImage = /^\/cub\/red(\/img\/(?:profiles\/[\w-]+\.png|reactions\/[\w-]+\.svg|icons\/premium_two\.svg))$/i;
const origin = 'https://cub.black';

export default function installCubImages(enabled) {
 const retried = new WeakMap();
 document.addEventListener('error', event => {
  const image = event.target;
  if (!enabled() || !(image instanceof HTMLImageElement)) return;

  const address = new URL(image.currentSrc || image.src, window.location.href);
  const match = address.origin === window.location.origin && proxyImage.exec(address.pathname);
  if (!match || retried.get(image) === match[1]) return;

  // Retry only public static assets. Keep Lampa's load and error handlers.
  retried.set(image, match[1]);
  event.stopImmediatePropagation();
  image.referrerPolicy = 'no-referrer';
  image.src = origin + match[1];
 }, true);
}
