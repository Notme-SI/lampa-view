import {officialBanner} from './artwork.js';
import {isAnimeHome} from './catalogue.js';

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
 const regions = Array.from({length:6},()=>[0,0,0,0]);
 let red = 0, green = 0, blue = 0, weight = 0;
 for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
  const high = Math.max(r, g, b), low = Math.min(r, g, b);
  const value = a / 255 * (0.3 + (high - low) / 255);
  red += r * value;
  green += g * value;
  blue += b * value;
  weight += value;
  const pixel=i/4, column=Math.floor((pixel%24)/8), row=pixel>=24*9?1:0;
  const region=regions[row*3+column], alpha=a/255;
  region[0]+=r*alpha;region[1]+=g*alpha;region[2]+=b*alpha;region[3]+=alpha;
 }
 if (!weight) return '';
 const channels = [red, green, blue].map(channel => channel / weight);
 const average = channels.reduce((sum, channel) => sum + channel, 0) / 3;
 const color=channels.map(channel => Math.max(0,Math.min(255,
  Math.round(128 + (channel - average) + (average - 128) * 0.45)))).join(',');
 return {color,tones:regions.map(([r,g,b,count])=>{
  const rgb=count?[r/count,g/count,b/count]:channels;
  return rgb.map(value=>Math.round(9+value*.42)).join(',');
 })};
}

export default function glassScene(L, enabled, chromePalette=()=>{}) {
 const colors = new Map(), detail = new WeakMap(), animeHome = new WeakMap();
 let home, visible, revision = 0;

 function read(image) {
  try { return imageColor(image); }
  catch (_) { return ''; }
 }

 function palette(url, image) {
  if (!url) return '';
  const color = image ? read(image) : '';
  if(color){colors.set(url,color);if(colors.size>32)colors.delete(colors.keys().next().value);return color;}
  if (colors.has(url)) return colors.get(url);
  const probeColor=src=>new Promise(resolve => {
   const probe = new Image();
   probe.crossOrigin = 'anonymous';
   probe.onload = () => resolve(read(probe));
   probe.onerror = () => resolve('');
   probe.src = src;
  });
  // Some hosts proxy TMDB images without CORS headers. Sample the same
  // artwork from TMDB at thumbnail size if that proxy cannot be read.
  const file=url.match(/\/t\/p\/(?:w\d+|original)\/([\w-]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i);
  const pending=probeColor(url).then(sample=>sample || (file?probeColor('https://image.tmdb.org/t/p/w300/'+file[1]):''));
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

 function strength(){const value=Number(L.Storage.value?L.Storage.value('lampa_view_artwork_tint','50'):L.Storage.get('lampa_view_artwork_tint','50'));return Number.isFinite(value)?Math.max(0,Math.min(100,value))/100:.5;}
 function paint(body, scene, color) {
  if (color) body.style.setProperty('--pt-scene-rgb', color.color);
  else body.style.removeProperty('--pt-scene-rgb');
  const active=L.Activity.active();
  if(scene==='catalogue' && color && (active?.component==='main' || isAnimeHome(active))){
   const positions=['12% 7%','56% 9%','91% 12%','19% 44%','60% 49%','91% 51%'];
   const alpha=Math.min(1,strength()*1.35);
   const layers=color.tones.map((tone,index)=>
    'radial-gradient(ellipse 54% 42% at '+positions[index]+',rgba('+tone+','+alpha+'),transparent 100%)');
   body.style.setProperty('--pt-home-atmosphere',layers.join(','));
  }else body.style.removeProperty('--pt-home-atmosphere');
  if (scene) body.setAttribute('data-pt-scene', scene);
  else body.removeAttribute('data-pt-scene');
  body.style.setProperty('--pt-scene-strength',String((body.classList.contains('pt-theme-glass')?.60:.44)*strength()*2));
 }

 function tint(color){
  const amount=enabled()?strength():0;
  const channels=String(color || '').split(',').map(Number);
  if(channels.length!==3 || channels.some(value=>!Number.isFinite(value)) || !amount){document.body.style.removeProperty('--pt-material-rgb');return;}
  document.body.style.setProperty('--pt-material-rgb',channels.map(channel=>Math.round(30+(Math.min(120,channel*.55)-30)*amount)).join(','));
 }

 function refresh() {
  const body = document.body, active = L.Activity.active() || {};
  const stack = L.Activity.all?.() || [];
  const origin = stack[stack.indexOf(active) - 1];
  const current = ++revision;
  let scene = '', color;
  // The plugin replaces native Background; its saved switch can be disabled
  // in Electron/older installations and must not suppress our artwork tint.
  if (enabled() && strength()>0) {
   if (L.Storage.get('lampa_view_hero', true) &&
      (active.component === 'main' || active.component === 'category' && catalogue.has(active.url || active.cat))) {
    scene = 'catalogue';
    color = isAnimeHome(active) ? animeHome.get(active) : home;
   } else if (active.component==='full') {
    scene='detail';
    color=detail.get(active) || cardPalette(active.movie || active.card);
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
  if (visible !== active || body.getAttribute('data-pt-scene') !== (scene || null)) {
   paint(body, scene, '');
   if(isAnimeHome(active) || isAnimeHome(visible)){tint('');chromePalette('');}
  }
  visible = active;
  const artwork=enabled() && strength()>0 &&
   (active.component==='main' && L.Storage.get('lampa_view_hero', true)?home:
    active.component==='full'?detail.get(active):color);
  Promise.all([color,artwork]).then(([value,chrome])=>{
   if (current !== revision)return;
   paint(body,scene,value);
   const palette=(chrome || value)?.color || '';
   tint(palette);
   chromePalette(palette);
  });
 }

 function capture(image) {
  if (!enabled() || !image?.complete || !image.naturalWidth || !image.closest('.activity--active')) return;
  const active = L.Activity.active();
  const source = image.currentSrc || image.src;
  if ((active?.component === 'main' || isAnimeHome(active)) && image.matches('.pt-hero__image')) {
   const value=palette(source, image);
   if(isAnimeHome(active))animeHome.set(active,value);else home=value;
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
  if (!['lampa_view_theme','lampa_view_enabled','lampa_view_artwork_tint','lampa_view_hero'].includes(event.name)) return;
  if (enabled()) captureActive();
  refresh();
 });
 captureActive();
 refresh();
}
