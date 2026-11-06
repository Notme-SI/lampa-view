'use strict';

const {profileScope} = require('./timeline-meta.cjs');

function normalizeURL(value) {
  try { return decodeURI(decodeURI(value)); } catch (error) { return value; }
}

function torrentKey(value) {
  try {
    const url = new URL(value), match = url.pathname.match(/^(.*\/stream)(?:\/[^/]*)?$/);
    const hash = url.searchParams.get('link'), index = url.searchParams.get('index');
    if (!/^https?:$/.test(url.protocol) || !match || !/^[a-f0-9]{40}$/i.test(hash || '') || !/^[1-9]\d*$/.test(index || '') || url.searchParams.getAll('link').length!==1 || url.searchParams.getAll('index').length!==1) return '';
    return [url.origin,match[1],hash.toLowerCase(),Number(index)].join('|');
  } catch (error) { return ''; }
}

// Desktop already forwards the launched child's stdout/stderr. MPV expands the
// measured position and current path in its status message, including file
// switches. Only entries from this exact launch may update their own timeline.
function progressChannel(L, root, entries, enabled) {
  const token = 'lampa-progress-' + Math.random().toString(36).slice(2);
  const marker = '[' + token + '] ';
  const scope = profileScope(L);
  const videos = new Map();
  for (const item of entries) if (item && item.url && item.timeline && !videos.has(normalizeURL(item.url))) videos.set(normalizeURL(item.url), item);
  const torrents = new Map();
  for (const item of videos.values()) {
    const key = torrentKey(item.url); if (!key) continue;
    const previous = torrents.get(key);
    if (torrents.has(key) && (!previous || previous.timeline.hash !== item.timeline.hash)) torrents.set(key,null);
    else torrents.set(key,item);
  }
  const buffers = {stdout:'', stderr:''};
  const decoder = typeof root.TextDecoder === 'function' ? new root.TextDecoder() : null;
  let latest = null, savedAt = 0, savedPosition = '', ended = false;

  function save() {
    if (!latest || !enabled() || scope !== profileScope(L)) return;
    const {video, time, duration} = latest;
    const timeline = video.timeline;
    if (!timeline || timeline.stop_recording || typeof timeline.handler !== 'function') return;
    const signature = [timeline.hash, time, duration].join('|');
    if (signature === savedPosition) return;
    const percent = Math.min(100, Math.round(time / duration * 100));
    Object.assign(timeline, {percent, time, duration});
    timeline.handler(percent, time, duration);
    if (typeof video.viewed === 'function') video.viewed(time);
    savedAt = Date.now();
    savedPosition = signature;
  }

  function line(value) {
    const start = value.indexOf(marker);
    if (start < 0) return;
    const match = value.slice(start + marker.length).match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)\|(.+)$/);
    if (!match) return;
    const time = Number(match[1]), duration = Number(match[2]);
    const video = videos.get(normalizeURL(match[3])) || torrents.get(torrentKey(match[3]));
    if (!video || !Number.isFinite(time) || time <= 0 || !Number.isFinite(duration) || duration <= 0 || time > duration + 2) return;
    if (latest && latest.video !== video) { save(); savedAt = 0; }
    latest = {video, time:Math.min(time, duration), duration};
    if (!savedAt || Date.now() - savedAt >= 5000) save();
  }

  function receive(stream, chunk) {
    if (ended) return;
    let text;
    if (typeof chunk === 'string') text = chunk;
    else if (decoder) text = decoder.decode(chunk);
    else text = Array.from(chunk || [], byte => String.fromCharCode(byte)).join('');
    const rows = (buffers[stream] + text).split(/[\r\n]/);
    buffers[stream] = rows.pop().slice(-20000);
    rows.forEach(line);
  }

  function finish() {
    if (ended) return;
    Object.values(buffers).forEach(line);
    save();
    ended = true;
    videos.clear();torrents.clear();
  }

  return {
    args:['--terminal=yes', '--msg-color=no', '--term-osd=no', '--term-status-msg=' + marker + '${=time-pos}|${=duration}|${path}'],
    attach(child) {
      if (!child) return;
      for (const stream of ['stdout', 'stderr']) {
        if (child[stream] && typeof child[stream].on === 'function') child[stream].on('data', chunk => receive(stream, chunk));
      }
      if (typeof child.on === 'function') { child.on('exit', finish); child.on('close', finish); }
    },
    finish
  };
}

module.exports = {progressChannel};
