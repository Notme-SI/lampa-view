'use strict';

function text(value, max = 300) {
  return typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max) : '';
}
function integer(value, min = 1, max = 100000000) {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (String(value).trim() === '') return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
}
function first(...values) { return values.find(v => v !== undefined && v !== null && v !== ''); }
function unique(values) { return [...new Set(values.map(v => text(v)).filter(Boolean))].slice(0, 12); }
function episodeFromTitle(value) {
  const s = text(value, 1000);
  let m = s.match(/\bS(\d{1,3})[ ._-]*E(\d{1,4})\b/i) || s.match(/\b(\d{1,2})x(\d{1,4})\b/i);
  if (m) return {season: integer(m[1], 0, 999), episode: integer(m[2], 1, 9999)};
  const season = s.match(/(?:сезон\s*(\d{1,3})|(\d{1,3})\s*сезон)/i);
  const episode = s.match(/(?:серия\s*(\d{1,4})|(\d{1,4})\s*серия|\bepisode\s*(\d{1,4}))/i);
  return {season: season && integer(season[1] || season[2], 0, 999), episode: episode && integer(episode[1] || episode[2] || episode[3], 1, 9999)};
}
function identity(card = {}, video = {}) {
  const ep = video.episode && typeof video.episode === 'object' ? video.episode : {};
  const parsed = episodeFromTitle(video.title);
  const kind = card.media_type === 'movie' ? 'movie' : card.media_type === 'tv' ? 'tv' :
    (card.release_date && !card.original_name) ? 'movie' :
    card.original_name || card.first_air_date || card.number_of_seasons || video.season !== undefined ? 'tv' : 'movie';
  const title = text(card.title || card.name);
  const original = text(card.original_title || card.original_name);
  const source = card.source || video.source || 'tmdb';
  const ids = card.external_ids || {};
  const imdb = first(card.imdb_id, ids.imdb_id);
  const aliases = unique([title, original, ...(card.aliases || []), ...((card.alternative_titles || {}).results || (card.alternative_titles || {}).titles || []).map(v => v.title)]);
  const result = {
    title: title || original,
    original_title: original,
    aliases,
    kind,
    year: integer((card.release_date || card.first_air_date || '').slice(0, 4), 1870, 2200),
    season: integer(first(video.season, video.season_number, ep.season_number, parsed.season), 0, 999),
    episode: integer(first(typeof video.episode === 'object' ? ep.episode_number : video.episode, video.episode_number, parsed.episode), 1, 9999),
    episode_title: text(video.episode_title || ep.name),
    tmdb_id: source === 'tmdb' ? integer(card.id) : integer(card.tmdb_id),
    imdb_id: /^tt\d{5,12}$/.test(imdb || '') ? imdb : undefined,
    mal_id: integer(card.mal_id || ids.mal_id || video.mal_id),
    shikimori_id: integer(card.shikimori_id || ids.shikimori_id || video.shikimori_id),
    anime: ['ja', 'zh'].includes(card.original_language) && (card.genre_ids || card.genres || []).some(v => Number(v.id || v) === 16),
    duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined
  };
  // A movie named "Episode 1" must not turn into an unrelated TV entry.
  if (result.kind === 'movie') { delete result.season; delete result.episode; }
  Object.keys(result).forEach(key=>{if(result[key]===undefined || result[key]===null)delete result[key];});
  return result;
}
function mediaURL(value) {
  if (typeof value !== 'string' || value.length > 10000 || /[\x00-\x1f]/.test(value)) return '';
  return /^https?:\/\//i.test(value) ? value : '';
}
function context(card, video, list = []) {
  const entries = [];
  const add = item => {
    const url = mediaURL(item.url);
    if (!url || entries.some(e => e.url === url)) return;
    entries.push({url, identity: identity(card, item)});
  };
  add(video);
  // One launch must never overflow Windows' 32K environment variable limit.
  for (const item of list.slice(0, 40)) {
    add(item);
    if (JSON.stringify(entries).length > 22000) { entries.pop(); break; }
  }
  return {version: 1, source: 'lampa', entries};
}
module.exports = {text, integer, episodeFromTitle, identity, context, mediaURL};
