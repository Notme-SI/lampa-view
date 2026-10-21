/* Torrent Catalogue 0.3.0. Pure metadata routines; no network or downloads. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.TorrentCatalogueCore = factory();
}(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    function text(v) { return v === null || v === undefined ? '' : String(v); }
    function norm(v) {
        return text(v).toLowerCase().replace(/ё/g, 'е').replace(/[-‐‑–—_.:,!?()[\]{}'"«»/|]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function uniq(a) {
        var seen = Object.create(null);
        return a.filter(function (v) { var k = norm(v); if (!k || seen[k]) return false; seen[k] = true; return true; });
    }
    function contains(haystack, needle) {
        return (' ' + norm(haystack) + ' ').indexOf(' ' + norm(needle) + ' ') >= 0;
    }
    function copy(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); return r; }
    function year(v) { var m = text(v).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/); return m ? +m[1] : null; }
    function list(a, b, max) { var r = []; if (a < 0 || b < a || b > max || b - a > max) return r; for (var i = a; i <= b; i++) r.push(i); return r; }
    function parseNumbers(s, max) {
        var out = [], valid = true;
        text(s).split(/\s*[,;+]\s*/).forEach(function (part) {
            var m = part.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/);
            if (!m) { valid = false; return; }
            var items = list(+m[1], +(m[2] || m[1]), max);
            if (!items.length) valid = false;
            out = out.concat(items);
        });
        return valid ? out.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }) : [];
    }
    function ranges(values) {
        if (!values.length) return '';
        var out = [], start = values[0], end = start;
        for (var i = 1; i <= values.length; i++) {
            if (values[i] === end + 1) end = values[i];
            else { out.push(start === end ? text(start) : start + '-' + end); start = end = values[i]; }
        }
        return out.join(', ');
    }
    function parseTitle(title) {
        var s = text(title).toLowerCase().replace(/ё/g, 'е').replace(/[‐‑–—]/g, '-');
        var result = { seasons: [], episodes: [], declaredCount: null, countSource: '', total: null, year: year(s), completeWord: /(?:^|[^a-zа-я])(?:complete|полный|полностью|все серии)(?:$|[^a-zа-я])/.test(s), issues: [] };
        var m, numberSpec = '(\\d{1,3}(?:\\s*-\\s*\\d{1,3})?)';
        var patterns = [
            /(?:^|[^a-z0-9])s(\d{1,2})(?:\s*-\s*s?(\d{1,2}))?(?=e\d|[^a-z0-9]|$)/,
            /(?:^|[^a-zа-я0-9])(\d{1,2})\s*[xх×]\s*\d{2,3}(?=$|[^0-9])/,
            new RegExp(numberSpec + '\\s*(?:-?[йяе]\\s*)?сезон(?:ы|ов|а)?'),
            new RegExp('(?:сезон(?:ы|ов|а)?|seasons?)\\s*[:#-]?\\s*' + numberSpec),
            /(?:^|[^a-zа-я])(?:тв|tv)\s*-\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?/
        ];
        for (var p = 0; p < patterns.length; p++) {
            m = s.match(patterns[p]);
            if (m) { result.seasons = parseNumbers(m[2] ? m[1] + '-' + m[2] : m[1], 99); break; }
        }
        if (!result.seasons.length) {
            var words = { первый: 1, первая: 1, второй: 2, вторая: 2, третий: 3, третья: 3, четвертый: 4, пятый: 5, шестой: 6, седьмой: 7, восьмой: 8, девятый: 9, десятый: 10, first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
            Object.keys(words).some(function (w) {
                if (contains(s, w + ' сезон') || contains(s, 'сезон ' + w) || contains(s, w + ' season')) { result.seasons = [words[w]]; return true; }
                return false;
            });
            m = s.match(/(?:сезон|season)\s+(viii|vii|iii|vi|iv|ix|ii|v|x|i)(?=$|[^a-z])/);
            if (!result.seasons.length && m) result.seasons = [{ i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }[m[1]]];
        }
        // Episode identifiers are parsed independently from season identifiers.
        m = s.match(/s\d{1,2}e(\d{1,4})(?:\s*-\s*(?:s\d{1,2})?e?(\d{1,4}))?/);
        if (m) result.episodes = parseNumbers(m[1] + (m[2] ? '-' + m[2] : ''), 9999);
        var xRange = s.match(/(?:^|[^a-zа-я0-9])(\d{1,2})\s*[xх×]\s*(\d{2,3})(?:\s*-\s*(?:(\d{1,2})\s*[xх×]\s*)?(\d{1,3}))?(?=$|[^a-zа-я0-9])/);
        if (!result.episodes.length && xRange) result.episodes = parseNumbers(xRange[2] + (xRange[4] ? '-' + xRange[4] : ''), 9999);
        // A count "8 из 24" is not a file list. An explicit "1-8" is a declared range.
        var spec = '(\\d{1,4}(?:(?:\\s*-\\s*|\\s*[,;+]\\s*)\\d{1,4})*)';
        var outOf = s.match(new RegExp(spec + '\\s*(?:сери(?:я|и|й)|эпизод(?:ы|ов)?|эп\\.?|episodes?|eps?\\.?)?\\s*(?:из|of)\\s*(\\d{1,4})(?=$|[^0-9])'));
        if (outOf) {
            result.total = +outOf[2];
            if (/[-,;+]/.test(outOf[1])) result.episodes = parseNumbers(outOf[1], 9999);
            else if (/\d\s*(?:серия|эпизод)\s+(?:из|of)/.test(outOf[0])) result.episodes = [+outOf[1]];
            else { result.declaredCount = +outOf[1]; result.countSource = 'out-of'; }
        } else if (!result.episodes.length) {
            m = s.match(new RegExp(spec + '\\s*(?:сери(?:я|и|й)|эпизод(?:ы|ов)?|эп\\.?|episodes?|eps?\\.?)(?=$|[^a-zа-я])'));
            if (m) {
                if (/[-,;+]/.test(m[1]) || /\d\s+(?:серия|эпизод|episode)(?=$|[^a-zа-я])/.test(m[0])) result.episodes = parseNumbers(m[1], 9999);
                else { result.declaredCount = +m[1]; result.countSource = 'count-only'; }
            } else {
                m = s.match(new RegExp('(?:сери(?:я|и|й)|эпизод(?:ы|ов)?|эп\\.?|episodes?|eps?\\.?)\\s*[:#]?\\s*' + spec));
                if (m) result.episodes = parseNumbers(m[1], 9999);
                else {
                    m = s.match(/[\[(]\s*(\d{1,3}\s*-\s*\d{1,3})\s*[\])]/);
                    if (m && !/\d{4}/.test(m[1])) result.episodes = parseNumbers(m[1], 9999);
                }
            }
        }
        if (result.total > 9999 || result.total === 0) { result.total = null; result.issues.push('Некорректное число серий в заголовке'); }
        if (result.episodes.some(function (v) { return v < 1 || (result.total && v > result.total); }) || (result.total && result.declaredCount > result.total)) result.issues.push('Противоречивый диапазон серий');
        // Never reuse the first season's range as a per-season range for a bundle.
        m = s.match(/s(\d{1,2})e\d{1,4}\s*-\s*s(\d{1,2})e\d{1,4}/);
        if (m && m[1] !== m[2]) { result.seasons = parseNumbers(m[1] + '-' + m[2], 99); result.episodes = []; }
        if (xRange && xRange[3] && +xRange[1] !== +xRange[3]) { result.seasons = parseNumbers(xRange[1] + '-' + xRange[3], 99); result.episodes = []; }
        result.bundle = result.seasons.length > 1;
        return result;
    }
    function catalogue(card, english) {
        card = card || {}; english = english || {};
        var tv = card.media_type==='movie' || card.type==='movie'?false:!!(card.media_type==='tv' || card.type==='tv' || card.original_name || card.number_of_seasons || card.seasons);
        var aliases = [], seasonAliases = [], seasons = [];
        function add(v, priority, language) { if (text(v).trim()) aliases.push({ title: text(v).trim(), priority: priority, language: language }); }
        add(card.name || card.title, 0, 'ru'); add(english.name || english.title, 1, 'en');
        add(card.original_name || card.original_title, 4, card.original_language || 'original');
        var alternatives = card.alternative_titles || {};
        (alternatives.results || alternatives.titles || []).forEach(function (a) {
            var season = text(a.type).match(/(?:season\s*|^s)(\d{1,2})(?:\D|$)/i);
            if (season) seasonAliases.push({ title: a.title, season: +season[1] });
            else {
                var priority = a.iso_3166_1 === 'RU' ? 2 : /romaji/i.test(a.type) ? 3 : /^(US|GB)$/.test(a.iso_3166_1) && /shortened|^$/i.test(a.type) ? 2 : 6;
                if (!/\b(?:ONA|OVA|special|movie|film)\b/i.test(a.type)) add(a.title, priority, a.iso_3166_1);
            }
        });
        (card.seasons || []).forEach(function (s) {
            var en = (english.seasons || []).filter(function (e) { return e.season_number === s.season_number; })[0];
            seasons.push({ number: s.season_number, name: s.name, expected: s.episode_count || null, year: year(s.air_date), airDate: s.air_date || '', ended: card.status === 'Ended' || card.status === 'Canceled', aliases: [] });
            [s.name, en && en.name].forEach(function (name) { if (name && !/^(?:сезон|season|спецматериалы|specials)\s*\d*$/i.test(name)) seasonAliases.push({ title: name, season: s.season_number }); });
        });
        aliases.sort(function (a, b) { return a.priority - b.priority; });
        var seen = Object.create(null);
        aliases = aliases.filter(function (a) { var key = norm(a.title); if (!key || seen[key]) return false; seen[key] = true; return true; });
        seasonAliases.forEach(function (a) {
            var n = norm(a.title), best = '';
            if (aliases.some(function (base) { return n === norm(base.title); })) return;
            aliases.forEach(function (base) { var b = norm(base.title); if (n.indexOf(b + ' ') === 0 && b.length > best.length) best = b; });
            if (best) n = n.slice(best.length).trim();
            if (n.length < 4 || /^(?:season|сезон|tv|тв)\s*\d+$/.test(n)) return;
            var target = seasons.filter(function (s) { return s.number === a.season; })[0];
            if (target) target.aliases = uniq(target.aliases.concat(n));
        });
        return { id: card.id, tv: tv, title: card.name || card.title || '', aliases: aliases, seasons: seasons, year: year(card.first_air_date || card.release_date), status: card.status || '', hasMetadata: !!card.seasons || !!card.release_date };
    }
    function queries(cat, initial, max) {
        // A bounded set of catalogue aliases, not a Cartesian product of translations.
        var candidates = cat.aliases.filter(function (a) { return a.priority <= 4; }), selected = [initial];
        function first(predicate) {
            candidates.some(function (a) {
                if (predicate(a) && !selected.some(function (q) { return norm(q) === norm(a.title); })) { selected.push(a.title); return true; }
                return false;
            });
        }
        // Include a Cyrillic synonym, one English form and Romaji before secondary English spellings.
        first(function (a) { return /[а-яё]/i.test(a.title); });
        first(function (a) { return a.language === 'en' || /^(US|GB)$/.test(a.language); });
        first(function (a) { return a.priority === 3; });
        return uniq(selected.concat(candidates.map(function (a) { return a.title; }))).slice(0, max || 4);
    }
    function identify(row, cat, parsed) {
        if (!cat || !cat.aliases.length) return { state: 'unknown', reason: 'Нет карточки для сопоставления' };
        var title = text(row.Title), names = [title, row.info && row.info.originalname].filter(Boolean).join(' / ');
        var matches = cat.aliases.filter(function (a) { return contains(names, a.title); });
        if (!matches.length) return { state: 'unknown', reason: 'Название не подтверждено вариантами из карточки' };
        var strong = matches.some(function (a) { return a.language === 'en' || a.language === 'original' || a.priority === 3 || a.title === cat.aliases.filter(function (x) { return x.priority === 4; }).map(function (x) { return x.title; })[0]; });
        var releaseYear = parsed.year;
        if (!cat.tv && releaseYear && cat.year && Math.abs(releaseYear - cat.year) > 1) return { state: 'mismatch', reason: 'Год фильма не совпадает с карточкой' };
        if (cat.tv && releaseYear && cat.year && releaseYear < cat.year - 1) return { state: 'mismatch', reason: 'Раздача выпущена раньше этого сериала' };
        if (!strong && /(?:\bova\b|\bogre slayer\b|\bonikirimaru\b)/i.test(title) && cat.year && releaseYear && releaseYear !== cat.year) return { state: 'mismatch', reason: 'Совпало только локализованное название другого произведения' };
        return { state: 'matched', reason: 'Вариант названия из карточки' };
    }
    function mapSeason(parsed, title, cat, identity) {
        var result = { number: null, name: '', expected: null, evidence: 'unknown', issue: '' };
        if (!cat.tv || identity.state !== 'matched' || parsed.bundle) return result;
        var named = cat.seasons.filter(function (s) { return s.aliases.some(function (a) { return contains(title, a); }); });
        if (named.length === 1) {
            result.number = named[0].number; result.name = named[0].name; result.expected = named[0].expected; result.evidence = 'arc';
        } else if (named.length > 1) result.issue = 'В названии несколько частей';
        else if (parsed.seasons.length === 1) {
            var direct = cat.seasons.filter(function (s) { return s.number === parsed.seasons[0]; })[0];
            var evidenceCount = parsed.total || (parsed.completeWord && parsed.declaredCount);
            var directYear = direct && (!parsed.year || !direct.year || parsed.year === direct.year);
            var directCount = direct && (!evidenceCount || evidenceCount === direct.expected);
            if (direct && directYear && directCount) {
                result.number = direct.number; result.name = direct.name; result.expected = direct.expected; result.evidence = 'number';
            } else {
                // Year + total corroborates a numbered release without imposing an anime-wide offset.
                var possible = cat.seasons.filter(function (s) { return s.number > 0 && s.year === parsed.year && evidenceCount && s.expected === evidenceCount; });
                if (possible.length === 1) {
                    result.number = possible[0].number; result.name = possible[0].name; result.expected = possible[0].expected; result.evidence = 'year-count';
                } else if (cat.seasons.some(function(s){return s.number>0;})) result.issue = 'Нумерация раздачи не сопоставлена с карточкой';
            }
        }
        if (result.number !== null && parsed.total && result.expected && parsed.total !== result.expected) result.issue = 'В раздаче заявлено ' + parsed.total + ', в карточке ' + result.expected + ' серий';
        return result;
    }
    function releaseAuthor(title) {var match=text(title).match(/\bот\s+([^|]+)\s*\|/i);if(!match)match=text(title).match(/(?:^|\s)от\s+([^|]+)\s*\|/i);return match && !/(?:озвучк[аи]|перевод|дубляж)\s*$/i.test(text(title).slice(0,match.index))?match[1].trim():'';}
    function voices(row, cat) {
        var tracks = [], claimed = [], ignored = [];
        var probe = Array.isArray(row.ffprobe) ? row.ffprobe : row.ffprobe && row.ffprobe.streams || [];
        probe.forEach(function (track) {
            if (track.codec_type !== 'audio') return;
            var tag = track.tags || {};
            var label = [tag.language && tag.language !== 'und' ? tag.language : '', tag.title || tag.handler_name || '', track.codec_name, track.channels ? track.channels + ' ch' : ''].filter(Boolean).join(' · ');
            if (label) tracks.push(label);
        });
        var title = text(row.Title), n = norm(title), startOfCredits = title.search(/\[|\(|\||\b(?:WEB[- .]?DL|WEBRip|BDRip|BluRay|HDTVRip|DVDRip|2160p|1080p|720p)\b/i);
        var credits = startOfCredits < 0 ? '' : title.slice(startOfCredits);
        (row.info && row.info.voices || []).forEach(function (voice) {
            // A studio name may itself be a word in the film title (DeMon / Demon Slayer).
            var inAlias = cat.aliases.some(function (a) { return contains(a.title, voice); });
            if (inAlias && !contains(credits, voice)) ignored.push(voice);
            else if (contains(n, voice) || tracks.some(function (t) { return contains(t, voice); })) claimed.push(voice);
        });
        // Explicit dubbing credits can contain studios absent from the server's dictionary.
        var creditPattern = /(?:^|[\s,/|])(?:лм|лд|ло|пм|дб|mvo|dvo|avo|dub)\s*\(([^)]+)\)/gi, match;
        while ((match = creditPattern.exec(title))) claimed = claimed.concat(match[1].split(/\s*[,;]\s*/));
        var groups = [
            ['LostFilm','LF'],['HDRezka','HDRezka Studio','HDR'],['TVShows','TVS'],['Кубик в Кубе','KVK','Кубик'],
            ['Red Head Sound','RHS'],['LE-Production','LE'],['NewComers','NC'],['ColdFilm'],['ViruseProject','Viruse Project'],
            ['AlexFilm'],['AniLibria'],['AniDUB'],['AniStar'],['AnimeVost'],['AniMaunt'],['Studio Band'],['Дубляж','Dub','Dubbing']
        ], names = [], evidence = title + ' ' + tracks.join(' '), author=releaseAuthor(title), types=[];
        function credited(value) {return contains(evidence,value) && (!cat.aliases.some(function(a){return contains(a.title,value);}) || contains(credits+' '+tracks.join(' '),value));}
        function addVoice(value, explicit) {
            value = text(value).trim(); if (!value) return;
            if(!explicit && author && norm(author)===norm(value) && !tracks.some(function(t){return contains(t,value);}))return;
            var group = groups.filter(function (g) { return g.some(function (v) { return norm(v) === norm(value); }); })[0];
            if (group) { if (explicit || group.some(function (v) { return v.length > 3 && credited(v); })) names.push(group[0]); }
            else if (value.length > 3 && value.length <= 64 && !/^(?:rus|eng|ukr|ru|en|uk|audio|main|original|original sound|russian|english|русский|английский|оригинал|стерео|ac-?3|e-?ac-?3|aac|dts|flac|mp3|\d[ .]ch)$/i.test(value)) names.push(value);
        }
        claimed.forEach(function(v){addVoice(v,false);});
        var translationNames={D:'Дубляж','Д':'Дубляж','ДБ':'Дубляж',DUB:'Дубляж',MVO:'Многоголосый','ПМ':'Многоголосый','ЛМ':'Многоголосый',DVO:'Двухголосый',AVO:'Авторский'},declaration=/(?:\||\/)\s*(D|Д|ДБ|DUB|MVO|ПМ|ЛМ|DVO|AVO)\s*(?:\||\/)\s*([^|/\r\n]+)/gi,credit;
        while((credit=declaration.exec(title))){types.push(translationNames[credit[1].toUpperCase()]);var studio=credit[2].replace(/\s*\([^)]*\)\s*$/,'').trim();if(studio && studio.length<=64 && !/^(?:WEB|BDRip|BluRay|HEVC|H[. ]?26[45]|HDR10|SDR|RUS|ENG|RU\b|EN\b|\d)/i.test(studio))addVoice(studio,true);}
        groups.forEach(function (g) { if (g.some(function (v) { return v.length > 3 && credited(v); })) names.push(g[0]); });
        probe.forEach(function (track) {
            if (track.codec_type !== 'audio') return;
            var label = text((track.tags || {}).title || (track.tags || {}).handler_name), known = groups.some(function (g) { return g.some(function (v) { return v.length > 3 && contains(label,v); }); });
            if (!known) addVoice(label.replace(/^(?:rus|eng|ukr|ru|en|uk)\s*[-:·]\s*/i,'').replace(/\s*[-,;·]?\s*(?:(?:e-?)?ac-?3|aac|dts|flac|mp3|[257]\.\d|\d\s*ch)(?:\s.*)?$/i,''));
        });
        return { tracks: uniq(tracks), claimed: uniq(claimed), ignored: uniq(ignored), names: uniq(names), types:uniq(types), author:author };
    }
    function probeStreams(value) {
        if(typeof value==='string'){try{value=JSON.parse(value);}catch(error){return [];}}
        return Array.isArray(value)?value:value && Array.isArray(value.streams)?value.streams:[];
    }
    function technical(row) {
        var info = row.info || {}, probe = probeStreams(row.ffprobe);
        if(!probe.length)probe=probeStreams(info.ffprobe || row.probe);
        var general=row.general || {};
        var raw = [row.Title,info.quality,info.resolution,info.videotype,general.resolution,row.resolution,row.Resolution,row.Quality].concat(row._tcTitles || [],info.types || []).join(' '), video=[],audio=[],languages=[],subtitles=[],channels=[],hdr=[],dimensions='';
        function language(v) { var s=text(v).trim().toUpperCase(), codes={RUS:'RU',RUSSIAN:'RU',РУССКИЙ:'RU',ENG:'EN',ENGLISH:'EN',UKR:'UK',UKRAINIAN:'UK',JPN:'JA',JAPANESE:'JA',JAP:'JA',CHI:'ZH',ZHO:'ZH',KOR:'KO',GER:'DE',DEU:'DE',FRE:'FR',FRA:'FR',SPA:'ES'};return codes[s] || (/^[A-Z]{2,3}$/.test(s) && s!=='UND'?s:''); }
        function codec(v,type) { var s=text(v).toUpperCase().replace(/[ ._-]/g,'');var aliases=type==='video'?{H264:'H.264',X264:'H.264',AVC:'H.264',AVC1:'H.264',H265:'H.265',X265:'H.265',HEVC:'H.265',AV1:'AV1',MPEG4:'MPEG-4',XVID:'MPEG-4',DIVX:'MPEG-4',MPEG2VIDEO:'MPEG-2',MPEG2:'MPEG-2',VP9:'VP9'}:{AC3:'AC-3',DD:'AC-3',EAC3:'E-AC-3',DDP:'E-AC-3',DTS:'DTS',DTSHDMA:'DTS-HD MA',TRUEHD:'TrueHD',AAC:'AAC',FLAC:'FLAC',MP3:'MP3',OPUS:'Opus'};return aliases[s] || ''; }
        function resolution(v) {var s=text(v).trim().toUpperCase(),r={SD:'SD',HD:'720p',FHD:'1080p','FULL HD':'1080p','4K':'2160p',UHD:'2160p','8K':'4320p'};if(r[s])return r[s];var m=s.match(/^(480|576|720|1080|1440|2160|4320)[PI]?$/);return m?m[1]+'p':'';}
        function fromDimensions(w,h) {return w>=7600 || h>=4200?'4320p':w>=3800 || h>=2100?'2160p':w>=2500 || h>=1400?'1440p':w>=1900 || h>=1000?'1080p':w>=1200 || h>=700?'720p':'SD';}
        var quality='',source='',firstVideo=probe.filter(function(t){return t.codec_type==='video' && t.width>0 && t.height>0 && !(t.disposition && t.disposition.attached_pic);})[0];
        if(!firstVideo){
            [info.video,info,general,row].some(function(v){
                if(v && +v.width>0 && +v.height>0){firstVideo={width:+v.width,height:+v.height};return true;}return false;
            });
        }
        if(!firstVideo){
            var media=row.mediainfo || row.mediaInfo || row.MediaInfo || info.mediainfo;
            if(typeof media==='string'){try{media=JSON.parse(media);}catch(error){media=null;}}
            var tracks=media && media.media && media.media.track || media && media.track || [];
            if(Array.isArray(tracks))tracks.some(function(track){
                if(String(track['@type'] || track.StreamKind || '').toLowerCase()!=='video')return false;
                var w=parseInt(text(track.Width || track.width).replace(/\s/g,''),10),h=parseInt(text(track.Height || track.height).replace(/\s/g,''),10),cover=track.Cover==='Yes' || track.ImageType==='Cover';
                if(w>0 && h>0 && !cover){firstVideo={width:w,height:h};return true;}return false;
            });
        }
        if(firstVideo){dimensions=firstVideo.width+'×'+firstVideo.height;quality=fromDimensions(+firstVideo.width,+firstVideo.height);}
        if(!quality)quality=resolution(info.quality) || resolution(general.resolution) || resolution(info.resolution) || resolution(row.resolution) || resolution(row.Resolution);
        if(!quality){var dim=raw.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i),q=raw.match(/\b(4320|2160|1440|1080|720|576|480)[pi]\b|\b(8K|4K|UHD|FHD|HD|SD)\b/i);if(dim){dimensions=dim[1]+'×'+dim[2];quality=fromDimensions(+dim[1],+dim[2]);}else if(q)quality=resolution(q[1] || q[2]);}
        if(!quality && row._tcResolution){quality=row._tcResolution.quality;dimensions=row._tcResolution.dimensions || '';}
        var sm=raw.match(/\b(BD[- .]?Remux|Blu[- .]?Ray|BDRip|WEB[- .]?DL[- .]?Rip|WEB[- .]?DL|WEBRip|HDTVRip|HDTV|DVD[- .]?Rip|DVD[- .]?Scr|DVD|TS[- .]?Rip|HD[- .]?TS|TeleSync|TS|CAM[- .]?Rip|HD[- .]?CAM|CAM|TC[- .]?Rip|TeleCine|TC)\b/i);if(sm){var sk=sm[1].toUpperCase().replace(/[ .-]/g,'');source={BDREMUX:'BDRemux',BLURAY:'Blu-ray',BDRIP:'BDRip',WEBDLRIP:'WEB-DLRip',WEBDL:'WEB-DL',WEBRIP:'WEBRip',HDTVRIP:'HDTVRip',HDTV:'HDTV',DVDRIP:'DVDRip',DVDSCR:'DVDScr',DVD:'DVD',TSRIP:'TSRip',HDTS:'HDTS',TELESYNC:'TS',TS:'TS',CAMRIP:'CAMRip',HDCAM:'HDCAM',CAM:'CAM',TCRIP:'TCRip',TELECINE:'TC',TC:'TC'}[sk];}
        probe.forEach(function(track){var lang=language((track.tags || {}).language);if(track.codec_type==='video'){if(codec(track.codec_name,'video'))video.push(codec(track.codec_name,'video'));}else if(track.codec_type==='audio'){if(codec(track.codec_name,'audio'))audio.push(codec(track.codec_name,'audio'));if(lang)languages.push(lang);if(+track.channels===8)channels.push('7.1');else if(+track.channels===6)channels.push('5.1');else if(+track.channels===2)channels.push('2.0');else if(+track.channels===1)channels.push('1.0');}else if(track.codec_type==='subtitle' && lang)subtitles.push(lang);});
        if(!video.length){var vm=raw.match(/\b(?:[hx][ .-]?26[45]|HEVC|AVC1?|AV1|MPEG[- ]?[24]|XviD|DivX|VP9)\b/gi) || [];vm.forEach(function(v){if(codec(v,'video'))video.push(codec(v,'video'));});}
        if(!audio.length){var am=raw.match(/\b(?:E-?AC-?3|AC-?3|DDP|DTS[- ]HD[- ]MA|DTS|TrueHD|AAC|FLAC|MP3|Opus)\b/gi) || [];am.forEach(function(v){if(codec(v,'audio'))audio.push(codec(v,'audio'));});}
        if(!channels.length){var cm=raw.match(/\b[157]\.1\b|\b2\.0\b/g) || [];channels=channels.concat(cm);}
        if(/\bHDR10\+/i.test(raw))hdr.push('HDR10+');else if(/\bHDR10\b/i.test(raw))hdr.push('HDR10');else if(/\bHDR\b/i.test(text(row.Title)))hdr.push('HDR');
        if(/\b(?:DoVi|Dolby[ .-]?Vision|DV)\b/i.test(raw))hdr.push('Dolby Vision');if(!hdr.length && /\bSDR\b/i.test(raw))hdr.push('SDR');
        var supplied=row.languages || info.languages || [];if(!Array.isArray(supplied))supplied=text(supplied).split(/[,/; ]+/);supplied.forEach(function(v){if(language(v))languages.push(language(v));});
        return {quality:quality,source:source,dimensions:dimensions,video:uniq(video),audio:uniq(audio),channels:uniq(channels),hdr:uniq(hdr),subtitles:uniq(subtitles),languages:uniq(languages),tags:uniq([quality,source].concat(video,hdr,audio,channels).filter(Boolean))};
    }
    function describe(row, cat) {
        cat = cat || catalogue({});
        var parsed = parseTitle(row.Title), identity = identify(row, cat, parsed), season = mapSeason(parsed, row.Title, cat, identity);
        var issues = parsed.issues.slice(); if (season.issue) issues.push(season.issue);
        var expected = season.expected || parsed.total, count = parsed.episodes.length || parsed.declaredCount;
        var completeness = 'unknown', status = cat.tv ? 'Состав неизвестен' : 'Фильм';
        if (cat.tv && !parsed.bundle && identity.state !== 'mismatch') {
            var covers = parsed.episodes.length && parsed.episodes[0] === 1 && parsed.episodes[parsed.episodes.length - 1] === count;
            if (expected && count && count < expected) { completeness = 'partial'; status = 'Неполный'; }
            else if (expected && count === expected && (covers || (parsed.declaredCount === expected && (parsed.countSource === 'out-of' || parsed.completeWord))) && !issues.length) { completeness = 'complete'; status = 'Полный · по заголовку'; }
            else if (count && expected && count > expected) issues.push('Число серий превышает ожидаемое');
        }
        if (issues.length) { completeness = 'conflict'; status = 'Состав требует проверки'; }
        if (identity.state === 'mismatch') { completeness = 'mismatch'; status = 'Другое произведение'; }
        var seasonLabel = cat.tv ? 'Сезон не указан' : '';
        if (parsed.bundle) seasonLabel = 'Сезоны ' + ranges(parsed.seasons) + ' · нумерация раздачи';
        else if (season.number !== null) {
            seasonLabel = 'Сезон ' + season.number;
            if (season.name && !/^сезон\s+\d+$/i.test(season.name)) seasonLabel += ' · ' + season.name;
            if (parsed.seasons.length && parsed.seasons[0] !== season.number) seasonLabel += ' (в раздаче: ' + parsed.seasons[0] + ')';
        } else if (parsed.seasons.length) seasonLabel = 'Сезон ' + ranges(parsed.seasons) + ' · по заголовку';
        var episodeLabel = '';
        if (cat.tv) {
            if (parsed.episodes.length) episodeLabel = 'Серии ' + ranges(parsed.episodes) + (expected ? ' из ' + expected : '');
            else if (parsed.declaredCount) episodeLabel = parsed.declaredCount + (expected ? ' из ' + expected : '') + ' серий · заявлено';
            else episodeLabel = 'Серии не указаны';
            if (parsed.bundle && count) episodeLabel += ' · на всю раздачу';
        }
        return { parsed: parsed, identity: identity, season: season, completeness: completeness, status: status, seasonLabel: seasonLabel, episodeLabel: episodeLabel, voices: voices(row, cat), technical: technical(row), issues: uniq(issues), catalogueTitle: identity.state === 'matched' ? cat.title : '' };
    }
    function infoHash(uri) {
        var decoded; try { decoded = decodeURIComponent(text(uri)); } catch (e) { decoded = text(uri); }
        var m = decoded.match(/(?:[?&]xt=urn:btih:|^)([a-f0-9]{40}|[a-z2-7]{32})(?:[&#]|$)/i);
        if (!m) return '';
        var h = m[1].toUpperCase(); if (h.length === 40) return h.toLowerCase();
        var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = 0, value = 0, out = '';
        for (var i = 0; i < h.length; i++) { value = (value << 5) | alphabet.indexOf(h[i]); bits += 5; if (bits >= 8) { bits -= 8; out += ('0' + ((value >>> bits) & 255).toString(16)).slice(-2); } }
        return out;
    }
    function releaseKey(row) {
        var h = infoHash(row.MagnetUri || row.Link); if (h) return 'btih:' + h;
        return row.Guid || row.Details || row.Link || [norm(row.Title), row.Size, row.Tracker].join('|');
    }
    function merge(groups) {
        var index = Object.create(null), result = [];
        groups.forEach(function (rows) { (rows || []).forEach(function (row) {
            var k = releaseKey(row), existing = index[k];
            if (!existing) { existing = copy(row); existing._tcSources = [text(row.Tracker)]; existing._tcTitles = [row.Title]; index[k] = existing; result.push(existing); }
            else {
                existing._tcSources = uniq(existing._tcSources.concat(text(row.Tracker)));
                existing._tcTitles = uniq(existing._tcTitles.concat(row.Title));
                // Retain the richest single probe, never pretend tracks from different samples form one file.
                if (probeStreams(row.ffprobe).length > probeStreams(existing.ffprobe).length) existing.ffprobe = row.ffprobe;
                if(!technical(existing).quality){var extra=technical(row);if(extra.quality)existing._tcResolution={quality:extra.quality,dimensions:extra.dimensions};}
                existing.Seeders = Math.max(+existing.Seeders || 0, +row.Seeders || 0);
                if (row.viewed) existing.viewed = true;
            }
        }); });
        return result;
    }
    function sort(rows, selectedSeason) {
        var ranks = { complete: 0, partial: 1, unknown: 2, conflict: 3, mismatch: 5 };
        return rows.map(function (r, i) { return { row: r, index: i }; }).sort(function (a, b) {
            var aa = a.row._tc, bb = b.row._tc;
            if (!aa || !bb) return a.index - b.index;
            var targetA = selectedSeason === undefined || selectedSeason === null || aa.season.number === +selectedSeason ? 0 : 1;
            var targetB = selectedSeason === undefined || selectedSeason === null || bb.season.number === +selectedSeason ? 0 : 1;
            var identities = { matched: 0, unknown: 1, mismatch: 2 };
            return identities[aa.identity.state] - identities[bb.identity.state] || targetA - targetB || ranks[aa.completeness] - ranks[bb.completeness] || (+b.row.Seeders || 0) - (+a.row.Seeders || 0) || a.index - b.index;
        }).map(function (r) { return r.row; });
    }
    return { version: '0.3.0', normalize: norm, parseTitle: parseTitle, catalogue: catalogue, queries: queries, identify: identify, describe: describe, technical: technical, infoHash: infoHash, releaseKey: releaseKey, merge: merge, sort: sort, ranges: ranges };
}));

