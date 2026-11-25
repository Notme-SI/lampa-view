'use strict';

function linkFor(L, card, season, episode) {
  if (!card || !card.id) return null;
  const series = card.media_type !== 'movie' && !!(card.original_name || card.name || card.first_air_date || card.media_type === 'tv');
  if (series && (!Number.isInteger(Number(season)) || Number(season) < 0 || !Number.isInteger(Number(episode)) || Number(episode) < 1)) return null;
  if (L.Timeline && typeof L.Timeline.link === 'function') {
    const linked = L.Timeline.link(card, season, episode);
    if (linked && linked.card) return linked;
  }
  const source = card.source || 'tmdb';
  const prefix = ['tmdb', 'cub'].includes(source) ? '' : source + '_';
  const key = (prefix + (series ? 'tv_' : 'movie_') + card.id).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 64);
  return series ? {card:key, season:Number(season), episode:Number(episode)} : {card:key};
}

function torrentHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : '';
}

function profileScope(L) {
  const permit = L.Account && L.Account.Permit;
  const profile = permit && permit.sync && permit.account && permit.account.profile;
  const file = L.Timeline && L.Timeline.filename ? L.Timeline.filename() : 'file_view';
  const email = String(permit?.account?.email || L.Storage?.get?.('account', {})?.email ||
    L.Storage?.get?.('account_email', '') || '').trim().toLowerCase();
  return file + '|' + (profile ? profile.id : 0) + (email ? '|' + email : '');
}

module.exports = {linkFor, profileScope, torrentHash};
