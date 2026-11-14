'use strict';

const C = require('./identity.cjs');
const playbackStatus = require('./playback-status.cjs');
const {progressChannel} = require('./mpv-progress.cjs');
// The native Desktop preload already supports child_process.spawn. Pass a small
// opaque script option through it; no app patch, server or altered video URL.
function option(context, encode, trim = true) {
  const data = {
    ...context
  };
  if (Array.isArray(data.entries)) data.entries = data.entries.slice();
  let value = encode(JSON.stringify(data));
  while (trim && value.length > 11000 && data.entries && data.entries.length > 1) {
    data.entries.pop();
    value = encode(JSON.stringify(data));
  }
  if (value.length > 11000) return '';
  return '--script-opts-append=mpv_plus_lampa_context=' + Array.from(value, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
function install(L, root, cardFor, enabled, text = value => value) {
  const status = playbackStatus(root, text);
  L.Player.listener.follow?.('create', () => { if (enabled()) status.show('Открываем видео…'); });
  for (const event of ['external', 'destroy']) L.Player.listener.follow?.(event, status.clear);
  for (const event of ['playing', 'canplay', 'ended']) L.PlayerVideo?.listener?.follow?.(event, status.clear);
  L.PlayerVideo?.listener?.follow?.('error', () => { if (enabled()) status.show('Не удалось открыть видео', 'error'); });
  root.document?.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Backspace') status.clear(); });
  if (!L.Platform || typeof L.Platform.desktop !== 'function' || !L.Platform.desktop() || typeof root.require !== 'function') return;
  let pending = null, bypass = false;
  const active = new Map();
  const notice = value => status.show(value, /Не удалось/.test(value) ? 'error' : 'loading');
  L.SettingsApi?.addParam?.({component:'lampa_view',param:{name:'lampa_view_mpv_plus',type:'trigger',default:false},field:{name:text('Интеграция MPV Plus'),description:text('Включите, если выбранный внешний MPV содержит MPV Plus.')}});
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
    if (typeof path !== 'string' || !/(?:^|[\\/])mpv(?:\+)?\.exe$/i.test(path)) return null;
    const preference = L.Storage.field('lampa_view_mpv_plus');
    const plus = /(?:^|[\\/])mpv\+\.exe$/i.test(path) || preference === true || preference === 'true';
    // The Electron bridge supports spawn and process output, but the host's
    // stock MPV IPC launcher assumes a Node renderer with process and net.
    if (!plus && (!root.electronAPI || root.process?.platform)) return null;
    return {path, plus};
  }
  function create(event) {
    const video = event.data;
    const player = target(video);
    if (bypass || !player || !event.abort) return;
    const {path, plus} = player;
    const url = (video.quality && L.Player.getUrlQuality?.(video.quality, false)) || video.url;
    if (!plus && !C.mediaURL(url)) return;
    const key = typeof url === 'string' ? path.toLowerCase() + '\n' + url : null;
    if (key && (pending?.key === key || active.has(key))) {
      event.abort();
      if (pending?.key === key) notice('Открываем видео…');
      return;
    }
    if (pending) { pending.cancelled = true; pending.cancel?.(); pending = null; }
    const card = cardFor(video);
    if (plus && !card) return;
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
      key,
      spawn,
      card,
      items: Array.isArray(video.playlist) ? video.playlist : []
    };
    event.abort();
    notice('Открываем видео…');
    const launch = pending;
    const launchPending = (resolved) => {
      if (launch.cancelled) return;
      pending = null;
      let started = false,
        retried = false;
      function fallback() {
        if (retried) return;
        retried = true;
        status.clear();
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
        const selectedIdentity = card && C.identity(card, selected);
        const raw = (resolved || launch.items).filter(Boolean);
        const matches = item => item.url === video.url || item.url === selected.url ||
          selectedIdentity?.episode != null && C.identity(card, item).episode === selectedIdentity.episode &&
          C.identity(card, item).season === selectedIdentity.season;
        const series = !video.torrent_hash && selectedIdentity?.kind === 'tv';
        const rawAt = series ? raw.findIndex(matches) : -1;
        const playlist = raw.slice(Math.max(0, rawAt - 39), Math.max(0, rawAt - 39) + 80).map(prepare);
        let queue = [selected], start = 0;
        if (series) {
          const at = playlist.findIndex(matches);
          const side = before => at >= 0 ? playlist.slice(before ? 0 : at + 1, before ? at : undefined) : playlist.filter(item => {
            const identity = C.identity(card, item);
            return identity.season === selectedIdentity.season && (before ? identity.episode < selectedIdentity.episode : identity.episode > selectedIdentity.episode);
          });
          const urls = new Set([selected.url]);
          const coordinates=new Set([selectedIdentity.season+':'+selectedIdentity.episode]);
          const playable = items => items.filter(item => {
            if (!C.mediaURL(item.url) || urls.has(item.url)) return false;
            const identity=C.identity(card,item),coordinate=identity.season+':'+identity.episode;
            if(identity.episode!=null && coordinates.has(coordinate))return false;
            urls.add(item.url);if(identity.episode!=null)coordinates.add(coordinate);return true;
          });
          const before = playable(side(true)), after = playable(side(false));
          queue = [...before, selected, ...after];start = before.length;
          let length = queue.reduce((sum,item)=>sum + encodeURI(item.url).length + 3,0);
          // Bound the command line around the selection, retaining both directions.
          while (queue.length > 1 && (queue.length > 40 || length > 12000)) {
            const remove = start >= queue.length - start - 1 ? 0 : queue.length - 1;
            length -= encodeURI(queue[remove].url).length + 3;
            queue.splice(remove,1);if(remove === 0)start--;
          }
        }
        const encode = value => root.unescape(root.encodeURIComponent(value));
        function launchData(){
          const metadata=plus?option(C.context(launch.card,selected,video.torrent_hash?playlist:queue),encode,Boolean(video.torrent_hash)):'';
          const urls=queue.map(item=>encodeURI(item.url));
          return {metadata,urls,length:path.length+metadata.length+urls.reduce((size,url)=>size+url.length+3,0)+600};
        }
        let prepared=launchData();
        // Long signed stream URLs must not crowd the selected identity out of
        // Windows' command line. Keep the nearest entries with their metadata.
        while(!video.torrent_hash && queue.length>1 && (plus && !prepared.metadata || prepared.length>28000)){
          const remove=start>=queue.length-start-1?0:queue.length-1;
          queue.splice(remove,1);if(remove===0)start--;
          prepared=launchData();
        }
        const {metadata,urls}=prepared;
        const progress = progressChannel(L, root, video.torrent_hash ? [selected, ...playlist] : queue, enabled);
        const args = [...(metadata ? [metadata] : []), '--force-window=immediate', ...progress.args, ...(start ? ['--playlist-start=' + start] : [])];
        if (!plus) {
          if (L.Storage.field('player_external_fullscreen') !== false) args.push('--fullscreen');
          const timeline = video.timeline;
          const fresh = timeline?.hash && L.Timeline?.view?.(timeline.hash, timeline);
          const seconds = Number((fresh || timeline)?.time);
          if (Number.isFinite(seconds) && seconds > 0) {
            if (urls.length === 1) args.push('--start=' + seconds);
            else urls.splice(start, 1, '--{', '--start=' + seconds, urls[start], '--}');
          }
        }
        args.push(...urls);
        const child = spawn(path, args);
        started = true;
        if (child && typeof child.on === 'function') {
          if (key) active.set(key, child);
          const release = () => { if (key && active.get(key) === child) active.delete(key); };
          child.on('spawn', () => status.clear());
          child.on('error', () => { release(); if (!retried) { retried = true; notice('Не удалось открыть видео'); } });
          child.on('exit', code => {
            release();
            if (typeof code === 'number' && code !== 0 && !retried) notice('Не удалось открыть видео');
            else if (!retried) status.clear();
          });
          child.on('close', release);
        }
        progress.attach(child);
        L.Player.listener.send('external', video);
      } catch (error) {
        if (!started) notice('Не удалось открыть видео');
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
        try { resolver?.cancel?.(); } catch (error) {}
        launchPending(items);
      };
      // Reuse the source adapter's bounded resolver. Internal playlist cells
      // may contain functions and are not directly playable outside Lampa.
      try { resolver = video.minimalExternalPlaylist(finish); } catch (error) {}
      launch.cancel = () => { done = true; if (timeout != null) root.clearTimeout?.(timeout);try { resolver?.cancel?.(); } catch (error) {} };
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
