/*! mpv+ iOS Lampa bridge 0.2.4 | MIT | mpv+ contributors */
(function (root) {
    'use strict';
    function text(value) { return String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 2048); }
    function integer(value) { var n = Number(value); return Number.isInteger(n) && n > 0 && n < 10000000 ? n : null; }
    function network(value) {
        if (typeof value !== 'string' || /[\r\n\0]/.test(value)) return '';
        try { var url = new URL(value, /^(?:\/|\.\.?\/)/.test(value) && root.location ? root.location.href : undefined); return /^(https?:)$/.test(url.protocol) && url.hostname ? url.href : ''; } catch (_) { return ''; }
    }
    function coordinates(item) {
        var season = integer(item.season != null ? item.season : item.season_number);
        var episode = integer(item.episode != null ? item.episode : item.episode_number);
        var value = text(item.title || item.path || '');
        var match = value.match(/\bS(\d{1,3})\s*[:._ -]?\s*E(\d{1,4})\b/i) || value.match(/\b(\d{1,3})x(\d{1,4})\b/i);
        if (match) { season = season || integer(match[1]); episode = episode || integer(match[2]); }
        if (!episode) { match = value.match(/(?:серия|episode)\s*(\d{1,4})/i); if (match) episode = integer(match[1]); }
        return { season: season, episode: episode };
    }
    function tracks(values) {
        if (!Array.isArray(values)) return [];
        return values.filter(function (v) { return v && network(v.url); }).slice(0, 32).map(function (v) {
            return { url: network(v.url), title: text(v.label || v.title || v.lang || 'Дорожка') };
        });
    }
    function stream(item, adapter) {
        var url = item && item.url;
        if (item && item.quality && typeof item.quality === 'object' && adapter && adapter.quality) url = adapter.quality(item.quality) || url;
        if (adapter && adapter.torrent && typeof url === 'string') url = adapter.torrent(url);
        return network(playURL(url));
    }
    function playURL(url) { return typeof url === 'string' ? url.replace(/([?&])preload(?=&|$)/g, '$1play') : ''; }
    function build(video, rawItems, card, adapter) {
        video = video || {}; card = card || {};
        var current = stream(video, adapter);
        if (!current) throw new Error('Источник пока не выдал прямую ссылку на видео. Выбери доступную серию или качество.');
        var raw = Array.isArray(rawItems) ? rawItems.filter(function (v) { return v && !v.separator && typeof v.url === 'string'; }) : [];
        if (!raw.length) raw = [video];
        var title = text(card.title || card.name || video.media_title || video.title || 'Плейлист Lampa');
        var artwork = network(card.poster || card.img || '') || (typeof card.poster_path === 'string' && card.poster_path.charAt(0) === '/' ? 'https://image.tmdb.org/t/p/w500' + card.poster_path : '');
        var seen = {}, items = [], selected = -1;
        raw.forEach(function (item) {
            var url = stream(item, adapter);
            if (!url || seen[url]) return;
            seen[url] = true;
            var meta = coordinates(item), entry = { url: url, title: text(item.title || item.path || title), mediaTitle: title };
            if (url === current) { selected = items.length; var active = coordinates(video); meta.season = meta.season || active.season; meta.episode = meta.episode || active.episode; }
            if (meta.season) entry.season = meta.season;
            if (meta.episode) entry.episode = meta.episode;
            entry.mediaType = card.media_type || (card.name || card.first_air_date || card.number_of_seasons ? 'tv' : 'movie');
            if ((!card.source || card.source === 'tmdb') && integer(card.id)) entry.tmdbID = integer(card.id);
            var imdb = card.imdb_id || (card.external_ids && card.external_ids.imdb_id);
            if (/^tt\d+$/.test(imdb || '')) entry.imdbID = imdb;
            if (integer(card.mal_id)) entry.malID = integer(card.mal_id);
            if (artwork) entry.artwork = artwork;
            var voice = text(item.voice_name || video.voice_name), source = text(item.source || video.source);
            if (voice) entry.voice = voice;
            if (source) entry.source = source;
            var tl = item.timeline || (url === current ? video.timeline : null);
            if (tl && Number.isFinite(Number(tl.time)) && Number(tl.time) > 0) entry.startPosition = Number(tl.time);
            var subs = tracks(item.subtitles || video.subtitles), audio = tracks(item.audio || video.audio);
            if (subs.length) entry.subtitles = subs;
            if (audio.length) entry.audio = audio;
            items.push(entry);
        });
        if (selected < 0) {
            // Keep the chosen stream even if a provider's playlist omitted it.
            var activeDoc = build(video, [video], card, adapter);
            items.unshift(activeDoc.items[0]); selected = 0;
        }
        if (!items.length || items.length > 200) throw new Error('Нужен плейлист до 200 видео. Выбери один сезон.');
        return { version: 1, title: title, items: items, selected: selected };
    }
    function appURL(document) {
        var json = JSON.stringify(document);
        var encoded = root.btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return 'mpvplus://playlist?data=' + encoded;
    }
    var api = { build: build, appURL: appURL, coordinates: coordinates };
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    function install() {
    if (root.MPVPlusLampa) return;
    var L = root.Lampa;
    if (!L || !L.Player || !L.Select) { root.alert('Открой страницу Lampa и нажми закладку mpv+ ещё раз.'); return; }
    var activeCard = null, pending = null, list = [], scheduled = false, recentList = [], recentAt = 0;
    var originalPlay = L.Player.play, originalPlaylist = L.Player.playlist;
    var registered = false;
    if (L.Params && L.Params.values && L.Params.select) {
        ['player', 'player_torrent'].forEach(function (key) {
            var values = L.Params.values[key];
            if (values && typeof values === 'object' && !Array.isArray(values)) {
                L.Params.select(key, Object.assign({}, values, { mpvplus: 'mpv+' }), L.Params.defaults && L.Params.defaults[key]);
                registered = true;
            }
        });
    }
    if (registered) {
        var selectedPlayer = function (key) { return L.Storage.field ? L.Storage.field(key) : L.Storage.get(key, 'inner'); };
        // A default torrent player used to bypass the bridge even when mpv+
        // was chosen for online video. Upgrade that default once, quietly.
        if (L.Storage.get('mpvplus_ios_torrent_revision', 0) !== 1) {
            if (selectedPlayer('player') === 'mpvplus' && ['inner', 'ios', '', undefined].indexOf(selectedPlayer('player_torrent')) >= 0) L.Storage.set('player_torrent', 'mpvplus');
            L.Storage.set('mpvplus_ios_torrent_revision', 1);
        }
        if (L.Storage.listener && L.Storage.listener.follow) L.Storage.listener.follow('change', function (event) {
            if (event && event.name === 'player' && event.value === 'mpvplus' && selectedPlayer('player_torrent') !== 'mpvplus') L.Storage.set('player_torrent', 'mpvplus');
        });
    }
    function enabled(video) {
        if (registered) {
            var torrent = video && (video.torrent_hash || /\/stream(?:\/[^?]*)?\?[^#]*link=/.test(video.url || ''));
            var key = torrent ? 'player_torrent' : 'player';
            return (L.Storage.field ? L.Storage.field(key) : L.Storage.get(key, 'inner')) === 'mpvplus';
        }
        var value = L.Storage.get('mpvplus_ios', false); return value === true || value === 'true';
    }
    // Hand the ready stream to the external player without waiting for Lampa's
    // preload/stat loop. That loop can fail before Player.play is ever reached.
    // Keep the server, access token, file index and the user's setting intact.
    if (L.Torserver && typeof L.Torserver.stream === 'function') {
        var originalStream = L.Torserver.stream;
        L.Torserver.stream = function () {
            var url = originalStream.apply(this, arguments);
            return enabled({ torrent_hash: true, url: url }) ? playURL(url) : url;
        };
    }
    function enable() {
        if (registered) { L.Storage.set('player', 'mpvplus'); L.Storage.set('player_torrent', 'mpvplus'); }
        else L.Storage.set('mpvplus_ios', true);
    }
    api.enable = enable; root.MPVPlusLampa = api;
    if (L.Listener) L.Listener.follow('full', function (event) {
        if (event && event.type === 'complite') activeCard = event.data && event.data.movie || event.object && event.object.card || null;
    });
    function transfer(video, items, card) {
        try {
            var document = build(video, items, card || activeCard || {}, {
                quality: L.Player.getUrlQuality ? function (q) { return L.Player.getUrlQuality(q, false); } : null,
                torrent: L.Torserver && L.Torserver.toPlayUrl ? function (url) { return L.Torserver.toPlayUrl(url); } : null
            });
            var url = appURL(document);
            if (url.length > 64000) {
                var objectURL = URL.createObjectURL(new Blob([JSON.stringify(document)], { type: 'application/json' }));
                var anchor = root.document.createElement('a'); anchor.href = objectURL; anchor.download = 'lampa.mpvplaylist.json'; root.document.body.appendChild(anchor); anchor.click(); anchor.remove();
                root.setTimeout(function () { URL.revokeObjectURL(objectURL); }, 60000);
                L.Noty.show('Сохрани плейлист и открой файл в mpv+.');
            } else root.location.assign(url);
        } catch (error) { L.Noty.show(error.message); }
    }
    api.transfer = transfer;
    function queue(video, items, card) {
        if (!enabled(video)) return;
        pending = card ? Object.assign({}, video, { card: card }) : video;
        list = Array.isArray(items) ? items.slice() : [];
        if (!scheduled) { scheduled = true; root.setTimeout(show, 0); }
    }
    // Same public torrent menu event used by ITS. Preserve the original source list and selected file.
    if (L.Listener) L.Listener.follow('torrent_file', function (event) {
        // This event is emitted AFTER TorrServer preloading and the host's
        // player call. It also works when another adapter replaced Player.play.
        // Defer the chooser until the host has closed its loading/file dialog.
        if (event && event.type === 'onenter' && event.element) {
            queue(event.element, event.items || event.element.playlist, event.params && event.params.movie);
            return;
        }
        if (!event || event.type !== 'onlong' || !event.element || !Array.isArray(event.menu) || event.menu.some(function (item) { return item.mpvplus_action; })) return;
        var card = event.params && event.params.movie || activeCard || {};
        event.menu.push({ title: 'Открыть в mpv+', mpvplus_action: true, onSelect: function () { transfer(event.element, [event.element], card); } });
        if (Array.isArray(event.items) && event.items.length) {
            event.menu.push({ title: 'Передать весь список в mpv+', mpvplus_action: true, onSelect: function () { transfer(event.element, event.items, card); } });
        }
    });
    function show() {
        scheduled = false;
        if (!pending) return;
        var video = pending, raw = list.slice(); pending = null;
        var activity = L.Activity.active() || {};
        var card = video.card || video.movie || activity.card || activity.movie || activeCard || {};
        try {
            var document = build(video, raw, card, {
                quality: L.Player.getUrlQuality ? function (q) { return L.Player.getUrlQuality(q, false); } : null,
                torrent: L.Torserver && L.Torserver.toPlayUrl ? function (url) { return L.Torserver.toPlayUrl(url); } : null
            });
            var url = appURL(document), oversized = url.length > 64000;
            L.Select.show({
                title: 'mpv+ · ' + document.title,
                items: [
                    { title: oversized ? 'Сохранить плейлист для mpv+' : 'Открыть в mpv+', subtitle: document.items.length + ' видео · с выбранной серии', action: 'mpv' },
                    { title: 'Открыть обычным плеером Lampa', action: 'lampa' }
                ],
                onSelect: function (item) {
                    L.Select.hide();
                    if (item.action === 'lampa') { originalPlay.call(L.Player, Object.assign({}, video, { playlist: raw })); if (raw.length) originalPlaylist.call(L.Player, raw); return; }
                    if (oversized) {
                        var objectURL = URL.createObjectURL(new Blob([JSON.stringify(document)], { type: 'application/json' }));
                        var a = root.document.createElement('a'); a.href = objectURL; a.download = 'lampa.mpvplaylist.json'; root.document.body.appendChild(a); a.click(); a.remove();
                        root.setTimeout(function () { URL.revokeObjectURL(objectURL); }, 60000);
                        L.Noty.show('Сохрани файл и открой его через «Файлы» в mpv+.');
                    } else root.location.assign(url);
                },
                onBack: function () { L.Select.hide(); L.Controller.toggle('content'); }
            });
        } catch (error) { L.Noty.show(error.message); originalPlay.call(L.Player, video); if (raw.length) originalPlaylist.call(L.Player, raw); }
    }
    L.Player.play = function (video) {
        if (!enabled(video)) return originalPlay.apply(this, arguments);
        queue(video, video && Array.isArray(video.playlist) ? video.playlist :
            Date.now() - recentAt < 300 && recentList.some(function (item) { return item && video && item.url === video.url; }) ? recentList : []);
    };
    L.Player.playlist = function (items) {
        recentList = Array.isArray(items) ? items.slice() : []; recentAt = Date.now();
        if (pending && enabled(pending)) { list = Array.isArray(items) ? items.slice() : []; return; }
        return originalPlaylist.apply(this, arguments);
    };
    if (!registered && L.SettingsApi) L.SettingsApi.addParam({ component: 'player', param: { name: 'mpvplus_ios', type: 'trigger', default: false }, field: { name: 'mpv+', description: 'Передавать выбранное видео и плейлист в mpv+.' } });
    // Installing a permanent plugin must not change the user's selected player on every PWA launch.
    }
    if (root.Lampa && root.appready === false && root.Lampa.Listener) {
        if (!root.__mpvPlusWaiting) {
            root.__mpvPlusWaiting = true;
            root.Lampa.Listener.follow('app', function (event) { if (event && event.type === 'ready') { root.__mpvPlusWaiting = false; install(); } });
        }
    } else install();
}(typeof window !== 'undefined' ? window : globalThis));
