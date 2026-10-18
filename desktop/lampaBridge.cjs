'use strict';
// Transport only. It never chooses an executable, starts a server, or rewrites a stream URL.
const {identity, mediaURL} = require('./lampaIdentity.cjs');
const pending = new Map();
let installed = false;
const normalize = value => {
  try { return decodeURI(decodeURI(value)).replace(/&preload(?=&|$)/, '&play'); } catch { return value; }
};
function accept(sender, data, now = Date.now()) {
  if (!data || data.version !== 1 || data.source !== 'lampa' || !Array.isArray(data.entries)) return false;
  if (JSON.stringify(data).length > 26000) return false;
  const entries = data.entries.slice(0, 40).filter(e => e && mediaURL(e.url) && e.identity && typeof e.identity.title === 'string');
  if (!entries.length) return false;
  // Revalidate primitive values at the process boundary. The browser cannot supply mpv options.
  const clean = entries.map(e => {
    const v = e.identity;
    const card = {title: v.title, original_title: v.original_title, aliases: v.aliases,
      media_type: v.kind, source: 'tmdb', id: v.tmdb_id, imdb_id: v.imdb_id,
      mal_id: v.mal_id, shikimori_id: v.shikimori_id,
      release_date: v.year ? String(v.year) + '-01-01' : '',
      original_language: v.anime ? 'ja' : '', genre_ids: v.anime ? [16] : []};
    return {url: e.url, identity: identity(card, v)};
  });
  let store = pending.get(sender);
  if (!store) { store = new Map(); pending.set(sender, store); }
  for (const entry of clean) store.set(normalize(entry.url), {at: now, data: {version: 1, source: 'lampa', entries: clean}});
  for (const [key, item] of store) if (now - item.at > 120000 || store.size > 80) store.delete(key);
  return true;
}
function environment(sender, executable, args, now = Date.now()) {
  if (!/(?:^|[\\/])mpv(?:\+)?\.exe$/i.test(executable || '')) return {};
  const store = pending.get(sender);
  if (!store || !Array.isArray(args)) return {};
  for (const arg of args) {
    if (!mediaURL(arg)) continue;
    const item = store.get(normalize(arg));
    if (item && now - item.at <= 120000) return {MPV_PLUS_LAMPA_CONTEXT: JSON.stringify(item.data)};
  }
  return {};
}
function install(ipcMain) {
  if (installed) return;
  installed = true;
  ipcMain.on('lampa_view-lampa-context', (event, data) => {
    try { event.returnValue = accept(event.sender.id, data); }
    catch { event.returnValue = false; }
  });
}
module.exports = {install, environment, accept, normalize};
