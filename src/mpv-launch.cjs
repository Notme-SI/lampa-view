'use strict';

const C = require('./identity.cjs');
const {progressChannel} = require('./mpv-progress.cjs');
// The native Desktop preload already supports child_process.spawn. Pass a small
// opaque script option through it; no app patch, server or altered video URL.
function option(context, encode) {
  const data = {
    ...context
  };
  if (Array.isArray(data.entries)) data.entries = data.entries.slice();
  let value = encode(JSON.stringify(data));
  while (value.length > 11000 && data.entries && data.entries.length > 1) {
    data.entries.pop();
    value = encode(JSON.stringify(data));
  }
  if (value.length > 11000) return '';
  return '--script-opts-append=mpv_plus_lampa_context=' + Array.from(value, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
function install(L, root, cardFor, enabled) {
  if (!L.Platform || typeof L.Platform.desktop !== 'function' || !L.Platform.desktop() || typeof root.require !== 'function') return;
  let pending = null, bypass = false;
  const originalPlaylist = L.Player.playlist;
  L.Player.playlist = function (items) {
    if (pending && Array.isArray(items) && items.length) pending.items = items;
    return originalPlaylist.apply(this, arguments);
  };
  function target(video) {
    if (!enabled() || !L.Platform.desktop() || L.Platform.is('android') || typeof root.require !== 'function') return '';
    if (video.iptv || video.iptv_player || ['lampa', 'inner'].includes(video.launch_player)) return '';
    if (L.Storage.field(video.torrent_hash ? 'player_torrent' : 'player') !== 'other') return '';
    const path = L.Storage.field('player_nw_path');
    return typeof path === 'string' && /(?:^|[\\/])mpv(?:\+)?\.exe$/i.test(path) ? path : '';
  }
  function create(event) {
    if (pending) { pending.cancelled = true; pending = null; }
    const video = event.data,
      path = target(video);
    if (bypass || !path || !event.abort) return;
    const card = cardFor(video);
    if (!card) return;
    let spawn;
    try {
      spawn = root.require('child_process').spawn;
      if (typeof spawn !== 'function') return;
    } catch (error) {
      return;
    }
    // Let other synchronous create listeners finish correcting season/episode.
    // A playlist supplied immediately after Player.play is included too.
    pending = {
      video,
      path,
      spawn,
      card,
      items: Array.isArray(video.playlist) ? video.playlist : []
    };
    event.abort();
    const launch = pending;
    const launchPending = (resolved) => {
      if (launch.cancelled) return;
      pending = null;
      let started = false,
        retried = false;
      function fallback() {
        if (retried) return;
        retried = true;
        bypass = true;
        try {
          L.Player.play(video);
        } finally {
          bypass = false;
        }
      }
      try {
        const prepare = item => {
          const result = {
            ...item
          };
          if (result.quality && L.Player.getUrlQuality) result.url = L.Player.getUrlQuality(result.quality, false) || result.url;
          if (typeof result.url === 'string' && L.Torserver && L.Torserver.toPlayUrl) result.url = L.Torserver.toPlayUrl(result.url);
          return result;
        };
        const selected = prepare(video);
        if (!C.mediaURL(selected.url)) {
          fallback();
          return;
        }
        const playlist = (resolved || launch.items).slice(0, 80).filter(Boolean).map(prepare);
        const queue = [selected];
        const selectedIdentity = C.identity(card, selected);
        if (!video.torrent_hash && selectedIdentity.kind === 'tv') {
          const at = playlist.findIndex(item => item.url === selected.url || item.episode != null &&
            item.episode === selected.episode && item.season === selected.season);
          const following = at >= 0 ? playlist.slice(at + 1) : playlist.filter(item => {
            const identity = C.identity(card, item);
            return identity.season === selectedIdentity.season && identity.episode > selectedIdentity.episode;
          });
          const urls = new Set([selected.url]);
          let length = encodeURI(selected.url).length;
          for (const item of following) {
            if (!C.mediaURL(item.url) || urls.has(item.url)) continue;
            length += encodeURI(item.url).length + 3;
            if (length > 12000 || queue.length >= 40) break;
            urls.add(item.url);
            queue.push(item);
          }
        }
        const context = C.context(launch.card, selected, video.torrent_hash ? playlist : queue);
        const encode = value => root.unescape(root.encodeURIComponent(value));
        let metadata = option(context, encode);
        const urls = queue.map(item => encodeURI(item.url));
        if (path.length + urls.join(' ').length + metadata.length > 28000) metadata = '';
        const progress = progressChannel(L, root, video.torrent_hash ? [selected, ...playlist] : queue, enabled);
        const args = [...(metadata ? [metadata] : []), ...progress.args, ...urls];
        const child = spawn(path, args);
        progress.attach(child);
        started = true;
        if (child && typeof child.on === 'function') child.on('error', fallback);
        L.Player.listener.send('external', video);
      } catch (error) {
        if (!started) fallback();
      }
    };
    // The host supplies its playlist in the same call stack. A microtask keeps
    // it available without waiting behind rendering/timers after preloading.
    // Spawn reports a missing executable itself; another synchronous Desktop
    // fs IPC round trip here would hold the renderer before every launch.
    const preparePlaylist = () => {
      if (launch.cancelled) return;
      if (typeof video.minimalExternalPlaylist !== 'function') return launchPending();
      let done = false, ready = false, requested = false, resolver, timeout;
      const finish = () => {
        if (!ready) { requested = true; return; }
        if (done) return;
        done = true;
        if (timeout != null) root.clearTimeout?.(timeout);
        let items;
        try { items = resolver?.list(); } catch (error) {}
        launchPending(items);
      };
      // Reuse the source adapter's bounded resolver. Internal playlist cells
      // may contain functions and are not directly playable outside Lampa.
      try { resolver = video.minimalExternalPlaylist(finish); } catch (error) {}
      ready = true;
      if (!resolver || requested) finish();
      else timeout = root.setTimeout(finish, 2500);
    };
    if (typeof root.queueMicrotask === 'function') root.queueMicrotask(preparePlaylist);
    else if (root.Promise) root.Promise.resolve().then(preparePlaylist);
    else root.setTimeout(preparePlaylist, 0);
  }
  const notify = L.Player.listener.send;
  L.Player.listener.send = function (name, event) {
    if (name !== 'create' || !event || typeof event.abort !== 'function') return notify.apply(this, arguments);
    const abort = event.abort;
    let cancelled = false,
      result;
    event.abort = function () {
      cancelled = true;
      return abort.apply(this, arguments);
    };
    try {
      result = notify.apply(this, arguments);
    } finally {
      event.abort = abort;
    }
    // Respect another extension cancelling the launch; do not run around it.
    if (!cancelled) create(event);
    return result;
  };
}
module.exports = {
  install,
  option
};