/* Lampa adapter. Uses configured parser and Lampa's TMDB transport; no embedded API keys. */
(function (window) {
    'use strict';
    if (!window || window.TorrentCatalogue) return;
    var C = window.TorrentCatalogueCore, L, $, started = false, metadataCache = {}, installedAt = Date.now();
    var marker = '__torrentCataloguePage', generation = 0;
    function enabled() { var v = L.Storage.get('tc_enabled', true); return v !== false && v !== 'false'; }
    function once(fn) { var ran = false; return function () { if (!ran) { ran = true; return fn.apply(null, arguments); } }; }
    function copy(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); return r; }
    function escape(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\$/g, '&#36;'); }
    function metadata(movie, callback) {
        var source = movie.source || 'tmdb';
        // An unrelated provider's numeric identifier must never be sent as a TMDB identifier.
        if (source !== 'tmdb' || !/^\d+$/.test(String(movie.id || '')) || !L.Reguest || !L.TMDB) { callback(movie, {}); return; }
        var type = movie.original_name || movie.name || movie.number_of_seasons ? 'tv' : 'movie', cacheKey = type + ':' + movie.id;
        var cached = metadataCache[cacheKey];
        if (cached && Date.now() - cached.at < 3600000) { callback(cached.ru, cached.en); return; }
        var ru = movie, en = {}, requests = [], pending = 2;
        var done = once(function () {
            requests.forEach(function (n) { try { n.clear(); } catch (e) {} });
            clearTimeout(timer);
            if (ru !== movie || en.id) {
                if (Object.keys(metadataCache).length > 24) metadataCache = {};
                metadataCache[cacheKey] = { at: Date.now(), ru: ru, en: en };
            }
            callback(ru, en);
        });
        var timer = setTimeout(done, 3000);
        ['ru-RU', 'en-US'].forEach(function (language) {
            var n = new L.Reguest(); requests.push(n); n.timeout(2800);
            var finished = once(function (data) {
                if (data && +data.id === +movie.id) {
                    if (language === 'ru-RU') { ru = copy(movie); Object.keys(data).forEach(function (k) { ru[k] = data[k]; }); }
                    else en = data;
                }
                if (--pending === 0) done();
            });
            try {
                n.silent(L.TMDB.api(type + '/' + movie.id + '?api_key=' + encodeURIComponent(L.TMDB.key()) + '&language=' + language + (language === 'ru-RU' ? '&append_to_response=alternative_titles' : '')), finished, function () { finished(); });
            } catch (e) { finished(); }
        });
    }
    function enrich(data, page) {
        (data.Results || []).forEach(function (row) {
            Object.defineProperty(row, '_tc', { value: C.describe(row, page.catalogue), writable: true, configurable: true });
            Object.defineProperty(row, '_tcPage', { value: page, configurable: true });
            row.general = row.general || {};
            // This is also used by Lampa's season filter; do not leave its fallback "season 1".
            var seasons = row._tc.season.number !== null ? [row._tc.season.number] : row._tc.parsed.seasons.slice();
            if (row._tc.identity.state === 'mismatch' || row._tc.season.issue) seasons = [];
            row.general.seasons = seasons;
            row.general.season = seasons.length ? seasons.join('-') : '';
            row.general.episodes = row._tc.parsed.bundle ? '' : C.ranges(row._tc.parsed.episodes).replace(/–/g, '-');
        });
    }
    function installSearch() {
        var nativeGet = L.Parser.get, NativeComponent = L.Component.get('torrents');
        if (typeof nativeGet !== 'function' || typeof NativeComponent !== 'function') return false;
        L.Parser.get = function (params, success, failure) {
            var page = params && params[marker];
            if (!page || !enabled() || params.from_search || L.Storage.field('parser_torrent_type') !== 'jackett') return nativeGet.apply(this, arguments);
            var current = ++page.run, baseline = null, baselineDone = false, baselineError, supplementsDone = false, groups = [], deadline;
            function alive() { return !page.destroyed && current === page.run; }
            var complete = once(function () {
                clearTimeout(deadline);
                if (!alive()) return;
                if (!baseline && !groups.length) { failure(baselineError || 'Нет ответа парсера'); return; }
                var data = copy(baseline || {});
                data.Results = C.merge([baseline && baseline.Results || []].concat(groups));
                page.data = data;
                enrich(data, page);
                success(data);
            });
            function ready() { if (baselineDone && supplementsDone) complete(); }
            nativeGet.call(L.Parser, params, function (data) { if (!alive()) return; baseline = data; baselineDone = true; ready(); }, function (e) { if (!alive()) return; baselineError = e; baselineDone = true; ready(); });
            metadata(params.movie || {}, function (ru, en) {
                if (!alive()) return;
                page.catalogue = C.catalogue(ru, en);
                var names = params.clarification ? [] : C.queries(page.catalogue, params.search, 4).filter(function (name) { return C.normalize(name) !== C.normalize(params.search); });
                if (!names.length) { supplementsDone = true; ready(); return; }
                var next = 0, active = 0, pending = names.length, expired = false;
                deadline = setTimeout(function () { expired = true; supplementsDone = true; ready(); }, 8000);
                function pump() {
                    while (alive() && !expired && active < 2 && next < names.length) {
                        var query = copy(params); query.movie = copy(params.movie || {});
                        query.search = names[next++]; query.clarification = true;
                        // A series' premiere year is not a restriction on every later season's release year.
                        if (page.catalogue.tv) { query.movie.first_air_date = ''; query.movie.release_date = ''; }
                        delete query[marker]; active++;
                        (function (q) {
                            var finished = once(function (data) {
                                active--; pending--;
                                if (!alive() || expired) return;
                                if (data && data.Results) {
                                    // Supplemental searches contribute only catalogue-matched releases.
                                    groups.push(data.Results.filter(function (row) { return C.describe(row, page.catalogue).identity.state === 'matched'; }));
                                }
                                if (!pending) { supplementsDone = true; ready(); } else pump();
                            });
                            nativeGet.call(L.Parser, q, finished, function () { finished(); });
                        }(query));
                    }
                }
                pump();
            });
        };
        function EnhancedComponent(object) {
            var comp = new NativeComponent(object);
            if (!enabled()) return comp;
            var page = { id: ++generation, run: 0, destroyed: false, catalogue: C.catalogue(object.movie || {}), data: null };
            Object.defineProperty(object, marker, { value: page, configurable: true });
            var build = comp.build, sort = comp.sortResults, destroy = comp.destroy, start = comp.start;
            if (typeof start === 'function') comp.start = function () {var result=start.apply(comp,arguments);detailNavigation(comp);return result;};
            if (typeof build === 'function') comp.build = function () {
                if (page.data) enrich(page.data, page); // Native parse() replaces general immediately before build().
                return build.apply(comp, arguments);
            };
            if (typeof sort === 'function') comp.sortResults = function (need) {
                var result = sort.apply(comp, arguments);
                if (enabled() && need === 'popular' && page.data) page.data.Results = C.sort(page.data.Results, object.season);
                return result;
            };
            if (typeof destroy === 'function') comp.destroy = function () {
                page.destroyed = true; page.run++; page.data = null;
                delete object[marker]; return destroy.apply(comp, arguments);
            };
            return comp;
        }
        L.Component.add('torrents', EnhancedComponent);
        return true;
    }
    function pill(parent, label, kind) { if (label) $('<span class="tc-tag"></span>').addClass(kind ? 'tc-tag--' + kind : '').text(label).appendTo(parent); }
    function detailNavigation(comp) {
        var enabledController=L.Controller.enabled();if(!enabledController || enabledController.name!=='content')return;
        var controller=enabledController.controller;if(controller._tcInfoKeys)return;controller._tcInfoKeys=true;
        var old={right:controller.right,left:controller.left,up:controller.up,down:controller.down};
        function current(){var focused=window.Navigator && window.Navigator.getFocusedElement && window.Navigator.getFocusedElement(),root=comp.render(),scope=root && (root.nodeType?root:root[0]),row=focused && $(focused).closest('.torrent-item.tc-item')[0];return enabled() && scope && row && scope.contains(row)?{focused:focused,row:row,scope:scope}:null;}
        function focus(node,scope){L.Controller.collectionFocus(node,scope);}
        controller.right=function(){var c=current(),button=c && c.row.querySelector('.tc-info');if(button && c.focused!==button)focus(button,c.scope);else if(old.right)old.right();};
        controller.left=function(){var c=current();if(c && c.focused.classList.contains('tc-info'))focus(c.row,c.scope);else if(old.left)old.left();};
        function vertical(step,fallback){var c=current();if(c){var rows=Array.prototype.slice.call(c.scope.querySelectorAll('.torrent-item.tc-item')),next=rows[rows.indexOf(c.row)+step];if(next){focus(next,c.scope);return;}}if(fallback)fallback();}
        controller.up=function(){vertical(-1,old.up);};controller.down=function(){vertical(1,old.down);};
    }
    function details(row, m, owner, target) {
        if (!L.Modal || L.Modal.opened()) return;
        var controller = owner || L.Controller.enabled().name, body = $('<div class="about tc-full-details"></div>'), list = $('<dl></dl>').appendTo(body);
        function field(name,value) {if(!value)return;$('<dt></dt>').text(name).appendTo(list);$('<dd></dd>').text(value).appendTo(list);}
        field('Исходное название', (row._tcTitles || [row.Title]).join('\n'));
        field('Состав', [m.seasonLabel,m.episodeLabel].filter(Boolean).join(' · '));
        field('Характеристики',m.technical.tags.join(' · '));field('Разрешение',m.technical.dimensions);
        if(Number(row.bitrate)>0 && !m.seasonLabel)field('Битрейт (оценка)',row.bitrate+' Мбит/с');
        field('Аудио',m.voices.names.join(', '));field('Аудиодорожки',m.voices.tracks.join('\n'));
        field('Тип перевода',m.voices.types.join(', '));field('Релиз от',m.voices.author);
        field('Языки аудио',m.technical.languages.join(', '));field('Субтитры',m.technical.subtitles.join(', '));
        var types=row.info && row.info.types || [];field('Метки источника',Array.isArray(types)?types.join(', '):String(types));
        field('Трекеры',(row._tcSources || [row.Tracker]).filter(Boolean).join(', '));
        field('Размер',row.size || (L.Utils && L.Utils.bytesToSize(row.Size)) || '');
        field('Раздают / скачивают',(+row.Seeders || 0)+' / '+(+row.Peers || 0));
        L.Modal.open({title:'Сведения о раздаче',size:'large',html:body,onBack:function(){L.Modal.close();L.Controller.toggle(controller);if(target && target.isConnected)L.Controller.collectionFocus(target,$(target).closest('.torrent-list')[0] || document.body);}});
    }
    function render(e) {
        if (!e || !enabled()) return;
        var active = L.Activity.active() || {}, meta = e.element && (e.element._tc || C.describe(e.element,C.catalogue(active.movie || active.card || {})));
        if (e.type === 'onlong' && meta && Array.isArray(e.menu) && !e.menu.some(function(a){return a.tcDetails;})) {var owner=L.Controller.enabled().name;e.menu.unshift({title:'Сведения о раздаче',tcDetails:true,onSelect:function(){L.Select.hide();details(e.element,meta,owner,e.item && e.item[0]);}});}
        if ((e.type === 'onenter' || e.type === 'onlong') && e.item && e.item.hasClass('tc-item')) {
            setTimeout(function () { e.item.find('.torrent-item__viewed').appendTo(e.item.find('.tc-head')); }, 0);
        }
        if (e.type !== 'render' || !e.element) return;
        // Wait until theme listeners (including snack_tv) have built their row, regardless of load order.
        setTimeout(function () {
                var row = e.element, item = e.item, m = meta;
                if(m)m.technical=C.technical(row);
            if (!item || !item.length || (row._tcPage && row._tcPage.destroyed) || item.find('.tc-row').length) return;
            try {
                var content = $('<div class="tc-row"></div>'), head = $('<div class="tc-head"></div>').appendTo(content);
                var summary = $('<div class="tc-summary"></div>').appendTo(head);
                $('<strong class="tc-season"></strong>').text(m.seasonLabel ? (m.parsed.bundle ? 'Сезоны '+C.ranges(m.parsed.seasons) : m.season.number!==null ? 'Сезон '+m.season.number : m.parsed.seasons.length ? 'Сезон '+C.ranges(m.parsed.seasons) : 'Сезон не указан') : m.technical.quality || m.technical.source || 'Разрешение не указано').appendTo(summary);
                if (m.episodeLabel) $('<span class="tc-episodes"></span>').text(m.episodeLabel.replace(/ · заявлено/g, '')).appendTo(summary);
                if (m.seasonLabel && m.technical.quality) pill(summary,m.technical.quality,'quality');
                var right = $('<div class="tc-right"></div>').appendTo(head);
                $('<span class="tc-size"></span>').text(row.size || (L.Utils && L.Utils.bytesToSize(row.Size)) || '').appendTo(right);
                $('<span class="tc-seeds"></span>').text('Раздают ' + (+row.Seeders || 0) + (row.Peers !== undefined ? ' · Качают ' + (+row.Peers || 0) : '')).appendTo(right);
                var tags = $('<div class="tc-tags"></div>').appendTo(content);
                m.technical.tags.filter(function(v){return v!==m.technical.quality && (m.seasonLabel || m.technical.quality || v!==m.technical.source);}).slice(0,8).forEach(function(v){pill(tags,v);});
                m.voices.types.forEach(function(v){pill(tags,v,'translation');});
                if(Number(row.bitrate)>0 && !m.seasonLabel)pill(tags,'≈ '+row.bitrate+' Мбит/с');
                if (m.technical.subtitles.length) pill(tags,'Субтитры '+m.technical.subtitles.join('/'));
                if (!tags.children().length) tags.remove();
                var voices = $('<div class="tc-voices"></div>').appendTo(content), voiceTags=m.voices.names;
                if(voiceTags.length) $('<span class="tc-voice-names"></span>').text(voiceTags.join(' · ')).appendTo(voices);
                if(m.technical.languages.length) $('<span class="tc-languages"></span>').text(m.technical.languages.join(' / ')).appendTo(voices);
                if(!voices.children().length) voices.remove();
                if (m.identity.state==='mismatch') $('<div class="tc-warning"></div>').text('Другое произведение').appendTo(content);
                var foot = $('<div class="tc-foot"></div>').appendTo(content);
                var source=$('<span class="tc-source"></span>').text((row._tcSources || [row.Tracker]).filter(Boolean).join(', ') + (row.PublishDate ? ' · ' + String(row.PublishDate).slice(0, 10) : '')).appendTo(foot);
                $('<span class="tc-release-name"></span>').text(' · '+row.Title).appendTo(source);
                $('<button type="button" class="tc-info selector" aria-haspopup="dialog" aria-label="Сведения о раздаче">Сведения</button>').appendTo(foot).on('click hover:enter',function(event){event.preventDefault();event.stopImmediatePropagation();details(row,m,null,this);}).on('keydown',function(event){if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();details(row,m,null,this);}});
                content.attr('title', row.Title);
                item.append(content).addClass('tc-item');
                item.find('.torrent-item__viewed').appendTo(head);
                // Keep the native row and all event handlers. Only its visual fragments are superseded.
            } catch (err) { if (content) content.remove(); item.removeClass('tc-item'); }
        }, 0);
    }
    function styles() {
        var css = '.tc-item{padding:1.1em!important;border-radius:1em!important;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10);margin-bottom:.6em;color:#f0f2f5}' +
            '.torrent-list .torrent-item.tc-item.focus,.torrent-list .torrent-item.tc-item:hover{background:#26333f!important;color:#fff!important;border-color:#b7d8ef;box-shadow:0 0 0 2px #b7d8ef}' +
            '.tc-item>.torrent-item__title,.tc-item>.torrent-item__ffprobe,.tc-item>.torrent-item__details,.tc-item>.stv-tor{display:none!important}' +
            '.tc-head{display:flex;align-items:center;gap:1em;justify-content:space-between}.tc-title{font-size:1.15em;font-weight:600;overflow-wrap:anywhere;min-width:0}.tc-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:.25em;white-space:nowrap}.tc-size{font-size:1.15em;font-weight:700;color:#fff}.tc-seeds{font-size:1em;font-weight:700;color:#72dc87}.tc-item .tc-head .torrent-item__viewed{position:static;width:1em;height:1em;flex-shrink:0}' +
            '.tc-tags{display:flex;flex-wrap:wrap;gap:.4em;margin:.65em 0}.tc-tag{border:1px solid rgba(255,255,255,.15);border-radius:.5em;padding:.25em .5em;font-size:.8em;line-height:1.4}.tc-tag--voice{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.12);color:#e8edf2}' +
            '.tc-tag--complete{color:#a8ebc8;border-color:#3a6b56}.tc-tag--partial{color:#ffe0a3;border-color:#80683c}.tc-tag--conflict,.tc-tag--mismatch{color:#ffb7af;border-color:#86554f}.tc-tag--unknown{color:#d0d6de}' +
            '.tc-muted{color:#aeb5bf}.tc-foot{margin-top:.75em;color:#aeb5bf;font-size:.8em}.tc-original{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#b7bdc6;font-size:.8em;line-height:1.5}' +
            '@media(max-width:600px){.tc-head{display:block}.tc-size{display:block;font-size:.85em;margin-top:.35em}}';
        $('<style id="torrent-catalogue-style"></style>').text(css).appendTo('head');
    }
    function settings() {
        if (!L.SettingsApi) return;
        L.SettingsApi.addParam({ component: 'parser', param: { name: 'tc_enabled', type: 'trigger', default: true }, field: { name: 'Название и состав раздач', description: 'Варианты названия из TMDB, сезоны и серии, полные раздачи выше неполных. После переключения откройте поиск заново.' } });
    }
    function start() {
        if (started) return true;
        L = window.Lampa; $ = window.jQuery || window.$;
        if (!C || !L || !$ || !L.Parser || !L.Component || !L.Listener) return false;
        if (!installSearch()) return false;
        styles(); settings(); L.Listener.follow('torrent', render); started = true;
        window.TorrentCatalogue = { version: C.version, installedAt: installedAt, clearMetadataCache: function () { metadataCache = {}; } };
        return true;
    }
    if (!start()) {
        // Lampa plugins may load before appready; no polling or duplicate registrations.
        if (window.Lampa && window.Lampa.Listener) window.Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
    }
}(typeof window !== 'undefined' ? window : null));

