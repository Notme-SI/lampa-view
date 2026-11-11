import {officialBanner} from './artwork.js';

const catalogue = new Set(['movie', 'tv', 'anime', 'cartoon', 'tvshow']);
const playback = new Set(['alc_auto_view', 'lampac', 'online', 'torrents']);
const isProject = activity => activity.component === 'actor' || activity.component === 'company' ||
 (activity.component === 'category_full' && (activity.companies || activity.networks));

function imageColor(image) {
 const canvas = document.createElement('canvas');
 canvas.width = 24;
 canvas.height = 16;
 const ctx = canvas.getContext('2d', {willReadFrequently:true});
 if (!ctx) return '';
 ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
 const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
 let red = 0, green = 0, blue = 0, weight = 0;
 for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
  const high = Math.max(r, g, b), low = Math.min(r, g, b);
  const value = a / 255 * (0.3 + (high - low) / 255);
  red += r * value;
  green += g * value;
  blue += b * value;
  weight += value;
 }
 if (!weight) return '';
 const channels = [red, green, blue].map(channel => channel / weight);
 const average = channels.reduce((sum, channel) => sum + channel, 0) / 3;
 return channels.map(channel => Math.max(0,Math.min(255,
  Math.round(128 + (channel - average) + (average - 128) * 0.45)))).join(',');
}

export default function glassScene(L, enabled, chromePalette=()=>{}) {
 const colors = new Map(), detail = new WeakMap();
 let home, visible, revision = 0;

 function read(image) {
  try { return imageColor(image); }
  catch (_) { return ''; }
 }

 function palette(url, image) {
  if (!url) return '';
  if (colors.has(url)) return colors.get(url);
  const color = image ? read(image) : '';
  const pending = color || new Promise(resolve => {
   const probe = new Image();
   probe.crossOrigin = 'anonymous';
   probe.onload = () => resolve(read(probe));
   probe.onerror = () => resolve('');
   probe.src = url;
  });
  colors.set(url, pending);
  if (colors.size > 32) colors.delete(colors.keys().next().value);
  return pending;
 }

 async function cardPalette(card) {
  if (!card) return '';
  const paths = new Set([officialBanner(card, false), card.backdrop_path, card.poster_path]);
  for (const path of paths) {
   if (typeof path !== 'string' || !path) continue;
   const url = /^(?:https?:\/\/|\/\/|blob:|data:image\/)/i.test(path) ? path :
    path.startsWith('/') ? L.TMDB.image('/t/p/w300' + path, {preserveSize:true}) : '';
   const color = await palette(url);
   if (color) return color;
  }
  return '';
 }

 function originPalette(origin) {
  if (origin?.component === 'main') return home;
  if (origin?.component !== 'full') return '';
  const card = origin.movie || origin.card;
  const sample = detail.get(origin);
  return sample ? Promise.resolve(sample).then(color => color || cardPalette(card)) : cardPalette(card);
 }

 function paint(body, scene, color) {
  if (color) body.style.setProperty('--pt-scene-rgb', color);
  else body.style.removeProperty('--pt-scene-rgb');
  if (scene) body.setAttribute('data-pt-scene', scene);
  else body.removeAttribute('data-pt-scene');
 }

 function refresh() {
  const body = document.body, active = L.Activity.active() || {};
  const glass = L.Storage.get('lampa_view_theme','minimal') === 'glass';
  const stack = L.Activity.all?.() || [];
  const origin = stack[stack.indexOf(active) - 1];
  const current = ++revision;
  let scene = '', color;
  if (enabled() && L.Storage.get('background', true)) {
   if (glass && L.Storage.get('lampa_view_hero', true) &&
      (active.component === 'main' || active.component === 'category' && catalogue.has(active.url || active.cat))) {
    scene = 'catalogue';
    color = home;
   } else if (isProject(active)) {
    scene = 'related';
    color = originPalette(origin);
   } else if (playback.has(active.component) && (active.movie || active.card)) {
    scene = 'related';
    const target = active.movie || active.card;
    const source = origin?.movie || origin?.card;
    const sourceId = source?.tmdb_id || source?.id || origin?.id;
    const targetId = target.tmdb_id || target.id;
    color = origin?.component === 'full' && sourceId && String(sourceId) === String(targetId) ?
     originPalette(origin) : cardPalette(target);
   }
  }
  if (visible !== active || body.getAttribute('data-pt-scene') !== (scene || null)) paint(body, scene, '');
  visible = active;
  const artwork=enabled() && L.Storage.get('background', true) &&
   (active.component==='main' && L.Storage.get('lampa_view_hero', true)?home:
    active.component==='full'?detail.get(active):color);
  Promise.all([color,artwork]).then(([value,chrome])=>{
   if (current !== revision)return;
   paint(body,scene,value);
   chromePalette(chrome || '');
  });
 }

 function capture(image) {
  if (!enabled() || !image?.complete || !image.naturalWidth || !image.closest('.activity--active')) return;
  const active = L.Activity.active();
  const source = image.currentSrc || image.src;
  if (active?.component === 'main' && image.matches('.pt-hero__image')) {
   home = palette(source, image);
   refresh();
  } else if (active?.component === 'full' && image.matches('.full-start__background')) {
   detail.set(active, palette(source, image));
   refresh();
  }
 }

 const artwork = '.pt-hero__image,.full-start__background';
 function captureActive() {
  const slide = document.querySelector('.activity--active');
  if (slide) capture(slide.querySelector(artwork));
 }
 document.addEventListener('load', event => {
  if (event.target.matches?.(artwork)) capture(event.target);
 }, true);
 L.Listener.follow('activity', event => {
  if (event.type !== 'start') return;
  captureActive();
  refresh();
 });
 L.Storage.listener?.follow('change', event => {
  if (!['lampa_view_theme','lampa_view_enabled','background','lampa_view_hero'].includes(event.name)) return;
  if (enabled()) captureActive();
  refresh();
 });
 captureActive();
 refresh();
}
