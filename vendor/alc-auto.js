(function () {
  'use strict';
  // «Автопілот / Autopilot» - one button next to Play: asks all online sources at once, merges identical
  // voice-overs (preferred languages first, favourites next, the rest in a sub-menu), picks the
  // best source for the chosen voice and, if playback fails (fatal player error), switches to the
  // next source with the same voice and continues from the saved position.
  if (window.plugin_alc_auto_ready) return;
  window.plugin_alc_auto_ready = true;
  var VERSION = '2.1.34';

  /*cfg*/var PACK = (function () { try { var k = [243, 97, 214, 43, 23, 140, 67], c = atob('iEO1CS2sYZINtXR2+TecPqBCcvth30H0RzW2Y9EV+EZyozOcEb9HSPwslg2JSXj4Yd9B9E01tmOoQwawxzyTT7Fp+6esk0tBB6bGDpNNsFQLxzOTSLFm+6Rc+yPc9vqXXPMi4AaUxgyTTbBX+pVdwyPRBpbGA5J9sFT6ll3M07Fn+6JdwiPeBpDHPJJxsWv7qaJjI/QHqsc3k0tBBpnGB2Mj1gabN1z+I9kHrjdc9CPRBpTHN5NDsFT7r1z4I9n2yZcYYyLgBpTGDJNNsFf7r13BI9T2+pasknGxaPukXP3fQQaRxg6TTUEGmcc7knyxbQvHOJNGsWv6m1zwI9n4CTusYSP6BpvHMJNMsWYLxhpjIucGnsc1YyPeBpDHPJNAsED7qqyTTLFo+p9c+yLhB6XGApJxsFr6ll3M07Fn+6Jc9CPbBpXGBJJxsWj7pVz+I9/4C8cjk0mwX/uprJNBsW4LxzuTQ0EGlsc0knZBBpzHPJNMsW37p13BI9kGkMc0YxHhQgvGDZNMsW76lVzzI9gHqcc5YyPW9vqVXP0j0gaVO6ySdrBU+6msk0GxYfqYXPHTsWX6l1z9IukHvTmub9NDmkp6/CLTALhPN/grmhL2W3v5JJoP9kpl6WOVE7NOOawKlUGvRGKsM5IIsgtx4zHTFb5OeqBjkhK9C2PkJtMOuE43+yucQaJEeOdjig6jWTfhLJ0ErwU10T4='), d = '', i; for (i = 0; i < c.length; i++) d += String.fromCharCode(c.charCodeAt(i) ^ k[i % k.length]); return JSON.parse(decodeURIComponent(escape(d))); } catch (e) { return {}; } })();/*cfg-end*/

  // In this file, in order (sections marked «=== N. ===»):
  //   1 server address · 2 DATA (sources, voice words, studios: community JSON) and timeouts ·
  //   3 strings (ru / uk / en) and small helpers · 4 requests to our server, finding it ·
  //   5 sources: list, on / off, the search URL, ranking · 6 languages: preferred, names, scripts ·
  //   7 voices: classification, studio directory, favourites, the choice per card, episode numbers ·
  //   8 Session: search, seasons, merged voice list, voice pages, sound comparison, the sessions kept ·
  //   9 playback: audio tracks, source fallback, the player's voice list, stub guard, stall watchdog,
  //     subtitles, external players · 10 screen: voice / progress helpers, TMDB names, the screen
  //     model (TitleModel, no DOM) and the view (AutoView) · 11 quick start · 12 API for the pack's
  //     other plugins (alc_auto_api) · 13 settings, the card's button, boot tasks; debug export last.
  // Load order matters for the top-level values: DATA's device override comes before everything
  // built from DATA (regexps, studios), SEP before wordsRe() runs at load.

  // ======================= 1. SERVER ADDRESS =======================
  // ---------- your Lampac server ----------
  // Any Lampac the viewer runs (Al(co)pac / lampac-go, Lampac NextGen; not rch mode). The address: the
  // setting «Адрес вашего Lampac», else found once and remembered on this device (alc_auto_srv): the
  // host this script came from or the page's host if it is a Lampac at all (also one asking to sign
  // in), else the hosts of the plugins installed in Lampa (whatever their file names; a Lampac is known
  // by its answer to /lite/events), the first that gives its list (see withServer). BASE is '' until then
  // (see withServer); none answers: the card gets no button (Lampa's own «Watch» stays the way in) and
  // whatever is opened anyway says so instead of «nothing found»; an address set that gives no answer:
  // «server cannot be reached» with a likely reason (downWhy).
  var BASE = '';
  function originOf(u) { var m = /^(https?:\/\/[^\/?#]+)/i.exec(String(u || '')); return m ? m[1] : ''; }
  var SCRIPT_ORIGIN = (function () { try { return originOf(document.currentScript && document.currentScript.src); } catch (e) { return ''; } })();

  // ======================= 2. DATA (community-editable, plain JSON) =======================
  // Knowledge about sources and voice names lives here, not in the code below; nothing in the code
  // depends on a particular entry. Add entries freely; a device can extend it with Lampa.Storage
  // 'alc_auto_data' (same shape, merged over this block).
  //  sources  : start priority p inside one voice (the dynamic ranking takes over with history) and
  //             lang = the language of the source's voice-overs when the source does not say it
  //             itself (our JS modules send voice_lang; Go balancers do not)
  //  not_sources : entries of the server's list known to be service modules, never asked (a hint: others
  //             are found by their answer, see notSource)
  //  anime    : sources asked only for anime
  //  kinds    : words that name a kind of voice-over (matched as word starts; <= 3 letters: whole words)
  //  subs     : words of "original audio + subtitles" entries;  dead: entries without a stream
  //  placeholders : what some sources show instead of a voice name ("default"), i.e. an unnamed voice
  //  studios  : studio name + its spellings (merges "ICTV", "ictv", "ICTV [1080]" from several sources)
  /*data*/var DATA = {
    "sources": {
      "uaserials": { "p": 100 }, "eneyida": { "p": 92, "lang": "uk" }, "uaflix": { "p": 88 }, "filmix": { "p": 84 },
      "kinoukr": { "p": 72 }, "klonfun": { "p": 68 }, "makhno": { "p": 80 }, "franko": { "p": 66, "lang": "uk" }, "uakino": { "p": 64 },
      "starlight": { "p": 62, "lang": "uk" }, "oneplusone": { "p": 62, "lang": "uk" }
    },
    "not_sources": ["alc_auto", "alcauto", "auto", "alcstats", "ossubs", "kpid", "animeid", "uabadge", "subsx", "alcmedia"],
    "anime": { "anitube": { "p": 76, "lang": "uk" }, "unimay": { "p": 74 }, "mikai": { "p": 73 }, "bamboo": { "p": 70 }, "animeon": { "p": 66 } },
    "kinds": {
      "dub": ["дубляж", "дублир", "дубльов", "dub", "dubbing", "dubbed"],
      "avo": ["одноголос", "авторськ", "авторск", "avo", "single voice"],
      "mvo": ["багатогол", "многогол", "двогол", "двохгол", "двухгол", "закадров", "зак", "mvo", "dvo", "voice-over", "voiceover"]
    },
    "subs": ["субтит", "subtit", "sub", "subs"],
    "forced": ["forced", "форсир", "форсов", "надписи", "написи"],
    "dead": ["заблокирован", "правообладател", "недоступн", "blocked", "unavailable", "delete", "deleted", "удален", "видалено", "видалений"],
    "placeholders": ["не визначено", "по умолчанию", "за замовчуванням", "оригінал", "оригинал", "default", "original"],
    "studios": [
      { "name": "AMC", "match": ["amc", "амс"] }, { "name": "Інтер", "match": ["інтер", "интер", "inter", "iнтер"] },
      { "name": "ICTV", "lang": "uk", "match": ["ictv"] }, { "name": "1+1", "lang": "uk", "match": ["1+1", "1 + 1"] }, { "name": "СТБ", "lang": "uk", "match": ["стб", "stb"] },
      { "name": "Новий канал", "lang": "uk", "match": ["новий канал", "novy kanal", "новый канал"] }, { "name": "НЛО TV", "lang": "uk", "match": ["нло", "nlo"] },
      { "name": "Так Треба Продакшн", "lang": "uk", "match": ["так треба", "tak treba"] }, { "name": "Цікава Ідея", "lang": "uk", "match": ["цікава ідея", "cikava", "cikava ideya", "tsikava ideya"] },
      { "name": "QTV", "lang": "uk", "match": ["qtv"] }, { "name": "ТЕТ", "lang": "uk", "match": ["тет", "tet"] }, { "name": "Netflix", "match": ["netflix", "нетфлікс"] },
      { "name": "Le Doyen", "lang": "uk", "match": ["le doyen", "ле доєн", "ледоєн", "ле дуаєн"] }, { "name": "Дніпрофільм", "lang": "uk", "match": ["дніпрофільм", "dniprofilm", "днепрофильм"] },
      { "name": "Постмодерн", "lang": "uk", "match": ["postmodern", "постмодерн"] }, { "name": "Megogo", "match": ["megogo", "мегого"] },
      { "name": "Sweet.tv", "lang": "uk", "match": ["sweet.tv", "sweettv"] },
      { "name": "Гуртом", "lang": "uk", "match": ["гуртом", "hurtom", "gurtom"] }, { "name": "Струм", "lang": "uk", "match": ["струм", "strum"] },
      { "name": "Омікрон", "lang": "uk", "match": ["омікрон", "omikron", "омикрон"] }, { "name": "Плюс-Плюс", "lang": "uk", "match": ["плюсплюс", "плюс-плюс", "плюс плюс", "plusplus"] },
      { "name": "Amanogawa", "lang": "uk", "match": ["amanogawa", "аманогава", "аманоґава"] }, { "name": "FanVoxUA", "lang": "uk", "match": ["fanvoxua", "fanvox", "fanwoxua", "фанвоксюа"] }, { "name": "LostFilm", "match": ["lostfilm", "лостфильм"] },
      { "name": "Гоблин", "match": ["goblin", "гоблин", "пучков"] }, { "name": "Сербин", "match": ["сербин", "serbin"] },
      { "name": "Гаврилов", "match": ["гаврилов"] }, { "name": "Amedia", "match": ["amedia", "амедиа"] },
      { "name": "TVShows", "match": ["tvshows", "твшоус"] }, { "name": "NewStudio", "match": ["newstudio", "нью студио"] },
      { "name": "ColdFilm", "match": ["coldfilm", "колдфильм"] }, { "name": "Jaskier", "match": ["jaskier", "яскьер"] },
      { "name": "FoxCrime", "match": ["foxcrime", "fox crime"] }, { "name": "Paramount", "match": ["paramount"] },
      { "name": "Babak", "match": ["бабак", "babak"] },
      { "name": "Unimay", "lang": "uk", "match": ["unimay", "юнімей", "унімей"] }, { "name": "InariOkami", "lang": "uk", "match": ["inari okami"] }, { "name": "InariDuB", "lang": "uk", "match": ["inari", "інарі"] },
      { "name": "Київстар ТБ", "lang": "uk", "match": ["київстар", "киевстар", "kyivstar"] },
      { "name": "Novamedia", "match": ["новамедиа", "novamedia"] }, { "name": "Octopus", "match": ["октопус", "octopus"] },
      { "name": "HDRezka", "match": ["hdrezka", "rezkastudio", "rezka", "хдрезка", "резка"] },
      { "name": "Red Head Sound", "match": ["red head sound", "ред хед саунд"] },
      { "name": "Кубик в Кубе", "match": ["кубик в кубе", "kubik v kube", "kubik3"] }, { "name": "BaibaKo", "match": ["baibako", "байбако"] },
      { "name": "AlexFilm", "match": ["alexfilm", "алексфильм"] }, { "name": "IdeaFilm", "match": ["ideafilm", "идеафильм", "идеяфильм"] },
      { "name": "AniLibria", "match": ["anilibria", "анилибрия", "aniliberty", "анилиберти"] },
      { "name": "AniDUB", "match": ["anidub", "анидаб"] }, { "name": "AnimeVost", "match": ["animevost", "анимевост"] },
      { "name": "Пифагор", "match": ["пифагор", "pifagor"] }, { "name": "Tretyakoff Production", "match": ["tretyakoff", "третьякофф"] },
      { "name": "VHS Record", "match": ["vhs record"] }, { "name": "Sweet Sound Studio", "match": ["sweet sound studio", "sound sweet studio"] },
      { "name": "StudioBand", "match": ["studioband", "студийная банда"] }, { "name": "AniMedia", "match": ["animedia", "анимедиа"] },
      { "name": "AniStar", "match": ["anistar", "анистар"] }, { "name": "AniFilm", "match": ["anifilm", "анифильм"] },
      { "name": "AniMaunt", "match": ["animaunt", "анимаунт"] }, { "name": "Reanimedia", "match": ["reanimedia", "реанимедиа"] },
      { "name": "Crunchyroll", "match": ["crunchyroll", "кранчиролл"] }, { "name": "Wakanim", "match": ["wakanim", "ваканим"] },
      { "name": "KANSAI", "match": ["kansai"] }, { "name": "Onibaku", "match": ["onibaku", "онибаку"] },
      { "name": "DubLik", "match": ["dublik"] }, { "name": "ТО Дубляжная", "match": ["то дубляжная"] },
      { "name": "AniLeague.TV", "match": ["anileague"] }, { "name": "Первый канал", "match": ["первый канал"] },
      { "name": "Е. Лурье", "match": ["е. лурье", "евгения лурье"] },
      { "name": "UAFlix", "lang": "uk", "match": ["uaflix", "юафлікс", "уафлікс"] },
      { "name": "Струґачка", "lang": "uk", "match": ["струґачка", "стругачка", "strugachka"] },
      { "name": "Колодій Трейлерів", "lang": "uk", "match": ["колодій трейлерів", "kolodii trailers", "kolodiytrailers"] },
      { "name": "UkrDub", "lang": "uk", "match": ["ukrdub", "укрдаб", "укрдуб"] },
      { "name": "UATeam", "lang": "uk", "match": ["uateam", "юатім"] },
      { "name": "Робота Голосом", "lang": "uk", "match": ["робота голосом", "robota holosom"] },
      { "name": "UFDUB", "lang": "uk", "match": ["ufdub", "ukrainefastdub", "юфдаб"] },
      { "name": "AniUA", "lang": "uk", "match": ["aniua", "аніюа"] }, { "name": "Суспільне", "lang": "uk", "match": ["суспільне", "suspilne"] },
      { "name": "Enter-Film", "lang": "uk", "match": ["enter-film", "ентерфільм"] },
      { "name": "Anime Classic", "lang": "uk", "match": ["anime classic"] }, { "name": "AniUnion", "lang": "uk", "match": ["aniunion"] },
      { "name": "BULBUL MEDIA", "lang": "uk", "match": ["bulbul media"] }, { "name": "CreativUa", "lang": "uk", "match": ["creativua"] },
      { "name": "EspadaStudio", "lang": "uk", "match": ["espada studio", "еспада"] },
      { "name": "FukuroNachi", "lang": "uk", "match": ["fukuronachi"] }, { "name": "Gwean & Maslinka", "lang": "uk", "match": ["gwean"] },
      { "name": "Kagawy", "lang": "uk", "match": ["kagawy"] }, { "name": "QUAM Project", "lang": "uk", "match": ["quam project"] },
      { "name": "SaloVpalo", "lang": "uk", "match": ["salovpalo", "сало впало"] }, { "name": "Shirifugen", "lang": "uk", "match": ["shirifugen"] },
      { "name": "Studio LOLICORN", "lang": "uk", "match": ["lolicorn"] }, { "name": "UAMAX", "lang": "uk", "match": ["uamax"] },
      { "name": "UASPF Studio", "lang": "uk", "match": ["uaspf"] }, { "name": "The VOP", "lang": "uk", "match": ["the vop"] },
      { "name": "Voices Band", "lang": "uk", "match": ["voices band"] }, { "name": "ГарячіВареники", "lang": "uk", "match": ["гарячі вареники"] },
      { "name": "Кізукі", "lang": "uk", "match": ["кізукі"] }, { "name": "Студія «Сокира»", "lang": "uk", "match": ["сокира"] },
      { "name": "Cinema Sound Production", "lang": "uk", "match": ["cinema sound", "сінема саунд", "синема саунд"] },
      { "name": "Didko Studio", "lang": "uk", "match": ["didko"] }, { "name": "Glass Moon", "lang": "uk", "match": ["glass moon", "глас мун"] },
      { "name": "Clan Kaizoku", "lang": "uk", "match": ["clan kaizoku", "клан кайзоку"] },
      { "name": "Togarashi", "lang": "uk", "match": ["togarashi", "тогараші"] },
      { "name": "HATOSHI", "lang": "uk", "match": ["hatoshi", "хатоші"] }, { "name": "Рідний Голос", "lang": "uk", "match": ["рідний голос"] },
      { "name": "Студія Качур", "lang": "uk", "match": ["студія качур", "kachur studio"] },
      { "name": "DZUSKI", "lang": "uk", "match": ["dzuski", "дзуські"] }, { "name": "VRdub", "lang": "uk", "match": ["vrdub"] },
      { "name": "BambooUA", "lang": "uk", "match": ["bambooua", "bamboo"] },
      { "name": "Lem0nka Voice Project", "lang": "uk", "match": ["lem0nka"] },
      { "name": "Melodic Voice Studio", "lang": "uk", "match": ["melodic voice", "melvoice"] },
      { "name": "В одне рило", "lang": "uk", "match": ["в одне рило"] }, { "name": "SVOЇ Production", "lang": "uk", "match": ["svoї production"] },
      { "name": "UASpeedFilms", "lang": "uk", "match": ["uaspeedfilms"] }, { "name": "Твій Продакшн", "lang": "uk", "match": ["твій продакшн"] },
      { "name": "Три Крапки", "lang": "uk", "match": ["три крапки"] }, { "name": "FutaShine", "lang": "uk", "match": ["futashine"] },
      { "name": "Blueberry Studio", "lang": "uk", "match": ["blueberry", "блюберрі"] },
      { "name": "Майстерня Слів", "lang": "uk", "match": ["майстерня слів", "maysternya sliv"] },
      { "name": "Yaniam", "lang": "uk", "match": ["yaniam"] }, { "name": "Animesh", "lang": "uk", "match": ["animesh"] },
      { "name": "CloverDUB", "lang": "uk", "match": ["cloverdub"] }, { "name": "MoonAnime", "lang": "uk", "match": ["moonanime"] },
      { "name": "TATAKAE", "lang": "uk", "match": ["tatakae"] }, { "name": "10GU", "lang": "uk", "match": ["10gu"] },
      { "name": "AleksAlo", "lang": "uk", "match": ["aleksalo"] }, { "name": "AND5 Studio", "lang": "uk", "match": ["and5"] },
      { "name": "AniFanUA", "lang": "uk", "match": ["anifanua"] }, { "name": "AniKoe", "lang": "uk", "match": ["anikoe"] },
      { "name": "AnimeOriginal", "lang": "uk", "match": ["anime original"] },
      { "name": "BorshDUB", "lang": "uk", "match": ["borshdub", "борщдаб"] },
      { "name": "Боку но підвал", "lang": "uk", "match": ["боку но підвал", "boku no pidval"] },
      { "name": "Crystal Shade", "lang": "uk", "match": ["crystal shade"] }, { "name": "Flayzer", "lang": "uk", "match": ["flayzer"] },
      { "name": "HajimeDUB", "lang": "uk", "match": ["hajime dub"] }, { "name": "k0wbassa", "lang": "uk", "match": ["k0wbassa"] },
      { "name": "Kafori", "lang": "uk", "match": ["kafori"] }, { "name": "Kawaii Dub", "lang": "uk", "match": ["kawaii dub"] },
      { "name": "Life Cycle", "lang": "uk", "match": ["life cycle"] }, { "name": "Milki-Dub", "lang": "uk", "match": ["milki-dub"] },
      { "name": "MrCrashFox", "lang": "uk", "match": ["mrcrashfox"] }, { "name": "p1rsti", "lang": "uk", "match": ["p1rsti"] },
      { "name": "RaccoonHouse", "lang": "uk", "match": ["raccoon house"] },
      { "name": "Ryuka Studio", "lang": "uk", "match": ["ryuka"] }, { "name": "Shield Team", "lang": "uk", "match": ["shield team"] },
      { "name": "Чорний Верес", "lang": "uk", "match": ["чорний верес"] }, { "name": "Project U&A Lines", "lang": "uk", "match": ["u&a lines"] },
      { "name": "AniTube", "lang": "uk", "match": ["anitube", "анітюб"] },
      { "name": "СвійDUB", "lang": "uk", "match": ["свійdub", "sviydub", "svijdub"] },
      { "name": "Kioto anime", "lang": "uk", "match": ["kioto anime", "кіото аніме"] }
    ]
  };/*data-end*/
  try {
    var over = Lampa.Storage.get('alc_auto_data', '') || null;
    if (typeof over === 'string' && over) over = JSON.parse(over);
    if (over && typeof over === 'object') for (var dk in over) {
      if (isArr(DATA[dk])) DATA[dk] = (over[dk] || []).concat(DATA[dk]);
      else if (DATA[dk] && typeof DATA[dk] === 'object') for (var dk2 in over[dk]) DATA[dk][dk2] = over[dk][dk2];
      else DATA[dk] = over[dk];
    }
  } catch (e) {}
  // Source priority inside one voice (higher = tried first)
  var SOURCES = DATA.sources || {};
  // Extra sources: Lampa.Storage 'alc_auto_sources' = '{"name": priority, ...}' (e.g. '{"mysource": 40}').
  try {
    var extra = Lampa.Storage.get('alc_auto_sources', '') || {};   // Storage.get already parses JSON
    if (typeof extra === 'string') extra = JSON.parse(extra);
    for (var ek in extra) if (!SOURCES[ek]) SOURCES[ek] = { p: parseInt(extra[ek], 10) || 40 };
  } catch (e) {}
  var ANIME = DATA.anime || {};
  var REQ_TIMEOUT = 20000;   // per source request
  var SOFT_WAIT = 2500;      // season page: wait this long after the first answer for slower sources
  var ROOT_WAIT = 1000;      // first search: show seasons/voices this long after the first answer
  var VOICE_WAIT = 6000;    // remembered voice: wait this long for slow sources before falling back
  var failures = {};         // source -> {n, t}: recent fatal errors demote a source for a while
  var FAIL_TTL = 30 * 60 * 1000;

  // ======================= 3. STRINGS AND HELPERS =======================
  // ---------- helpers ----------
  function noty(s) { try { Lampa.Noty.show(s); } catch (e) {} }
  // is this play object still the one in Lampa's player? (every async answer about a play asks it
  // before touching the player: the viewer may have closed it or moved on to another episode)
  function isCurrent(data) { try { return !!data && Lampa.Player.opened() && Lampa.Player.playdata() === data; } catch (e) { return false; } }
  // the player plays one of our streams now (not a trailer, not another plugin's video)
  function playingOurs() {
    var d = null;
    try { if (!Lampa.Player.opened()) return false; d = Lampa.Player.playdata(); } catch (e) { return false; }
    return !!(d && (d.alc_src || d.alc_base));
  }
  // a field of a play element for our own use: not enumerable, so it stays out of JSON.stringify (the
  // external-player paths serialise the play data) and out of copies made with for..in
  function hidden(o, k, v) {
    try { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); } catch (e) { try { o[k] = v; } catch (x) {} }
    return v;
  }
  var HIDDEN = ['alc_session', 'alc_pb', 'alc_tinfo', 'card'];
  function copyHidden(from, to) {
    if (from && to) HIDDEN.forEach(function (k) { if (from[k] !== undefined && (from !== to || Object.prototype.propertyIsEnumerable.call(to, k))) hidden(to, k, from[k]); });
  }

  // ---------- interface language: ru / uk / en (Lampa setting; anything else -> en) ----------
  var STR = {
    watch:        ['Смотреть', 'Дивитися', 'Watch'],
    plugin_name:  ['Воспроизведение', 'Перегляд', 'Playback'],
    season:       ['Сезон', 'Сезон', 'Season'],
    voice:        ['Озвучка', 'Озвучення', 'Voice-over'],
    season_n:     ['Сезон %s', 'Сезон %s', 'Season %s'],
    episode_n:    ['Серия %s', 'Серія %s', 'Episode %s'],
    src_n:        ['%s ист.', '%s джер.', '%s src'],
    not_found:    ['Ничего не найдено', 'Нічого не знайдено', 'Nothing found'],
    nf_title:     ['Ни один источник не нашёл этот тайтл', 'Жодне джерело не знайшло цей тайтл', 'No source has this title'],
    nf_seasons:   ['Нет сезонов ни в одном источнике', 'Жодне джерело не має сезонів', 'No source has any season'],
    nf_stream:    ['Ни один источник не отдал поток', 'Жодне джерело не віддало потік', 'No source returned a stream'],
    no_more_src:  ['Озвучка «%s»: других источников нет', 'Озвучення «%s»: інших джерел немає', '“%s”: no other sources'],
    all_voices:   ['Все озвучки', 'Усі озвучення', 'All voice-overs'],
    source_item:  ['Источник: %s', 'Джерело: %s', 'Source: %s'],
    variant_n:    ['вариант %s', 'варіант %s', 'variant %s'],
    src_auto:     ['Автоматически', 'Автоматично', 'Automatic'],
    src_auto_d:   ['Лучший работающий источник, остальные - запасные', 'Найкраще робоче джерело, решта - запасні', 'Best working source, the others as fallback'],
    voice_dead:   ['Озвучка «%s»: все источники не отвечают', 'Озвучення «%s»: усі джерела не відповідають', '“%s”: every source is down'],
    poll_again:   ['Опросить источники снова', 'Опитати джерела знову', 'Ask the sources again'],
    poll_again_d: ['Свежие ссылки той же озвучки', 'Свіжі посилання того ж озвучення', 'Fresh links for the same voice-over'],
    polling:      ['Опрашиваю источники…', 'Опитую джерела…', 'Asking the sources…'],
    stalled:      ['Поток перестал отвечать', 'Потік перестав відповідати', 'The stream stopped responding'],
    tap_play:     ['Коснитесь экрана, чтобы начать воспроизведение', 'Торкніться екрана, щоб почати відтворення', 'Tap the screen to start playback'],
    other_voice:  ['другая озвучка с того же места', 'інше озвучення з того ж місця', 'another voice-over, same point'],
    src_again:    ['Поток %s оборвался - перезапускаю с того же места', 'Потік %s обірвався - перезапускаю з того ж місця', 'Stream from %s dropped - restarting at the same point'],
    switch_src:   ['Источник %s не отвечает - переключаю на %s', 'Джерело %s не відповідає - перемикаю на %s', 'Source %s failed - switching to %s'],
    switching:    ['Озвучка: %s…', 'Озвучення: %s…', 'Voice-over: %s…'],
    no_voice_ep:  ['Для этой серии озвучки «%s» нет', 'Для цієї серії озвучення «%s» немає', 'No “%s” for this episode'],
    airs_on:      ['выйдет %s', 'вийде %s', 'airs %s'],
    no_src:       ['нет в источниках', 'немає в джерелах', 'not in sources'],
    autosubs:     ['Автосубтитры', 'Автосубтитри', 'Auto subtitles'],
    autosubs_d:   ['Язык - первый из «Субтитры»', 'Мова - перша з «Субтитри»', 'Language: the first of “Subtitles”'],
    as_off:       ['выкл', 'вимк.', 'off'],
    as_forced:    ['только форсированные', 'лише форсовані', 'forced only'],
    as_voice:     ['по озвучке', 'за озвученням', 'by voice-over'],
    episodes_list:['Список серий', 'Список серій', 'Episode list'],
    choose_voice: ['Выбрать озвучку', 'Обрати озвучення', 'Choose voice-over'],
    continue_se:  ['Продолжить · S%sE%s', 'Продовжити · S%sE%s', 'Continue · S%sE%s'],
    community:    ['Поддержка (Telegram)', 'Підтримка (Telegram)', 'Support (Telegram)'],
    set_langs_d:  ['Коды языков по приоритету: uk,en; «-» - без приоритета', 'Коди мов за пріоритетом: uk,en; «-» - без пріоритету', 'Language codes by priority: uk,en; “-” = none'],
    unnamed:      ['Озвучка без названия', 'Озвучення без назви', 'Unnamed voice-over'],
    k_dub:        ['Дубляж', 'Дубляж', 'Dub'],
    k_avo:        ['Одноголосая', 'Одноголосе', 'Single-voice'],
    k_mvo:        ['Многоголосая закадровая', 'Багатоголосе закадрове', 'Multi-voice over'],
    set_quick_movie:['Фильмы: запускать сразу', 'Фільми: запускати одразу', 'Movies: play at once'],
    set_quick_series:['Сериалы: кнопка «Продолжить»', 'Серіали: кнопка «Продовжити»', 'Series: “Continue” button'],
    fav_voices:   ['Любимые озвучки', 'Улюблені озвучення', 'Favourite voice-overs'],
    studios:      ['Студии озвучки', 'Студії озвучення', 'Voice-over studios'],
    studios_d:    ['Как разные источники называют одну студию', 'Як різні джерела називають одну студію', 'How different sources name one studio'],
    st_add:       ['＋ Добавить студию', '＋ Додати студію', '＋ Add a studio'],
    st_unknown:   ['Нераспознанные названия', 'Нерозпізнані назви', 'Unrecognised names'],
    st_unknown_d: ['Озвучки последних тайтлов, не попавшие ни в одну студию', 'Озвучення останніх тайтлів, що не потрапили до жодної студії', 'Voice-overs of recent titles that match no studio'],
    st_none:      ['Пока ничего нет', 'Поки нічого немає', 'Nothing yet'],
    st_reset_all: ['Сбросить все изменения', 'Скинути всі зміни', 'Reset all changes'],
    st_variants:  ['%s вариантов', '%s варіантів', '%s spellings'],
    st_mine:      ['своя', 'власна', 'yours'],
    st_edited:    ['изменена', 'змінена', 'edited'],
    st_hidden:    ['скрыта', 'прихована', 'hidden'],
    st_rename:    ['Переименовать', 'Перейменувати', 'Rename'],
    st_add_var:   ['Добавить вариант написания', 'Додати варіант написання', 'Add a spelling'],
    st_del_var:   ['Удалить вариант', 'Видалити варіант', 'Remove a spelling'],
    st_delete:    ['Удалить студию', 'Видалити студію', 'Delete the studio'],
    st_hide:      ['Скрыть студию', 'Сховати студію', 'Hide the studio'],
    st_unhide:    ['Вернуть студию', 'Повернути студію', 'Show the studio again'],
    st_reset:     ['Сбросить к стандартной', 'Скинути до стандартної', 'Reset to the default'],
    st_from_name: ['Создать студию из этого названия', 'Створити студію з цієї назви', 'Make a studio of this name'],
    st_to_studio: ['Добавить как вариант к…', 'Додати як варіант до…', 'Add as a spelling of…'],
    st_name:      ['Название студии', 'Назва студії', 'Studio name'],
    st_var:       ['Вариант написания', 'Варіант написання', 'Spelling'],
    st_saved:     ['Сохранено', 'Збережено', 'Saved'],
    st_short:     ['Слишком коротко', 'Закоротко', 'Too short'],
    fav_empty:    ['Озвучки появятся после первых просмотров', 'Озвучення з’являться після перших переглядів', 'Voice-overs appear after the first titles'],
    chosen_n:     ['выбрано %s раз', 'обрано %s разів', 'chosen %s times'],
    src_slow:     ['%s долго не отвечает. Переключиться на %s?', '%s довго не відповідає. Перемкнутися на %s?', '%s is slow to answer. Switch to %s?'],
    switch_yes:   ['Да, переключиться', 'Так, перемкнутися', 'Yes, switch'],
    keep_waiting: ['Ждём', 'Чекаємо', 'Keep waiting'],
    orig_subs:    ['Оригинал + %s', 'Оригінал + %s', 'Original + %s'],
    multi:        ['Несколько дорожек (%s)', 'Кілька доріжок (%s)', 'Several tracks (%s)'],
    loading:      ['загрузка…', 'завантаження…', 'loading…'],
    searching:    ['Ищем в источниках…', 'Шукаємо в джерелах…', 'Searching the sources…'],
    lang_other:   ['Другие', 'Інші', 'Other'],
    voices_more:  ['ещё не все источники ответили', 'ще не всі джерела відповіли', 'some sources have not answered yet'],
    subs_more:    ['Ищу субтитры других источников…', 'Шукаю субтитри інших джерел…', 'Looking for subtitles of other sources…'],
    voice_loading:['Озвучки ещё загружаются…', 'Озвучення ще завантажуються…', 'Voice-overs are still loading…'],
    stub_lower:   ['Вместо фильма короткий фрагмент (%s) - пробую %s', 'Замість фільму короткий фрагмент (%s) - пробую %s', 'A short clip instead of the full video (%s) - trying %s'],
    no_stream:    ['Не удалось получить поток ни из одного источника', 'Не вдалося отримати потік з жодного джерела', 'Could not get a stream from any source'],
    set_server:   ['Адрес вашего сервера (Lampac, Alpac…)', 'Адреса вашого сервера (Lampac, Alpac…)', 'Your server address (Lampac, Alpac…)'],
    set_server_d: ['Сервер с онлайн-источниками. Оставьте пустым для автоматического определения', 'Сервер з онлайн-джерелами. Залиште порожнім для автоматичного визначення', 'Server with online sources. Leave empty to detect automatically'],
    srv_auto:     ['авто', 'авто', 'auto'],
    srv_none:     ['Сервер Lampac не найден', 'Сервер Lampac не знайдено', 'No Lampac server found'],
    srv_none_d:   ['Укажите адрес: Настройки → L A M P A → Подключение → «Адрес вашего сервера»', 'Вкажіть адресу: Налаштування → L A M P A → Підключення → «Адреса вашого сервера»', 'Set it in Settings → L A M P A → Connection → Your server address'],
    srv_auth:     ['Сервер просит войти', 'Сервер просить увійти', 'The server asks you to sign in'],
    srv_auth_d:   ['Войдите в аккаунт Lampa (Настройки → Аккаунт) или добавьте на сервере ID этого устройства: %s', 'Увійдіть в акаунт Lampa (Налаштування → Акаунт) або додайте на сервері ID цього пристрою: %s', 'Sign in to your Lampa account (Settings → Account) or add this device ID on the server: %s'],
    srv_auth_via: ['Этот сервер найден по плагину %s - войдите через него (он покажет код входа), затем откройте снова', 'Цей сервер знайдено за плагіном %s - увійдіть через нього (він покаже код входу), потім відкрийте знову', 'This server was found by the plugin %s: sign in through it (it shows the sign-in code), then open again'],
    srv_rch:      ['Сервер работает только через rch', 'Сервер працює лише через rch', 'The server works in rch mode only'],
    srv_rch_d:    ['Источники этого сервера доступны только через устройство (rch). Подключите другой сервер', 'Джерела цього сервера доступні лише через пристрій (rch). Підключіть інший сервер', 'This server requires device-side access (rch). Connect another server'],
    srv_down:     ['Сервер Lampac недоступен', 'Сервер Lampac недоступний', 'The Lampac server cannot be reached'],
    srv_down_net: ['Нет связи или браузер не пустил запрос (CORS) - проверьте адрес и что сервер запущен', 'Немає зв\'язку або браузер не пропустив запит (CORS) - перевірте адресу і що сервер запущено', 'No connection, or the browser blocked the request (CORS): check the address and that the server runs'],
    srv_down_time:['Сервер не ответил за %s с - он запущен?', 'Сервер не відповів за %s с - він запущений?', 'The server did not answer within %s s: is it running?'],
    srv_down_mixed:['Lampa открыта по https, а сервер - по http: браузер такое блокирует, а по https этот сервер не ответил. Нужен https-адрес сервера', 'Lampa відкрита через https, а сервер - через http: браузер таке блокує, а через https цей сервер не відповів. Потрібна https-адреса сервера', 'Lampa is open over https and the server is http: the browser blocks that, and the server did not answer over https. Use an https address'],
    srv_down_pna: ['Браузер не пускает сайт из интернета к адресу домашней сети. Откройте Lampa с самого сервера или укажите внешний адрес', 'Браузер не пускає сайт з інтернету до адреси домашньої мережі. Відкрийте Lampa з самого сервера або вкажіть зовнішню адресу', 'The browser keeps an internet site away from a home-network address. Open Lampa from the server itself or use an outside address'],
    srv_down_auth:['Сервер требует вход (HTTP %s) - войдите в аккаунт Lampa или проверьте доступ на сервере', 'Сервер вимагає вхід (HTTP %s) - увійдіть в акаунт Lampa або перевірте доступ на сервері', 'The server wants a sign-in (HTTP %s): sign in to your Lampa account or check access on the server'],
    srv_down_http:['Сервер ответил ошибкой HTTP %s', 'Сервер відповів помилкою HTTP %s', 'The server answered HTTP %s'],
    spd_slow:     ['Источник медленный - включил %s', 'Джерело повільне - увімкнув %s', 'Slow source: switched to %s'],
    spd_other:    [' · другой источник: %s', ' · інше джерело: %s', ' · another source: %s'],
    sources:      ['Источники', 'Джерела', 'Sources'],
    torrents:     ['Торренты', 'Торенти', 'Torrents'],
    sources_d:    ['Скрытые не опрашиваются', 'Приховані не опитуються', 'Hidden ones are not asked'],
    src_hidden_n: ['скрыто: %s', 'приховано: %s', 'hidden: %s'],
    src_all_off:  ['Все источники скрыты', 'Усі джерела приховано', 'Every source is hidden'],
    src_list_none:['Сервер не дал список источников', 'Сервер не дав список джерел', 'The server gave no source list'],
    ep_reverse:   ['Серии: последние сверху', 'Серії: останні згори', 'Episodes: newest on top'],
    on:           ['вкл', 'увімк.', 'on'],
    ep_jump:      ['Перейти к серии №…', 'Перейти до серії №…', 'Go to episode #…'],
    ep_jump_t:    ['Номер серии', 'Номер серії', 'Episode number'],
    all_settings: ['Все настройки', 'Усі налаштування', 'All settings'],
    ep_none:      ['Серии %s нет в этом сезоне', 'Серії %s немає в цьому сезоні', 'No episode %s in this season'],
    // the screen
    continue_s:   ['Продолжить · S%s, E%s', 'Продовжити · S%s, E%s', 'Continue · S%s, E%s'],
    watch_se:     ['Смотреть · S%s, E%s', 'Дивитися · S%s, E%s', 'Watch · S%s, E%s'],
    resume:       ['Продолжить', 'Продовжити', 'Resume'],
    soon:         ['Скоро', 'Незабаром', 'Soon'],
    min:          ['%s мин', '%s хв', '%s min'],
    hm:           ['%s ч %s мин', '%s год %s хв', '%s h %s min'],
    h:            ['%s ч', '%s год', '%s h'],
    in_voice:     ['в %s %s из %s', 'у %s %s з %s', 'in %s %s of %s'],
    has_in:       ['есть в %s', 'є в %s', 'also in %s'],
    not_in:       ['нет в %s', 'немає в %s', 'not in %s'],
    watch_in:     ['Смотреть в «%s»', 'Дивитися в «%s»', 'Watch in “%s”'],
    ep_missing:   ['S%s E%s нет в «%s»', 'S%s E%s немає в «%s»', 'S%s E%s is not in “%s”'],
    series_voice: ['Озвучка сериала', 'Озвучення серіалу', 'Voice-over of the series'],
    other_voices: ['В другой озвучке', 'В іншому озвученні', 'In another voice-over'],
    mark_seen:    ['Отметить просмотренной', 'Позначити переглянутою', 'Mark as watched'],
    mark_unseen:  ['Снять отметку «просмотрено»', 'Зняти позначку «переглянуто»', 'Mark as not watched']
  };
  // the same with a number: [one, few, many] per language (ru / uk; en: one, other)
  var PLURAL = {
    seasons_n:   [['%s сезон', '%s сезона', '%s сезонов'], ['%s сезон', '%s сезони', '%s сезонів'], ['%s season', '%s seasons']],
    eps_count:   [['%s серия', '%s серии', '%s серий'], ['%s серія', '%s серії', '%s серій'], ['%s episode', '%s episodes']],
    srcs_n:      [['%s источник', '%s источника', '%s источников'], ['%s джерело', '%s джерела', '%s джерел'], ['%s source', '%s sources']],
    voices_plus: [['+%s озвучка', '+%s озвучки', '+%s озвучек'], ['+%s озвучення', '+%s озвучення', '+%s озвучень'], ['+%s voice-over', '+%s voice-overs']]
  };
  function plural(key, n) {
    var li = langIdx(), forms = (PLURAL[key] || [])[li] || [], m10 = n % 10, m100 = n % 100, f;
    if (li === 2) f = n === 1 ? 0 : 1;
    else f = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
    return String(forms[f] || forms[forms.length - 1] || '%s').replace('%s', n);
  }
  function langIdx() {
    var l = '';
    try { l = String(Lampa.Storage.get('language', 'ru') || 'ru'); } catch (e) {}
    return l === 'ru' || l === 'be' ? 0 : l === 'uk' ? 1 : 2;   // Belarusian: Russian, as in the rest of the pack
  }
  function tr(key) {
    var row = STR[key], s = row ? (row[langIdx()] || row[0]) : key, args = arguments, i = 1;
    return s.replace(/%s/g, function () { return i < args.length ? args[i++] : ''; });
  }

  // ---------- small shared helpers ----------
  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  // a Lampa.Storage value of the expected shape (anything else, or a failed read: an empty one)
  function storeArr(name) { var a = null; try { a = Lampa.Storage.get(name, []); } catch (e) {} return isArr(a) ? a : []; }
  function storeObj(name) { var o = null; try { o = Lampa.Storage.get(name, {}); } catch (e) {} return o && typeof o === 'object' ? o : {}; }
  // the element inside a Lampa module's own markup (Lampa.<mod>.render()), else anywhere on the page
  function lampaFind(mod, sel) {
    var m = Lampa[mod], box = m && typeof m.render === 'function' ? $(m.render()).find(sel) : $();
    return box.length ? box : $(sel);
  }
  // a stored map capped at max entries: the oldest (by .t) go
  function trimByT(store, max) {
    var keys = Object.keys(store);
    if (keys.length <= max) return;
    keys.sort(function (a, b) { return (store[a].t || 0) - (store[b].t || 0); });
    keys.slice(0, keys.length - max).forEach(function (k) { delete store[k]; });
  }
  function numKeys(o) { return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); }
  function deviceId() { try { return Lampa.Storage.get('lampac_unic_id', '') || ''; } catch (e) { return ''; } }
  // the card's TMDB id (cards of other catalogues carry it as tmdb_id)
  function tmdbId(m) { return ['cub', 'tmdb'].indexOf(m.source || 'tmdb') === -1 ? m.tmdb_id : m.id; }
  // a TMDB date ("2024-03-01") as ms; 0 = none
  function airTime(d) { return d ? new Date((d + '').replace(/-/g, '/')).getTime() : 0; }
  // seasons 1..number_of_seasons of a card (at least min of them)
  function seasonRange(m, min) {
    var out = [], n = Math.max(min || 0, parseInt(m.number_of_seasons, 10) || 0);
    for (var i = 1; i <= n; i++) out.push(i);
    return out;
  }
  // ---------- the card ----------
  function yearOf(m) { return parseInt(((m.release_date || m.first_air_date || '0000') + '').slice(0, 4), 10) || 0; }
  function isSerial(m) { return !!(m.name || m.number_of_seasons || m.first_air_date); }
  // anime: the server's TMDB -> MyAnimeList map said so (see animeInfo), or Animation from Japan/China/Korea
  function isAnime(m) {
    if (m.alc_anime) return true;
    var g = m.genres || [], ids = m.genre_ids || [], anim = false, i;   // a full card has genres, a list card genre_ids
    for (i = 0; i < g.length; i++) if (g[i] && g[i].id == 16) anim = true;
    for (i = 0; i < ids.length; i++) if (ids[i] == 16) anim = true;
    return anim && (m.original_language === 'ja' || m.original_language === 'zh' || m.original_language === 'ko');
  }

  // ---------- one user action at a time ----------
  // Every user action gets a token; pressing Back on a spinner invalidates it, so late async
  // results don't open menus or start the player behind the user's back.
  var opId = 0;
  function newOp() { var id = ++opId; return function () { return id === opId; }; }
  // spinner; cancelling it invalidates the operation and returns to the given controller
  function loading(alive, ctl) {
    // Lampa.Loading.start() forgets a layer already on screen (it stays forever, and the controller
    // it returns to becomes the loading layer itself): close the current one first
    try { Lampa.Loading.stop(); } catch (e) {}
    Lampa.Loading.start(function () { opId++; Lampa.Loading.stop(); try { Lampa.Controller.toggle(ctl || 'content'); } catch (e) {} });
    return alive;
  }

  // ======================= 4. REQUESTS: OUR SERVER AND ITS SOURCES =======================
  // ---------- the token and the device id go to our server only ----------
  function authToken() {
    var tok = '', names = ['alpac_token', 'lampac_token', 'lampac_auth_token'];
    try { for (var i = 0; i < names.length && !tok; i++) tok = Lampa.Storage.get(names[i], '') || ''; } catch (e) {}
    if (!tok) { try { tok = localStorage.getItem('lampac_auth_token') || ''; } catch (e) {} }
    return tok;
  }

  // the token, device id and cookies go only to our own server: the host this script came from or
  // the page's host (by name: a proxy in front may change the scheme or port). Sources may hand out
  // links to other hosts; those get a plain request.
  function hostName(u) { var m = /^(?:[a-z]+:)?\/\/([^\/?#:]+)/i.exec(String(u)); return m ? m[1].toLowerCase() : ''; }
  function ownUrl(url) {
    if (!/^(?:[a-z]+:)?\/\//i.test(String(url))) return true;   // relative: our server
    var h = hostName(url);
    return !!h && (h === hostName(BASE) || h === String(location.hostname || '').toLowerCase());
  }

  // the names our server gives itself in its links (the host of the request it was asked by: behind a
  // proxy its listen name, another host name): learnt from the hosts of BASE's own /lite/events list
  // (see learnSelf), kept for that BASE only, in memory
  var selfHosts = null;   // {base, h: {hostname: true}}
  function learnSelf(base, list) {
    if (!base || base !== BASE) return;
    if (!selfHosts || selfHosts.base !== base) selfHosts = { base: base, h: {} };
    (list || []).forEach(function (e) {
      var u = e && typeof e.url === 'string' ? e.url : '', h = hostName(u);
      if (h && /^(?:https?:)?\/\/[^\/?#]+\/(?:[^?#]*\/)?lite\//i.test(u)) selfHosts.h[h] = true;
    });
  }
  function selfHost(h) { return !!(selfHosts && selfHosts.base === BASE && selfHosts.h[h]); }
  // a source link of our server as the server names itself (behind a proxy: another scheme or port,
  // localhost, or a name learnt above) -> the address that answers here. Every request goes through it
  // (getJSON), so the season / voice / call links inside source answers reach BASE with the device id
  // and token; links to any other host stay as they are
  function ownBase(u) {
    u = String(u || '');
    var m = /^(?:https?:)?\/\/([^\/?#:]+)(?::\d+)?(\/[^?#]*)?/i.exec(u);
    if (!m || !BASE) return u;
    var h = m[1].toLowerCase(), at = u.indexOf('/lite/', m[0].length - (m[2] || '').length);
    if (at < 0 || (h !== hostName(BASE) && !selfHost(h) && !/^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0)$/.test(h))) return u;
    return BASE + u.slice(at);
  }
  function addParam(url, kv) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + kv; }

  // the device id and, as Lampac's own online plugin does, the Lampa account e-mail: a server with
  // accounts (accsdb) knows its viewers by one of them
  function account(url) {
    url = String(url);
    if (url.indexOf('uid=') < 0) {
      var uid = deviceId();
      if (uid) url = addParam(url, 'uid=' + encodeURIComponent(uid));
    }
    if (url.indexOf('account_email=') < 0) {
      var em = '';
      try { em = Lampa.Storage.get('account_email', '') || ''; } catch (e) {}
      if (em && typeof em === 'string') url = addParam(url, 'account_email=' + encodeURIComponent(em));
    }
    if (url.indexOf('rjson=') < 0) url = addParam(url, 'rjson=true');
    return url;
  }

  // ---------- a busy server: 429 (and 503 with Retry-After) ----------
  // A public Lampac answers 429 Too Many Requests when too many requests come at once (a card asks all
  // its ~35 sources together, then the season pages). A 429 is no answer: that request is sent again
  // after the answer's Retry-After (seconds or a date, at most THR_MAXWAIT; a cross-origin server must
  // expose the header) or after 1, 2, 4, 8 s (+-25%), at most THR_TRIES times, then it fails as a
  // timeout does with `throttled` set (1): the callers note no «no source», no failure in the source's
  // stats, no lasting mark. One source passing on its own site's 429 (or a 503 while it restarts) is
  // that source's matter only. The SERVER throttles when 429s come for two different paths
  // (/lite/<source>) or for its list within THR_WIN: then that host (name[:port]) gets an adaptive
  // limit (AIMD) - half of what is on the way to it (2 at least; once per round: answers to requests
  // sent before the cut do not cut again), nothing more sent to it for its Retry-After or a moment
  // (THR_PAUSE), the rest waits in the host's line. A server that never does (the viewer's own) gets
  // every request at once, as before. Answers while the limit holds (a line, or every slot taken)
  // raise it by one per THR_UP, back to none at THR_FREE or after THR_IDLE without such 429s.
  // The line of a limited host: what the viewer waits for (a link to play: `pri`) first, then the
  // pages and then the searches of the screen in front (a request sent again after a 429 behind the
  // others of its kind: the pages of sources found give voices), then other cards'; a background page
  // of a card no screen shows (or a session dropped) is not sent at all - it fails as cancelled
  // (`throttled` 2). A request still on the way after THR_SLOW gives its slot up (a slow source's own
  // site must not hold the line) while fewer than lim + THR_SLACK are on the way in all.
  // REQ_TIMEOUT counts from the request's own send, not from its wait in the line (the wait is this
  // client's doing, the timeout judges the source). Callbacks never run inside another request's.
  var THR_UP = 4, THR_FREE = 32, THR_TRIES = 4, THR_MAXWAIT = 30000, THR_IDLE = 60000, THR_SLOW = 2500,
    THR_PAUSE = 300, THR_WIN = 3000, THR_SLACK = 4;
  // host -> {lim, on: holding a slot, slow: on the way without one, wait: [entries], ok: answers toward
  // +1, cut: round, at: the server's last 429, until: paused till, hits: [{t, p}] recent 429s}
  var hosts = {}, reqSeq = 0;
  function hostKey(u) {
    var m = /^(?:([a-z][a-z0-9+.-]*):)?\/\/(?:[^\/?#@]*@)?([^\/?#]+)/i.exec(String(u)), sch, hp;
    if (!m) return String(location.host || '').toLowerCase();
    sch = String(m[1] || location.protocol || '').replace(/:$/, '').toLowerCase();
    hp = m[2].toLowerCase();
    return (sch === 'https' && /:443$/.test(hp)) || (sch === 'http' && /:80$/.test(hp)) ? hp.replace(/:\d+$/, '') : hp;
  }
  function pathOf(u) { var m = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^\/?#]+([^?#]*)/i.exec(String(u)); return (m ? m[1] : String(u).replace(/[?#].*$/, '')) || '/'; }
  function hostOf(u) {
    var k = hostKey(u), h = hosts[k] || (hosts[k] = { lim: Infinity, on: 0, slow: 0, wait: [], ok: 0, cut: 0, at: 0, until: 0, timer: 0, hits: [] });
    if (h.lim < Infinity && Date.now() - h.at > THR_IDLE) { h.lim = Infinity; h.ok = 0; }
    return h;
  }
  // the screen in front's session (its claims, a search started): its requests go first in a line
  var actSess = null;
  // a request's place in a limited host's line (higher first); -1: not to be sent (see above)
  function reqRank(e) {
    var o = e.o, t = o.tag, r;
    if (t && t.gone) return -1;
    r = o.pri ? 4 : !t || t === actSess ? (o.low ? 2 : 3) : !o.bg ? 1 : t.view && t.view.owner ? 0 : -1;
    return e.again && r > 0 ? r - 1 : r;
  }
  function hostPump(h) {
    var w = h.until - Date.now(), i, r, b, best, e;
    if (w > 0) { if (!h.timer) h.timer = setTimeout(function () { h.timer = 0; hostPump(h); }, w); return; }
    while (h.wait.length && h.on < h.lim) {
      if (h.lim === Infinity) { h.wait.shift().send(); continue; }   // (no limit: in turn, as they came)
      b = -1; best = -1;
      for (i = 0; i < h.wait.length; i++) {
        r = reqRank(h.wait[i]);
        if (r < 0) { h.wait.splice(i--, 1)[0].cancel(); continue; }
        if (r > b || (r === b && h.wait[i].seq < h.wait[best].seq)) { b = r; best = i; }
      }
      if (best < 0) break;
      e = h.wait.splice(best, 1)[0];
      e.send();
    }
  }
  // Retry-After in ms; null: none, -1: there but of no use (a past date, unreadable). Only the headers the
  // browser lets us see (no console noise); the first of several values
  function retryAfter(x) {
    var m = null, v, p, t;
    try { m = /(?:^|\n)\s*retry-after:[ \t]*([^\r\n]*)/i.exec(x.getAllResponseHeaders() || ''); } catch (e) {}
    if (!m) return null;
    v = m[1].replace(/^\s+|\s+$/g, ''); p = v.split(',');
    if (/^\d/.test(v)) t = parseFloat(v) * 1000;   // seconds, also "1.5" (parseFloat stops at a comma)
    else { t = Date.parse(v); if (isNaN(t)) t = Date.parse(p[0] + ',' + (p[1] || '')); t -= Date.now(); }
    return isNaN(t) || t < 0 ? -1 : Math.max(500, Math.min(THR_MAXWAIT, t));
  }

  // fail(status, json, timedOut, text, throttled): timedOut = the seconds waited; text = the answer as it came; json = the answer when it was JSON (a server with accounts answers
  // {accsdb: true, msg} to a viewer it does not know; a source that needs rch: {rch: true}); status 0 =
  // no answer at all (offline, refused, CORS, mixed content, the browser's local-network block);
  // throttled = no fault of the source: 1 the server kept answering 429, 2 cancelled (see above).
  // opts: {pri: the viewer waits for it, tag: the Session it is for, bg: a background page of it, low: a search}
  function getJSON(url, ok, fail, opts) {
    var done = false, tries = 0, t0 = 0, h, own, full, path, entry;
    try {
      url = ownBase(url);
      own = ownUrl(url);
      full = own ? account(url) : (url.indexOf('rjson=') < 0 ? addParam(url, 'rjson=true') : url);
      h = hostOf(full);
      path = pathOf(full);
    } catch (e) { fail(0, null); return; }
    var later = function (f) { setTimeout(f, 0); };
    entry = { o: opts || {}, seq: ++reqSeq, send: send,
      cancel: function () { if (!done) { done = true; later(function () { fail(0, null, undefined, '', 2); }); } } };
    h.wait.push(entry);   // (in turn: straight on when the host has no limit)
    hostPump(h);
    function send() {
      if (done) return;
      var cut = h.cut, held = true, open = true, slowT = 0, x;
      // the slot: given back at the answer, or after THR_SLOW while the host is not too full
      var release = function () { if (held) { held = false; h.on--; if (h.wait.length) hostPump(h); } };
      var finish = function () { clearTimeout(slowT); if (open) { open = false; if (held) release(); else h.slow--; } };
      var slowly = function () {
        if (!open || !held || h.lim === Infinity) return;
        if (h.on + h.slow < h.lim + THR_SLACK) { h.slow++; release(); } else slowT = setTimeout(slowly, 500);
      };
      var end = function (f) { finish(); if (!done) { done = true; f(); } };
      h.on++;
      slowT = setTimeout(slowly, THR_SLOW);
      if (!t0) t0 = Date.now();
      try {
        x = new XMLHttpRequest();
        x.open('GET', full, true);
        x.timeout = REQ_TIMEOUT;
        if (own) {
          x.withCredentials = true;
          var tok = authToken();
          if (tok) { x.setRequestHeader('X-Lampac-Token', tok); x.setRequestHeader('X-Alpac-Token', tok); }
        }
        x.onload = function () {
          var st = x.status, ra = st === 429 || st === 503 ? retryAfter(x) : null;
          if (st === 429 || ra !== null) { throttled(ra); return; }
          // an answer while the limit holds: one step back toward no limit
          if (h.lim < Infinity && (h.wait.length || h.on >= h.lim) && ++h.ok >= THR_UP) { h.ok = 0; h.lim = h.lim + 1 >= THR_FREE ? Infinity : h.lim + 1; }
          end(function () {
            var j = null;
            try { j = JSON.parse(x.responseText); } catch (e) {}
            // our server answered: an earlier «cannot be reached» (srv.down) is over
            if (own && st >= 200 && st < 300 && srv.down && hostName(url) === hostName(BASE)) srv.down = null;
            if (st >= 200 && st < 300 && j && typeof j === 'object' && !j.rch && !j.accsdb) ok(j);
            else fail(st, j && typeof j === 'object' ? j : null, undefined, x.responseText);
          });
        };
        x.onerror = function () { end(function () { fail(0, null); }); };
        x.ontimeout = function () { end(function () { fail(0, null, REQ_TIMEOUT / 1000); }); };
        x.send();
      } catch (e) { end(function () { later(function () { fail(0, null); }); }); }
      // ra: Retry-After (see retryAfter)
      function throttled(ra) {
        var now = Date.now(), seen = {}, n = 0;
        h.hits = h.hits.filter(function (e) { return now - e.t < THR_WIN; });
        h.hits.push({ t: now, p: path });
        h.hits.forEach(function (e) { if (!seen[e.p]) { seen[e.p] = 1; n++; } });
        if (n >= 2 || /\/lite\/events$/.test(path)) {   // the server itself throttles
          h.at = now;
          if (cut === h.cut) {
            h.lim = Math.max(2, Math.min(h.lim, Math.floor((h.on + h.slow) / 2))); h.cut++; h.ok = 0;
            h.until = now + (ra > 0 ? ra : THR_PAUSE * (0.75 + Math.random() * 0.5));
          }
        }
        finish();
        if (++tries > THR_TRIES) { end(function () { fail(0, null, Math.round((Date.now() - t0) / 1000), '', 1); }); return; }
        entry.again = true;
        setTimeout(function () { if (!done) { h.wait.push(entry); hostPump(h); } },
          ra > 0 ? ra : Math.min(THR_MAXWAIT, 1000 * Math.pow(2, tries - 1)) * (0.75 + Math.random() * 0.5));
      }
    }
  }
  // an optional server module (alcstats, alcmedia, kpid, animeid) is not there: 404 (Al(co)pac without
  // it, Lampac NextGen), or an answer that is not JSON (a page instead of the module)
  function absent(st, j) { return st === 404 || st === 405 || st === 501 || (st >= 200 && st < 300 && !j); }

  // ---------- finding the server (see BASE) ----------
  // The search is the pack's shared one (the [pack server] block below, as in the pack's other plugins);
  // Autopilot adds its memory of the server found (alc_auto_srv), the «cannot be reached» state
  // (srv.down) and the plugin the server was found by (srv.via). Its packServer() is not used here: the
  // other plugins come to Autopilot's withServer through window.alc_auto_server.
  // [pack server] the same block in alc_auto, alc_ua, alc_trailers, opensubs_menu, skip_segments and
  // alc_trick (each must work alone). packServer(own, cb): cb(base), '' = none, once. With Autopilot
  // installed: its server (window.alc_auto_server: its setting / found by this search and remembered; its
  // '' is for now, it looks again a minute later). Without it this search (S.find): the pack's setting
  // «Адрес вашего Lampac» (alc_auto_server), else `own` (the host this script came from), the page's host,
  // then the folder and host of every installed plugin (Lampa's plugin list; not the page's scripts: CDNs,
  // analytics; a Lampac is not known by its plugin's file name), all probed at once with GET
  // <base>/lite/events, a plain request (no token or cookies: not ours until chosen); the choice keeps
  // that order. What counts:
  // - the address the viewer set: any HTTP answer, also a slow one (the viewer chose it; a token-only
  //   server answers this plain probe 401 and the plugins' own requests carry the token); no answer at
  //   all = none;
  // - `own`: a Lampac's JSON (its list, or {accsdb}: a request to sign in), or 401 / 403 (a server that
  //   wants the token); a static host's page (404, HTML) is none;
  // - the page's host: only a Lampac's JSON (its list or a sign-in; a CDN's or Cloudflare's 403 in front
  //   of a public Lampa is no Lampac);
  // - a plugin's host (a public Lampac, or no Lampac at all): only a Lampac's JSON - the first that gives
  //   its list, else the first that asks to sign in. Any other answer: no Lampac, remembered
  //   (alc_auto_srv_no: a day; no answer: an hour) so a changed plugin list is not probed again.
  // An http address under an https page goes over https (the browser blocks http there unsent). One probe
  // per base for all plugins, its answer kept a minute (a Lampac too: a search after a lost server must
  // not trust an old yes). The answer of a search is kept a minute (per `own`; a changed setting or
  // plugin list searches at once); searches for the same `own` at the same time are one search. The
  // newest copy serves all whatever the load order (window.alc_pack_srv.v >= SRV_V); copies older than
  // versions (window.alc_pack_probe(base, cb(bool))) are handed the newest probe.
  var SRV_V = 4;
  // a stored {key: until} map without the entries whose time is over
  function unexpired(m, now) { var out = {}, k; if (m && typeof m === 'object') for (k in m) if (m[k] > now) out[k] = m[k]; return out; }
  function packSrv() {
    var S = window.alc_pack_srv;
    if (S && S.v >= SRV_V) return S;
    S = window.alc_pack_srv = { v: SRV_V };
    var seen = {}, memo = {}, AGAIN = 60000, NO = 'alc_auto_srv_no';
    var get = function (k, d) { try { return Lampa.Storage.get(k, d); } catch (e) { return d; } };
    var origin = function (u) { var m = /^(https?:\/\/[^\/?#]+)/i.exec(String(u || '')); return m ? m[1] : ''; };
    var reach = function (b) { var h = false; try { h = location.protocol === 'https:'; } catch (e) {} return b && h ? b.replace(/^http:/i, 'https:') : b; };
    // cb(kind, status, timedOut): kind 2 = a Lampac's list, 1 = a Lampac asking to sign in, 0 = else;
    // seen[base]: [callbacks] = asking, else the answer {k, st, to, at}
    S.probe = function (base, cb) {
      var s = seen[base];
      if (s && s.push) { s.push(cb); return; }
      if (s && Date.now() - s.at < AGAIN) { cb(s.k, s.st, s.to); return; }
      var w = seen[base] = [cb];
      var fin = function (k, st, to) {
        if (seen[base] !== w) return;
        seen[base] = { k: k, st: st || 0, to: !!to, at: Date.now() };
        w.forEach(function (f) { try { f(k, st || 0, !!to); } catch (e) {} });
      };
      if (!base) { fin(0); return; }
      try {
        var x = new XMLHttpRequest();
        x.open('GET', base + '/lite/events?rjson=true', true);
        x.timeout = 5000;
        x.onload = function () {
          var j = null; try { j = JSON.parse(x.responseText); } catch (e) {}
          fin(!j || typeof j !== 'object' ? 0 : j.accsdb ? 1 : x.status >= 200 && x.status < 300 ? 2 : 0, x.status);
        };
        x.onerror = function () { fin(0); };
        x.ontimeout = function () { fin(0, 0, true); };
        x.send();
      } catch (e) { fin(0); }
    };
    // the setting «Адрес вашего Lampac»: "host:port", "http(s)://host:port", also with a proxy's path
    // before /lite; asSet: as written (http stays http), else as it is asked (see reach)
    S.setting = function (asSet) {
      var v = String(get('alc_auto_server', '') || '').trim();
      if (!v) return '';
      if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
      v = v.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\/lite$/i, '');
      return asSet ? v : reach(v);
    };
    // the candidates in order; out.mine: `own` leads (0 or 1), out.own: own + the page's host,
    // out.via[base]: the plugin it came from
    S.cands = function (own) {
      var out = [], via = {};
      var add = function (b, from) { b = reach(b); if (b && out.indexOf(b) < 0) { out.push(b); if (from) via[b] = from; } };
      var plugin = function (u) {
        var o = typeof u === 'string' ? origin(u) : '';
        if (o) { add(o + u.slice(o.length).replace(/[?#].*$/, '').replace(/\/[^\/]*$/, ''), u); add(o, u); }
      };
      if (/^https?:\/\/[^\/?#]/i.test(own || '')) add(String(own).replace(/[?#].*$/, '').replace(/\/+$/, ''));
      out.mine = out.length;
      try { if (/^https?:$/.test(location.protocol)) add(location.protocol + '//' + location.host); } catch (e) {}
      out.own = out.length;
      try { var pl = get('plugins', '[]'); if (typeof pl === 'string') pl = JSON.parse(pl); (pl || []).forEach(function (p) { plugin(p && typeof p === 'object' ? p.url : p); }); } catch (e) {}
      out.via = via;
      return out;
    };
    // a server that stopped answering: probed and searched afresh next time
    S.forget = function (base) {
      if (seen[base] && !seen[base].push) delete seen[base];
      for (var o in memo) if (memo[o].b === base) delete memo[o];
    };
    // cb(base, r): r = the chosen answer {kind, status, timedOut, via: the plugin it was found by}.
    // memo[own]: the answer {key, at, b, r}, or a search running {key, at, w: [callbacks]} (the plugins
    // starting together ask once; one stuck past 20 s is not waited for)
    S.find = function (own, cb) {
      var pl = get('plugins', '[]'), key = String(get('alc_auto_server', '') || '') + ' ' + (typeof pl === 'string' ? pl : JSON.stringify(pl)), m = memo[own];
      if (m && m.key === key && Date.now() - m.at < (m.w ? 20000 : AGAIN)) { if (m.w) m.w.push(cb); else cb(m.b, m.r); return; }
      var run = memo[own] = { key: key, at: Date.now(), w: [cb] };
      var answer = function (b, r) {
        if (run.b !== undefined) return;
        run.b = b; r.via = r.via || '';
        if (memo[own] === run) memo[own] = { key: key, at: Date.now(), b: b, r: r };
        run.w.forEach(function (f) { try { f(b, r); } catch (e) {} });
      };
      try { search(own, answer); } catch (e) { answer('', { kind: 0, status: 0, timedOut: false }); }
    };
    var search = function (own, answer) {
      var fixed = S.setting();
      if (fixed) { S.probe(fixed, function (k, st, to) { answer(k || st || to ? fixed : '', { kind: k, status: st, timedOut: to }); }); return; }
      var c = S.cands(own), now = Date.now(), no = unexpired(get(NO, null), now), fresh = {}, nFresh = 0, ans = [], todo = [], decided = false;
      var decide = function () {
        if (decided) return;
        var pick = -1, i;
        for (i = 0; i < c.length; i++) {
          if (!ans[i]) return;   // an earlier candidate has not answered yet
          if (ans[i].kind === 2 || (ans[i].kind === 1 && i < c.own)) { pick = i; break; }
          if (ans[i].kind === 1 && pick < 0) pick = i;
        }
        decided = true;
        if (pick < 0) answer('', { kind: 0, status: 0, timedOut: false });
        else { ans[pick].via = c.via[c[pick]]; answer(c[pick], ans[pick]); }
      };
      // no Lampac: written once, when all have answered, into the map as stored now (another search
      // may have written meanwhile)
      var left = function () {
        if (--todo.n || !nFresh) return;
        var cur = unexpired(get(NO, null), Date.now());
        for (var b in fresh) cur[b] = fresh[b];
        try { Lampa.Storage.set(NO, cur); } catch (e) {}
      };
      c.forEach(function (b, i) { if (i >= c.own && no[b] > now) ans[i] = { kind: 0, status: 0, timedOut: false }; else todo.push(i); });
      todo.n = todo.length;
      todo.forEach(function (i) {
        if (decided) { left(); return; }
        S.probe(c[i], function (k, st, to) {
          // `own` answering 401 / 403: a Lampac that wants its token (the plugins' own requests carry it)
          ans[i] = { kind: k || (i < c.mine && (st === 401 || st === 403) ? 1 : 0), status: st, timedOut: to };
          if (!k && i >= c.own) { fresh[c[i]] = Date.now() + (st > 0 ? 86400000 : 3600000); nFresh++; }
          left();
          decide();
        });
      });
      decide();
    };
    window.alc_pack_probe = function (base, cb) { S.probe(base, function (k, st) { cb(k > 0 || st === 401 || st === 403); }); };
    return S;
  }
  packSrv();
  function packServer(own, cb) {
    var done = false, once = function (b) { if (done) return; done = true; cb(b || ''); };
    if (typeof window.alc_auto_server === 'function') {
      try { window.alc_auto_server(once); } catch (e) { once(''); }
      return;
    }
    try { packSrv().find(own, once); } catch (e) { once(''); }
  }
  // the setting as written (see S.setting): "host:port", "http(s)://host:port", also with a proxy's path
  function serverSetting() { return packSrv().setting(true); }
  function pageHttps() { try { return location.protocol === 'https:'; } catch (e) { return false; } }
  // An address that gives no answer at all, in words: [title, hint]. The browser does not say why a
  // request failed (status 0), so the hint is guessed from the addresses: an http server under an
  // https page (mixed content), a home-network address under a public page (Chrome's Private
  // Network Access), a timeout; else a refused connection / CORS. An answer that is not JSON with
  // 401 / 403: a server that wants a sign-in this plugin cannot give.
  function privateHost(h) {
    return /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|[^.]+|.+\.(local|lan|home|internal))$/i.test(String(h || ''));
  }
  function downWhy(base, st, timedOut) {
    var ph = '', set = serverSetting();
    try { ph = location.hostname; } catch (e) {}
    var hint = st === 401 || st === 403 ? tr('srv_down_auth', st)
      : st > 0 ? tr('srv_down_http', st)
      : pageHttps() && (/^http:/i.test(base) || (/^http:/i.test(set) && set.replace(/^http:/i, 'https:') === base)) ? tr('srv_down_mixed')
      : timedOut ? tr('srv_down_time', timedOut)
      : privateHost(hostName(base)) && ph && !privateHost(ph) ? tr('srv_down_pna')
      : tr('srv_down_net');
    return [tr('srv_down'), hint];
  }
  // state: '' not looked for yet, 'busy', 'ok', 'none'; gen: bumped by every search and by a changed
  // setting (a search that ends after either is stale: its result is dropped). down: the address set
  // in the settings gave no answer to the probe ([title, hint], see downWhy; null = it answered)
  var srv = { state: '', at: 0, waiters: [], gen: 0, down: null, probing: null, via: '' };
  var SRV_MEM = 4;   // alc_auto_srv format: v4 = 401 / 403 counts from this script's host only; v3 = any plugin's host probed, the plugin kept (via); older: by plugin file names
  // cb(BASE) once the server is known ('' = none answered; looked for again a minute later, like an
  // address set in the settings that did not answer)
  function withServer(cb) {
    if ((srv.state === 'none' || (srv.state === 'ok' && srv.down)) && Date.now() - srv.at > 60000) srv.state = '';
    if (srv.state === 'ok' || srv.state === 'none') { cb(BASE); return; }
    srv.waiters.push(cb);
    if (srv.state === 'busy') return;
    srv.state = 'busy';
    var gen = ++srv.gen;
    var done = function (b) {
      if (gen !== srv.gen) {
        // the setting changed (or a newer search started) meanwhile: the waiters get the current
        // answer - the newer search's, or a fresh search's when none is running
        if (srv.state !== 'busy' && srv.waiters.length) { var ws = srv.waiters; srv.waiters = []; ws.forEach(withServer); }
        return;
      }
      BASE = b; srv.state = b ? 'ok' : 'none'; srv.at = Date.now();
      if (!b) srv.down = null;
      var w = srv.waiters; srv.waiters = [];
      w.forEach(function (f) { try { f(BASE); } catch (e) { console.error('AlcAuto', e && e.message); } });
    };
    // The address set in the settings is used whatever happens (the viewer chose it) and at once (the
    // search itself finds out a dead one: sourceUrls), but probed alongside: one that gives no answer
    // at all (offline, CORS, mixed content, a local-network block) is told so on the screen instead of
    // «no source has this title» for the next searches (srv.down, see Session.loadRoots) and to the
    // pack's other plugins (they wait for the probe: srv.probing). Any HTTP answer counts as reachable
    // here: a token-only server answers this plain probe 401 and the real requests (with the token) may
    // still pass; they say themselves what is wrong (sourceUrls). A slow answer is no proof of a dead
    // server: the probe's own timeout leaves srv.down unset (the search waits for its real requests),
    // and any answer of the server later clears it (getJSON).
    // An http address under an https page goes over https (see S.setting): http would be blocked unsent.
    // The probe is a fresh one (S.forget): the answer kept from before may be the one being retried.
    var S = packSrv(), fixed = S.setting();
    srv.via = '';
    if (fixed) {
      srv.down = null;
      var mine = srv.probing = (srv.probing || []).slice();   // a newer probe takes over the waiters
      S.forget(fixed);
      S.probe(fixed, function (kind, st, to) {
        if (gen === srv.gen && !(kind || st) && !to) srv.down = downWhy(fixed, st, 0);
        if (srv.probing !== mine) return;
        srv.probing = null;
        mine.forEach(function (f) { try { f(); } catch (e) {} });
      });
      done(fixed);
      return;
    }
    srv.down = null;
    var cands = S.cands(SCRIPT_ORIGIN), key = cands.join(' '), mem = storeObj('alc_auto_srv');
    // found before with the same candidates: no probe (written again only when it changes)
    if (mem.v === SRV_MEM && mem.k === key && cands.indexOf(mem.b) >= 0) { srv.via = mem.via || ''; done(mem.b); return; }
    // The search (S.find): the viewer's own server first - this script's host as soon as it is a Lampac
    // at all (also one that only asks to sign in, or answers 401 / 403), the page's host when it is a
    // Lampac's JSON; the hosts of the installed plugins (maybe a public Lampac) only when neither is: the
    // first in the list that gives its list, else the first that asks to sign in.
    S.find(SCRIPT_ORIGIN, function (b, r) {
      if (b && gen === srv.gen) {
        srv.via = (r && r.via) || '';
        try { Lampa.Storage.set('alc_auto_srv', { v: SRV_MEM, k: key, b: b, via: srv.via }); } catch (e) {}
      }
      done(b);
    });
  }
  // the remembered server stopped answering /lite/events: look for it again next time (also the
  // search's own answers about it: S.forget)
  function serverLost(base) {
    try { packSrv().forget(base); } catch (e) {}
    if (serverSetting() || srv.state !== 'ok') return;
    srv.state = '';
    try { Lampa.Storage.set('alc_auto_srv', {}); } catch (e) {}
  }
  // for the pack's other plugins: cb(base), '' = none. A fixed address that does not answer counts as
  // none for them (the theme then shows Lampa's own Play, the others ask nothing); Autopilot's own button
  // stays and says why the server cannot be reached
  window.alc_auto_server = function (cb) {
    withServer(function (b) {
      var tell = function () { cb(srv.down ? '' : b); };
      if (srv.probing) srv.probing.push(tell); else tell();
    });
  };

  // the search of a title at a source: the card's ids and titles
  function rootQuery(m) {
    var q = [];
    q.push('id=' + encodeURIComponent(m.id));
    if (m.imdb_id) q.push('imdb_id=' + encodeURIComponent(m.imdb_id));
    if (m.kinopoisk_id) q.push('kinopoisk_id=' + encodeURIComponent(m.kinopoisk_id));
    if (m.tmdb_id) q.push('tmdb_id=' + encodeURIComponent(m.tmdb_id));
    q.push('title=' + encodeURIComponent(m.title || m.name || ''));
    q.push('original_title=' + encodeURIComponent(m.original_title || m.original_name || ''));
    q.push('serial=' + (isSerial(m) ? 1 : 0));
    q.push('original_language=' + encodeURIComponent(m.original_language || ''));
    q.push('year=' + yearOf(m));
    q.push('source=' + encodeURIComponent(m.source || 'tmdb'));
    // anime: MyAnimeList ids and the Ukrainian title (animeInfo); anime sources match by them
    if (m.alc_mal) q.push('mal_id=' + encodeURIComponent(m.alc_mal));
    if (m.alc_title_ua) q.push('title_ua=' + encodeURIComponent(m.alc_title_ua));
    q.push('clarification=0');
    q.push('similar=false');
    return q.join('&');
  }

  function rootUrl(src, m, base) {
    var u = base || (BASE + '/lite/' + src);
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + rootQuery(m);
  }

  // ======================= 5. SOURCES: THE LIST, ON / OFF, THE SEARCH, RANKING =======================
  // anime-only sources are dropped for other cards in loadRoots (once animeInfo has answered)
  function sourceList() {
    var list = [], k;
    for (k in SOURCES) list.push(k);
    for (k in ANIME) list.push(k);
    return list;
  }
  // the pack's modules published on hub.alcopa.cc carry the suffix _snack (uaflix_snack = uaflix)
  function srcBase(s) { return String(s || '').replace(/_snack$/, ''); }
  function srcInfo(s) { var b = srcBase(s); return SOURCES[b] || ANIME[b] || { p: 40 }; }   // unknown (new) sources: middle priority
  // ---------- sources the viewer switched off (alc_auto_src_off: names, lower case, no _snack) ----------
  // not asked at all; on the screen already open their voices go at once
  var offList = null;
  function srcOffList() {
    if (offList) return offList;
    return (offList = storeArr('alc_auto_src_off').map(String));
  }
  function srcKey(s) { return srcBase(String(s || '').toLowerCase()); }
  function srcOff(s) { var l = srcOffList(); return l.length > 0 && l.indexOf(srcKey(s)) >= 0; }
  // the server's sources seen so far (alc_auto_src_list; the list depends on the title, e.g. anime ones,
  // so it only grows; written when a new one shows up): the list in the settings
  function knownSources() {
    var a = storeArr('alc_auto_src_list').slice();
    srcOffList().forEach(function (s) { if (a.indexOf(s) < 0) a.push(s); });
    return a.slice().sort();
  }
  // the server's answer to /lite/events (a list, or NextGen's {online: [...]}) -> its sources [{name, url}];
  // the host names in it are learnt (learnSelf), the names kept for the settings (rememberSources).
  // Entries that are no source are left out (see notSource; an entry may also say so itself: service)
  function eventSources(base, list) {
    var out = [];
    if (list && isArr(list.online)) list = list.online;
    if (!isArr(list)) return out;
    learnSelf(base, list);
    var no = noSrcOf(base);
    list.forEach(function (e) {
      var name = e && (e.balanser || e.name);
      if (name && e.url && e.service !== true && !notSource(no, name)) out.push({ name: name, url: e.url });
    });
    rememberSources(out.map(function (e) { return e.name; }));
    return out;
  }
  function rememberSources(names) {
    var old = storeArr('alc_auto_src_list');
    var list = old.slice();
    names.forEach(function (n) { var k = srcKey(n); if (/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(k) && list.indexOf(k) < 0) list.push(k); });
    if (list.length > old.length && list.length <= 200) { list.sort(); try { Lampa.Storage.set('alc_auto_src_list', list); } catch (e) {} }
  }
  // ---------- entries of /lite/events that are no source ----------
  // A Lampac lists its service modules (statistics, logins, subtitles, id lookups …) among the
  // balancers ('show' is no help: the server sets it false for real sources too). DATA.not_sources
  // names the pack's own ones (a hint: never asked); any other one is known by its answer to the
  // search (notSourceAnswer) and remembered for that server for a day (alc_auto_nosrc: {base:
  // {name: until}}): a new module, or another server's own one, costs one request a day, not one
  // per search. After a day it is asked again (a module may have become a source).
  var NOSRC_TTL = 864e5;
  function noSrcOf(base) { var m = storeObj('alc_auto_nosrc')[base]; return m && typeof m === 'object' ? m : {}; }
  function notSource(no, name) {
    var k = srcKey(name);
    return (DATA.not_sources || []).indexOf(k) >= 0 || no[k] > Date.now();
  }
  function rememberNotSource(base, name) {
    var k = srcKey(name), all = storeObj('alc_auto_nosrc'), now = Date.now(), out = {}, b;
    if (!base || !k) return;
    for (b in all) {   // (expired names and servers go)
      var m = unexpired(all[b], now);
      if (Object.keys(m).length) out[b] = m;
    }
    (out[base] = out[base] || {})[k] = now + NOSRC_TTL;
    try { Lampa.Storage.set('alc_auto_nosrc', out); } catch (e) {}
    // nor is it offered in the settings' source list
    var list = storeArr('alc_auto_src_list');
    if (list.indexOf(k) >= 0) try { Lampa.Storage.set('alc_auto_src_list', list.filter(function (x) { return x !== k; })); } catch (e) {}
    console.log('AlcAuto', 'not a source:', k, '(' + base + ')');
  }
  // an entry's answer to the search says it is no source: 2 = it says so ({service: true}); 1 = it is
  // no balancer's answer: a page (HTML: nothing Autopilot could read anyway), or JSON with neither the
  // balancer's type nor data; 0 = nothing certain. A real source can fail (no answer, a timeout, 4xx /
  // 5xx), ask for rch or a sign-in, find nothing (an empty answer) or send a message ({error} / {msg}):
  // none of those counts. (The pack's modules answer a search like an empty source: the hint above.)
  function notSourceAnswer(st, j, text) {
    if (j && typeof j === 'object' && j.service === true) return 2;
    if (!(st >= 200 && st < 300)) return 0;
    // a page instead of JSON; any JSON may be a source's own way of saying «not found» ({}, {ok:false},
    // {results:[]} ...): never a proof
    return !j && /^\s*</.test(String(text || '').slice(0, 200)) ? 1 : 0;
  }
  // ---------- dynamic source ranking ----------
  // score (0..100) = 40% reliability + 25% quality + 20% completeness + 15% speed.
  // The start weights above (p) are only a prior until there is history. History is kept on this
  // device (Lampa.Storage) and shared by all devices through the server module `alcstats`;
  // old events fade out (half-life 7 days), so a source that was broken last week can come back.
  var HALF_LIFE = 7 * 864e5, K_PRIOR = 4;
  var devStats = {}, srvStats = {}, srvAt = 0, queue = [], qTimer = 0, saveTimer = 0;
  // servers without the module (other Lampac builds, NextGen) answer 404 or a page: stop asking, keep
  // device-only stats
  var srvNone = false;
  function srvFail(st, j) { if (absent(st, j)) { srvNone = true; queue.length = 0; } }
  devStats = storeObj('alc_auto_stats');

  function decayE(e, now) {
    if (e.t) { var f = Math.pow(0.5, (now - e.t) / HALF_LIFE); e.ok = (e.ok || 0) * f; e.fail = (e.fail || 0) * f; }
    e.t = now;
    return e;
  }
  function loadServerStats() {
    if (srvNone || !BASE || Date.now() - srvAt < 10 * 60 * 1000) return;
    srvAt = Date.now();
    getJSON(BASE + '/lite/alcstats?op=get', function (j) { if (j && j.stats && typeof j.stats === 'object') srvStats = j.stats; }, srvFail);
  }
  function record(src, ev) {
    src = String(src || '').toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(src)) return;
    var now = Date.now(), e = decayE(devStats[src] || {}, now);
    if (ev.ok) e.ok = (e.ok || 0) + ev.ok;
    if (ev.fail) e.fail = (e.fail || 0) + ev.fail;
    if (ev.rt) e.rt = e.rt ? Math.round(e.rt * 0.8 + ev.rt * 0.2) : Math.round(ev.rt);
    if (ev.q) e.q = e.q ? Math.round(e.q * 0.8 + ev.q * 0.2) : Math.round(ev.q);
    devStats[src] = e;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { Lampa.Storage.set('alc_auto_stats', devStats); } catch (x) {} }, 2000);
    if (srvNone) return;
    var out = { s: src };
    for (var k in ev) out[k] = ev[k];
    queue.push(out);
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      var batch = queue.splice(0, 50);
      if (batch.length && !srvNone && BASE) getJSON(BASE + '/lite/alcstats?op=put&d=' + encodeURIComponent(JSON.stringify(batch)), function () {}, srvFail);
    }, 4000);
  }
  function merged(src) {
    var now = Date.now(), d = devStats[src] || {}, s = srvStats[src] || {};
    var fd = d.t ? Math.pow(0.5, (now - d.t) / HALF_LIFE) : 1, fs = s.t ? Math.pow(0.5, (now - s.t) / HALF_LIFE) : 1;
    // this device counts double: it knows its own codec / network problems (iPad vs TV)
    return { ok: (d.ok || 0) * fd + 0.5 * (s.ok || 0) * fs, fail: (d.fail || 0) * fd + 0.5 * (s.fail || 0) * fs, rt: d.rt || s.rt, q: d.q || s.q };
  }
  function qOf(x) {
    var best = 0;
    function take(v) { var m = /(\d{3,4})p?/i.exec(String(v || '')); if (m) best = Math.max(best, parseInt(m[1], 10)); if (/4k|uhd/i.test(String(v || ''))) best = Math.max(best, 2160); }
    if (!x) return 0;
    var q = x.quality || x.qualitys;
    if (q && typeof q === 'object') for (var k in q) take(k);
    take(x.maxquality); take(x.details);
    if (!best) take(x.name);
    return best;
  }
  function itemsQuality(items) { var b = 0; (items || []).slice(0, 3).forEach(function (it) { b = Math.max(b, qOf(it)); }); return b; }
  function qNorm(q) { return !q ? 0 : q >= 2160 ? 1 : q >= 1440 ? 0.92 : q >= 1080 ? 0.85 : q >= 720 ? 0.62 : q >= 480 ? 0.4 : 0.25; }
  function srcScore(src, cand, maxItems) {
    var base = srcInfo(src).p / 100, m = merged(src);
    var rel = (m.ok + base * K_PRIOR) / (m.ok + m.fail + K_PRIOR);
    var spd = m.rt ? Math.max(0, Math.min(1, 1 - (m.rt - 500) / 9500)) : base;
    var qq = qNorm(cand && cand.items ? itemsQuality(cand.items) : 0) || qNorm(m.q) || 0.6;
    var comp = cand && cand.items && maxItems ? cand.items.length / maxItems : 0.7;
    var score = 100 * (0.40 * rel + 0.25 * qq + 0.20 * comp + 0.15 * spd) + base;
    var f = failures[src];
    if (f && Date.now() - f.t > FAIL_TTL) { delete failures[src]; f = null; }
    return score - (f ? Math.min(f.n, 2) * 30 : 0);   // a fresh failure in this session weighs extra
  }
  function srcPriority(s) { return srcScore(s, null, 0); }
  function rankCands(cands) {
    var mx = 0;
    cands.forEach(function (c) { if (c.items) mx = Math.max(mx, c.items.length); });
    // each score computed once (not in every comparison); ties keep the order they came in
    var sc = cands.map(function (c, i) { return { c: c, s: srcScore(c.src, c, mx), i: i }; });
    sc.sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); });
    return sc.map(function (x) { return x.c; });
  }
  function markFailed(s) {
    var f = failures[s];
    if (!f || Date.now() - f.t > FAIL_TTL) f = failures[s] = { n: 0, t: 0 };
    f.n++; f.t = Date.now();
    record(s, { fail: 1 });
  }
  // the stream that is playing now: a 'loadeddata' from the player counts as a success for its source
  var curSrc = '', curOk = true;
  // (only while that play is on: a trailer or another plugin's video after ours credits nothing)
  try {
    Lampa.PlayerVideo.listener.follow('loadeddata', function () {
      var d = null;
      try { d = Lampa.Player.playdata(); } catch (x) {}
      if (curSrc && !curOk && d && d.alc_src === curSrc) { curOk = true; record(curSrc, { ok: 1 }); }
    });
    Lampa.Player.listener.follow('destroy', function () { curOk = true; });
  } catch (e) {}

  // ======================= 6. LANGUAGES =======================
  // ---------- preferred voice-over languages ----------
  // Voices in these languages come first (in this order), the rest is folded. Device setting
  // 'alc_auto_langs' ("uk,en"; "-" = no preference); without it: the server default below (set by
  // the installer), else the interface language.
  var PREF_DEFAULT = 'ru';   // installer option auto-no-ua sets '' (= the interface language)
  function uiLang() {
    var l = '';
    try { l = String(Lampa.Storage.get('language', '') || ''); } catch (e) {}
    return (l || (navigator.language || 'en')).toLowerCase().split('-')[0];
  }
  function parseLangs(v) { return String(v || '').toLowerCase().split(/[\s,;]+/).filter(function (x) { return /^[a-z]{2,3}$/.test(x); }); }
  function prefLangs() {
    var v = null;
    try { v = Lampa.Storage.get('alc_auto_langs', null); } catch (e) {}
    if (v === '-') return [];
    if (v === null || v === undefined || v === '') {
      // older device setting "Ukrainian voice-overs first" (true / false)
      var old = '';
      try { old = Lampa.Storage.get('alc_auto_ua_first', ''); } catch (e) {}
      if (old === false || old === 'false') return [];
      if (old === true || old === 'true') return ['uk'];
      var d = parseLangs(PREF_DEFAULT);
      return d.length ? d : [uiLang()];
    }
    return parseLangs(v);
  }
  function prefIndex(lang) { var l = prefLangs(); var i = l.indexOf(lang); return i < 0 ? -1 : i; }
  function prefOn() { return prefLangs().length > 0; }

  // the script a text is written in (the most letters), and the interface language's
  var PLACEHOLDER = /^[^\d]{1,24}\s\d{1,4}$/;
  var SCRIPTS = { cyr: /[\u0400-\u04FF]/g, cjk: /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/g, lat: /[A-Za-z\u00C0-\u024F]/g };
  function scriptOf(str) {
    var best = '', n = 0;
    for (var k in SCRIPTS) { var c = (String(str || '').match(SCRIPTS[k]) || []).length; if (c > n) { n = c; best = k; } }
    return best;
  }
  // the interface language's script: the script of its own name (the browser knows it)
  function uiScript() {
    var l = uiLang(), d = dn(l), n = '';
    try { n = d ? d.of(l) : ''; } catch (e) {}
    return scriptOf(n) || 'lat';
  }
  // ---------- language names (the browser's Intl; no word lists) ----------
  var dnCache = {};
  function dn(loc) {
    if (dnCache[loc] !== undefined) return dnCache[loc];
    var d = null;
    try { if (window.Intl && Intl.DisplayNames) d = new Intl.DisplayNames([loc], { type: 'language' }); } catch (e) {}
    return (dnCache[loc] = d);
  }
  // a voice the source gives no name for, in a known language: "Українське озвучення" /
  // "Украинская озвучка" / "Ukrainian voice-over" - the adjective from the browser's language name,
  // put in the right form for the interface language; other interfaces: "Unnamed voice-over · X"
  function unnamedLabel(lang) {
    var ln = langName(lang), ui = uiLang(), low = String(ln || '').toLowerCase();
    if (!ln || ln === String(lang).toUpperCase()) return tr('unnamed') + (ln ? ' · ' + ln : '');
    var cap = function (x) { return x.charAt(0).toUpperCase() + x.slice(1); };
    if (ui === 'uk' && /[сцз]ька$/.test(low)) return cap(low.replace(/а$/, 'е')) + ' озвучення';
    if (ui === 'ru' && /[сцз]кий$/.test(low)) return cap(low.replace(/ий$/, 'ая')) + ' озвучка';
    if (ui === 'en' && /^[A-Z][a-z]+$/.test(ln)) return ln + ' voice-over';
    return tr('unnamed') + ' · ' + ln;
  }
  function langName(code) {
    if (!code || code === 'und') return '';
    var d = dn(uiLang()), n = '';
    try { n = d ? d.of(code) : ''; } catch (e) {}
    return n && n !== code ? n : code.toUpperCase();
  }
  // a language code ('ukr', 'UA' as a country, 'ru') -> 'uk' / 'ru' / ...; '' if it is none
  function langCode(tok, region) {
    var t = String(tok || '').toLowerCase(), en = dn('en');
    if (!en || !/^[a-z]{2,3}$/.test(t)) return '';
    try {
      var c = (Intl.getCanonicalLocales(t)[0] || '').toLowerCase();
      if (c && en.of(c) !== c) return c;
    } catch (e) {}
    if (region && t.length === 2 && window.Intl && Intl.Locale) {
      try { var m = new Intl.Locale('und-' + t.toUpperCase()).maximize(); if (m.language && m.language !== 'und') return m.language; } catch (e) {}
    }
    return '';
  }
  // every language's name, as word stems, in the languages written in the word's script (a Cyrillic
  // word: the names in Russian, Ukrainian, Bulgarian…; a Latin one: English, French…), found from
  // the browser's own data: a language's script = the script of its own name
  var LANG_STEMS = null, LANG_CODES = null, CODE_SCRIPT = {};
  function langCodes() {
    if (LANG_CODES) return LANG_CODES;
    LANG_CODES = [];
    var en = dn('en'), seen = {}, a, b;
    if (!en) return LANG_CODES;
    prefLangs().concat([uiLang()]).forEach(function (c) { if (!seen[c]) { seen[c] = 1; LANG_CODES.push(c); } });
    for (a = 97; a <= 122; a++) for (b = 97; b <= 122; b++) {
      var c = String.fromCharCode(a, b);
      if (seen[c]) continue;
      try { if (en.of(c) !== c) { seen[c] = 1; LANG_CODES.push(c); } } catch (e) {}
    }
    return LANG_CODES;
  }
  function codeScript(c) {
    if (CODE_SCRIPT[c] === undefined) { var d = dn(c), n = ''; try { n = d ? d.of(c) : ''; } catch (e) {} CODE_SCRIPT[c] = scriptOf(n) || ''; }
    return CODE_SCRIPT[c];
  }
  function langStems(script) {
    LANG_STEMS = LANG_STEMS || {};
    script = script || 'lat';
    if (LANG_STEMS[script]) return LANG_STEMS[script];
    var out = LANG_STEMS[script] = [];
    out.by = {};
    var codes = langCodes();
    if (!codes.length) return out;
    var locs = ['en', uiLang()].concat(prefLangs()).concat(codes.filter(function (c) { return codeScript(c) === script; }));
    var seenLoc = {};
    locs = locs.filter(function (l) { if (seenLoc[l]) return false; seenLoc[l] = 1; return true; });
    var own = {};
    ['en', uiLang()].concat(prefLangs()).forEach(function (l) { own[l] = 1; });
    codes.forEach(function (c) {
      locs.concat([c]).forEach(function (loc) {
        var d = dn(loc), n = '';
        try { n = d ? String(d.of(c) || '') : ''; } catch (e) {}
        n = n.toLowerCase().split(/[\s(,]/)[0];
        if (!n || n === c || n.length < 4 || scriptOf(n) !== script) return;
        // a short name is the whole word: Kazakh "серб" is not "Сербин"; so is a name up to 7 letters
        // in some other language of the script (not the interface / preferred ones / English, not the
        // language's own name): Chechen "сербийн" is not "Сербин" either
        var weak = !own[loc] && loc !== c, exact = n.length <= 5 || (weak && n.length <= 7);
        out.push({ stem: exact ? n : n.slice(0, Math.max(5, n.length - 4)), abbr: n, code: c, exact: exact });
      });
    });
    // by first letter, in order (every match below starts with the word's first letter): a word is
    // compared with a few dozen names, not thousands
    out.forEach(function (x) { var f = x.stem.charAt(0); (out.by[f] = out.by[f] || []).push(x); });
    return out;
  }
  function inBrackets(str, at) { return /[\[(][^\])]*$/.test(str.slice(0, at)); }
  // languages named in a voice name: ["uk"], ["ru", "en"], [] ; "+UA" (an extra track) is ignored.
  // Remembered by name (the same few dozen names come again on every page of every season: a long
  // anime asked thousands of times, each a walk over the language stems; the stems are built once too)
  var langsMemo = {}, langsMemoN = 0;
  function langsIn(name) {
    var key = '#' + (name == null ? '' : name), hit = langsMemo[key];
    if (hit) return hit;
    if (++langsMemoN > 3000) { langsMemo = {}; langsMemoN = 1; }
    return (langsMemo[key] = langsInName(name));
  }
  function langsInName(name) {
    var orig = String(name || ''), out = [], low = orig.toLowerCase();
    function push(c) { if (c && out.indexOf(c) < 0) out.push(c); }
    var re = /([+]?)([^\s,.;:!?()\[\]{}|\/\\+\---_"'«»0-9]+)(\.?)/g, m, inBr;
    while ((m = re.exec(low)) !== null) {
      if (m[1]) continue;
      var w = m[2], dot = !!m[3], caps = orig.substr(m.index + m[1].length, w.length);
      // an upper-case two-letter word ("DUB RU") is a language code too
      if (/^[A-Z]{2}$/.test(caps) && !TECH_RE.test(w) && !inBrackets(low, m.index)) { push(langCode(w, false)); continue; }
      inBr = inBrackets(low, m.index);
      if (TECH_RE.test(w) && !/^[a-z]{3}$/.test(w)) continue;
      // a three-letter word is a language code only for languages that also have a two-letter one
      // (eng, ukr, rus...): "BBC" is a code too (Batak Toba) but not a language anyone names here
      if (/^[a-z]{3}$/.test(w) && !kindOf(w)) { var c3 = langCode(w, false); if (c3.length === 2) push(c3); continue; }
      if (/^[a-z]{2}$/.test(w)) { if (inBr || low.length <= 4) push(langCode(w, true)); continue; }
      if (w.length < 3) continue;
      var st = langStems(scriptOf(w)).by[w.charAt(0)] || [], hit = '';
      for (var i = 0; i < st.length && !hit; i++) {
        if (st[i].exact ? w === st[i].stem : (w.length >= 5 && w.indexOf(st[i].stem) === 0)) hit = st[i].code;
        else if ((dot || inBr) && w.length >= 3 && w.length < 5 && st[i].abbr.indexOf(w) === 0) hit = st[i].code;
      }
      push(hit);
    }
    return out;
  }

  // a track's language as two letters (players and manifests give "uk", "ukr", "uk-UA", "Ukrainian")
  var LANG3 = { ukr: 'uk', rus: 'ru', eng: 'en', jpn: 'ja', ger: 'de', deu: 'de', fre: 'fr', fra: 'fr', spa: 'es', ita: 'it', pol: 'pl',
    kor: 'ko', chi: 'zh', zho: 'zh', por: 'pt', tur: 'tr', cze: 'cs', ces: 'cs', heb: 'he', ara: 'ar', hin: 'hi', bel: 'be', kaz: 'kk', geo: 'ka', kat: 'ka' };
  function lang2(x) {
    x = String(x || '').toLowerCase().replace(/[-_].*$/, '');
    if (x === 'und') return '';
    if (!/^[a-z]{2,3}$/.test(x)) return x.length > 3 ? langsIn(x)[0] || '' : '';
    return x.length === 3 ? LANG3[x] || x.slice(0, 2) : x;
  }

  // ======================= 7. VOICES: CLASSIFICATION, STUDIOS, FAVOURITES, THE CHOICE PER CARD =======================
  // ---------- voice classification ----------
  // \b only knows Latin letters, so word boundaries are built from separators: spaces,
  // punctuation and symbols (any script's letters count as letters)
  var SEP = '[\\s!-\\/:-@\\[-`{-~\\u00a0-\\u00bf\\u2000-\\u206f\\u3000-\\u303f]';
  function reEsc(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'); }
  // a DATA word list as one regexp: words of 4+ letters match as word starts, shorter ones whole
  function wordsRe(list) {
    var long = [], short = [];
    (list || []).forEach(function (w) { (String(w).length >= 4 ? long : short).push(reEsc(String(w).toLowerCase())); });
    var parts = [];
    if (long.length) parts.push('(?:^|' + SEP + ')(?:' + long.join('|') + ')');
    if (short.length) parts.push('(?:^|' + SEP + ')(?:' + short.join('|') + ')(?=$|' + SEP + ')');
    return parts.length ? new RegExp(parts.join('|'), 'i') : /$^/;
  }
  var KIND_RE = {};
  ['dub', 'avo', 'mvo'].forEach(function (k) { KIND_RE[k] = wordsRe((DATA.kinds || {})[k]); });
  function kindOf(name) { return KIND_RE.dub.test(name) ? 'dub' : KIND_RE.avo.test(name) ? 'avo' : KIND_RE.mvo.test(name) ? 'mvo' : ''; }
  var SUBS_RE = wordsRe(DATA.subs), DEAD_RE = wordsRe(DATA.dead);
  // [matcher, display name, key name]; built from DATA + this device's edits (see the studio editor)
  var STUDIOS = [];
  var PLACEHOLDER_RE = new RegExp('^(?:' + (DATA.placeholders || []).map(reEsc).join('|') + ')$', 'i');
  // tokens that describe the stream, not the voice: resolution, codecs, releases, language codes
  // ("Дубляж [1080, Ukr, ПлюсПлюс]" -> studio "ПлюсПлюс"; "Дубляж [4K, SDR, ru, Blu-Ray]" -> a dub)
  var TECH_RE = /^([\d\s.]+p?\+?|[48]k|uhd|fhd|hd|sd|hdr\S*|sdr|dv|\+\s*[a-z]{2,3}|blu-?ray|bd-?(rip|remux)?|remux|web-?(dl|rip)?|hdtv|hd-?rip|dvd-?rip|hevc|avc|[hx]\.?26[45]|aac|e?-?ac-?3|dts(-?hd)?|atmos|truehd|\d{1,2}-?bit|dolby\s*vision)$/i;
  // a name as a key: lower case, letters of any script and digits ('+' kept: "1+1")
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s!-*,-\/:-@\[-`{-~\u00a0-\u00bf\u2000-\u206f\u3000-\u303f]+/g, ''); }
  // nothing but stream details / punctuation / language names
  function onlyDetails(name) {
    var rest = String(name || '').toLowerCase().replace(/[\[\](),|\/+\-]+/g, ' ').split(/\s+/).filter(function (w) {
      return w && !TECH_RE.test(w) && !langsIn(w).length;
    });
    return !rest.length;
  }

  // returns {key, label, lang, pref, fav, rank}, or null for an entry without a stream
  //   meta: {lang: the voice-over language the source declares, unnamed: the source has no name for it}
  function classify(src, raw, movie, meta) {
    meta = meta || {};
    var name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (DEAD_RE.test(name)) return null;
    if (SUBS_RE.test(name)) {
      // original audio with subtitles: not a voice-over; the source's own wording is kept,
      // identical wording from several sources is merged
      return { key: 'sub:' + norm(name), label: tr('orig_subs', name), lang: 'und', pref: false, fav: false, rank: 5 };
    }
    if (name.replace(/\[[^\]]*\]/g, '').split(/\s*[,\/]\s*/).length >= 3) {
      // one stream with several audio tracks
      return { key: 'multi:' + src, label: tr('multi', src), lang: 'und', pref: false, fav: false, rank: 5 };
    }
    // language: what the item says, words in the name, the site's language, the DATA entry, unknown
    var named = langsIn(name);
    var lang = lang2(meta.itemLang) || named[0] || lang2(meta.lang) || (srcInfo(src).lang) || 'und';
    var title1 = String(movie.title || movie.name || '').toLowerCase();
    var title2 = String(movie.original_title || movie.original_name || '').toLowerCase();
    var low = name.toLowerCase();
    var unnamed = !!meta.unnamed || !name || PLACEHOLDER_RE.test(name) || low === title1 || low === title2 ||
      low.indexOf(title1 + ' / ') === 0 || onlyDetails(name);
    var studio = '';
    if (!unnamed) {
      var studioKey = '';
      for (var i = 0; i < STUDIOS.length; i++) if (STUDIOS[i][0].test(name)) {
        studio = STUDIOS[i][1]; studioKey = STUDIOS[i][2];
        // a studio of the directory that voices in one language only: its language when nothing
        // else told one (an explicit language word or the source's language wins)
        if (lang === 'und' && STUDIOS[i][3]) lang = STUDIOS[i][3];
        break;
      }
      if (!studio) {
        // a studio named inside brackets next to stream details
        var br = [];
        name.replace(/\[([^\]]*)\]/g, function (m, x) { br = br.concat(x.split(/\s*,\s*/)); return m; });
        br = br.filter(function (t) { t = t.trim(); return t && !TECH_RE.test(t) && !kindOf(t) && !langsIn(t).length; });
        if (br.length === 1) studio = br[0].trim();
      }
    }
    var kind = unnamed ? '' : kindOf(name);
    var key, label;
    if (unnamed) {
      key = 'unnamed:' + lang;
      label = unnamedLabel(lang);
    } else if (studio) {
      key = 'v:' + lang + ':' + (studioKey || norm(studio));
      label = studio;
    } else if (kind) {
      key = 'v:' + lang + ':' + kind;
      label = tr('k_' + kind) + (lang !== 'und' ? ' · ' + langName(lang) : '');
    } else {
      // the source's own wording; a language word around the real name is dropped:
      // "Український (Київстар ТБ)" -> "Київстар ТБ"
      var outside = name.replace(/\[[^\]]*\]/g, '').replace(/\(.*?\)/g, '').replace(/[|].*$/, '').trim();
      var inside = (/\(([^)]+)\)/.exec(name) || [])[1] || '';
      var clean = (onlyDetails(outside) || PLACEHOLDER_RE.test(outside)) && inside ? inside.trim() : (outside || name);
      key = 'v:' + lang + ':' + norm(clean);
      label = clean;
    }
    var pref = prefIndex(lang) >= 0;
    return { key: key, label: label, lang: lang, pref: pref, fav: false, rank: pref ? 1 : 4, unnamed: unnamed };
  }

  // ---------- studio directory: DATA.studios + this device's edits ----------
  // Lampa.Storage 'alc_auto_data'.studio_edits (the per-device override of DATA):
  //   "<built-in name>": { name: renamed, add: [spellings], del: [spellings], hide: true }
  //   "+<id>": { user: true, name, k: key name, match: [spellings] }   (a studio added here)
  // A studio keeps its key when renamed, so remembered voices stay valid.
  var RUSSIAN_STUDIOS = /^(lostfilm|tvshows|newstudio|coldfilm|jaskier|alexfilm|hdrezka|redheadsound|leproduction|levitation|кубиквкубе|гоблин|сербин|гаврилов|amedia)$/i;
  (DATA.studios || []).forEach(function (studio) { if (!studio.lang && RUSSIAN_STUDIOS.test(norm(studio.name))) studio.lang = 'ru'; });
  [{name:'HDRezka',lang:'ru',match:['hdrezka','hd rezka']},{name:'Red Head Sound',lang:'ru',match:['red head sound']},{name:'Кубик в Кубе',lang:'ru',match:['кубик в кубе']},{name:'AlexFilm',lang:'ru',match:['alexfilm']},{name:'LE-Production',lang:'ru',match:['le-production','le production']},{name:'LE-Vitation',lang:'ru',match:['le-vitation','le vitation']}].forEach(function (studio) { if (!(DATA.studios || []).some(function (old) { return norm(old.name) === norm(studio.name); })) DATA.studios.push(studio); });
  var BUILTIN_STUDIOS = (DATA.studios || []).slice();
  function dataOver() {
    var o = null;
    try { o = Lampa.Storage.get('alc_auto_data', ''); if (typeof o === 'string') o = o ? JSON.parse(o) : {}; } catch (e) { o = {}; }
    return o && typeof o === 'object' ? o : {};
  }
  function studioEdits() { var e = dataOver().studio_edits; return e && typeof e === 'object' ? e : {}; }
  // spellings by key: a variant typed in the editor that differs only in spaces/punctuation is the same one
  function uniqVariants(list) { return uniqBy(list, norm); }
  // spellings as matched: wordsRe() matches the literal text, so "1 + 1", "плюс-плюс" and "fox crime"
  // are their own spellings, not copies of "1+1", "плюсплюс" and "foxcrime"
  function uniqSpellings(list) { return uniqBy(list, function (x) { return x.toLowerCase(); }); }
  function uniqBy(list, key) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) { x = String(x || '').trim(); var n = key(x); if (n && !seen[n]) { seen[n] = 1; out.push(x); } });
    return out;
  }
  function studioList(withHidden) {
    var ed = studioEdits(), out = [];
    BUILTIN_STUDIOS.forEach(function (s) {
      var e = ed[s.name] || {};
      if (e.hide && !withHidden) return;
      var del = (e.del || []).map(norm);
      out.push({ id: s.name, k: norm(s.name), name: e.name || s.name, builtin: true, hidden: !!e.hide, lang: s.lang || '',
        edited: !!(e.name || (e.add && e.add.length) || (e.del && e.del.length)),
        match: uniqSpellings((s.match || []).filter(function (m) { return del.indexOf(norm(m)) < 0; }).concat(e.add || [])) });
    });
    for (var id in ed) if (ed[id] && ed[id].user && ed[id].name) {
      out.push({ id: id, k: ed[id].k || norm(ed[id].name), name: ed[id].name, user: true, lang: ed[id].lang || '', match: uniqSpellings(ed[id].match) });
    }
    return out;
  }
  function buildStudios() {
    STUDIOS = studioList(false).map(function (s) {
      return [wordsRe(uniqSpellings(s.match.concat([s.name]))), s.name, s.k, s.lang];
    });
  }
  buildStudios();
  // edits apply at once: voice lists of the open screens are built again
  function saveEdits(ed) {
    var o = dataOver();
    if (ed && Object.keys(ed).length) o.studio_edits = ed; else delete o.studio_edits;
    Lampa.Storage.set('alc_auto_data', o);
    buildStudios();
    prefVer++;
    for (var k in sessions) { try { sessions[k].changed(); } catch (e) {} }
  }
  function editOf(ed, s) { return (ed[s.id] = ed[s.id] || {}); }

  function askText(title, value, cb) {
    try {
      Lampa.Input.edit({ title: title, value: value || '', free: true, nosave: true }, function (v) {
        v = String(v || '').trim();
        if (v === String(value || '').trim()) { cb(null); return; }   // back without a change
        if (norm(v).length < 2) { noty(tr('st_short')); cb(null); return; }
        cb(v);
      });
    } catch (e) { cb(null); }
  }
  function studiosMenu(onBack) {
    var list = studioList(true).sort(function (a, b) { return (a.hidden - b.hidden) || String(a.name).localeCompare(String(b.name)); });
    var hasEdits = Object.keys(studioEdits()).length > 0;
    var again = function () { studiosMenu(onBack); };
    var items = [{ title: tr('st_add'), add: true }, { title: tr('st_unknown') + ' ›', subtitle: tr('st_unknown_d'), unknown: true }];
    if (hasEdits) items.push({ title: tr('st_reset_all'), resetAll: true });
    list.forEach(function (s) {
      var marks = [tr('st_variants', uniqSpellings(s.match.concat([s.name])).length)];
      if (s.user) marks.push(tr('st_mine')); else if (s.edited) marks.push(tr('st_edited'));
      if (s.hidden) marks.push(tr('st_hidden'));
      items.push({ title: s.name + (s.user || s.edited ? ' ✎' : ''), subtitle: marks.join(' · '), studio: s });
    });
    Lampa.Select.show({
      title: tr('studios'),
      items: items,
      onSelect: function (a) {
        if (a.add) askText(tr('st_name'), '', function (v) {
          if (v) { var ed = studioEdits(); ed['+' + Date.now().toString(36)] = { user: true, name: v, k: norm(v), match: [v] }; saveEdits(ed); noty(tr('st_saved')); }
          again();
        });
        else if (a.unknown) unknownMenu(again);
        else if (a.resetAll) { saveEdits({}); noty(tr('st_saved')); again(); }
        else if (a.studio) studioMenu(a.studio, again);
      },
      onBack: onBack
    });
  }
  function studioMenu(s, onBack) {
    var again = function () {
      var fresh = studioList(true).filter(function (x) { return x.id === s.id; })[0];
      if (fresh) studioMenu(fresh, onBack); else onBack();
    };
    var items = [{ title: tr('st_rename'), act: 'rename' }, { title: tr('st_add_var'), act: 'add' }];
    if (s.match.length) items.push({ title: tr('st_del_var') + ' ›', subtitle: s.match.join(', ').slice(0, 80), act: 'del' });
    if (s.builtin) items.push(s.hidden ? { title: tr('st_unhide'), act: 'unhide' } : { title: tr('st_hide'), act: 'hide' });
    else items.push({ title: tr('st_delete'), act: 'delete' });
    if (s.builtin && (s.edited || s.hidden)) items.push({ title: tr('st_reset'), act: 'reset' });
    Lampa.Select.show({
      title: s.name,
      items: items,
      onSelect: function (a) {
        var ed = studioEdits(), e = editOf(ed, s);
        if (a.act === 'rename') askText(tr('st_name'), s.name, function (v) { if (v) { e.name = v; saveEdits(ed); noty(tr('st_saved')); } again(); });
        else if (a.act === 'add') askText(tr('st_var'), '', function (v) {
          if (v) { if (s.user) e.match = uniqVariants((e.match || []).concat([v])); else { e.add = uniqVariants((e.add || []).concat([v])); e.del = (e.del || []).filter(function (x) { return norm(x) !== norm(v); }); } saveEdits(ed); noty(tr('st_saved')); }
          again();
        });
        else if (a.act === 'del') {
          Lampa.Select.show({
            title: tr('st_del_var'),
            items: s.match.map(function (m) { return { title: m, v: m }; }),
            onSelect: function (b) {
              var ed2 = studioEdits(), e2 = editOf(ed2, s), n = norm(b.v);
              if (s.user) e2.match = (e2.match || []).filter(function (x) { return norm(x) !== n; });
              else {
                var inAdd = (e2.add || []).some(function (x) { return norm(x) === n; });
                e2.add = (e2.add || []).filter(function (x) { return norm(x) !== n; });
                if (!inAdd) e2.del = uniqVariants((e2.del || []).concat([b.v]));
              }
              saveEdits(ed2); noty(tr('st_saved')); again();
            },
            onBack: again
          });
        }
        else if (a.act === 'hide' || a.act === 'unhide') { e.hide = a.act === 'hide'; if (!e.hide) delete e.hide; saveEdits(ed); noty(tr('st_saved')); again(); }
        else if (a.act === 'delete') { delete ed[s.id]; saveEdits(ed); noty(tr('st_saved')); onBack(); }
        else if (a.act === 'reset') { delete ed[s.id]; saveEdits(ed); noty(tr('st_saved')); again(); }
      },
      onBack: onBack
    });
  }
  // names of voices seen lately that no studio claims (not a kind of voice-over, not unnamed)
  function unknownNames() {
    var seen = seenVoices(), keys = {}, out = [], have = {};
    STUDIOS.forEach(function (s) { keys[s[2]] = 1; });
    Object.keys(seen).sort(function (a, b) { return (seen[b].t || 0) - (seen[a].t || 0); }).forEach(function (k) {
      var m = /^v:[a-z]{2,3}:(.+)$/.exec(k), l = String(seen[k].l || '');
      if (!m || keys[m[1]] || /^(dub|avo|mvo)$/.test(m[1]) || !l || have[norm(l)]) return;
      if (STUDIOS.some(function (s) { return s[0].test(l); })) return;
      have[norm(l)] = 1;
      out.push(l);
    });
    return out.slice(0, 60);
  }
  function unknownMenu(onBack) {
    var names = unknownNames();
    if (!names.length) { noty(tr('st_none')); onBack(); return; }
    Lampa.Select.show({
      title: tr('st_unknown'),
      items: names.map(function (n) { return { title: n, name: n }; }),
      onSelect: function (a) {
        var back = function () { unknownMenu(onBack); };
        Lampa.Select.show({
          title: a.name,
          items: [{ title: tr('st_from_name'), make: true }, { title: tr('st_to_studio') + ' ›', to: true }],
          onSelect: function (b) {
            if (b.make) { var ed = studioEdits(); ed['+' + Date.now().toString(36)] = { user: true, name: a.name, k: norm(a.name), match: [a.name] }; saveEdits(ed); noty(tr('st_saved')); back(); return; }
            var list = studioList(false).sort(function (x, y) { return String(x.name).localeCompare(String(y.name)); });
            Lampa.Select.show({
              title: tr('st_to_studio'),
              items: list.map(function (s) { return { title: s.name, studio: s }; }),
              onSelect: function (c) {
                var ed = studioEdits(), e = editOf(ed, c.studio);
                if (c.studio.user) e.match = uniqVariants((e.match || []).concat([a.name]));
                else e.add = uniqVariants((e.add || []).concat([a.name]));
                saveEdits(ed); noty(tr('st_saved')); back();
              },
              onBack: back
            });
          },
          onBack: back
        });
      },
      onBack: onBack
    });
  }

  // ---------- voices offered so far (the list for "favourite voices" in the settings) ----------
  function seenVoices() { return storeObj('alc_auto_voices_seen'); }
  function rememberVoices(list) {
    var seen = seenVoices(), add = false;
    list.forEach(function (v) {
      if (v.rank >= 5 || seen[v.key]) return;
      seen[v.key] = { l: v.label, lang: v.lang, n: 0, t: Date.now() };
      add = true;
    });
    if (!add) return;   // written only when something new shows up
    var keys = Object.keys(seen);
    if (keys.length > 300) {
      keys.sort(function (a, b) { return (seen[b].n - seen[a].n) || (seen[b].t - seen[a].t); });
      keys.slice(300).forEach(function (k) { delete seen[k]; });
    }
    Lampa.Storage.set('alc_auto_voices_seen', seen);
  }
  function favKeys() {
    return storeArr('alc_auto_fav_keys').map(normKey);
  }

  // Favourite voices: picked in the plugin settings from the voices seen so far (alc_auto_fav_keys).
  // The older text setting 'alc_auto_fav' ("LostFilm, Netflix") still works.
  // favs: favLists() when the caller checks many voices
  function favLists() {
    var text = [];
    try { text = String(Lampa.Storage.get('alc_auto_fav', '') || '').toLowerCase().split(/\s*,\s*/).filter(Boolean); } catch (e) {}
    return { keys: favKeys(), text: text };
  }
  function isFav(v, favs) {
    favs = favs || favLists();
    var keys = favs.keys, text = favs.text;
    for (var i = 0; i < keys.length; i++) if (keyMatch(v, keys[i])) return true;
    var l = String(v.label || '').toLowerCase();
    for (var j = 0; j < text.length; j++) if (l.indexOf(text[j]) >= 0) return true;
    return false;
  }


  // ---------- state per card ----------
  function choiceStore() { return storeObj('alc_auto_choice'); }
  // Voice keys: 'v:<lang>:<name>', 'unnamed:<lang>', 'sub:<text>', 'multi:<source>'. Keys saved by
  // older versions: 'ua:<name>' (Ukrainian) / 'ru:<name>' (anything else) -> 'v:uk:' / 'v:ru:'.
  function normKey(k) {
    k = String(k || '');
    var m = /^(ua|ru):(.*)$/.exec(k);
    if (m) return 'v:' + (m[1] === 'ua' ? 'uk' : 'ru') + ':' + norm(m[2]);
    m = /^v:([a-z]{2,3}):(.*)$/.exec(k);
    if (m) return 'v:' + m[1] + ':' + norm(m[2]);
    m = /^(sub):(.*)$/.exec(k);
    return m ? 'sub:' + norm(m[2]) : k;
  }
  function keyName(k) { var m = /^v:[a-z]{2,3}:(.*)$/.exec(k); return m ? m[1] : null; }
  function keyLang(k) { var m = /^(?:v|unnamed):([a-z]{2,3})/.exec(k); return m ? m[1] : ''; }
  // the same voice, also when its language was detected differently (older keys, 'und')
  function keyMatch(v, k) {
    if (!k) return false;
    k = normKey(k);
    if (v.key === k) return true;
    var a = keyName(v.key), b = keyName(k);
    return a !== null && a === b && (keyLang(k) === v.lang || keyLang(k) === 'und' || v.lang === 'und');
  }
  function getChoice(id) {
    var c = choiceStore()[id] || {};
    if (c.voice) c.voice = normKey(c.voice);
    return c;
  }
  function saveChoice(id, patch) {
    var all = choiceStore(), cur = all[id] || {}, k;
    for (k in patch) cur[k] = patch[k];
    cur.t = Date.now();
    all[id] = cur;
    trimByT(all, 300);
    Lampa.Storage.set('alc_auto_choice', all);
    declareSync();   // again (idempotent): a sync plugin that loaded after us learns the key here
    if (patch.voice) {
      var seen = seenVoices();
      if (seen[patch.voice]) { seen[patch.voice].n++; seen[patch.voice].t = Date.now(); Lampa.Storage.set('alc_auto_voices_seen', seen); }
      var recent = [patch.voice].concat(storeArr('alc_auto_recent').filter(function (v) { return v !== patch.voice; })).slice(0, 10);
      Lampa.Storage.set('alc_auto_recent', recent);
    }
  }

  function episodeNum(it, idx) {
    var e = parseInt(it.e, 10);
    if (!e || e < 1) {
      // "S01E05" -> 5; otherwise the last small number ("1 сезон 5 серия" -> 5, "Серія 3" -> 3)
      var name = String(it.name || it.title || ''), m = /e(\d{1,4})(?!\d)/i.exec(name);
      if (m) e = parseInt(m[1], 10);
      else {
        var nums = (name.match(/\d+/g) || []).map(Number).filter(function (n) { return n > 0 && n < 1000; });
        if (nums.length) e = nums[nums.length - 1];
      }
    }
    return e > 0 ? e : idx + 1;
  }
  // Some sources pack several episodes into one file ("s01e01-02", "1-2 серия"): [first, last].
  function episodeRange(it, idx) {
    var a = episodeNum(it, idx);
    var m = /e(\d+)\s*-\s*e?(\d+)/i.exec(String(it.url || '')) || /(\d+)\s*[\-\u2013\u2014]\s*(\d+)/.exec(String(it.name || it.title || ''));
    if (m) {
      var x = parseInt(m[1], 10), y = parseInt(m[2], 10);
      if (x === a && y > a && y - a < 5) return [a, y];
    }
    return [a, a];
  }
  // voice pages are cached per season: some modules use one URL for every season of a voice
  function cacheKey(c) { return (c.url || c.src + ':' + c.name) + '#' + (c.season || 0); }
  // false when the item says it belongs to another season (s) than the one asked for
  function inSeason(it, season) {
    var s = parseInt(it.s, 10);
    return !season || !(s > 0) || s === season;
  }
  // the items of a source answer that are streams (not folders), of that season (0 = any)
  function isPlayable(it) { return it.method === 'play' || it.method === 'call'; }
  function playableItems(j, season) { return ((j && j.data) || []).filter(function (it) { return isPlayable(it) && inSeason(it, season); }); }
  function seasonNum(it, idx) {
    var s = parseInt(it.id, 10);
    if (!(s > 0)) { var m = /(\d+)/.exec(it.name || ''); s = m ? parseInt(m[1], 10) : idx + 1; }
    return s;
  }

  function timelineHash(movie, season, episode) {
    var ot = movie.original_title;
    return Lampa.Utils.hash(season ? [season, season > 10 ? ':' : '', episode, ot].join('') : ot);
  }
  // Lampa's watch progress of an episode (a movie: 0, 0); watched = WATCHED % or more
  var WATCHED = 90;
  function timelineOf(movie, season, episode) { return Lampa.Timeline.view(timelineHash(movie, season, episode)); }
  function watched(tl) { return !!(tl && tl.percent >= WATCHED); }
  // Episode order: one setting for every title (a viewing habit, like newest first for a show still
  // airing); the focus lands on the next episode to watch either way.
  function epReverse() { var v = false; try { v = Lampa.Storage.get('alc_auto_ep_rev', false); } catch (e) {} return v === true || v === 'true'; }

  function setDefaultQuality(el) {
    var q = el.quality;
    if (!q || typeof q !== 'object') return;
    var want = parseInt(Lampa.Storage.field('video_quality_default'), 10);
    for (var k in q) {
      var v = typeof q[k] === 'string' ? q[k] : (q[k] && q[k].url) || '';
      if (v.indexOf(' or ') >= 0) { v = v.split(' or ')[0]; q[k] = v; }
      if (want && parseInt(k, 10) === want) el.url = v;
    }
  }
  function splitReserve(el) {
    if (typeof el.url === 'string' && el.url.indexOf(' or ') >= 0) {
      var p = el.url.split(' or ');
      el.url = p[0];
    }
  }

  // Resolve a 'play'/'call' item to {url, quality, headers, subtitles}.
  function resolveItem(it, ok, fail) {
    if (it.method === 'play' || !it.method) {
      var q0 = qOf(it); if (q0 && it.alc_src) record(it.alc_src, { q: q0 });
      ok({ url: it.url || it.stream, quality: it.quality || it.qualitys, subtitles: it.subtitles, headers: it.headers, segments: it.segments, subtitles_call: it.subtitles_call });
      return;
    }
    getJSON(it.url, function (j) {
      // voice_name: the voice the source actually gives (it may substitute an unavailable one)
      if (j && j.url) ok({ url: j.url, quality: j.quality || it.qualitys, subtitles: j.subtitles, headers: j.headers, segments: j.segments || it.segments,
        subtitles_call: j.subtitles_call || it.subtitles_call,
        voice_name: j.voice_name || j.translate || '' });
      else fail();
    }, fail, { pri: true });   // (the viewer waits for it: first in a busy server's line)
  }

  // ======================= 8. SESSION: EVERYTHING KNOWN ABOUT ONE CARD =======================
  // ---------- session: everything we know about one card ----------
  function Session(movie) {
    var copy = {};
    for (var k in movie) copy[k] = movie[k];
    this.card = movie;   // the card as Lampa gave it (for Lampa's history)
    this.movie = movie = copy;
    this.serial = isSerial(movie);
    this.roots = {};    // src -> root json
    this.seasons = {};  // seasonNum -> [{src, url, json?}]
    this.seasonData = {}; // seasonNum -> {src -> json(episode page)}
    this.voiceCache = {}; // cacheKey(cand) -> episodes
    this.emptyVoice = {}; // cacheKey(cand) -> true: the voice page has no episodes of that season
    this.badVoice = {};   // cacheKey(cand) -> true: the source plays another voice under this name
    this.checked = {};    // cacheKey(cand) -> true: the voice was checked (see verifyCand)
    this.srcVoices = {};  // 'src#season' -> {voice key: true}: voices each source lists
    this.inflight = {};   // 'season:src' -> [callbacks]
    this.seasonFail = {}; // 'season:src' -> when its page failed / was empty
    this.answered = {};   // sources that answered the search (with or without results)
    this.ready = false;
  }

  // Still waiting for anything that may add voices to this season?
  // some source has not answered the search yet
  Session.prototype.rootsPending = function () { return !this.rootsDone || this.rootsLeft > 0; };
  // (season 0, a movie: the search only)
  Session.prototype.pending = function (season) {
    if (this.rootsPending()) return true;
    for (var k in this.inflight) if (k.indexOf(season + ':') === 0) return true;
    return false;
  };

  // Late answers (after the menu/screen is already shown) notify listeners, so open screens can
  // add the new voices / seasons without being reopened.
  Session.prototype.listen = function (f) { this.listeners = this.listeners || []; if (this.listeners.indexOf(f) < 0) this.listeners.push(f); };
  Session.prototype.unlisten = function (f) {
    this.listeners = (this.listeners || []).filter(function (x) { return x !== f; });
    // nobody left to show what comes: a pump still due starts nothing (the next screen plans again)
    if (!this.listeners.length && this.queue) { clearTimeout(this.queue.soon); this.queue.soon = 0; }
  };
  // ---------- one name, several recordings? (server service alcmedia compares the sound) ----------
  // Results: per voice key + season, also kept on this device (Storage alc_auto_vsplit3) so a title
  // is compared once. Servers without the service: the module answers 404 / 'unavailable', off.
  var vsplitOff = false;
  function vsplitStore() { return storeObj('alc_auto_vsplit3'); }
  Session.prototype.splitOf = function (key, season) {
    var k = this.movie.id + ':' + (season || 0) + ':' + key, own = this.splits && this.splits[k];
    if (own) return own;
    var st = vsplitStore()[k];
    return st && st.g;
  };
  Session.prototype.verifyVoices = function (season, voices, dur) {
    var self = this;
    if (vsplitOff) return;
    this.splits = this.splits || {};
    this.vasked = this.vasked || {};
    voices.forEach(function (v) {
      var k = self.movie.id + ':' + (season || 0) + ':' + v.key;
      if (self.vasked[k] || vsplitStore()[k] || v.variant) return;
      // the candidates that can be compared: an item of the same episode, not a costly source
      var cands = v.cands.filter(function (c) { return c.items && c.items.length && !costly(c.items[0]); });
      if (cands.length < 2) return;
      var ep = 0;
      if (self.serial) {
        var count = {};
        cands.forEach(function (c) { c.items.forEach(function (it, i) { var e = episodeNum(it, i); if (e) count[e] = (count[e] || 0) + 1; }); });
        numKeys(count).some(function (e) { if (count[e] >= 2) { ep = e; return true; } return false; });
        if (!ep) return;
      }
      var items = [];
      cands.forEach(function (c) {
        var it = !self.serial ? c.items[0] : c.items.filter(function (x, i) { return episodeNum(x, i) === ep; })[0];
        if (!it) return;
        var tk = trackOf(c, it, self.movie);
        if (tk && tk.idx < 0) return;   // this episode lacks the track
        var url = String(it.method === 'call' ? it.url : (it.url || it.stream) || '').split(' or ')[0];
        if (!url) return;
        // the quality map too: the service takes the lowest quality that is not a paid-quality stub
        var qm = it.quality || it.qualitys;
        items.push({ id: c.src, url: url, call: it.method === 'call', track: tk ? tk.idx : -1, tlang: tk && tk.lang || undefined, tnth: tk ? tk.nth : undefined, headers: it.headers || undefined,
          q: qm && typeof qm === 'object' ? qm : undefined });
      });
      if (items.length < 2) return;
      self.vasked[k] = true;
      var job = JSON.stringify({ key: k + ':' + ep + ':' + items.map(function (x) { return x.id; }).sort().join(','), dur: Math.round(dur || 0), items: items,
        uid: deviceId() });
      var b64 = btoa(unescape(encodeURIComponent(job))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      var t0 = Date.now();
      (function poll() {
        getJSON(BASE + '/lite/alcmedia?op=voices&job=' + b64, function (j) {
          if (j.status === 'running' && Date.now() - t0 < 180000) { setTimeout(poll, 4000); return; }
          if (j.status !== 'done' || !j.groups) return;
          var store = vsplitStore();
          trimByT(store, 300);
          store[k] = { g: j.groups, t: Date.now() };
          try { Lampa.Storage.set('alc_auto_vsplit3', store); } catch (e) {}
          if (j.groups.length > 1) { self.splits[k] = j.groups; self.voicesMemo = {}; self.changed(); }
        }, function (st, j) { if (absent(st, j)) vsplitOff = true; });
      })();
    });
  };

  // the data changed: cached voice lists are rebuilt (bump), open screens are told a moment later (changed)
  Session.prototype.bump = function () { this.ver = (this.ver || 0) + 1; };
  // (at most every 400 ms, and never later than that after a change: a stream of answers must not keep
  // postponing the news)
  Session.prototype.changed = function () {
    var self = this;
    this.bump();
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(function () { self.changeTimer = 0; (self.listeners || []).forEach(function (f) { try { f(); } catch (e) {} }); }, 180);
  };

  // a request for this card: tagged with the session (a busy server's line puts the screen in front's
  // first, drops background pages nobody looks at any more); a request a queued job makes is a background
  // one. how: true = the viewer waits for it (pri), 'low' = a source's search (after the pages of the
  // sources found: they give voices)
  Session.prototype.get = function (url, ok, fail, how) { getJSON(url, ok, fail, { tag: this, bg: !!this.inJob, pri: how === true, low: how === 'low' }); };

  // An answer to the search that says its entry is no source (notSourceAnswer) -> remembered for the
  // server whose list named it (evBase). One that only looks wrong counts when some other entry of
  // that list gave a balancer's answer in this search: a proxy or portal page in front of the server
  // answers every request alike, and must not make every source «no source» for a day.
  Session.prototype.noteAnswer = function (src, st, j, text) {
    var base = this.evBase;
    if (!base || base !== BASE) return;
    var kind = notSourceAnswer(st, j, text);
    if (kind === 2) { rememberNotSource(base, src); return; }
    if (kind === 1) (this.nonSrc = this.nonSrc || []).push(src);
    else if (st >= 200 && st < 300 && j && typeof j === 'object' && (j.type !== undefined || j.data !== undefined)) this.realSrc = true;
    if (this.realSrc && this.nonSrc && this.nonSrc.length) { this.nonSrc.forEach(function (s) { rememberNotSource(base, s); }); this.nonSrc = []; }
  };

  // Ask all sources; cb() once everything answered or soft timeout passed with results.
  Session.prototype.fanout = function (urls, onEach, cb, onAnswer) {
    var self = this;
    var keys = Object.keys(urls), pending = keys.length, found = 0, finished = false, started = Date.now();
    if (!pending) { cb(); return; }
    function finish() { if (!finished) { finished = true; clearInterval(timer); cb(); } }
    var timer = setInterval(function () {
      if (found && Date.now() - started > ROOT_WAIT) finish();
    }, 300);
    keys.forEach(function (src) {
      var t0 = Date.now();
      self.get(urls[src], function (j) {
        record(src, { rt: Date.now() - t0 });
        self.noteAnswer(src, 200, j);
        if (onAnswer) onAnswer(src);
        var added = false;
        try { added = onEach(src, j); } catch (e) {}   // a malformed answer must not stall the search
        if (added) { found++; self.changed(); }   // open screens update as sources answer
        if (--pending === 0) finish();
      }, function (st, j, to, text, thr) {
        self.noteAnswer(src, st, j, text);
        // search failed / timed out: a light penalty (a busy server's 429s say nothing about the source)
        if (!thr) record(src, { fail: 0.3, rt: Date.now() - t0 });
        // why nothing came: the server does not know this viewer / the source needs rch
        if (j && j.accsdb && self.authMsg === undefined) self.authMsg = String(j.msg || j.denymsg || '');
        if (j && j.rch) self.rchN = (self.rchN || 0) + 1;
        if (onAnswer) onAnswer(src);
        if (--pending === 0) finish();
      }, 'low');
    });
  };

  // Same as the built-in online plugin: TMDB cards lack kinopoisk_id (some balancers need it).
  // The server maps imdb -> kinopoisk (its data/externalids.json), so a card without imdb_id (TMDB
  // series cards usually) first gets it from TMDB.
  Session.prototype.externalIds = function (cb) {
    var self = this, m = this.movie;
    if (m.imdb_id && m.kinopoisk_id) { cb(); return; }
    if (!m.imdb_id && m.external_ids && m.external_ids.imdb_id) m.imdb_id = m.external_ids.imdb_id;
    var id = tmdbId(m);
    if (!m.imdb_id && !m.kinopoisk_id && typeof id === 'number' && !this.imdbAsked) {
      this.imdbAsked = true;
      var url;
      try { url = Lampa.TMDB.api((this.serial ? 'tv/' : 'movie/') + id + '/external_ids?api_key=' + Lampa.TMDB.key()); } catch (e) {}
      if (url) {
        $.ajax({ url: url, dataType: 'json', timeout: 4000,
          success: function (d) { if (d && d.imdb_id) m.imdb_id = d.imdb_id; self.externalIds(cb); },
          error: function () { self.externalIds(cb); } });
        return;
      }
    }
    var q = ['id=' + encodeURIComponent(m.id), 'serial=' + (this.serial ? 1 : 0)];
    if (m.imdb_id) q.push('imdb_id=' + encodeURIComponent(m.imdb_id));
    if (m.kinopoisk_id) q.push('kinopoisk_id=' + encodeURIComponent(m.kinopoisk_id));
    getJSON(BASE + '/externalids?' + q.join('&'), function (j) {
      for (var k in j) if (j[k] && !m[k]) m[k] = j[k];
      if (m.kinopoisk_id) cb(); else kpLookup(m, self.serial, id, cb);
    }, function () { kpLookup(m, self.serial, id, cb); });
  };

  // Not in the server's file (new titles): the optional server module `kpid` (part of the pack) asks online services.
  // Answers (also "unknown") are kept on this device; servers without the module answer 404 once.
  var kpNone = false;
  function kpLookup(m, serial, tmdb, cb) {
    var key = m.imdb_id || (typeof tmdb === 'number' ? (serial ? 'tv' : 'm') + tmdb : '');
    if (kpNone || !key) { cb(); return; }
    var store = storeObj('alc_auto_kp');
    var c = store[key], now = Date.now();
    if (c && (c.kp || now - c.t < 864e5)) { if (c.kp) m.kinopoisk_id = c.kp; if (c.imdb && !m.imdb_id) m.imdb_id = c.imdb; cb(); return; }
    var q = ['serial=' + (serial ? 1 : 0)];
    if (m.imdb_id) q.push('imdb_id=' + encodeURIComponent(m.imdb_id));
    if (typeof tmdb === 'number') q.push('tmdb_id=' + tmdb);
    getJSON(BASE + '/lite/kpid?' + q.join('&'), function (j) {
      if (j && typeof j.kinopoisk_id === 'string') {
        if (j.kinopoisk_id) m.kinopoisk_id = j.kinopoisk_id;
        if (j.imdb_id && !m.imdb_id) m.imdb_id = j.imdb_id;
        trimByT(store, 500);
        store[key] = { kp: j.kinopoisk_id || '', imdb: j.imdb_id || '', t: now };
        try { Lampa.Storage.set('alc_auto_kp', store); } catch (e) {}
      }
      cb();
    }, function (st, j) { if (absent(st, j)) kpNone = true; cb(); });
  }

  // Sources: the server's own list of enabled balancers (/lite/events, same as the built-in online
  // plugin), so new or disabled sources are picked up automatically. Anime-only sources are asked
  // only for anime (loadRoots). The built-in list is the fallback when the server does not answer.
  // Lampac NextGen answers the same list ({name, url, balanser}; with its search check also index, show
  // and rch). The list's `rch` is NOT a mode flag: Al(co)pac's search check sets rch: true on the
  // sources that FOUND the title, so it never filters sources here; a source that really needs rch says
  // so in its own answer ({rch: true}, counted in rchN). A server that asks to sign in answers
  // {accsdb: true, msg} (kept for the message on the screen). A connection that fails at once
  // (status 0: refused, CORS, mixed content, a local-network block), or a sign-in the plugin cannot
  // give (401 / 403 that is not JSON): the server cannot be used now, the sources behind it neither -
  // the screen says so (self.down) instead of asking the built-in list only to report «not found».
  // Other errors (404: a server without the list) and a timeout (a busy server may still answer the
  // sources) take the built-in list.
  Session.prototype.sourceUrls = function (cb) {
    var m = this.movie, self = this, base = BASE;
    this.get(base + '/lite/events?' + rootQuery(m), function (list) {
      var urls = {}, n = 0;
      eventSources(base, list).forEach(function (e) { urls[e.name] = rootUrl(e.name, m, ownBase(e.url)); n++; });
      if (n) { self.evBase = base; cb(urls); return; }
      fallback();
    }, function (st, j, to, text, thr) {
      if (j && j.accsdb) { self.authMsg = String(j.msg || j.denymsg || ''); cb({}); return; }
      if (j && j.rch) { self.rchOnly = true; cb({}); return; }
      if (thr) { fallback(); return; }   // busy (429), not lost: the server is kept
      serverLost(base);
      if ((!st && !to) || ((st === 401 || st === 403) && !j)) {
        self.down = downWhy(base, st, 0);
        // the address set in the settings: the next search does not wait for it again (probed anew a minute later)
        if (base === BASE && packSrv().setting() === base) { srv.down = self.down; srv.at = Date.now(); }
        cb({}); return;
      }
      fallback();
    });
    function fallback() {
      var urls = {};
      sourceList().forEach(function (s) { urls[s] = rootUrl(s, m); });
      cb(urls);
    }
  };

  // Anime: the optional server module `animeid` (part of the pack) looks the TMDB id up in a TMDB -> MyAnimeList
  // map: anime the heuristic misses still gets the anime sources, and they get the MyAnimeList ids and the
  // Ukrainian title (Hikka) to search by. Asked only for Animation cards (or cards without genres), so other
  // searches never wait for it; the search waits at most ANIME_WAIT (the request itself goes on: its answer is
  // kept on this device for the next time). Servers without the module answer 404 once.
  var animeNone = false, ANIME_WAIT = 3000;
  Session.prototype.animeInfo = function (cb) {
    var m = this.movie, serial = this.serial, done = false, timer = 0;
    var id = tmdbId(m);
    var g = m.genres, anim = !g || !g.length;
    for (var i = 0; g && i < g.length; i++) if (g[i] && g[i].id == 16) anim = true;
    if (animeNone || !anim || typeof id !== 'number') { cb(); return; }
    var key = (serial ? 'tv' : 'm') + id, store = storeObj('alc_auto_anime');
    var c = store[key];
    if (c && Date.now() - c.t < (c.a ? 30 : 1) * 864e5) { use(c); cb(); return; }
    timer = setTimeout(finish, ANIME_WAIT);
    getJSON(BASE + '/lite/animeid?op=get&tmdb_id=' + id + '&serial=' + (serial ? 1 : 0), function (j) {
      if (j.anime === true || j.anime === false) {   // null: the server is still loading its map
        var e = { a: j.anime ? 1 : 0, mal: (j.mal || []).slice(0, 20).join(','), ua: String(j.title_ua || '').slice(0, 200), t: Date.now() };
        trimByT(store, 500);
        store[key] = e;
        try { Lampa.Storage.set('alc_auto_anime', store); } catch (x) {}
        if (!done) use(e);   // too late for this search: the sources were asked already
      }
      finish();
    }, function (st, j) { if (absent(st, j)) animeNone = true; finish(); });
    function finish() { if (done) return; done = true; clearTimeout(timer); cb(); }
    function use(c) { if (c.a) { m.alc_anime = true; if (c.mal) m.alc_mal = c.mal; if (c.ua) m.alc_title_ua = c.ua; } }
  };

  Session.prototype.loadRoots = function (cb) {
    var self = this, names = null, ids = false, anime = false;
    withServer(function (base) {
      // no server answered: nothing to ask (the screen says so)
      if (!base) { self.noServer = true; self.rootsDone = true; self.rootsLeft = 0; cb(); return; }
      // the address set in the settings gave no answer a moment ago: nothing to ask either (every
      // request would wait for nothing, then end as «not found»)
      if (srv.down) { self.down = srv.down; self.rootsDone = true; self.rootsLeft = 0; cb(); return; }
      loadServerStats();
      // the three requests run in parallel; source URLs get the query only after the ids are known
      self.sourceUrls(function (urls) { names = urls; go(); });
      self.externalIds(function () { ids = true; go(); });
      self.animeInfo(function () { anime = true; go(); });
    });
    function go() {
      if (!names || !ids || !anime) return;
      var urls = {}, isA = isAnime(self.movie), off = 0;
      // anime-only sources only for anime; sources the viewer switched off are not asked
      for (var k in names) {
        if (!isA && ANIME[srcBase(k)]) continue;
        if (srcOff(k) || (srcInfo(k).lang && !languageEnabled(lang2(srcInfo(k).lang)))) { off++; continue; }
        urls[k] = rootUrl(k, self.movie, names[k].split('?')[0]);
      }
      if (off && !Object.keys(urls).length) self.allOff = true;
      self.rootsLeft = Object.keys(urls).length;
      self.fanout(urls, function (src, j) { return self.addRoot(src, j); }, function () { self.rootsDone = true; cb(); },
        function (src) { self.rootsLeft--; self.answered[src] = 1; if (!self.rootsLeft) self.changed(); });
    }
  };

  Session.prototype.addRoot = function (src, j) {
    var data = j.data || [];
    if (!data.length || j.type === 'similar' || j.service === true || srcOff(src)) return false;
    this.roots[src] = j;
    if (!this.serial) return true;
    var self = this;
    if (j.type === 'season') {
      data.forEach(function (it, i) {
        if (!it.url) return;
        var s = seasonNum(it, i), c = { src: src, url: it.url };
        (self.seasons[s] = self.seasons[s] || []).push(c);
        // a slow source answered after the seasons were already loaded: load its episodes too
        // (also the season on screen while the search is still running)
        if ((self.rootsDone && self.seasonData[s]) || s === self.focus) self.fetchSeasonSrc(s, c, function (ok) { if (ok) self.changed(); });
      });
      if (this.rootsDone) this.changed();
      return true;
    }
    if (j.type === 'episode') {
      var s = parseInt(data[0].s, 10) || 1;
      (this.seasons[s] = this.seasons[s] || []).push({ src: src, url: null });
      (this.seasonData[s] = this.seasonData[s] || {})[src] = j;
      return true;
    }
    return false;
  };

  // when a page failed (seasonFail / candFail: not asked again by the screens for FAIL_TTL / 3); one
  // that failed only because the server kept answering 429 (thr 1) may be asked again in a minute, one
  // cancelled (thr 2: no screen wanted it any more) whenever it is wanted again
  function thrMark(thr) { return thr === 2 ? 0 : thr ? Date.now() - FAIL_TTL / 3 + 60000 : Date.now(); }
  // the page of season s from source c is to be asked: not here, not on the way, not failed / empty lately
  Session.prototype.needPage = function (s, c) {
    var key = s + ':' + c.src;
    return !!c.url && !(this.seasonData[s] || {})[c.src] && !this.inflight[key] && Date.now() - (this.seasonFail[key] || 0) >= FAIL_TTL / 3;
  };
  // One season page of one source; parallel callers share one request.
  Session.prototype.fetchSeasonSrc = function (s, c, cb) {
    var have = this.seasonData[s] = this.seasonData[s] || {}, key = s + ':' + c.src, waiting = this.inflight[key];
    if (srcOff(c.src)) { cb(false); return; }   // switched off meanwhile
    if (waiting) { waiting.push(cb); return; }
    if (!this.needPage(s, c)) { cb(!!have[c.src]); return; }
    waiting = this.inflight[key] = [cb];
    var self = this;
    function done(ok, thr) {
      delete self.inflight[key];
      if (!ok) { self.seasonFail[key] = thrMark(thr); self.changed(); }   // (nothing new, but one less to wait for)
      waiting.forEach(function (f) { f(ok); });
    }
    this.get(c.url, function (j) {
      if (j.type === 'episode' && (j.data || []).length) { have[c.src] = j; done(true); self.changed(); } else done(false);
    }, function (st, j, to, text, thr) { done(false, thr); });
  };

  // All sources of a season; cb() when all answered, or SOFT_WAIT after the first answer.
  Session.prototype.loadSeason = function (s, cb) {
    var self = this, list = this.seasons[s] || [], pending = list.length, found = 0, finished = false, started = Date.now();
    if (!pending) { cb(); return; }
    function finish() { if (!finished) { finished = true; clearInterval(timer); cb(); } }
    var timer = setInterval(function () { if (found && Date.now() - started > SOFT_WAIT) finish(); }, 300);
    list.forEach(function (c) {
      self.fetchSeasonSrc(s, c, function (ok) {
        if (ok) found++;
        if (--pending === 0) finish();
      });
    });
  };

  // the pages of season s near the screen through the queue, a job each (the screens plan again after
  // every change: a source that lists the season later gets its job then)
  Session.prototype.wantSeason = function (s) {
    var self = this;
    (this.seasons[s] || []).forEach(function (c) {
      if (self.needPage(s, c)) self.want('S' + s + ':' + c.src, s, 1, function (done) { self.fetchSeasonSrc(s, c, function () { done(); }); });
    });
  };
  // a season TMDB does not know (a source's own numbering: specials, films, another show): asked
  // wherever the screen is, so it is shown only when it has episodes - one source after another up to
  // the first with episodes the screen can show (enough(): the title's voice has episodes there; the
  // rest come with loadSeason when it is on screen). A source listing it later makes a new job
  Session.prototype.probe = function (s, enough) {
    var self = this, list = (this.seasons[s] || []).filter(function (c) { return c.url; });
    if (list.length) this.want('P' + s + ':' + list.length, s, 1, function (done) {
      (function next(i) {
        if (i >= list.length) { done(); return; }
        self.fetchSeasonSrc(s, list[i], function (ok) {
          var full = ok;
          if (ok && enough) { try { full = enough(); } catch (e) {} }
          if (full) done(); else next(i + 1);
        });
      })(0);
    }, true);
  };

  // ---------- one queue for a card's background requests ----------
  // Pages nobody is waiting for this very moment (the neighbours of the season on screen, the voice
  // pages a screen asks to know which episodes each voice has) go through one queue per card: at most
  // PAR_BG at a time, the season on screen (focus) first, then its neighbours; a job of a season that
  // is no longer near is dropped (asked again when it comes near). run(done); every job that ends
  // tells the listeners (changed). Keep-jobs (probes nobody looks at) take one slot at most, so the
  // pages of the season on screen never wait minutes behind them.
  var PAR_BG = 3;
  // keep: asked wherever the screen is (last, after all the others)
  Session.prototype.want = function (k, s, pri, run, keep) {
    var q = this.queue = this.queue || { jobs: [], running: [], asked: {} };
    if (q.asked[k]) return;
    q.asked[k] = 1;
    q.jobs.push({ k: k, s: s || 0, pri: pri || 0, run: run, keep: !!keep });
    this.pumpSoon();
  };
  // one pump per tick for the many jobs and claims of one change (each pump sorts the whole queue)
  Session.prototype.pumpSoon = function () {
    var self = this, q = this.queue;
    if (q && !q.soon && !this.gone) q.soon = setTimeout(function () { q.soon = 0; self.pumpQueue(); }, 0);
  };
  // something for season s is still queued or on the way
  Session.prototype.queued = function (s) {
    var q = this.queue, on = function (j) { return j.s === s; };
    return !!q && (q.jobs.some(on) || q.running.some(on));
  };
  Session.prototype.queueSize = function () { var q = this.queue; return q ? q.jobs.length + q.running.length : 0; };
  // the season on screen and the other seasons whose rows are on screen (a touch screen shows three at
  // once): one owner at a time - the screen in front (a title may be open twice), or the quick start (null)
  Session.prototype.claim = function (owner, focus, near, gone) {
    this.view = { owner: owner, focus: focus || 0, near: near || [] };
    if (!gone) actSess = this;   // (its requests first in a busy server's line)
    this.pumpSoon();
  };
  // the owner went behind another screen or closed: its rows no longer count (its season on screen
  // stays until another owner claims)
  Session.prototype.release = function (owner) {
    var v = this.view;
    if (v && v.owner === owner) this.claim(null, v.focus, [], true);
  };
  Session.prototype.pumpQueue = function () {
    var self = this, q = this.queue;
    if (!q || this.gone) return;   // (dropped from the kept sessions: nothing more starts)
    var v = this.view || {}, f = v.focus || 0, near = v.near || [], dist = function (j) { return Math.abs(j.s - f); };
    // a job of a season no longer near is dropped (not a running one: the screens plan again when it is)
    q.jobs = q.jobs.filter(function (j) { if (j.keep || dist(j) <= 1 || near.indexOf(j.s) >= 0) return true; delete q.asked[j.k]; return false; });
    q.jobs.sort(function (a, b) { return (a.keep - b.keep) || (dist(a) - dist(b)) || (a.pri - b.pri); });
    var keepOn = q.running.filter(function (j) { return j.keep; }).length;
    // sorted keep-jobs last: one of them waiting while another runs means only keep-jobs are left
    while (q.running.length < PAR_BG && q.jobs.length && !(q.jobs[0].keep && keepOn)) (function (j) {
      if (j.keep) keepOn++;
      q.running.push(j);
      var was = self.inJob;
      self.inJob = true;   // (its requests: background ones, see get)
      try {
        j.run(function () {
          q.running = q.running.filter(function (x) { return x !== j; });
          self.changed();
          self.pumpQueue();
        });
      } finally { self.inJob = was; }
    })(q.jobs.shift());
  };
  // a voice page that failed lately (not asked again by the screens for a while; playback still tries)
  Session.prototype.candFailed = function (c) {
    var t = this.candFail && this.candFail[cacheKey(c)];
    return !!t && Date.now() - t < FAIL_TTL / 3;
  };

  // preferences that change the order of voices (bumped when they are changed)
  var prefVer = 0;
  // the screens showing «nothing found»: told when the sources / the server change (see AutoView's search)
  var deadScreens = [];
  // what a search depends on that the viewer can change: the sources off, the server
  function srcSig() { return srcOffList().join(',') + '|' + Lampa.Storage.get('alc_auto_server', '') + '|' + storeArr('alc_auto_lang_off').join(','); }

  try {
    Lampa.Storage.listener.follow('change', function (e) {
      if (/^(alc_auto_fav|alc_auto_fav_keys|alc_auto_ua_first|alc_auto_langs|alc_auto_lang_off|alc_auto_recent|language)$/.test(e && e.name)) prefVer++;
      // the language name tables depend on the languages only (not on favourites / recent picks)
      if (/^(alc_auto_ua_first|alc_auto_langs|language)$/.test(e && e.name)) { LANG_STEMS = null; LANG_CODES = null; langsMemo = {}; langsMemoN = 0; }
      var name = e && e.name;
      // sources switched on / off, another server: titles are searched afresh (the open screen drops
      // the voices of a source switched off at once; a screen that found nothing searches again)
      if (name === 'alc_auto_src_off' || name === 'alc_auto_server' || name === 'alc_auto_lang_off') {
        offList = null; prefVer++;
        if (name === 'alc_auto_server') { srv.state = ''; srv.gen++; selfHosts = null; srvNone = false; vsplitOff = false; kpNone = false; animeNone = false; }
        for (var k in sessions) { var s = sessions[k]; if (!s.loading) { s.created = 0; try { s.changed(); } catch (x) {} } }
        deadScreens.slice().forEach(function (f) { try { f(); } catch (x) {} });
      }
    });
  } catch (e) {}

  // Merged voice list, cached per data version. Each voice: {key,label,lang,pref,fav,rank,cands:[{src, name, url|null, items|null}]}
  Session.prototype.voices = function (season) {
    var memoKey = (season || 0) + '|' + (this.ver || 0) + '|' + prefVer;
    this.voicesMemo = this.voicesMemo || {};
    if (this.voicesMemo[season || 0] && this.voicesMemo[season || 0].k === memoKey) return this.voicesMemo[season || 0].list;
    var list = this.buildVoices(season);
    this.voicesMemo[season || 0] = { k: memoKey, list: list };
    return list;
  };
  // what a source says about a voice: its language (item, else the whole answer = the site's
  // language) and whether it has a name at all (our modules: voice_lang / voice_unnamed)
  function metaOf(j, it) {
    it = it || {};
    return { itemLang: it.voice_lang && it.voice_lang !== (j && j.voice_lang) ? String(it.voice_lang) : '',
      lang: String(it.voice_lang || (j && j.voice_lang) || ''), unnamed: !!it.voice_unnamed };
  }
  function movieVoiceName(it, movie) {
    var raw = String(it.voice_name || it.translate || it.translation || it.name || '').trim();
    // A film/release title is not a voice. Keep a recognised studio if the source put it in that title.
    for (var i=0;i<STUDIOS.length;i++) if (STUDIOS[i][0].test(raw)) return STUDIOS[i][1];
    var compact=norm(raw), names=[movie.title,movie.name,movie.original_title,movie.original_name].map(norm).filter(function (n) { return n.length>=6; });
    var genres=(movie.genres || []).map(function (g) { return norm(g.name); });
    if (names.some(function (n) { return compact.indexOf(n)>=0; }) || genres.indexOf(compact.replace(/^[248][кk]/i,''))>=0 || /^(?:сша|япония|канада|великобритания)$/.test(compact) || /^(?:19|20)\d{2}[. ]/.test(raw) || /полная версия фильма/i.test(raw)) return '';
    return raw;
  }
  function languageEnabled(lang) { return storeArr('alc_auto_lang_off').indexOf(lang || 'und') < 0; }
  function sourceCount(v) { var seen={};(v.cands || []).forEach(function (c) { seen[c.src]=true; });return Object.keys(seen).length; }
  Session.prototype.buildVoices = function (season) {
    var self = this, map = {};
    function add(src, raw, url, items, meta) {
      var tracks = items ? trackNames(raw) : null;
      if (!tracks) { addOne(src, raw, url, items, meta, -1); return; }
      // one voice per named track; the player is told which track to turn on. Tracks without a
      // name of their own ("Eng.Original") are left out rather than given an invented one.
      tracks.forEach(function (name, i) {
        var c = classify(src, name, self.movie, { lang: meta && meta.lang });
        if (c && !c.unnamed && !/^(sub|multi):/.test(c.key)) addOne(src, name, url, items, { lang: meta && meta.lang }, i);
      });
    }
    function addOne(src, raw, url, items, meta, track) {
      // a voice without episodes in this season is not offered; nor a source switched off meanwhile
      if ((items && !items.length) || srcOff(src)) return;
      if (!items && url && self.emptyVoice[cacheKey({ url: url, season: season || 0 })]) return;
      if (self.badVoice[cacheKey({ url: url, src: src, name: raw, season: season || 0 })]) return;
      var c = classify(src, raw, self.movie, meta);
      if (!c) return;
      // a second unnamed voice of the same language from the same source is another voice
      if (c.unnamed && self.serial) {
        var base = c.key, lab = c.label, n = 1;
        while (map[c.key] && map[c.key].cands.some(function (x) { return x.src === src; })) { n++; c.key = base + '#' + n; c.label = lab + ' (' + n + ')'; }
      }
      var sv = self.srcVoices[src + '#' + (season || 0)] = self.srcVoices[src + '#' + (season || 0)] || {};
      sv[c.key] = true;
      var v = map[c.key];
      if (!v) { v = map[c.key] = c; c.cands = []; }
      for (var i = 0; i < v.cands.length; i++) if (v.cands[i].src === src) {
        if (self.serial || (v.cands[i].items && items && v.cands[i].items[0] === items[0])) return;
      }
      v.cands.push({ src: src, name: meta && meta.candidateName || raw, url: url, items: items, season: season || 0, meta: meta, track: track });
    }
    if (!this.serial) {
      Object.keys(this.roots).forEach(function (src) {
        (self.roots[src].data || []).forEach(function (it) {
          if (!isPlayable(it)) return;
          var meta=metaOf(self.roots[src],it);meta.candidateName=it.name || it.voice_name || '';add(src, movieVoiceName(it,self.movie), null, [it], meta);
        });
      });
    } else {
      var sd = this.seasonData[season] || {};
      Object.keys(sd).forEach(function (src) {
        var j = sd[src], eps = playableItems(j, season);
        if (j.voice && j.voice.length) {
          j.voice.forEach(function (v) {
            if (v.active) add(src, v.name, v.url || null, eps, metaOf(j, v));
            else if (v.url) add(src, v.name, v.url, null, metaOf(j, v));
          });
        } else if (eps.length) add(src, eps[0].voice_name || '', null, eps, metaOf(j, eps[0]));
      });
    }
    // voices merged under one name that turned out to be different recordings (alcmedia compared
    // their sound): the biggest group keeps the voice, the others become "· variant 2/3"
    Object.keys(map).forEach(function (k) {
      var v = map[k], sp = self.splitOf(k, season);
      if (!sp || sp.length < 2) return;
      var groups = sp.map(function (g) { return v.cands.filter(function (c) { return g.indexOf(c.src) >= 0; }); }).filter(function (g) { return g.length; });
      if (groups.length < 2) return;
      var main = 0;
      groups.forEach(function (g, i) { if (g.length > groups[main].length) main = i; });
      var inGroups = {};
      sp.forEach(function (g) { g.forEach(function (x) { inGroups[x] = 1; }); });
      var keep = groups[main].concat(v.cands.filter(function (c) { return !inGroups[c.src]; }));
      var n = 1;
      groups.forEach(function (g, i) {
        if (i === main) return;
        n++;
        var nv = {}; for (var f in v) nv[f] = v[f];
        nv.key = v.key + '~' + n; nv.label = v.label + ' · ' + tr('variant_n', n); nv.cands = g; nv.variant = n;
        map[nv.key] = nv;
      });
      v.cands = keep;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    var favs = favLists();
    list.forEach(function (v) { v.cands = rankCands(v.cands); v.fav = isFav(v, favs); });
    rememberVoices(list);
    // alc_ua («Мітка UA»): the voices this search found (a Ukrainian one -> the poster badge)
    if (window.snack_ua && window.snack_ua.voices) { try { window.snack_ua.voices(self.movie, self.serial, list); } catch (e) {} }
    var recent = storeArr('alc_auto_recent').map(normKey);
    // preferred languages first (in their order), then favourites, then the rest; inside a group:
    // recently chosen, then how many sources carry the voice (more sources = more fallbacks)
    var nPref = prefLangs().length;
    function score(v) {
      var r = -1, rel = 0, pi = prefIndex(v.lang);
      for (var i = 0; i < recent.length && r < 0; i++) if (keyMatch(v, recent[i])) r = i;
      v.cands.forEach(function (c) { rel += Math.max(0, srcPriority(c.src)) / 10; });
      return (r >= 0 ? 100 - r * 5 : 0) + rel + (pi >= 0 ? (nPref - pi) * 20 : 0) + (/:dub$/.test(v.key) ? 5 : 0);
    }
    // favourite preferred, preferred, favourite other, other, subtitles / several tracks
    var uf = prefOn();
    function group(v) {
      if (v.rank >= 5 && !v.fav) return 4;
      if (!uf) return v.fav ? 0 : 1;
      return v.pref ? (v.fav ? 0 : 1) : v.fav ? 2 : 3;
    }
    // each voice's group and score computed once, not in every comparison
    var keyed = list.map(function (v, i) { return { v: v, g: group(v), s: score(v), i: i }; });
    keyed.sort(function (a, b) { return (a.g - b.g) || (b.s - a.s) || (a.i - b.i); });
    return keyed.map(function (x) { return x.v; }).filter(function (v) { return languageEnabled(v.lang); });
  };

  // The episodes of a candidate known so far (its own, or its voice page's from the cache), or null
  Session.prototype.itemsOf = function (c) { return c.items || (c.url && this.voiceCache[cacheKey(c)]) || null; };
  // Episodes of one candidate (fetching the voice page if needed); pri: the viewer waits (playback)
  Session.prototype.candItems = function (cand, cb, pri) {
    if (cand.items) { cb(cand.items); return; }
    var self = this;
    if (this.voiceCache[cacheKey(cand)]) { cand.items = this.voiceCache[cacheKey(cand)]; cb(cand.items); return; }
    this.get(cand.url, function (j) {
      // a module may answer with another season of this voice (e.g. its first one): drop it
      var eps = playableItems(j, cand.season);
      if (!eps.length && j.type === 'season' && j.data && j.data.length) {
        cb(null); return;
      }
      cand.items = eps.length ? eps : null;
      if (cand.items) self.voiceCache[cacheKey(cand)] = cand.items;
      else self.emptyVoice[cacheKey(cand)] = true;   // listed by the source, but nothing in this season
      self.bump();
      cb(cand.items);
    }, function (st, j, to, text, thr) {
      (self.candFail = self.candFail || {})[cacheKey(cand)] = thrMark(thr);
      cb(null);
    }, pri);
  };

  // Some sources quietly play another voice when the asked one is unavailable (and say so in the
  // stream answer). Resolve the first episode once and compare: cb(true) = the voice is real.
  Session.prototype.substituted = function (cand, voiceKey, actual) {
    if (!actual) return false;
    var c = classify(cand.src, actual, this.movie, cand.meta);
    if (!c || c.key === voiceKey) return false;
    var other = (this.srcVoices[cand.src + '#' + (cand.season || 0)] || {})[c.key];
    if (!other) return false;   // e.g. "Дубляж" listed, "Дубляж (studio)" played: same voice, more detail
    this.badVoice[cacheKey(cand)] = true;
    this.bump();
    return true;
  };
  // A source may mark its items 'call_opens_session': asking for the link opens a viewing session on
  // its CDN (an unwatched one counts against the client there). Such links are asked only to play.
  function costly(it) { return !!(it && it.call_opens_session); }

  Session.prototype.verifyCand = function (cand, voiceKey, cb) {
    var self = this, k = cacheKey(cand), it = cand.items && cand.items[0];
    if (costly(it)) this.checked[k] = true;   // not checked in advance; the play answer is still compared
    if (this.checked[k] || !it || it.method !== 'call') { cb(!this.badVoice[k]); return; }
    this.get(it.url, function (j) {
      self.checked[k] = true;
      cb(!self.substituted(cand, voiceKey, j && (j.voice_name || j.translate)));
    }, function (st, j, to, text, thr) { if (!thr) self.checked[k] = true; cb(true); });   // (a busy server: checked another time)
  };

  // ---------- the sessions kept (a few recent cards; each holds every answer of its sources) ----------
  var SESSION_TTL = 20 * 60 * 1000;
  var sessions = {};
  // early(s): the session while its search is still running (screens show partial results)
  function obtainSession(movie, cb, early) {
    var key = movie.id + ':' + (movie.source || '');
    var s = sessions[key];
    if (s && s.ready && Date.now() - s.created < SESSION_TTL) { cb(s); return; }
    if (s && s.loading) { s.waiters.push(cb); if (early) early(s); return; }
    // keep few sessions: each holds every answer of every source for its card
    var keys = Object.keys(sessions).filter(function (k) { return !sessions[k].loading; });
    keys.sort(function (a, b) { return sessions[a].created - sessions[b].created; });
    keys.forEach(function (k, i) {
      if (Date.now() - sessions[k].created > SESSION_TTL || keys.length - i > 4) {
        var o = sessions[k];
        o.gone = true; o.listeners = []; clearTimeout(o.changeTimer); if (o.queue) clearTimeout(o.queue.soon);   // (gone: nothing more starts)
        delete sessions[k];
      }
    });
    s = sessions[key] = new Session(movie);
    actSess = s;
    s.created = Date.now();
    s.loading = true;
    s.waiters = [cb];
    if (early) early(s);
    s.loadRoots(function () {
      s.loading = false;
      var ok = Object.keys(s.roots).length > 0;
      if (ok) s.ready = true; else delete sessions[key];
      var w = s.waiters, why = ok ? null : failWhy(s); s.waiters = [];
      w.forEach(function (f) { f(ok ? s : null, why); });
    });
  }
  // why a search found nothing, in words: [title, text]
  function failWhy(s) {
    var uid = deviceId();
    if (s.noServer) return [tr('srv_none'), tr('srv_none_d')];
    if (s.down) return s.down;   // the server gave no answer (see downWhy): not «not found»
    if (s.authMsg !== undefined) return [tr('srv_auth'), (s.authMsg ? s.authMsg.replace(/\s+$/, '') + (/[.!?]$/.test(s.authMsg.trim()) ? ' ' : '. ') : '') + (srv.via ? tr('srv_auth_via', srv.via) : tr('srv_auth_d', uid || '-'))];
    if (s.rchOnly || (s.rchN && s.rchN >= Object.keys(s.answered).length)) return [tr('srv_rch'), tr('srv_rch_d')];   // every source wants rch
    if (s.allOff) return [tr('src_all_off'), tr('sources') + ': ' + tr('src_hidden_n', srcOffList().length)];
    return [tr('not_found'), tr('nf_title')];
  }

  // ======================= 9. PLAYBACK: FALLBACK, TRACKS, STUB GUARD, STALLS, SUBTITLES, EXTERNAL PLAYERS =======================
  // ---------- audio tracks: one voice = one track of a several-tracks stream ----------
  // "A, B, C" / "A / B / C": the names of the audio tracks of one stream, in the stream's order
  // (lift and alike: HLS with several EXT-X-MEDIA audio renditions). null when it is one voice.
  function trackNames(raw) {
    var parts = String(raw || '').replace(/\\u0026/g, '&').replace(/\[[^\]]*\]/g, '').split(/\s*[,\/]\s*/)
      .map(function (x) { return x.trim(); }).filter(Boolean);
    return parts.length >= 3 ? parts : null;
  }
  // The track of voice candidate c in item it: {idx, lang, nth}. idx: its place in that item's own
  // list of names (a source may order the tracks differently from episode to episode); lang + nth:
  // the language the name tells and the place among the names of that language - the names may
  // disagree with the stream itself, whose tracks carry their language (see streamTrack).
  // null = not a track voice; idx -1 = this episode lacks the track.
  function trackOf(c, it, movie) {
    if (!(c.track >= 0)) return null;
    var names = it && trackNames(it.voice_name || it.translate || it.name);
    if (!names) return { idx: c.track, lang: '', nth: 0, name: c.name };
    var idx = names.indexOf(c.name);
    if (idx < 0) return { idx: -1 };
    var langOf = function (n) { var k = classify('', n, movie, {}); return k && k.lang !== 'und' ? k.lang : ''; };
    var lang = langOf(c.name), nth = 0;
    if (lang) for (var i = 0; i < idx; i++) if (langOf(names[i]) === lang) nth++;
    return { idx: idx, lang: lang, nth: nth, name: c.name };
  }
  // the audio track to turn on in an HLS stream: the place in the names when the stream's track
  // there has the name's language; else the nth track of that language; else the place.
  // cb(idx, info): info = what the player's own track list is matched by later (see fixTrack):
  // {idx, lang, nth, name, langs: the stream's track languages, names: their NAMEs}
  // a small text GET: ok(text, xhr) on 2xx, else fail(why)
  function getText(url, ok, fail, timeout) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.timeout = timeout || 8000;
      x.onload = function () { if (x.status >= 200 && x.status < 300) ok(String(x.responseText || ''), x); else fail(x.status); };
      x.onerror = function () { fail('failed'); };
      x.ontimeout = function () { fail('timeout'); };
      x.send();
    } catch (e) { fail(String(e && e.message)); }
  }
  function streamTrack(url, t, cb) {
    var info = t && { idx: t.idx, lang: t.lang || '', nth: t.nth || 0, name: t.name || '', langs: null, names: null };
    if (!t || !t.lang || !/m3u8/.test(String(url))) { cb(t ? t.idx : -1, info); return; }
    var done = false, fin = function (v) { if (!done) { done = true; info.idx = v; cb(v, info); } };
    getText(url, function (text) {
      var langs = [], names = [], group = null;
      text.split('\n').forEach(function (l) {
        if (!/^#EXT-X-MEDIA:/.test(l) || !/TYPE=AUDIO/.test(l)) return;
        var g = (/GROUP-ID="([^"]*)"/.exec(l) || [])[1];
        if (group === null) group = g;
        if (g !== group) return;
        langs.push(lang2((/LANGUAGE="([^"]*)"/.exec(l) || [])[1]));
        names.push(String((/NAME="([^"]*)"/.exec(l) || [])[1] || ''));
      });
      if (langs.length) { info.langs = langs; info.names = names; }
      // the names agree with the stream at that place: the place (a same-language track whose
      // name tells no language would shift the count); else the nth track of the language
      if (langs[t.idx] === t.lang) { fin(t.idx); return; }
      var at = -1, n = 0;
      for (var i = 0; i < langs.length && at < 0; i++) if (langs[i] === t.lang && n++ === t.nth) at = i;
        fin(at >= 0 ? at : t.idx);
    }, function () { fin(t.idx); }, 8000);
  }
  // ---------- playback with fallback ----------
  function Playback(session, voice, season) {
    this.session = session;
    this.voice = voice;
    this.season = season;
    this.tried = {}; // episodeKey -> {src:true}
  }

  // exact: only a file of this very episode; otherwise a file that also covers it (range)
  Playback.prototype.findItem = function (items, episode, exact) {
    if (!this.session.serial) return items[0];
    for (var i = 0; i < items.length; i++) if (episodeNum(items[i], i) === episode) return items[i];
    if (exact) return null;
    for (var j = 0; j < items.length; j++) {
      var r = episodeRange(items[j], j);
      if (episode >= r[0] && episode <= r[1]) return items[j];
    }
    return null;
  };

  // Find the next working candidate for an episode: cb({url,quality,...,src}) or cb(null).
  // First pass: sources with a file of this very episode; second pass: sources that have it only
  // inside a multi-episode file.
  Playback.prototype.next = function (episode, cb) {
    var self = this, ek = String(episode || 0);
    var tried = this.tried[ek] = this.tried[ek] || {};
    var prefer = this.prefer;
    var queue = rankCands(this.voice.cands.filter(function (c) { return !srcOff(c.src); })).map(function (c) { return { c: c, exact: true }; });
    if (prefer) {   // the source used last time goes first, the rest keep their rank order
      var first = queue.filter(function (j) { return j.c.src === prefer; });
      queue = first.concat(queue.filter(function (j) { return j.c.src !== prefer; }));
    }
    (function step() {
      var job = null;
      while (queue.length && !job) {
        var j = queue.shift();
        if (!tried[j.c.src + (j.exact ? '' : '~')]) job = j;
      }
      if (!job) { cb(null); return; }
      var c = job.c;
      tried[c.src + (job.exact ? '' : '~')] = true;
      self.session.candItems(c, function (items) {
        var it = items && self.findItem(items, episode, job.exact);
        if (!it) {
          if (job.exact && items && self.findItem(items, episode, false)) queue.push({ c: c, exact: false });
          step(); return;
        }
        var tk = trackOf(c, it, self.session.movie);
        if (tk && tk.idx < 0) { step(); return; }   // this episode lacks the track
        it.alc_src = c.src;
        var from = job.exact ? 0 : episodeRange(it, items.indexOf(it))[0];
        resolveItem(it, function (r) {
          if (!r.url) { step(); return; }
          if (self.session.substituted(c, self.voice.key, r.voice_name)) { self.session.changed(); step(); return; }
          r.src = c.src;
          if (costly(it)) r.costly = true;
          if (from && from < episode) r.from = from;
          var q1 = qOf(r); if (q1) record(c.src, { q: q1 });
          if (!tk) { cb(r); return; }
          streamTrack(r.url, tk, function (idx, ti) { if (idx >= 0) { r.track = idx; r.tinfo = ti; } cb(r); });
        }, function (st, j, to, text, thr) { if (!thr) record(c.src, { fail: 0.5 }); step(); });
      }, true);
    })();
  };

  // seconds: the movie's runtime, the episode's TMDB runtime (else the show's usual one), 0 = unknown
  Playback.prototype.expectedSec = function (episode) {
    var m = this.session.movie, min = 0;
    if (!this.session.serial) min = parseInt(m.runtime, 10) || 0;
    else {
      (this.episodes || []).forEach(function (ep) { if (ep.e === episode && ep.runtime) min = ep.runtime; });
      if (!min && m.episode_run_time && m.episode_run_time.length) min = parseInt(m.episode_run_time[0], 10) || 0;
    }
    return min > 0 ? min * 60 : 0;
  };

  Playback.prototype.element = function (episode, epTitle, lazy) {
    var self = this, m = this.session.movie;
    var title = !this.session.serial ? (m.title || m.name || '')
      : epTitle ? 'S' + this.season + 'E' + episode + ' · ' + epTitle
      : (m.title || m.name || '') + ' - S' + this.season + 'E' + episode;
    var el = {
      title: title,
      url: '',
      timeline: timelineOf(m, this.session.serial ? this.season : 0, episode),
      season: this.session.serial ? this.season : undefined,
      episode: this.session.serial ? episode : undefined,
      voice_name: this.voice.label,
      isonline: true,
      alc_switching: false
    };
    el.alc_subs = subsIntent(this.voice);
    // the card this plays (Lampa's convention, data.card): the player's title and «about» panel, the
    // skip markers (skip_segments) and subtitle search (opensubs_menu) look for it here before the open
    // screen. Started from the home screen (the theme's hero, a row's episode) no screen holds the card,
    // and the intro / credits markers were never asked for. Hidden: the external-player path serialises
    // the play data, a whole TMDB card has no place there.
    hidden(el, 'card', this.session.card);
    // expected length (TMDB) for the stub guard; the progress before this stream, to restore if it is a stub
    el.alc_expect = this.expectedSec(episode);
    el.alc_tl0 = { percent: el.timeline.percent, time: el.timeline.time, duration: el.timeline.duration };
    if (!lazy) {   // playlist cells get theirs when the player reaches them (see buildPlaylist)
      var vo = this.voiceovers(episode);
      if (vo) el.voiceovers = vo;
    }
    el.error = function (work, reserve) {
      if (work.alc_switching) return;   // several fatal errors in a row = one switch
      work.alc_switching = true;
      var bad = work.alc_src, pos = 0, handler = work.error;
      try { pos = Lampa.PlayerVideo.video().currentTime || 0; } catch (x) {}
      if (bad) markFailed(bad);
      var done = function (r, again) {
        // the viewer picked another voice, closed the player or moved to another episode meanwhile:
        // the answer is for a stream that is gone (it must not start under the new one)
        if (work.error !== handler) return;   // (switchVoice gave the element a new handler, unlocked)
        work.alc_switching = false;
        if (!isCurrent(work)) return;
        if (!r) { self.deadMenu(episode, work, reserve, pos, done); return; }
        noty(again ? tr('src_again', r.src) : tr('switch_src', bad || '', r.src));
        cancelSeek();
        self.apply(work, r);
        subsAfterReload(work);   // the new stream comes without a subtitle list: the new source's own
        inPlace(work.url, function () { reserve(work.url); });   // (in the same <video>: no tap here)
        panelQuality(work);
        if (r.from) self.seekInto(r.from, episode);
        else if (pos > 5) seekOnce(Math.max(0, pos - 3));   // the new stream starts where this one died
      };
      self.next(episode, function (r) {
        if (r || !bad) { done(r); return; }
        // no other source: ask the same one again - a source whose CDN kills sessions after a
        // while (signed URLs expire) gives a fresh one. At most once per minute and 10 times per play.
        var now = Date.now(), rr = self.retries = self.retries || {}, rk = String(episode || 0), rt = rr[rk] = rr[rk] || { n: 0, t: 0 };
        if (rt.n >= 10 || now - rt.t < 60000) { done(null); return; }
        rt.n++; rt.t = now;
        var tried = self.tried[String(episode || 0)] || {};
        delete tried[bad]; delete tried[bad + '~'];
        self.next(episode, function (r2) { done(r2, true); });
      });
    };
    return el;
  };

  // a voice that is one audio track of a several-tracks stream: Lampa turns that track on when the
  // stream has loaded (PlayerVideo params, kept until the player closes)
  var trackSet = false, trackWas = false, playEl = null;   // playEl: the element Lampa started last
  var wantTrack = null;   // the track info of the stream that needs one (see streamTrack / fixTrack)
  // Our track is put on the player's list only for a stream this plugin itself started or switched to:
  // the first list of each kind after that load (trackNew). The viewer's own pick in the player's
  // track menu (handTrack: on the list seen last, trackSeen, another track is selected than the one
  // we left) stops that for this play and its playlist moves; a stream we load again (same point,
  // another source) and a list the player reloads get the viewer's track instead. A voice picked in
  // our menus (switchVoice) is ours again.
  var trackNew = null, trackSeen = null, handTrack = null, handWas = null;
  function selIdx(arr) { for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].selected === true) return i; return -1; }
  function handCheck() {
    var s = trackSeen, k = s ? selIdx(s.list) : -1;
    if (k < 0 || k === s.at) return;
    var l = s.list.map(trackLang), nth = 0;
    for (var i = 0; i < k; i++) if (l[i] && l[i] === l[k]) nth++;
    handTrack = { idx: k, lang: l[k] || '', nth: nth, name: '', hand: true };
    s.at = k;
  }
  function playTrack(idx, info) {
    handCheck();
    trackSeen = null;
    wantTrack = idx >= 0 ? info || { idx: idx } : null;
    trackNew = idx >= 0 ? { tracks: true, webos_tracks: true } : null;
    try {
      if (idx >= 0) { Lampa.PlayerVideo.setParams({ track: handTrack ? handTrack.idx : idx }); trackSet = true; }
      else if (trackSet) { Lampa.PlayerVideo.setParams({}); trackSet = false; }
    } catch (e) {}
  }
  // ---------- the audio track on the player's own list (LG webOS, Samsung Tizen, hls.js) ----------
  // The index above is the track's place in the stream's manifest. The player's own list may leave
  // out tracks the TV cannot decode (TrueHD, DTS: webOS and Tizen lists, webos_tracks; hls.js drops
  // codecs the browser lacks): then the same index is another track. Once the player has its list,
  // the track is found on it: by language (the nth of that language; a same-language track named as
  // TrueHD / DTS in the manifest counts only if the list is as long as the manifest), else the place
  // among the tracks the TV can play; a list that agrees with the manifest keeps the index.
  var HD_AUDIO = /truehd|dts|mlp|atmos/i;
  function trackLang(t) { return lang2(t && (t.language || t.lang || (t.extra && t.extra.language)) || ''); }
  function pickTrack(list, w) {
    var n = list.length, langs = list.map(trackLang), known = langs.some(Boolean);
    var ml = w.langs || null, mn = w.names || [], same = ml && ml.length === n;
    if (w.idx < n && (same || !ml) && (!known || !w.lang || !langs[w.idx] || langs[w.idx] === w.lang)) return w.idx;
    // the manifest's tracks the TV is likely to have: without TrueHD / DTS, when the list is shorter
    var keep = [];
    if (ml) for (var i = 0; i < ml.length; i++) if (same || !HD_AUDIO.test(mn[i] || '')) keep.push(i);
    if (known && w.lang) {
      var ofLang = [];
      langs.forEach(function (l, j) { if (l === w.lang) ofLang.push(j); });
      if (!ofLang.length) return -1;
      var nth = w.nth || 0;
      if (ml && keep.length) {   // its place among the kept tracks of its language
        var k = 0, at = -1;
        keep.forEach(function (x) { if (ml[x] === w.lang) { if (x === w.idx) at = k; k++; } });
        if (at >= 0) nth = at;
      }
      return ofLang[Math.min(nth, ofLang.length - 1)];
    }
    // no languages on the list: the place among the kept tracks, if the counts agree
    if (ml && keep.length === n) { var p = keep.indexOf(w.idx); if (p >= 0) return p; }
    return w.idx < n ? w.idx : -1;
  }
  function fixTrack(list, kind) {
    var data = null;
    try { data = Lampa.Player.playdata(); } catch (e) {}
    if (!data || !data.alc_src || !list || !list.length) return;
    var arr = [];
    for (var i = 0; i < list.length; i++) arr.push(list[i]);
    handCheck();
    kind = kind || 'tracks';
    var w = handTrack ? (wantTrack ? handTrack : null) : trackNew && trackNew[kind] ? wantTrack : null;
    if (trackNew) trackNew[kind] = false;
    var j = w ? pickTrack(arr, w) : -1;
    trackSeen = { list: arr, at: selIdx(arr) };
    if (j < 0 || (j === w.idx && arr[j] && arr[j].selected)) return;
    if (j === w.idx && !w.langs && !w.lang && !w.hand) return;   // nothing to compare: Lampa's own choice stands
    trackSeen.at = j;
    arr.forEach(function (t, k) { if (k !== j) { t.selected = false; try { if (t.enabled === true) t.enabled = false; } catch (x) {} } });
    try { arr[j].enabled = true; } catch (x) {}
    arr[j].selected = true;
    // the player saves / restores its index (a later webOS reload, a playlist move): the right one
    var p = null;
    try { p = Lampa.PlayerVideo.saveParams ? Lampa.PlayerVideo.saveParams() : null; } catch (x) {}
    try { if (p && typeof p === 'object') p.track = j; else Lampa.PlayerVideo.setParams({ track: j }); } catch (x) {}
  }
  try {
    Lampa.PlayerVideo.listener.follow('tracks', function (e) { try { fixTrack(e && e.tracks, 'tracks'); } catch (x) {} });
    Lampa.PlayerVideo.listener.follow('webos_tracks', function (e) { try { fixTrack(e && e.tracks, 'webos_tracks'); } catch (x) {} });
  } catch (e) {}
  try { Lampa.Player.listener.follow('start', function (data) { playEl = data; }); } catch (e) {}
  // Subtitles off unless asked for. Safari plays HLS itself and turns on a subtitle track the stream
  // marks DEFAULT/AUTOSELECT; Lampa never turns it off (its menu even says «off»). Lampa picks a track
  // only for «Использовать субтитры» or the track chosen in the previous episode (selected = true);
  // any other track showing in the first seconds is the browser's doing and is switched off
  function browserSubsOff() {
    try { if (Lampa.Storage.field('subtitles_start')) return; } catch (x) {}
    var v = null;
    try { v = Lampa.PlayerVideo.video && Lampa.PlayerVideo.video(); } catch (x) {}
    var list = v && !v.customSubs && v.textTracks;
    if (!list || !list.length) return;
    var off = function () {
      // a list of the pack's came in meanwhile (opensubs_menu): its items stand for the stream's
      // tracks and switch them on themselves; one chosen there (by the viewer or the automatic choice,
      // autoSubs) leaves the tracks alone
      var cs = v.customSubs;
      if (cs && cs.length && cs.some(function (s) { return s && s.selected; })) return;
      for (var i = 0; i < list.length; i++) if (list[i].mode === 'showing' && !list[i].selected) list[i].mode = 'disabled';
    };
    off();
    // Safari may switch it on a moment later: watch for a few seconds only (later it is the viewer)
    if (list.addEventListener) {
      list.addEventListener('change', off);
      setTimeout(function () { try { list.removeEventListener('change', off); } catch (x) {} }, 6000);
    }
  }
  try { Lampa.PlayerVideo.listener.follow('subs', function () { try { browserSubsOff(); } catch (x) {} }); } catch (e) {}
  // Lampa moved on in its playlist (next / previous episode): it closed the player first, which
  // dropped our per-play state, and handed the new episode the audio track index of the old
  // stream (PlayerVideo params, saved after our cell had set its own): put both right
  function playlistMoved(pb, episode, el) {
    trackSet = trackWas;
    handTrack = handWas; handWas = null;   // the viewer's track goes on with the playlist
    playTrack(el.alc_track, el.alc_tinfo);
    if (el.alc_src) { curSrc = el.alc_src; curOk = false; }
    setMulti(pb, episode);
    registerPlaying(pb, episode);
  }
  // the player's quality menu follows a stream replaced in place (Lampa fills it only when a play
  // starts): else it keeps the links of the previous source; an empty map when the new one has none
  function panelQuality(el) {
    try { Lampa.PlayerPanel.quality(el.quality || {}, el.url); } catch (x) {}
  }

  // ---------- a source switched inside the open player keeps its <video> ----------
  // Lampa swaps a stream with PlayerVideo.destroy(true) + url(), and url() makes a new <video>: Safari on
  // iPhone / iPad would not play our tap-less switch there. destroy(savemeta, keepPip) - Lampa's own
  // picture-in-picture path - keeps the element for url(); our switch's own destroy is asked that, and
  // the element then starts over as a new one (v.alc_gen +1: other plugins compare element + gen).
  var keepReq = null;   // {v, kept, move}: the switch running now, until its destroy takes it
  var keepOff = false;  // a keep was lost once (a destroy below ours drops the flag): Lampa's way
  function keepWrap() {
    var pv = Lampa.PlayerVideo, cur = pv && pv.destroy;
    if (!cur || cur.alc_keep) return;   // ours on top already: a bypass is below it, nothing to re-wrap
    pv.destroy = function (savemeta, keepPip) {
      var r = keepReq, args = arguments, v = null, mine = ownKeep;
      // a source switch: its own destroy(true); a playlist move (r.move): the player's close before
      // the next item, whatever savemeta it passes; the element still the player's, in the page
      if (r && (r.move || savemeta === true) && !keepPip) {
        keepReq = null;   // the switch's own destroy only, once
        try { if (pv.video() === r.v && inPage(r.v)) { args = [savemeta, true]; r.kept = true; } } catch (x) {}
      }
      // the element stays for the next url(): our keep, or Lampa's own (picture-in-picture) - one
      // signal per keep (a copy of ours below this one gets the flag from it)
      try { if ((r && r.kept) || (keepPip === true && !mine)) v = pv.video(); } catch (x) {}
      ownKeep = ownKeep || !!(r && r.kept);
      var out;
      try { out = cur.apply(this, args); } finally { ownKeep = mine; }
      if (v && v.tagName === 'VIDEO') streamSignal(v);
      return out;
    };
    pv.destroy.alc_keep = true;
  }
  var ownKeep = false;   // our keep's destroy is running (its flag passes through other wrappers)
  function inPage(v) { try { return !!v && document.documentElement.contains(v); } catch (x) { return false; } }
  try { keepWrap(); } catch (x) {}
  // the element is to carry another stream: what is kept per element starts over
  function streamSignal(v) {
    v.alc_gen = (v.alc_gen || 0) + 1;
    try { delete v.customSubs; } catch (x) {}   // Lampa keeps the subtitle list on the element
    v.alc_tried = null;   // autoplay retry: a same-URL restart is a new stream too
    v.alc_seen = 0;
    if (userPaused === v) userPaused = null;
    disarmTap();
    guard.ok = false;
    // Lampa sized the element (player_size) for the stream before and does not again for a new link
    unsize();
    var f = sizeAgain = function () {
      unsize();
      try { if (Lampa.PlayerVideo.video() === v) Lampa.PlayerVideo.size(Lampa.Storage.get('player_size', 'default')); } catch (x) {}
    };
    try { Lampa.PlayerVideo.listener.follow('loadeddata', f); } catch (x) {}
  }
  var sizeAgain = null;
  function unsize() {
    try { if (sizeAgain) Lampa.PlayerVideo.listener.remove('loadeddata', sizeAgain); } catch (x) {}
    sizeAgain = null;
  }
  // the element to keep for a switch to url, or null: TVs (AVPlay objects), a YouTube link (Lampa's frame,
  // raw or as Lampa plays it) and a lost keep get Lampa's new element
  function keepTarget(url) {
    try {
      var v = Lampa.PlayerVideo.video(), tube = Lampa.PlayerVideo.verifyTube;
      if (keepOff || (Lampa.Platform.tv && Lampa.Platform.tv()) || !v || v.tagName !== 'VIDEO') return null;
      var play = url;
      try { if (Lampa.Torserver && Lampa.Torserver.toPlayUrl) play = Lampa.Torserver.toPlayUrl(url); } catch (x) {}
      if (tube && (tube(String(url)) || tube(String(play)))) return null;
      return v;
    } catch (x) { return null; }
  }
  function inPlace(url, fn) {
    var v = keepTarget(url), r = keepReq = v ? { v: v, kept: false } : null, bypass = false;
    try { fn(); } finally {
      bypass = !!r && keepReq === r;   // still unclaimed: our destroy was not in the chain
      keepReq = null;
    }
    if (bypass) try { keepWrap(); } catch (x) {}   // ours on top again for the next switch
    if (!r || !r.kept) return;
    var now = null;
    try { now = Lampa.PlayerVideo.video(); } catch (x) {}
    if (now !== v) keepLost();
  }
  // asked to keep, yet a new element came (a destroy below ours drops the flag): the reset went to the
  // element left behind (nothing global to undo); Lampa's way from now on
  function keepLost() {
    keepOff = true;
    unsize();
    console.log('AlcAuto', 'player element not kept: new elements from now on');
  }
  // a stream replaced the way the player's quality menu does it (no panel: the video directly)
  function inPlaceQuality(name, url) {
    inPlace(url, function () {
      if (Lampa.PlayerPanel && Lampa.PlayerPanel.listener) Lampa.PlayerPanel.listener.send('quality', { name: name, url: url });
      else { Lampa.PlayerVideo.destroy(true); Lampa.PlayerVideo.url(url, true); }
    });
  }

  // ---------- the next episode in the same <video> ----------
  // Lampa moves its playlist by closing the player and playing the next item: a new <video>, which
  // Safari does not play at the end of an episode (no tap). A move to one of our episodes keeps the
  // element: its playlist 'select' (before any handler) marks it, and the move's own close - right
  // after Lampa's PlayerVideo.saveParams(), which only a move calls, however late the link comes and
  // whoever wraps our cell - is asked to keep it. Back, another item or a closed player drop the mark.
  // A lazy cell's select while Lampa still waits for an earlier one's link is ignored by Lampa (until
  // the player closes): the earlier mark stays.
  var moving = null;   // {item, v}: the move to one of our episodes waiting for its close
  var lazyOn = false;  // Lampa waits for a lazy cell's link (its wait_for_loading_url)
  function moveWrap() {
    var L = Lampa.PlayerPlaylist && Lampa.PlayerPlaylist.listener, send = L && L.send, pv = Lampa.PlayerVideo, sp = pv && pv.saveParams;
    if (send && !send.alc_keep) {
      L.send = function (type, e) {
        var item = e && e.item, lazy = !!item && typeof item.url === 'function';
        if (type === 'select' && !(lazy && lazyOn)) {
          moving = null;
          if (lazy) lazyOn = true;
          try {
            var v = keepTarget('');
            if (v && item && item.alc_tl0 && Lampa.Player.opened() && inPage(v)) moving = { item: item, v: v };
          } catch (x) {}
        }
        return send.apply(this, arguments);
      };
      L.send.alc_keep = true;
    }
    if (sp && !sp.alc_keep) {
      pv.saveParams = function () {
        var m = moving;
        moving = null;
        try {
          var url = m && m.item.url;
          if (m && typeof url === 'string' && url && Lampa.Player.opened() && inPage(m.v) && keepTarget(url) === m.v) {
            var r = keepReq = { v: m.v, kept: false, move: true };
            moveWatch(r, m.item);
            setTimeout(function () { if (keepReq === r) keepReq = null; }, 0);   // (the close comes at once)
          }
        } catch (x) {}
        return sp.apply(this, arguments);
      };
      pv.saveParams.alc_keep = true;
    }
  }
  try { moveWrap(); } catch (x) {}
  try { Lampa.Player.listener.follow('destroy', function () { moving = null; lazyOn = false; }); } catch (x) {}
  // after a kept close: the item's own 'start' loads its link into the element (checked); an external
  // player, or a second close (an external player's prompt cancelled) or nothing at all (a minute
  // with neither a player nor a dialog / a picker open), leaves it to be cleaned up as a close would
  function moveWatch(r, item) {
    var P = Lampa.Player.listener, closes = 0, timer = 0;
    var fin = function (clean) {
      clearTimeout(timer);
      try { P.remove('start', start); P.remove('external', ext); P.remove('destroy', gone); } catch (x) {}
      if (clean && r.kept) try { if (!Lampa.Player.opened()) Lampa.PlayerVideo.destroy(false); } catch (x) {}
    };
    var start = function (d) {
      fin(false);   // any play now takes the kept element (url())
      if (r.kept && (d === item || (d && d.url === item.url))) setTimeout(function () {
        try { if (Lampa.PlayerVideo.video() !== r.v) keepLost(); } catch (x) {}
      }, 0);
    };
    var ext = function () { fin(true); };
    var gone = function () { if (closes++ || !r.kept) fin(closes > 1); };   // the first: the move's own
    var wait = function () {
      var busy = false;
      try { busy = Lampa.Player.opened() || (Lampa.Modal.opened && Lampa.Modal.opened()) || (Lampa.Select.opened && Lampa.Select.opened()); } catch (x) {}
      try { busy = busy || Lampa.Controller.enabled().name === 'select'; } catch (x) {}   // (an external player's picker)
      if (busy) timer = setTimeout(wait, 60000); else fin(true);
    };
    try { P.follow('start', start); P.follow('external', ext); P.follow('destroy', gone); } catch (x) {}
    timer = setTimeout(wait, 60000);
  }

  Playback.prototype.apply = function (el, r) {
    curSrc = r.src; curOk = false;
    playTrack(r.track, r.tinfo);
    el.alc_track = r.track >= 0 ? r.track : -1;   // the audio track this stream needs (see playlistMoved)
    hidden(el, 'alc_tinfo', r.track >= 0 ? r.tinfo || null : null);
    el.url = r.url;
    el.alc_src = r.src;
    // other plugins (seek previews) must not ask such a source for anything beyond playing
    el.alc_costly = !!r.costly;
    el.alc_stubbed = false;   // stub guard: a new stream is judged afresh
    hidden(el, 'alc_spd', false);   // and measured afresh (speedCheck)
    if (r.quality && typeof r.quality === 'object' && Object.keys(r.quality).length) el.quality = r.quality;
    else delete el.quality;
    // fields of the previous source must not stick to the new stream (wrong Referer / subtitles)
    ['subtitles', 'headers'].forEach(function (k) { if (r[k]) el[k] = r[k]; else delete el[k]; });
    // skip markers (intro / credits) belong to the episode, not to the source: those attached
    // before (skip_segments plugin) stay when another source takes over
    if (r.segments) el.segments = r.segments;
    splitReserve(el);
    setDefaultQuality(el);
    this.otherSubs(el, el.episode || 0, r);
  };

  // Subtitles of the OTHER sources of this voice for this episode (same voice = same cut in
  // practice): sources whose items carry subtitles add them at once; sources that tell them only in
  // a 'call' answer are asked later (at most two, when the viewer opens the subtitle menu, or when
  // automatic subtitles find nothing). The source's own subtitles_call is asked at the start.
  Playback.prototype.otherSubs = function (el, episode, r) {
    var self = this, now = [], lazy = [];
    if (r.subtitles_call) lazy.push({ src: r.src, url: r.subtitles_call, own: true });
    this.voice.cands.forEach(function (c) {
      if (c.src === r.src) return;
      var items = self.session.itemsOf(c);
      var it = items && self.findItem(items, episode, true);
      if (!it) return;
      if (it.subtitles && it.subtitles.length) it.subtitles.forEach(function (x) { if (x && x.url) now.push({ label: (x.label || '') + ' · ' + c.src, url: x.url, alc_src: c.src }); });
      else if (it.method === 'call' && !costly(it) && lazy.filter(function (j) { return !j.own; }).length < 2) lazy.push({ src: c.src, url: it.url });
      if (it.subtitles_call) lazy.push({ src: c.src, url: it.subtitles_call });
    });
    el.alc_xsubs = now;
    el.alc_xlazy = lazy;
    el.alc_xbusy = false;   // an ask still running was for the previous source (fetchOtherSubs drops it)
    hidden(el, 'alc_session', this.session);
  };

  Playback.prototype.titleOf = function (e) {
    var eps = this.episodes || [];
    for (var i = 0; i < eps.length; i++) if (eps[i].e === e) return eps[i].title || '';
    return '';
  };

  // Playlist for the player: the current episode is a copy (no cycle), the others resolve lazily.
  Playback.prototype.buildPlaylist = function (episodes, current, currentEl) {
    var self = this, playlist = [];
    episodes.forEach(function (ep) {
      if (ep.shared && ep.e !== current) return;   // plays as part of the previous file
      if (ep.e === current) {
        // a copy, not the element itself: el.playlist -> el would be a cycle, and Lampa's
        // external-player path JSON.stringify()s the play data ("cannot serialize cyclic structures")
        var cur = {};
        for (var k in currentEl) if (k !== 'playlist') cur[k] = currentEl[k];
        copyHidden(currentEl, cur);
        // played again from the playlist, it takes what the element has by then (skip markers come
        // after this copy; a failed source may have been replaced) - see the 'create' handler
        Object.defineProperty(cur, 'alc_base', { value: currentEl, enumerable: false });
        cur.callback = function () { playlistMoved(self, current, cur); };
        playlist.push(cur);
        return;
      }
      var cell = self.element(ep.e, ep.title || '', true);
      cell.callback = function () { playlistMoved(self, ep.e, cell); };
      cell.url = function (call) {
        self.next(ep.e, function (rr) {
          if (rr) {
            self.apply(cell, rr);
            setMulti(self, ep.e);
            var vo = self.voiceovers(ep.e);
            if (vo) cell.voiceovers = vo;
            saveChoice(self.session.movie.id, { season: self.season, episode: ep.e });
          }
          else cell.url = '';
          call();
        });
      };
      playlist.push(cell);
    });
    return playlist;
  };

  // The player's «Аудиодорожки» menu lists the voices of this title; picking one switches the
  // source in place and continues from the same second. Streams that really carry several
  // audio tracks keep Lampa's own track menu.
  // others: only the other voices (appended to the stream's own tracks, see multiNow)
  Playback.prototype.voiceovers = function (episode, others) {
    var self = this, s = this.session;
    if (/^multi:/.test(this.voice.key) && !others) return null;   // the stream's own tracks come first
    var list = s.voices(this.season);   // (a movie: season 0)
    // series: only voices known to have this episode (a voice may cover just part of a season)
    // (a voice whose pages are not loaded yet stays: unknown is not "absent")
    if (s.serial) list = list.filter(function (v) {
      if (v.key === self.voice.key || episode in voiceEpisodesOf(s, v)) return true;
      return v.cands.some(function (c) { var k = cacheKey(c); return c.url && !c.items && !s.voiceCache[k] && !s.emptyVoice[k]; });
    });
    if (others) list = list.filter(function (v) { return v.key !== self.voice.key; });
    var out = list.slice(0, 40).map(function (v) {
      // Lampa shows "N / language / label"; the source count meant nothing there, so language only
      return { language: v.label, label: '', alc_voice: true,
        selected: v.key === self.voice.key, enabled: v.key === self.voice.key,
        // Lampa's menu calls an item's own onSelect instead of its tracks handler, which is what
        // gives control back to the player: without this the closed menu keeps the controller
        // and "back" (remote, on-screen "<", iPad) goes nowhere
        onSelect: function () {
          toPlayer();
          self.switchVoice(v, episode);
        } };
    }).map(function (o, i) {
      // the voice itself, hidden from JSON.stringify (the external-player path serialises play data)
      Object.defineProperty(o, 'alc_v', { value: list[i], enumerable: false });
      return o;
    });
    return others ? out : out.length > 1 ? out : null;
  };

  // a menu over the player closed: the remote goes back to the player
  function toPlayer() { try { if (Lampa.Player.opened()) Lampa.Controller.toggle('player'); } catch (x) {} }

  // Every source of the voice failed (and asking the same one again did not help): the viewer
  // picks another voice that has this episode, or asks this voice's sources once more.
  Playback.prototype.deadMenu = function (episode, work, reserve, pos, done) {
    var self = this, others = this.voiceovers(episode, true) || [];
    var items = [{ title: tr('poll_again'), subtitle: tr('poll_again_d'), again: true }];
    others.forEach(function (o, i) { items.push({ title: o.language, subtitle: i ? '' : tr('other_voice'), idx: i }); });
    var back = toPlayer;
    try {
      Lampa.Select.show({
        title: tr('voice_dead', this.voice.label),
        items: items,
        onSelect: function (a) {
          back();
          if (a.again) {
            // a fresh round: every source of this voice may be asked again (fresh links)
            self.tried[String(episode || 0)] = {};
            self.retries = {};
            self.voice.cands.forEach(function (c) { delete failures[c.src]; });
            work.alc_switching = true;
            noty(tr('polling'));
            self.next(episode, function (r) { done(r, true); });
          } else if (others[a.idx]) self.switchVoice(others[a.idx].alc_v, episode, pos);
        },
        onBack: back
      });
    } catch (e) { noty(tr('no_more_src', this.voice.label)); }
  };

  Playback.prototype.switchVoice = function (v, episode, at) {
    if (!v || v.key === this.voice.key) return;
    primeVideo();
    var self = this, pb = new Playback(this.session, v, this.season), t = 0;
    pb.episodes = this.episodes;
    try { var vid = Lampa.PlayerVideo.video(); t = vid ? vid.currentTime || 0 : 0; } catch (e) {}
    if (at > t) t = at;
    noty(tr('switching', v.label));
    var from = null;
    try { from = Lampa.Player.playdata(); } catch (e) {}
    pb.next(episode, function (r) {
      try { if (Lampa.Player.opened && !Lampa.Player.opened()) return; } catch (e) {}   // the viewer left the player meanwhile
      if (from && !isCurrent(from)) return;   // another episode plays by now: not ours to change
      if (!r) { noty(tr('no_voice_ep', v.label)); return; }
      handTrack = trackSeen = null;   // a voice picked in our menu: its own track again
      var work = null;
      try { work = Lampa.Player.playdata(); } catch (e) {}
      var el = pb.element(episode, pb.titleOf(episode));
      pb.apply(el, r);
      if (work) {
        // same play object; error handler / voiceovers now belong to the new voice
        ['quality', 'subtitles', 'headers', 'voiceovers'].forEach(function (k) { if (!(k in el)) delete work[k]; });   // segments: the episode's, they stay
        // the timeline too: Lampa's continue-watching reads the live one (a fresh view holds the
        // last saved second, up to minutes back, and Lampa would jump there after our seek)
        for (var k in el) if (k !== 'timeline' || !work.timeline) work[k] = el[k];
        copyHidden(el, work);
        hidden(work, 'alc_pb', pb);
      }
      saveChoice(self.session.movie.id, { voice: v.key, src: r.src, pin: '' });   // the source of the voice now playing; a fixed source was for the other voice
      registerPlaying(pb, episode);
      pb.verifySoon(episode);
      setMulti(pb, episode);
      // «Аудиодоріжки» was built at player start: hand it the new list, else it keeps the old
      // voice marked and its items keep acting for the old voice
      try { if (work && work.voiceovers && Lampa.PlayerPanel && Lampa.PlayerPanel.setTracks) Lampa.PlayerPanel.setTracks(work.voiceovers); } catch (x) {}
      // the new stream gets a new video element without any subtitle list: choose once it is there
      // (now it would pick, and download, a track of the list that is about to disappear)
      subsAfterReload(work || el);
      try {
        if (t > 5) seekOnce(t); else cancelSeek();
        var url = (work || el).url;
        // the same path as Lampa's own quality switch (keeps the player's state consistent: work.url,
        // continue-watching reset); direct video replacement only if the panel is not there
        var qname, qs = (work || el).quality || {};
        for (var qk in qs) if (qs[qk] === url || (qs[qk] && qs[qk].url === url)) qname = qk;   // the quality this url is
        // (in the same <video>: the answer may come later than Safari's second after the menu's tap)
        inPlaceQuality(qname, url);
        panelQuality(work || el);
      } catch (e) { console.error('AlcAuto voice', e && e.message); }
      if (self.session.serial && pb.episodes && pb.episodes.length > 1) {
        try {
          // skip markers fetched for the next episodes (skip_segments) stay with them
          var segs = {};
          (Lampa.PlayerPlaylist.get() || []).forEach(function (c) { if (c && c.segments && c.episode) segs[c.episode] = c.segments; });
          var pl = pb.buildPlaylist(pb.episodes, episode, work || el);
          pl.forEach(function (c) { if (!c.segments && segs[c.episode]) c.segments = segs[c.episode]; });
          Lampa.Player.playlist(pl);
        } catch (e) {}
      }
    });
  };

  // ---------- the voice list in the player follows the sound comparison ----------
  // While a stream plays, a split of its voice ("· variant 2") or new sources change the player's
  // «Audio tracks» list at once, and the playing voice becomes the variant whose sources carry the
  // recording that plays (so a failure switches only to the same recording).
  var playingNow = null;   // {pb, episode}
  function registerPlaying(pb, episode) {
    playingNow = { pb: pb, episode: episode };
    var sess = pb.session;
    if (sess.playerListen) return;
    sess.playerListen = function () {
      var p = playingNow;
      if (!p || p.pb.session !== sess) return;
      try { if (!Lampa.Player.opened()) return; } catch (e) { return; }
      var voices = sess.voices(p.pb.season);
      var now = variantFor(voices, findVoice(voices, String(p.pb.voice.key).split('~')[0]) || findVoice(voices, p.pb.voice.key), curSrc);
      if (now) p.pb.voice = now;
      var work = null;
      try { work = Lampa.Player.playdata(); } catch (e) {}
      if (!work || /^multi:/.test(p.pb.voice.key)) return;
      var vo = p.pb.voiceovers(p.episode);
      if (vo) {
        work.voiceovers = vo;
        work.voice_name = p.pb.voice.label;
        try { Lampa.PlayerPanel.setTracks(vo); } catch (e) {}
      }
    };
    sess.listen(sess.playerListen);
  }
  try { Lampa.Player.listener.follow('destroy', function () { playingNow = null; }); } catch (e) {}

  Playback.prototype.start = function (episode, episodes) {
    var self = this;
    primeVideo();   // still inside the tap (a screen's episode / voice): the player's element may play later
    this.episodes = episodes || [];
    var first = this.element(episode, this.titleOf(episode));
    var alive = loading(newOp(), this.ctl);   // ctl: the controller a cancelled spinner returns to
    this.next(episode, function (r) {
      if (!alive()) return;
      Lampa.Loading.stop();
      if (!r) { noty(tr('no_stream')); if (self.onFail) self.onFail(); return; }
      // Lampa's history feeds its «Continue watching» row (most recent first): every start counts,
      // also the quick start / «Continue» button that never opens our screen
      try { var card = self.session.card; if (card && card.id) Lampa.Favorite.add('history', card, 100); } catch (e) {}
      saveChoice(self.session.movie.id, self.session.serial ? { src: r.src, season: self.season, episode: episode } : { src: r.src });
      self.apply(first, r);
      var playlist = [];
      if (self.session.serial && episodes && episodes.length > 1) {
        playlist = self.buildPlaylist(episodes, episode, first);
        first.playlist = playlist;
      }
      setMulti(self, episode);
      hidden(first, 'alc_pb', self);   // an external player gets the season's links (extPlaylist)
      Lampa.Player.play(first);
      registerPlaying(self, episode);
      self.verifySoon(episode);
      if (playlist.length) Lampa.Player.playlist(playlist);
      if (r.from) self.seekInto(r.from, episode);
      else if (self.restart) seekOnce(0);   // watched to the end: again from the start, not at the credits
    });
  };

  // The voice that started playing is compared by sound right away, whatever the way in (the quick
  // start never opens the episodes screen): its other sources' episode lists are loaded, then the
  // usual comparison runs; a split shows up in the player's voice list (registerPlaying)
  Playback.prototype.verifySoon = function (episode) {
    var self = this, v = this.voice, s = this.session;
    if (!v || v.variant || /^(multi|sub):/.test(v.key) || v.cands.length < 2) return;
    var season = s.serial ? this.season : 0;
    var go = function () { s.verifyVoices(season, [v], self.expectedSec(episode)); };
    var todo = v.cands.filter(function (c) { return !c.items && c.url; }), n = todo.length;
    if (!n) { go(); return; }
    todo.forEach(function (c) { s.candItems(c, function () { if (--n === 0) go(); }); });
  };

  // The episode is the second part of a multi-episode file: jump to its start, i.e. past the
  // TMDB runtimes of the episodes before it in that file (no jump if a runtime is unknown).
  Playback.prototype.seekInto = function (from, episode) {
    var sec = 0, byE = {};
    (this.episodes || []).forEach(function (ep) { byE[ep.e] = ep.runtime; });
    for (var e = from; e < episode; e++) {
      if (!byE[e]) return;
      sec += byE[e] * 60;
    }
    seekOnce(sec);
  };

  // One pending seek for the next 'loadeddata' at a time; dropped when the source changes or the
  // player closes, so it never jumps an unrelated video.
  var pendingSeek = null, multiNow = null;   // multiNow: {pb, episode} while a several-tracks stream plays
  var external = false;   // the play went to an external player: no 'destroy' will come to undo our player settings
  function setMulti(pb, episode) { multiNow = /^multi:/.test(pb.voice.key) ? { pb: pb, episode: episode } : null; }
  function cancelSeek() {
    if (!pendingSeek) return;
    try { Lampa.PlayerVideo.listener.remove('canplay', pendingSeek); } catch (x) {}
    pendingSeek = null;
  }
  // on 'canplay' (some data buffered): seeking on 'loadeddata' made hls.js report buffer stalls
  function seekOnce(sec) {
    cancelSeek();
    if (external) return;   // a seek left waiting would jump the next video played inside Lampa
    var f = pendingSeek = function () { cancelSeek(); try { Lampa.PlayerVideo.to(sec); } catch (x) {} };
    try { Lampa.PlayerVideo.listener.follow('canplay', f); } catch (x) {}
  }

  // ---------- autoplay on iPhone / iPad ----------
  // Our start comes seconds after the tap (the sources are asked first), in a new element Lampa makes
  // for it: Safari refuses its play(), Lampa drops the refusal, and the player stays black with an
  // empty timeline until pause + play. So every tap that leads to a play prepares the element (below).
  function primeVideo() { packPrime().prime(); }
  // ---------- play after a tap (the same block in every plugin of the pack that starts the player late) ----------
  // Safari on iPhone / iPad starts a video with sound only from a tap (about a second after it), and
  // only in the <video> element that tap reached. A plugin that opens Lampa's player later (after asking
  // a server) calls packPrime().prime() inside the tap: a <video> is prepared there (load() + play()
  // without a source: Safari lets that element play later on), and Lampa's next player video is that
  // element. Elsewhere it is just an ordinary new <video>; TVs are left alone. The newest copy of this
  // block serves all, and Lampa's markup is read by one hook only.
  // A prepared element is replaced only by a new tap (a tap, click or key under TAP_MS ago, inside the
  // browser's user activation; a swipe does not count): the browser's
  // «user activation» lasts several seconds, Safari's play permission about one - a prime() called
  // later in the same flow (another plugin on the way to the player) must not swap the prepared
  // element for one Safari will not let play.
  var PRIME_V = 4;
  function packPrime() {
    var P = window.alc_prime;
    if (P && P.v >= PRIME_V) return P;
    P = window.alc_prime = { v: PRIME_V, el: P && P.el || null, tap: 0 };
    var TAP_MS = 800, tv = function () { try { return !!(Lampa.Platform && Lampa.Platform.tv && Lampa.Platform.tv()); } catch (e) { return false; } };
    // a tap (a touch that did not move: a swipe is no tap), a click or a key; not on TVs (no tap to wait for)
    if (!tv()) try {
      var mark = function () { window.alc_prime.tap = Date.now(); }, t0 = null, opt = { capture: true, passive: true };
      ['click', 'keydown'].forEach(function (t) { document.addEventListener(t, mark, opt); });
      document.addEventListener('touchstart', function (e) { var t = e.touches && e.touches[0]; t0 = t ? { x: t.clientX, y: t.clientY } : null; }, opt);
      document.addEventListener('touchend', function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (t0 && t && Math.abs(t.clientX - t0.x) < 12 && Math.abs(t.clientY - t0.y) < 12) mark();
        t0 = null;
      }, opt);
    } catch (e) {}
    P.prime = function () {
      try {
        if (tv()) return null;   // TVs play without a tap
        var ua = navigator.userActivation, active = !ua || ua.isActive;
        // a new element only inside a tap: a prepared one is replaced by a new tap only (the first
        // prime() of a tap runs before these listeners ever heard a tap: then the activation decides)
        if (!active || (P.el && Date.now() - P.tap > TAP_MS)) return P.el;
        var v = document.createElement('video');
        v.setAttribute('playsinline', 'true');
        v.load();
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        v.pause();
        P.el = v;
      } catch (e) {}
      return P.el;
    };
    // Lampa's PlayerVideo makes its element with $('<video class="player-video__video" ...>'): the
    // prepared one is handed over instead, with the attributes Lampa asked for
    P.take = function (html, out) {
      var v = P.el;
      if (!v || !out || out.length !== 1 || typeof html !== 'string' || html.indexOf('<video class="player-video__video"') !== 0) return out;
      P.el = null;
      while (v.attributes.length) v.removeAttribute(v.attributes[0].name);
      for (var i = 0; i < out[0].attributes.length; i++) v.setAttribute(out[0].attributes[i].name, out[0].attributes[i].value);
      return [v];
    };
    var J = window.jQuery, orig = J && J.parseHTML;
    if (orig && !orig.alc_prime) {
      J.parseHTML = function (html) {
        var out = orig.apply(this, arguments);
        try { out = window.alc_prime.take(html, out); } catch (e) {}
        return out;
      };
      J.parseHTML.alc_prime = true;
    }
    return P;
  }
  // The safety net (an element no tap prepared: a source switched by itself, an old Safari): a
  // stream of ours that never started (paused, nothing played, not paused by the viewer) is asked
  // to play once more; refused, the next tap anywhere starts it (Lampa's own play button does
  // nothing while its spinner is up, which it is until the first frame).
  var tapArmed = null, userPaused = null;
  function disarmTap() {
    if (!tapArmed) return;
    document.removeEventListener('touchend', tapArmed, true);
    document.removeEventListener('click', tapArmed, true);
    tapArmed = null;
  }
  function armTap(v) {
    if (tapArmed) return;
    tapArmed = function () {
      disarmTap();
      try { if (Lampa.PlayerVideo.video() === v && v.paused) Lampa.PlayerVideo.play(); } catch (x) {}
    };
    document.addEventListener('touchend', tapArmed, true);
    document.addEventListener('click', tapArmed, true);
    noty(tr('tap_play'));
  }
  try { Lampa.PlayerVideo.listener.follow('pause', function () { try { userPaused = Lampa.PlayerVideo.video(); } catch (x) {} }); } catch (x) {}
  try { Lampa.Player.listener.follow('destroy', function () { disarmTap(); userPaused = null; }); } catch (x) {}
  setInterval(function () {
    var data = null, v = null;
    try { if (!Lampa.Player.opened()) return; data = Lampa.Player.playdata(); v = Lampa.PlayerVideo.video(); } catch (x) { return; }
    if (!data || !data.alc_src || data.alc_switching || !v || typeof v.play !== 'function') return;
    var src = v.currentSrc || v.src;
    if (v.alc_tried && v.alc_tried === src) return;   // once per stream (an element given a new source is asked again)
    if (!v.paused || v.ended || v === userPaused || (v.played && v.played.length) || !(v.currentSrc || v.src)) { v.alc_seen = 0; return; }
    if (!v.alc_seen) { v.alc_seen = Date.now(); return; }
    if (Date.now() - v.alc_seen < 2000) return;
    v.alc_tried = src;
    try {
      var p = v.play();
      if (p && p.then) p.then(function () { try { Lampa.PlayerVideo.listener.send('play', {}); } catch (x) {} }, function (e) {
        console.log('AlcAuto', 'autoplay refused:', e && e.name);
        if (e && e.name === 'NotAllowedError' && Lampa.PlayerVideo.video() === v) armTap(v);
      });
    } catch (x) {}
  }, 1000);

  try {
    // non-fatal player notes ("bufferStalledError fatal [false]": the buffer ran dry for a moment
    // and the player recovered by itself) are hidden while one of our streams plays; fatal errors
    // still show (Lampa shows them elsewhere, and this plugin switches the source on them). Another
    // plugin's video keeps its notes: they may be the only word on what goes wrong there
    Lampa.PlayerVideo.listener.follow('error', function (e) {
      if (!e || e.fatal || !playingOurs()) return;
      try {
        lampaFind('PlayerInfo', '.player-info__error').addClass('hide');
      } catch (x) {}
    });
    Lampa.Player.listener.follow('destroy', function () {
      try { cancelSeek(); } catch (x) {}
      try { if (subsReload) Lampa.PlayerVideo.listener.remove('loadeddata', subsReload); } catch (x) {}
      trackWas = !!(playEl && playEl.alc_track >= 0); playEl = null;   // for a playlist move (playlistMoved)
      handCheck(); handWas = handTrack; handTrack = null; trackSeen = null; trackNew = null;
      subsReload = null; multiNow = null; trackSet = false; wantTrack = null;
      unsize();
      guard.ok = false; guard.video = null;
      subsAuto = { data: null, picked: false };   // (else the closed play, and its whole Session, stays in memory)
    });
    // an external player (Android, Apple, ...): our seek and audio track index would stay set for the
    // next video played inside Lampa ('external' may come before or after them, see seekOnce)
    Lampa.Player.listener.follow('external', function () {
      external = true;
      try { cancelSeek(); handTrack = handWas = trackSeen = null; playTrack(-1); } catch (x) {}
    });
    // a play of ours may never open (another plugin that delays Lampa's play - skip_segments' wait,
    // mirage's link - can drop it on Back): the seek and track list armed for it must not jump or
    // extend the next video that is not ours
    Lampa.Player.listener.follow('start', function (d) {
      if (d && !d.alc_src && !d.alc_pb && !d.alc_base) { cancelSeek(); multiNow = null; }
    });
    // the copy of the started episode in our playlist (buildPlaylist) plays what that element has now
    Lampa.Player.listener.follow('create', function (e) {
      external = false;
      var d = e && e.data, b = d && d.alc_base;
      if (b) { for (var k in b) if (k !== 'playlist' && k !== 'callback' && k !== 'alc_switching') d[k] = b[k]; copyHidden(b, d); }
    });
    // A stream with several audio tracks: its tracks are listed by whoever calls setTracks (Lampa's
    // own 'tracks' handler, which runs after ours in Lampa 3.3; plugins such as hls_tracks, later
    // still): our other voices are appended to every such list, whatever the order of the calls.
    var P = Lampa.PlayerPanel, origSetTracks = P && P.setTracks;
    if (origSetTracks && !origSetTracks.alc_auto) {
      P.setTracks = function (list) {
        var args = arguments;
        try {
          var mine = false;
          for (var i = 0; list && i < list.length; i++) if (list[i] && list[i].alc_voice) mine = true;
          if (multiNow && list && list.length && !mine) {
            var all = [];
            for (var j = 0; j < list.length; j++) all.push(list[j]);
            args = [all.concat(multiNow.pb.voiceovers(multiNow.episode, true) || [])];
          }
        } catch (x) {}
        return origSetTracks.apply(this, args);
      };
      P.setTracks.alc_auto = true;
    }
  } catch (x) {}

  // ---------- stub guard ----------
  // Some sources answer some qualities with a short preview clip instead of the video (or with a cut
  // file). Played as is, it "ends" after a few seconds and Lampa saves the title as watched. Once the
  // length is known it is compared with TMDB's runtime: less than half of it (unknown runtime: a
  // movie under 2 minutes) = a stub. Then the next lower quality of the same item is tried, and when
  // none is left, the next source with this voice (the same path as a fatal player error). The
  // stub's seconds never reach the timeline.
  var guard = { ok: false, video: null };
  function qNum(k) { var m = /(\d{3,4})/.exec(String(k)); return m ? parseInt(m[1], 10) : /4k|uhd/i.test(String(k)) ? 2160 : 0; }
  function qUrl(v) { return typeof v === 'string' ? v : (v && typeof v.url === 'string' ? v.url : ''); }
  function isStub(data, dur) {
    if (!dur || !isFinite(dur) || dur <= 0) return false;
    if (data.alc_expect > 0) return dur < data.alc_expect * 0.5;
    return !data.season && dur < 120;
  }
  function stubSwitch(data, dur) {
    if (!isCurrent(data)) return;
    var tl = data.timeline, good = data.alc_good || data.alc_tl0;
    if (tl && good) { tl.percent = good.percent; tl.time = good.time; tl.duration = good.duration; }
    if (tl) { tl.continued = false; tl.continued_bloc = false; }
    if (!data.alc_stubbed) { data.alc_stubbed = true; record(data.alc_src, { fail: 0.5 }); }
    var q = data.quality, cur = 0, k, best = null, bq = 0;
    if (q && typeof q === 'object') {
      for (k in q) if (qUrl(q[k]) === data.url) { cur = qNum(k); delete q[k]; }   // not offered again
      for (k in q) {
        var n = qNum(k), u = qUrl(q[k]);
        if (n && u && u !== data.url && (!cur || n < cur) && n > bq) { best = k; bq = n; }
      }
    }
    guard.ok = false;
    if (best) {
      var d = Math.round(dur), len = d >= 3600 ? Math.floor(d / 3600) + ':' + ('0' + Math.floor(d % 3600 / 60)).slice(-2) + ':' + ('0' + d % 60).slice(-2) : Math.floor(d / 60) + ':' + ('0' + d % 60).slice(-2);
      noty(tr('stub_lower', len, best));
      try { inPlaceQuality(best, qUrl(q[best])); } catch (x) {}
      try { Lampa.PlayerPanel.quality(q, qUrl(q[best])); } catch (x) {}
      return;
    }
    if (typeof data.error === 'function') data.error(data, function (url) {
      guard.ok = false;
      try { inPlaceQuality('', url); } catch (x) {}
      try { if (data.quality) Lampa.PlayerPanel.quality(data.quality, url); } catch (x) {}
    });
  }
  try {
    Lampa.Player.listener.follow('start', function () { guard.ok = false; });
    Lampa.PlayerPanel.listener.follow('quality', function () { guard.ok = false; });
    Lampa.PlayerVideo.listener.follow('loadeddata', function (e) {
      var data = null, v = null;
      try { data = Lampa.Player.playdata(); v = Lampa.PlayerVideo.video(); } catch (x) {}
      if (!data || !data.alc_src) return;   // not ours
      var dur = (e && e.duration) || (v && v.duration);
      if (isStub(data, dur)) { guard.ok = false; setTimeout(function () { stubSwitch(data, dur); }, 0); return; }
      guard.ok = true; guard.video = v;
    });
    // progress of a checked stream: what a later stub is rolled back to
    Lampa.PlayerVideo.listener.follow('timeupdate', function () {
      if (!guard.ok) return;
      var data = null;
      try { data = Lampa.Player.playdata(); if (Lampa.PlayerVideo.video() !== guard.video) return; } catch (x) { return; }
      var tl = data && data.alc_src && data.timeline;
      if (tl) data.alc_good = { percent: tl.percent, time: tl.time, duration: tl.duration };
    });
  } catch (x) {}

  // ---------- slow source: a lower quality ----------
  // Some sources' CDNs deliver slower than the stream's own bitrate (uaserials «Плюс-Плюс» on hdvbua:
  // 1080p needs 2.1 Mbit/s, the CDN gives 1.5-2): playback keeps stopping, worst after a seek. Once per
  // stream start (an HLS link with a choice: the source's quality map, or the variants of a master
  // playlist the player lists as its levels) one media segment past what the player has buffered is
  // timed (its first 512 KB when the bitrate is known; one the player loads soon anyway, not one it is
  // loading now; hls.js's own bandwidth estimate is not reachable: Lampa keeps its instance). Slower
  // than SPD_MARGIN x the quality's bitrate (BANDWIDTH of the variant, else the segment's own size per
  // second): the 720p quality (else the next lower one) is switched on the way the player's own quality
  // menu does it, with a toast naming another source of this voice when there is one. The player's
  // quality is a choice the player makes itself at the start (video_quality_default), so the switch
  // comes after it, not as the start URL. A CDN is remembered for SPD_TTL: found slow, the next
  // episode from it is put to the quality chosen then (not one lower again: the player starts the next
  // episode in the level of the previous one), without a toast; found fast, it is not measured again. One
  // quality only, an mp4 link, a fast source, a measurement that fails (CORS, nothing loaded): nothing
  // changes.
  var SPD_MARGIN = 1.2, SPD_CAP = 12000, SPD_TTL = 30 * 60 * 1000;
  var spdLevels = null;   // {list, url}: the levels the player listed last and the link they are of
  var spdHosts = {};      // spdKey -> {t: when measured, slow, h: the quality measured, to: the one switched to} (SPD_TTL)
  var spdLast = null;     // the last measurement (for test harnesses: alc_auto_debug.speed())
  try {
    Lampa.PlayerVideo.listener.follow('levels', function (e) {
      var d = null;
      try { d = Lampa.Player.playdata(); } catch (x) {}
      spdLevels = e && e.levels && e.levels.length > 1 ? { list: e.levels, url: d && d.url } : null;
    });
  } catch (e) {}
  // a link relative to a playlist -> absolute
  function m3uUrl(u, base) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/\//.test(u)) return (/^(https?:)/i.exec(base) || ['', 'https:'])[1] + u;
    if (u.charAt(0) === '/') return originOf(base) + u;
    return String(base).replace(/[?#].*$/, '').replace(/[^\/]*$/, '') + u;
  }
  // what can be switched to: {cur: {name, h, url, bw}, to: the 720p or the next lower quality} or null
  function spdOptions(data) {
    var lvUrl = function (l) { var u = l.url; return String((isArr(u) ? u[0] : u) || l.uri || ''); };
    var out = [], cur = null, k;
    if (spdLevels && spdLevels.url === data.url) {
      spdLevels.list.forEach(function (l) {
        var o = { name: l.title || (l.height ? l.height + 'p' : ''), h: l.height || qNum(l.title), url: lvUrl(l), bw: l.bitrate || 0, level: l };
        if (l.selected === true) cur = o; else out.push(o);
      });
    } else if (data.quality && typeof data.quality === 'object') {
      for (k in data.quality) {
        var u = qUrl(data.quality[k]), o = { name: k, h: qNum(k), url: u, bw: 0, key: k };
        if (!u) continue;
        if (u === data.url && !cur) cur = o; else out.push(o);
      }
    }
    if (!cur || !cur.h || !cur.url) return null;   // the player chooses itself (automatic levels) or one quality
    out = out.filter(function (o) { return o.h && o.h < cur.h && (o.url || o.level); });
    if (!out.length) return null;
    out.sort(function (a, b) { return b.h - a.h; });
    return { cur: cur, to: out.filter(function (o) { return o.h <= 720; })[0] || out[0], lower: out };
  }
  // the CDN a link is of: through a proxy of our server (Lampac's /proxy/..., the link in it plain or
  // encoded) the host of the link inside; a proxy link that hides it - the source and our host (every
  // source would share the one host otherwise)
  function spdKey(url, src) {
    var u = String(url || ''), h = hostName(u), m = /^(?:[a-z]+:)?\/\/[^\/?#]+\/(.*)$/i.exec(u), rest = m ? m[1] : '';
    if (!/(^|\/)proxy/i.test(rest) && !ownUrl(u)) return h;
    var inner = /(https?)(?::|%3A)(?:\/|%2F){2}([^\/?#%:]+)/i.exec(rest);
    return inner ? inner[2].toLowerCase() : srcBase(src) + '@' + h;
  }
  // cb({kbps, need, ratio}) or cb(null): the throughput of the first segment that starts past sec,
  // against the bitrate. A segment that came in under 50 ms came from the browser's cache (the player
  // had it already): no measurement
  function spdMeasure(url, bw, sec, cb) {
    var done = false, fin = function (r, why) { if (!done) { done = true; cb(r, why); } };
    getText(url, function (text, x) {
      // links in the list are relative to where it came from after redirects (CDNs hand out a node)
      var base = x.responseURL || url;
      // a master playlist (a quality map's link may be one): its first variant
      var m = /#EXT-X-STREAM-INF:([^\n]*)\n\s*([^#\s][^\n]*)/.exec(text);
      if (m) {
        var b = /BANDWIDTH=(\d+)/.exec(m[1]);
        done = true;
        spdMeasure(m3uUrl(m[2], base), bw || (b ? parseInt(b[1], 10) : 0), sec, cb);
        return;
      }
      if (/#EXT-X-BYTERANGE/.test(text)) { fin(null, 'byterange'); return; }   // parts of one file: not one request each
      var segs = [], at = 0, d = 0;
      text.split('\n').forEach(function (l) {
        l = l.trim();
        var inf = /^#EXTINF:([\d.]+)/.exec(l);
        if (inf) { d = parseFloat(inf[1]) || 0; return; }
        if (!l || l.charAt(0) === '#' || !d) return;
        segs.push({ t: at, d: d, url: m3uUrl(l, base) });
        at += d; d = 0;
      });
      var seg = segs.filter(function (s) { return s.t >= sec; })[0];
      if (!seg) { fin(null, 'no segment'); return; }
      spdSegment(seg, bw, !!bw, fin);
    }, function (why) { fin(null, 'list ' + why); }, 8000);
  }
  // the segment timed. The bitrate known: its first SPD_PART bytes are enough (a ranged GET; a server
  // that ignores the range is cut there too; older TV browsers ask CORS leave for a Range header,
  // and a CDN that refuses it is measured without one); else the whole segment (its size per
  // second is the bitrate). Timed from the first bytes on (the bytes after them over the time since):
  // the CORS preflight, the connection and the wait for the first byte are not throughput
  var SPD_PART = 524288;
  function spdSegment(seg, bw, ranged, fin) {
    var t0 = Date.now(), t1 = 0, b1 = 0, loaded = 0, total = 0, over = false, sx = new XMLHttpRequest();
    var result = function (complete) {
      var now = Date.now(), ms = now - t1, bytes = loaded - b1;
      if (complete) total = loaded;
      if (!loaded || now - t0 < 50) { fin(null, loaded ? 'cached' : 'nothing loaded'); return; }
      var need = bw ? bw / 1000 : total ? total * 8 / seg.d / 1000 : 0;
      if (!need) { fin(null, 'no bitrate'); return; }
      // all in one go (a fast server: no progress in between): timed from the start, which counts
      // the wait too - fast enough even so is fast; slower says nothing
      if (!t1 || bytes <= 0 || ms < 50) {
        ms = now - t0; bytes = loaded;
        if (bytes * 8 / ms / need < SPD_MARGIN) { fin(null, 'too short'); return; }
      }
      var kbps = bytes * 8 / ms;
      fin({ kbps: Math.round(kbps), need: Math.round(need), ratio: Math.round(kbps / need * 100) / 100, bytes: bytes, ms: ms });
    };
    var stop = function () { over = true; clearTimeout(cap); try { sx.abort(); } catch (e) {} result(false); };
    var cap = setTimeout(stop, SPD_CAP);
    try {
      sx.open('GET', seg.url, true);
      sx.responseType = 'arraybuffer';
      if (ranged) sx.setRequestHeader('Range', 'bytes=0-' + (SPD_PART - 1));
      sx.onprogress = function (e) {
        loaded = e.loaded || loaded;
        if (!t1 && loaded) { t1 = Date.now(); b1 = loaded; }
        if (e.lengthComputable) total = e.total;
        if (bw && loaded >= SPD_PART && !over) stop();
      };
      sx.onload = function () {
        if (over) return;
        clearTimeout(cap);
        if (sx.status < 200 || sx.status >= 300) { fin(null, 'segment ' + sx.status); return; }
        loaded = (sx.response && sx.response.byteLength) || loaded;
        result(!ranged);
      };
      sx.onerror = function () {
        if (over) return;
        clearTimeout(cap);
        if (ranged && !loaded) spdSegment(seg, bw, false, fin); else fin(null, 'segment failed');
      };
      sx.send();
    } catch (e) { clearTimeout(cap); fin(null, String(e && e.message)); }
  }
  // the lower quality, as the player's quality menu sets it
  function spdSwitch(data, o, say) {
    var t = o.to;
    if (t.level) {
      if (!(t.level.change_quality && t.level.url)) {
        // hls.js levels: the level's own switch (the player keeps playing, from the next segment)
        try { t.level.enabled = true; } catch (x) { return; }
      } else {
        // levels read from the master by Lampa's parser (native HLS): the variant's link is loaded,
        // the player goes on from the saved point (as with a pick in its menu)
        spdLevels.list.forEach(function (l) { l.selected = false; });
        t.level.selected = true;
        try { inPlaceQuality(t.name, t.level.url); } catch (x) { return; }
      }
      // (the panel's quality button shows it; a Lampa without that button: nothing to show)
      try {
        var qb = lampaFind('PlayerPanel', '.player-panel__quality');
        if (qb.length) qb.text(Lampa.Utils.qualityToText ? Lampa.Utils.qualityToText(t.name) : t.name);
      } catch (x) {}
    } else {
      try { inPlaceQuality(t.key, t.url); } catch (x) { return; }
      try { Lampa.PlayerPanel.quality(data.quality, t.url); } catch (x) {}
    }
    if (!say) return;
    // another source of this voice the viewer can pick in the player's source list
    var alt = '', p = playingNow && playingNow.pb;
    if (p && p.voice) rankCands(p.voice.cands.filter(function (c) { return c.src !== data.alc_src && !srcOff(c.src); })).some(function (c) { alt = srcBase(c.src); return true; });
    noty(tr('spd_slow', t.name) + (alt ? tr('spd_other', alt) : ''));
  }
  // tries: how often it waited already for the player's first buffer (see below)
  function speedCheck(tries) {
    var data = null, v = null;
    try { if (!Lampa.Player.opened()) return; data = Lampa.Player.playdata(); v = Lampa.PlayerVideo.video(); } catch (x) { return; }
    if (!data || !data.alc_src || data.alc_spd || data.alc_switching || data.alc_stubbed || !/\.m3u8/i.test(String(data.url))) return;
    var o = spdOptions(data);
    if (!o) return;
    var host = spdKey(o.cur.url, data.alc_src), url0 = data.url, cur = o.cur;
    // measured lately: slow -> the quality chosen then, at once and quietly, only from a higher one (a
    // start in it or lower stays); fast (in this quality or a higher one) -> nothing
    var known = spdHosts[host];
    if (known && Date.now() - known.t < SPD_TTL && (known.slow || known.h >= cur.h)) {
      hidden(data, 'alc_spd', true);
      var aim = known.slow && cur.h > known.to && o.lower.filter(function (x) { return x.h <= known.to; })[0];
      spdLast = { src: data.alc_src, from: cur.name, to: aim ? aim.name : '', known: known.slow ? 'slow' : 'fast' };
      if (aim) spdSwitch(data, { cur: cur, to: aim, lower: o.lower }, false);
      return;
    }
    // a segment past what the player has buffered (+ 8 s: not the one it is loading now)
    var at = (v && v.currentTime) || 0, ahead = at;
    try { for (var i = 0; v && i < v.buffered.length; i++) if (v.buffered.start(i) <= at + 1 && v.buffered.end(i) > ahead) ahead = v.buffered.end(i); } catch (x) {}
    // the player still fills its first buffer (it takes the line itself then): a moment later (up to ~16 s)
    tries = tries || 0;
    if (ahead - at < 6 && tries < 8) { setTimeout(function () { speedCheck(tries + 1); }, 2000); return; }
    hidden(data, 'alc_spd', true);   // once per stream (apply() clears it for another source)
    spdMeasure(cur.url, cur.bw, ahead + 8, function (r, why) {
      spdLast = r ? { src: data.alc_src, from: cur.name, to: o.to.name, kbps: r.kbps, need: r.need, ratio: r.ratio, bytes: r.bytes, ms: r.ms } : { src: data.alc_src, from: cur.name, none: why || '' };
      console.log('AlcAuto', 'speed', JSON.stringify(spdLast));
      if (!r) return;
      if (r.ratio >= SPD_MARGIN) { spdHosts[host] = { t: Date.now(), slow: false, h: cur.h }; return; }
      // still this stream, in the quality measured (the viewer may have picked another one meanwhile)
      if (!isCurrent(data) || data.url !== url0 || data.alc_switching) return;
      if (cur.level && cur.level.selected !== true) return;
      spdHosts[host] = { t: Date.now(), slow: true, h: cur.h, to: o.to.h };
      spdSwitch(data, o, true);
    });
  }
  // after the stream has loaded (the levels are known by then; the stub guard has had its say)
  try { Lampa.PlayerVideo.listener.follow('loadeddata', function () { setTimeout(function () { speedCheck(0); }, 2000); }); } catch (e) {}

  // ---------- stall watchdog ----------
  // Native HLS (Safari on iPhone / iPad) does not report a dead stream as an error: the video waits
  // for data forever and no source switch happens. A stream of ours that should be playing (not
  // paused), has not moved and has nothing buffered ahead for STALL ms is reported as a fatal error,
  // which takes the usual path (the next source, the same one asked again, the menu). Once per
  // stall: it has to move (or a new stream load) before it can fire again.
  // A second kind of stall: Safari's own player stops (time stands still, not paused) with data
  // buffered ahead - nothing is wrong with the stream, and pause + play wakes it. That is done once
  // per stall after KICK ms of standing; if the time still does not move, it counts as a dead stream.
  var STALL = 25000, KICK = 8000, stall = { at: -1, since: 0, fired: false, kicked: 0 };
  function aheadSec(v) {
    try { for (var i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5 && v.buffered.end(i) > v.currentTime) return v.buffered.end(i) - v.currentTime; } catch (x) {}
    return 0;
  }
  function kick(v) {
    try {
      v.pause();
      setTimeout(function () { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (x) {} }, 300);
      console.log('AlcAuto', 'stall with data buffered: pause + play at', v.currentTime);
    } catch (x) {}
  }
  setInterval(function () {
    var data = null, v = null;
    try { if (!Lampa.Player.opened()) { stall.since = 0; return; } data = Lampa.Player.playdata(); v = Lampa.PlayerVideo.video(); } catch (x) { return; }
    // one record per stream: a fallback stream that is dead from the start must be able to fire too
    if (data && stall.url !== data.url) stall = { at: -1, since: 0, fired: false, kicked: 0, url: data.url };
    // the kick's own short pause (300 ms) must not reset the stall it is waking; a longer one is the viewer's
    var ownPause = stall.kicked && Date.now() - stall.kicked < 2000;
    if (!data || !data.alc_src || !v || data.alc_switching || (v.paused && !ownPause) || v.ended || v.seeking || !data.url) { stall.since = 0; stall.kicked = 0; return; }
    var t = v.currentTime || 0;
    if (t !== stall.at) { stall.at = t; stall.since = 0; stall.fired = false; stall.kicked = 0; return; }
    if (stall.fired) return;
    if (!stall.since) { stall.since = Date.now(); return; }
    var standing = Date.now() - stall.since;
    if (aheadSec(v) > 1) {
      // data is there: wake Safari's player once; a player that is still loading is left alone
      if (!stall.kicked && standing >= KICK && v.readyState >= 3) { stall.kicked = Date.now(); kick(v); return; }
      if (!stall.kicked || Date.now() - stall.kicked < STALL - KICK) return;
    } else if (standing < STALL) return;
    stall.fired = true; stall.since = 0;
    try { Lampa.PlayerVideo.listener.send('error', { error: tr('stalled'), fatal: true }); } catch (x) {}
  }, 4000);
  try { Lampa.PlayerVideo.listener.follow('loadeddata', function () { stall.fired = false; stall.since = 0; stall.kicked = 0; }); } catch (x) {}

  // ---------- automatic subtitles (setting «Автосубтитры») ----------
  // voice-over in the subtitle language -> forced subtitles (if any, else none); original / another
  // language -> full ones; "original + subtitles" from a source -> that source's own subtitles.
  // Subtitles the source gives itself are preferred to OpenSubtitles. The list comes from the
  // player (source subtitles) and opensubs_menu (OpenSubtitles items carry lang / forced / os);
  // a file is downloaded only when its track is switched on, so the daily quota is spent only
  // on the one picked. Nothing found: nothing is switched on.
  // The subtitle language: the first of opensubs_menu's own (its API, with its default when nothing
  // is set); without that API, its setting read here, else the interface language
  function subsLang() {
    // the first of opensubs_menu's languages (its API, else its setting); region codes (pt-br, es-419, pt_br) kept
    var first = function (v) { return String(v || '').toLowerCase().split(/[\s,;]+/).filter(function (x) { return /^[a-z]{2,3}([-_][a-z0-9]{2,4})?$/.test(x); })[0] || ''; };
    var l = '', api = window.alc_opensubs_api;
    if (api && api.version >= 1 && typeof api.langs === 'function') {
      try { var a = api.langs(); l = isArr(a) ? first(a.join(',')) : ''; } catch (e) {}
    }
    if (!l) try { l = first(Lampa.Storage.get('opensubs_langs', '')); } catch (e) {}
    if (!l) try { l = String(Lampa.Storage.get('language', '') || ''); } catch (e) {}
    return l || 'en';
  }
  function subsIntent(v) {
    var mode = '';
    try { mode = Lampa.Storage.get('alc_auto_autosubs', 'forced'); } catch (e) {}
    if (mode !== 'forced' && mode !== 'voice') return null;
    var lang = subsLang();
    if (/^sub:/.test(v.key)) return { pick: 'source', lang: lang };
    if (mode === 'forced') return { pick: 'forced', lang: lang };
    // a voice-over in the subtitle language needs only the forced ones (foreign parts)
    return { pick: v.lang === lang ? 'forced' : 'full', lang: lang };
  }
  // a subtitle label in this language: the code itself or the language's name (from the browser,
  // in a few interface languages; e.g. "Українські" matches uk)
  var langNames = {};
  function langMatch(label, lang) {
    var l = String(label || '').toLowerCase();
    if (!l || !lang) return false;
    if (!langNames[lang]) {
      var names = [];
      try {
        if (window.Intl && Intl.DisplayNames) [uiLang(), 'en', lang].concat(prefLangs()).forEach(function (loc) {
          try { var n = new Intl.DisplayNames([loc], { type: 'language' }).of(lang); if (n) names.push(n.toLowerCase().slice(0, 4)); } catch (e) {}
        });
      } catch (e) {}
      langNames[lang] = names;
    }
    if (new RegExp('(^|[^a-z])' + lang + '([^a-z]|$)').test(l)) return true;
    return langNames[lang].some(function (n) { return n.length >= 3 && l.indexOf(n) >= 0; });
  }
  var subsAuto = { data: null, picked: false };
  // ---------- adding subtitles to Lampa's list without wiping it ----------
  // Lampa.Player.subtitles() replaces the whole list: merge with what is there (the source's own,
  // OpenSubtitles, embedded), skip duplicates (same file or same label), keep the viewer's pick.
  // Shared with other plugins: window.alc_subs_merge(items).
  var FORCED_RE = wordsRe(DATA.forced);
  function subPlain(x) {
    var o = { label: x.label, url: x.url };
    for (var k in x) if (k !== 'mode' && k !== 'selected' && k !== 'index' && k !== 'ready' && x[k] !== undefined && typeof x[k] !== 'function') o[k] = x[k];
    return o;
  }
  function subsMerge(extra) {
    var v = null;
    try { v = Lampa.PlayerVideo.video(); } catch (e) {}
    if (!v || !extra || !extra.length) return false;
    var all = (v.customSubs || []).filter(function (x) { return x && x.index !== -1; });
    var cur = all.filter(function (x) { return x.url; });
    // items without a file (tracks embedded in the stream, with their own switch) are kept as they are
    var natives = all.filter(function (x) { return !x.url; });
    var sel = cur.filter(function (x) { return x.selected; })[0];
    var byUrl = {}, byLabel = {}, list = [];
    cur.concat(extra).forEach(function (x) {
      if (!x || !x.url) return;
      var l = String(x.label || '');
      if (byUrl[x.url] || (l && byLabel[l])) return;
      byUrl[x.url] = byLabel[l] = 1;
      list.push(subPlain(x));
    });
    if (list.length === cur.length) return false;
    try { Lampa.Player.subtitles(list); } catch (e) { return false; }
    try { var nv = Lampa.PlayerVideo.video().customSubs; for (var ni = natives.length - 1; ni >= 0; ni--) nv.unshift(natives[ni]); } catch (e) {}
    if (sel) {
      try {
        (Lampa.PlayerVideo.video().customSubs || []).forEach(function (x) {
          if (x.url === sel.url) { x.selected = true; x.mode = 'showing'; }
        });
        Lampa.PlayerVideo.subsview(true);
      } catch (e) {}
    }
    return true;
  }
  window.alc_subs_merge = subsMerge;
  function ensureOtherSubs() {
    var d = null;
    try { d = Lampa.Player.playdata(); } catch (e) {}
    if (d && d.alc_xsubs && d.alc_xsubs.length) subsMerge(d.alc_xsubs);
  }
  // ask the sources that tell their subtitles only in a 'call' answer: once per play element,
  // answers cached per title; cb(true) when something was added
  function fetchOtherSubs(data, cb) {
    var jobs = (data.alc_xlazy || []).slice();
    if (!jobs.length || data.alc_xbusy) { if (cb) cb(false); return; }
    data.alc_xlazy = [];
    data.alc_xbusy = true;
    var sess = data.alc_session || {}, cache = sess.subsCache = sess.subsCache || {}, left = jobs.length, got = [];
    var base = data.alc_xsubs;   // replaced when another source takes over (otherSubs)
    jobs.forEach(function (j) {
      function done(list, busy) {
        if (!busy) cache[j.url] = list;   // (a busy server's 429s: asked again next time)
        if (data.alc_xsubs !== base) return;   // asked for the previous source: its lists are gone
        list.forEach(function (x) { if (x && x.url) got.push({ label: (x.label || '') + (j.own ? '' : ' · ' + j.src), url: x.url, alc_src: j.src }); });
        if (--left) return;
        data.alc_xbusy = false;
        var mine = isCurrent(data);
        data.alc_xsubs = (data.alc_xsubs || []).concat(got);
        var added = mine && subsMerge(data.alc_xsubs);
        if (cb) cb(added);
      }
      if (cache[j.url]) { done(cache[j.url]); return; }
      // only the answer is read (its subtitles); the stream it names is not touched
      getJSON(j.url, function (x) {
        var list = isArr(x) ? x : (x && x.subtitles) || [];
        done(isArr(list) ? list : []);
      }, function (st, x, to, text, thr) { done([], thr); }, { pri: true });
    });
  }
  // the player's subtitle button: ask the other sources now, then show the menu again with them
  function onSubsButton() {
    var data = null;
    try { data = Lampa.Player.playdata(); } catch (e) {}
    if (!data || !data.alc_xlazy || !data.alc_xlazy.filter(function (j) { return !j.own; }).length) return;
    noty(tr('subs_more'));
    fetchOtherSubs(data, function (added) {
      if (!added) return;
      // the menu is open (Lampa.Select.opened; older Lampa: the body's class): closed and opened again
      // from the panel's subtitle button - only when that button is there to open it again (else the
      // new items show next time the viewer opens the menu)
      try {
        var S = Lampa.Select, open = S && (typeof S.opened === 'function' ? S.opened() : $('body').hasClass('selectbox--open'));
        var btn = Lampa.PlayerPanel.render().find('.player-panel__subs');
        if (open && btn.length && typeof S.close === 'function') {
          S.close();
          setTimeout(function () { try { btn.trigger('hover:enter'); } catch (x) {} }, 50);
        }
      } catch (e) {}
    });
  }
  var subsBtnBound = null;
  function bindSubsButton() {
    try {
      var b = Lampa.PlayerPanel.render().find('.player-panel__subs');
      if (b.length && b[0] !== subsBtnBound) { subsBtnBound = b[0]; b.on('hover:enter', onSubsButton); }
    } catch (e) {}
  }

  // the item the automatic choice takes: own = the source's own / embedded / other sources' items,
  // os = OpenSubtitles items of the subtitle language; 'forced' = flagged (opensubs_menu marks
  // short "foreign parts only" files) or so named
  function subChoice(own, os, intent) {
    var mine = own.filter(function (x) { return x.lang === intent.lang || langMatch(x.label, intent.lang); });
    var forcedLike = function (x) { return !!x.forced || FORCED_RE.test(String(x.label || '')); };
    var full = function (x) { return !forcedLike(x); };
    return intent.pick === 'source' ? mine.filter(full)[0] || own.filter(full)[0] || mine[0] || own[0]
      : intent.pick === 'full' ? mine.filter(full)[0] || os.filter(function (x) { return !x.forced && !x.hi; })[0] || os.filter(function (x) { return !x.forced; })[0]
      : mine.filter(forcedLike)[0] || os.filter(function (x) { return x.forced; })[0];
  }
  function pickSubs(intent) {
    var v = null;
    try { v = Lampa.PlayerVideo.video(); } catch (e) {}
    var subs = v && v.customSubs;
    if (!intent || !subs || !subs.length) return false;
    var own = subs.filter(function (x) { return !x.os; });
    var quota = false;   // OpenSubtitles download limit reached (opensubs_menu): its files would stay empty
    try { quota = !!(window.alc_opensubs_quota_out && window.alc_opensubs_quota_out()); } catch (e) {}
    var os = quota ? [] : subs.filter(function (x) { return x.os && x.lang === intent.lang; });
    var t = subChoice(own, os, intent);
    if (!t) return false;
    subs.forEach(function (x) { x.selected = false; if (x !== t) x.mode = 'disabled'; });
    t.mode = 'showing';   // Lampa loads the file now
    t.selected = true;
    try { Lampa.PlayerVideo.subsview(true); } catch (e) {}
    return true;
  }
  // once per play element (again after a voice switch); not over a choice the viewer made
  function autoSubs(force) {
    var data = null;
    try { data = Lampa.Player.playdata(); } catch (e) {}
    if (!data || !data.alc_subs) return;
    if (force || subsAuto.data !== data) subsAuto = { data: data, picked: false };
    if (subsAuto.picked) return;
    var v = null;
    try { v = Lampa.PlayerVideo.video(); } catch (e) {}
    var chosen = v && v.customSubs && v.customSubs.filter(function (x) { return x.selected; })[0];
    if (chosen && !force) return;
    subsAuto.picked = pickSubs(data.alc_subs);
  }
  // opensubs_menu: its list is in (the player rebuilt the list, an earlier pick is gone with it)
  window.alc_auto_subs = function () { ensureOtherSubs(); subsAuto.picked = false; autoSubs(false); };
  // after a voice switch: opensubs_menu (if installed) puts the list back and calls alc_auto_subs;
  // when it did not (nothing of its own to show) or is not there, the source's own subtitles are put
  // back here
  var subsReload = null;
  function subsAfterReload(data) {
    try { if (subsReload) Lampa.PlayerVideo.listener.remove('loadeddata', subsReload); } catch (x) {}
    var f = subsReload = function () {
      try { Lampa.PlayerVideo.listener.remove('loadeddata', f); } catch (x) {}
      subsReload = null;
      setTimeout(function () {
        try {
          var v = Lampa.PlayerVideo.video();
          if (!isCurrent(data) || !v) return;
          if (window.alc_opensubs_menu_ready && v.customSubs && v.customSubs.length) return;   // opensubs_menu did it
          if (data.subtitles && data.subtitles.length && !(v.customSubs && v.customSubs.length)) Lampa.Player.subtitles(data.subtitles);
          ensureOtherSubs();
          autoSubs(true);
        } catch (x) {}
      }, 0);
    };
    try { Lampa.PlayerVideo.listener.follow('loadeddata', f); } catch (x) {}
  }
  try {
    Lampa.Player.listener.follow('start', function () {
      var tries = 0, d0 = null;
      try { d0 = Lampa.Player.playdata(); } catch (e) {}
      function wait() {   // the player builds its subtitle list once the video has metadata
        var v = null, data = null;
        try { if (!Lampa.Player.opened()) return; data = Lampa.Player.playdata(); v = Lampa.PlayerVideo.video(); } catch (e) { return; }
        if (d0 && data !== d0) return;   // another play by now: its own 'start' takes care of it
        if ((!v || v.readyState < 1) && ++tries < 40) { setTimeout(wait, 500); return; }
        bindSubsButton();
        ensureOtherSubs();
        // the source's own subtitles_call at once (as the built-in online plugin does)
        function then() {
          autoSubs(false);
          // automatic subtitles found nothing fitting: the other sources may have it
          if (data && data.alc_subs && !subsAuto.picked && data.alc_xlazy && data.alc_xlazy.length) {
            fetchOtherSubs(data, function (added) { if (added) { subsAuto.picked = false; autoSubs(false); } });
          }
        }
        var own = data && data.alc_xlazy ? data.alc_xlazy.filter(function (j) { return j.own; }) : [];
        if (own.length) {
          var rest = data.alc_xlazy.filter(function (j) { return !j.own; });
          data.alc_xlazy = own;
          fetchOtherSubs(data, function () { data.alc_xlazy = (data.alc_xlazy || []).concat(rest); then(); });
        } else then();
      }
      setTimeout(wait, 0);   // async: never inside Lampa's start sequence
    });
  } catch (e) {}

  // ---------- Android, external player: subtitles into its intent ----------
  // With an external player Lampa turns the play data into the player's intent inside
  // Player.play() (Lampa.Android.openPlayer -> JSON -> the app): there is no 'start', no subtitle
  // menu, and whatever is added later never reaches that player. For our plays the bridge waits
  // (at most EXT_WAIT) for what the player would otherwise get after 'start': the subtitles of the
  // other sources of this voice, the source's own subtitles_call and, with «Автосубтитры», the one
  // file the automatic choice takes (an OpenSubtitles one only when the source has none fitting:
  // the player may download every file it is given, and OpenSubtitles counts each download).
  // Nothing to ask (or not our play): the intent goes at once, as before.
  var EXT_WAIT = 1500;
  function absUrl(u) {
    try { var a = document.createElement('a'); a.href = u; return a.href || u; } catch (e) { return u; }
  }
  // Lampa's app reads url + label (required) + language of each item; with a playlist it takes
  // the subtitles of the playlist item with the same link
  function intentSubs(data, extra) {
    var have = {}, all = [], n = 0;
    var put = function (x) {
      if (!x || typeof x.url !== 'string' || !x.url) return;
      var u = absUrl(x.url);
      if (have[u]) return;
      have[u] = 1;
      var o = { url: u, label: String(x.label || '#' + (++n)) };
      var l = x.language || x.lang;
      if (l) o.language = String(l);
      all.push(o);
    };
    (isArr(data.subtitles) ? data.subtitles : []).forEach(put);
    var before = all.length;
    extra.forEach(put);
    if (all.length === before) return;
    data.subtitles = all;
    if (isArr(data.playlist)) data.playlist.forEach(function (p) { if (p && p.url === data.url) p.subtitles = all; });
  }
  // cb(items) once: what to add to the intent of this play
  function extSubs(data, cb) {
    var lazy = data.alc_xlazy || [], intent = data.alc_subs;
    // the source's own subtitles_call always; the other sources' 'call' answers with «Автосубтитры»
    // (the player shows them when automatic subtitles find nothing)
    var rest = intent ? [] : lazy.filter(function (j) { return !j.own; });
    data.alc_xlazy = intent ? lazy : lazy.filter(function (j) { return j.own; });
    fetchOtherSubs(data, function () {
      data.alc_xlazy = (data.alc_xlazy || []).concat(rest);
      var xs = data.alc_xsubs || [];
      var own = (data.subtitles || []).concat(xs);
      var quota = false;
      try { quota = !!(window.alc_opensubs_quota_out && window.alc_opensubs_quota_out()); } catch (e) {}
      var sess = data.alc_session || {};
      if (!intent || intent.pick === 'source' || subChoice(own, [], intent) || quota || typeof window.alc_opensubs_find !== 'function') return cb(xs);
      window.alc_opensubs_find(sess.card || sess.movie, data.season, data.episode, intent.lang, function (os) {
        var t = subChoice([], (os || []).filter(function (x) { return x && x.lang === intent.lang; }), intent);
        cb(t ? xs.concat([{ label: t.label, url: t.url, lang: t.lang }]) : xs);
      });
    });
  }
  // ---------- Android, external player: the whole season in its playlist ----------
  // Lampa hands the external player only the playlist items whose link is already known; ours are
  // asked when the player reaches them, so the app got the current episode alone. Before the intent
  // goes, the links of the other episodes of this voice are put in: those a source lists with the
  // episodes cost nothing; the others take one request each - only episodes after the current one
  // (at most EXT_PL_AHEAD, EXT_PL_PAR at a time, while the intent waits: at most EXT_PL_WAIT).
  // Not asked in advance: links that open a viewing session on the source's CDN (costly) and
  // episodes inside another one's file. Trade-off: a source whose links expire (signed for some
  // hours) may refuse an episode far down the list; the app stops there, as it did before.
  var EXT_PL_AHEAD = 8, EXT_PL_PAR = 4, EXT_PL_WAIT = 2500;
  // the item of episode e: the source playing now first, then the voice's other sources in rank
  // order (only episode lists already loaded: nothing is fetched for this). A link to ask ('call')
  // only from the source playing now and only when ask is set; a ready link from any.
  function extItem(pb, e, src, ask) {
    var s = pb.session, cands = rankCands(pb.voice.cands), out = null;
    cands = cands.filter(function (c) { return c.src === src; }).concat(cands.filter(function (c) { return c.src !== src; }));
    cands.some(function (c) {
      if (srcOff(c.src)) return false;
      var items = s.itemsOf(c);
      var it = items && pb.findItem(items, e, true);
      if (!it || costly(it)) return false;
      var tk = trackOf(c, it, s.movie);
      if (tk && tk.idx < 0) return false;   // this episode lacks the track
      if (it.method === 'call' && (!ask || c.src !== src)) return false;
      out = { c: c, it: it };
      return true;
    });
    return out;
  }
  // a playlist item from a resolved link: what the app reads (title, url, quality, headers, subtitles)
  // and the timeline Lampa updates when the app reports the position
  function extCell(pb, ep, r) {
    var o = { title: 'S' + pb.season + 'E' + ep.e + (ep.title ? ' · ' + ep.title : ''), url: r.url, season: pb.season, episode: ep.e,
      timeline: timelineOf(pb.session.movie, pb.season, ep.e) };
    if (r.quality && typeof r.quality === 'object' && Object.keys(r.quality).length) o.quality = r.quality;
    if (r.headers) o.headers = r.headers;
    splitReserve(o);
    setDefaultQuality(o);
    var subs = [];
    (isArr(r.subtitles) ? r.subtitles : []).forEach(function (x) {
      if (x && typeof x.url === 'string' && x.url) subs.push({ url: absUrl(x.url), label: String(x.label || '#' + (subs.length + 1)) });
    });
    if (subs.length) o.subtitles = subs;
    return typeof o.url === 'string' && o.url ? o : null;
  }
  // null: not a series of ours; else {list(): the playlist with the links known by then}; done() once
  // every link asked has answered
  function extPlaylist(data, done) {
    var pb = data.alc_pb;
    if (!pb || !pb.session || !pb.session.serial || !pb.episodes || pb.episodes.length < 2) return null;
    var cur = data.episode, eps = pb.episodes.filter(function (ep) { return !ep.shared || ep.e === cur; });
    var got = {}, jobs = [], ahead = 0;
    eps.forEach(function (ep) {
      if (ep.e === cur) return;
      var x = extItem(pb, ep.e, data.alc_src, ep.e > cur && ahead < EXT_PL_AHEAD);
      if (!x) return;
      if (x.it.method === 'call') { ahead++; jobs.push({ ep: ep, it: x.it }); return; }
      resolveItem(x.it, function (r) { if (r.url) got[ep.e] = extCell(pb, ep, r); }, function () {});
    });
    var left = jobs.length, running = 0;
    var pump = function () {
      while (running < EXT_PL_PAR && jobs.length) {
        (function (j) {
          running++;
          var fin = function () { running--; if (--left === 0) done(); else pump(); };
          resolveItem(j.it, function (r) { if (r.url) got[j.ep.e] = extCell(pb, j.ep, r); fin(); }, function (st, x, to, text, thr) {
            if (thr && !j.again) { j.again = true; jobs.push(j); running--; pump(); return; }   // a busy server: once more after the others
            fin();
          });
        })(jobs.shift());
      }
    };
    if (!left) setTimeout(done, 0); else pump();
    return {
      list: function () {
        var now = isArr(data.playlist) ? data.playlist : [];
        var mine = now.filter(function (p) { return p && p.url === data.url; })[0] || now.filter(function (p) { return p && p.episode === cur; })[0];
        var out = [];
        if (!mine) return null;
        eps.forEach(function (ep) { if (ep.e === cur) out.push(mine); else if (got[ep.e]) out.push(got[ep.e]); });
        return out.length > 1 ? out : null;
      }
    };
  }

  (function () {
    var A = window.Lampa && Lampa.Android;
    if (!A || typeof A.openPlayer !== 'function' || A.openPlayer.alc_auto) return;
    var orig = A.openPlayer;
    A.openPlayer = function (link, data) {
      var self = this, args = arguments;
      if (!data || typeof data !== 'object' || !data.alc_session) return orig.apply(self, args);
      // our session stays for our own use and out of the intent (it is large and may hold cycles)
      copyHidden(data, data);
      if (isArr(data.playlist)) data.playlist.forEach(function (p) { if (p && typeof p === 'object') copyHidden(p, p); });
      var sent = false, timer = null, got = [], pl = null, parts = 2;
      var send = function () {
        if (sent) return;
        sent = true;
        if (timer) clearTimeout(timer);
        try { var list = pl && pl.list(); if (list) data.playlist = list; } catch (e) {}
        try { intentSubs(data, got); } catch (e) {}
        try { orig.apply(self, args); } catch (e) { console.error('AlcAuto', e && e.message); }
      };
      // two parts, each with its own limit: the subtitles (EXT_WAIT), the season's links (EXT_PL_WAIT)
      var part = function () { if (--parts <= 0) send(); };
      var subsIn = false, subs = function (items) { if (subsIn || sent) return; subsIn = true; got = items || []; part(); };
      try { pl = extPlaylist(data, function () { if (!sent) part(); }); } catch (e) { pl = null; }
      if (!pl) parts--;
      try { extSubs(data, subs); } catch (e) { subs([]); }
      if (sent) return;
      timer = setTimeout(send, pl ? EXT_PL_WAIT : EXT_WAIT);
      if (pl && !subsIn) setTimeout(function () { subs([]); }, EXT_WAIT);
    };
    A.openPlayer.alc_auto = true;
  })();

  // ======================= 10. SCREEN: VOICES AND PROGRESS, TMDB NAMES, THE MODEL, THE VIEW =======================
  // Our reactions to player events run after Lampa has finished its own handling and can never
  // throw into it: Lampa calls listeners inside its close sequence without protection, so an
  // error there would leave the player without a way back.
  function later(f) {
    return function (e) { setTimeout(function () { try { f(e); } catch (x) { console.error('AlcAuto', x && x.message); } }, 0); };
  }

  // ---------- a card's voices, seasons and progress ----------

  // a remembered voice key -> the voice: exact, the same voice under another detected language,
  // a dub remembered by an older version -> the unnamed voice of that language
  function findVoice(voices, key) {
    if (!key) return null;
    key = normKey(key);
    var i;
    for (i = 0; i < voices.length; i++) if (voices[i].key === key) return voices[i];
    for (i = 0; i < voices.length; i++) if (keyMatch(voices[i], key)) return voices[i];
    if (keyName(key) === 'dub') for (i = 0; i < voices.length; i++) if (voices[i].key === 'unnamed:' + keyLang(key)) return voices[i];
    return null;
  }

  // A voice that was split by the sound comparison: the variant that has the source played last
  // (so the voice does not change in the middle of a series)
  function variantFor(voices, v, src) {
    if (!v || !src || v.cands.some(function (c) { return c.src === src; })) return v;
    var base = String(v.key).split('~')[0];
    for (var i = 0; i < voices.length; i++) {
      var x = voices[i];
      if (String(x.key).split('~')[0] === base && x.cands.some(function (c) { return c.src === src; })) return x;
    }
    return v;
  }

  // no voice remembered: the first one in a preferred language, else the first one
  function defaultVoice(voices) {
    if (prefOn()) for (var i = 0; i < voices.length; i++) if (voices[i].pref) return voices[i];
    return voices[0];
  }

  function seasonsOf(session) {
    return numKeys(session.seasons);
  }

  // Lampa timelines: the furthest episode of a season with progress {e, pct}, or null.
  function furthestWatched(movie, s, max) {
    var last = 0, pct = 0;
    for (var e = 1; e <= (max || 200); e++) {
      var tl = timelineOf(movie, s, e);
      if (tl && tl.percent > 0) { last = e; pct = tl.percent; }
      else if (e - last > 30) break;
    }
    return last ? { e: last, pct: pct } : null;
  }
  // the latest of these seasons with any progress, or 0
  function seasonWithProgress(movie, seasons) {
    for (var i = seasons.length - 1; i >= 0; i--) if (furthestWatched(movie, seasons[i], 30)) return seasons[i];
    return 0;
  }

  // Episodes of a voice that some source already returned: {episode: name, or null when the
  // episode exists only inside a multi-episode file}.
  function voiceEpisodesOf(session, voice) {
    var map = {};
    voice.cands.forEach(function (c) {
      var rs = itemRanges(session.itemsOf(c));
      for (var j = 0; j < rs.length; j++) {
        var r = rs[j];
        for (var e = r[0]; e <= r[1]; e++) {
          if (e === r[0]) { if (!map[e]) map[e] = r[2]; }
          else if (!(e in map)) map[e] = null;
        }
      }
    });
    return map;
  }
  // a page's items as [first episode, last, name], read once per page (the model asks again after every
  // answer of any source: a long anime's pages are 1000+ items, each through two regexps)
  function itemRanges(items) {
    if (!items) return [];
    if (items.alc_rng && items.alc_rng.n === items.length) return items.alc_rng;
    var out = items.map(function (it, i) { var r = episodeRange(it, i); return [r[0], r[1], it.name || '']; });
    out.n = items.length;
    items.alc_rng = out;
    return out;
  }
  // TMDB episodes of a season. TMDB answers "<word> 3" when an episode has no title in the
  // interface language (e.g. Bluey season 3, later Pokémon seasons). Such titles - and titles in a
  // script the interface language does not use - are replaced by the English title, then by the
  // original-language one only if that is readable in the interface script; else "Episode N" stays.
  function goodName(n, ui) { return !!n && !PLACEHOLDER.test(String(n).trim()) && (!scriptOf(n) || scriptOf(n) === ui); }
  function tmdbSeasonOf(movie, season, cb) {
    var id = tmdbId(movie);
    if (typeof id !== 'number' || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) { cb([]); return; }
    // Lampa's TMDB source keeps the callbacks of every call it made (until its clear()): they get only
    // this box, emptied on the answer (it held the closed screen's model and with it all its cards)
    var box = { cb: cb };
    function take() { var f = box.cb; box.cb = null; return f || function () {}; }
    try {
      Lampa.Api.sources.tmdb.get('tv/' + id + '/season/' + season, {}, function (d) { fillNames(movie, id, season, (d && d.episodes) || [], take()); }, function () { take()([], true); });
    } catch (e) { take()([], true); }
  }
  // The same for the descriptions: one missing in the interface language is taken in English (TMDB has
  // few Ukrainian ones for older shows), then in the original language if it is readable
  // TMDB text as the theme shows it (snack_tv.plainText: no emoji / zero-width marks, boxes on TVs), else trimmed
  function plainText(x) {
    try { if (window.snack_tv && window.snack_tv.plainText) return window.snack_tv.plainText(x); } catch (e) {}
    return String(x == null ? '' : x).trim();
  }
  function noText(e) { return !plainText(e.overview); }
  function fillNames(movie, id, season, eps, cb) {
    var ui = uiScript();
    // the episode's title is not readable here / it has no description (and none was found yet)
    var wantName = function (e) { return !goodName(e.name, ui) && !e.alc_named; };
    var wantText = function (e) { return noText(e) && !e.alc_text; };
    var need = function (e) { return wantName(e) || wantText(e); };
    var bad = eps.filter(need);
    if (!bad.length) { cb(eps); return; }
    var langs = ['en-US'], orig = movie.original_language;
    if (orig && orig !== 'en') langs.push(orig);
    (function next(i) {
      bad = bad.filter(need);
      if (!bad.length || i >= langs.length) {
        // nothing readable anywhere: our own "Episode N" instead of a title in a foreign script
        bad.forEach(function (e) { if (wantName(e) && e.name && !PLACEHOLDER.test(String(e.name).trim())) e.name = tr('episode_n', e.episode_number); });
        cb(eps); return;
      }
      var url;
      try { url = Lampa.TMDB.api('tv/' + id + '/season/' + season + '?api_key=' + Lampa.TMDB.key() + '&language=' + langs[i]); } catch (e) { cb(eps); return; }
      $.ajax({ url: url, dataType: 'json', timeout: 6000,
        success: function (d) {
          var alt = {};
          ((d && d.episodes) || []).forEach(function (x) { alt[x.episode_number] = x; });
          bad.forEach(function (e) {
            var x = alt[e.episode_number] || {}, n = x.name, o = String(x.overview || '').trim();
            // English is the agreed fallback in any interface language; others must be readable
            if (wantName(e) && n && !PLACEHOLDER.test(String(n).trim()) && (langs[i] === 'en-US' || scriptOf(n) === ui)) { e.name = n; e.alc_named = true; }
            if (noText(e) && plainText(o) && (langs[i] === 'en-US' || scriptOf(o) === ui)) { e.overview = o; e.alc_text = true; }
          });
          next(i + 1);
        },
        error: function () { next(i + 1); } });
    })(0);
  }

  // ---------- the screen's model: seasons × voices -> episodes (no DOM) ----------
  // A series is watched in ONE voice (the remembered one, alc_auto_choice; never replaced quietly). Every
  // season is shown at once: what the sources know about it (cheap: which sources list the season, TMDB's
  // episode count) at once, the exact episodes per voice only for the season on screen and its
  // neighbours, loaded lazily through the session's queue (at most 3 pages at a time, the season on
  // screen first; all of a series' voice pages is ~150 requests). An episode the voice lacks is shown with the voices that have
  // it; the viewer decides. A movie: its voices only (all known after the search).
  // What is derived (the table, the voice per season, indexes) is kept in memo until the data changes
  // (stamp: the session's version, the voice, the queue …). No polling: the session tells what arrives,
  // and the model sets a timer for its next deadline (see autoPick). onChange: something to draw.
  function TitleModel(movie, onChange) {
    this.movie = movie;
    this.serial = isSerial(movie);
    this.onChange = onChange || function () {};
    this.onTmdb = function () {};                // TMDB's season s arrived (the view repaints that row)
    this.session = null;
    this.key = getChoice(movie.id).voice || '';   // the voice of the title ('' = none yet: see autoPick)
    this.pin = ''; this.pinKey = '';             // a source fixed by hand here (see pinFor)
    this.tmdb = {}; this.tmdbIdx = {};           // season -> TMDB episodes (null while asked), by number
    this.tmdbQ = []; this.tmdbRun = 0; this.tmdbTry = {};   // seasons to ask TMDB for (see tmdbOf)
    this.tmdbNew = false;                        // a season arrived since the last redraw of everything
    this.focus = 0;                              // the season on screen
    this.start = 0;                              // the season the screen opened on (the voice is picked there)
    this.t0 = Date.now(); this.firstVoice = 0;
    this.asked = {};                             // seasons whose pages were asked to pick the voice
    this.memo = {}; this.memoStamp = ''; this.ver = 0; this.timer = 0;
    this.next = null;                            // nextUp(), until a timeline or the choice changes
    this.near = [];                              // the other seasons whose rows are on screen (see seen)
    this.paused = false;                         // behind another screen (see pause)
    this.none = null;                            // why the search found nothing [title, text]: TMDB's episodes only
    this.alive = true;
  }
  TitleModel.prototype.close = function () {
    this.alive = false; clearTimeout(this.timer);
    this.detach();
  };
  // the session goes (the search ended with nothing, another one replaces it, the screen closes): what
  // this screen told it goes too (its rows on screen; the session is kept for a while for other screens)
  TitleModel.prototype.detach = function () {
    if (this.session) this.session.release(this);
    this.session = null;
  };
  // the search found nothing: why (the screen shows it, every episode disabled)
  TitleModel.prototype.fail = function (why) { this.detach(); this.none = why; this.touch(); };
  // a deadline: the view is told then (one timer: the nearest one wins)
  TitleModel.prototype.wake = function (ms) {
    var self = this, at = Date.now() + ms;
    if (this.timer && this.wakeAt <= at && this.wakeAt > Date.now()) return;
    clearTimeout(this.timer);
    this.wakeAt = at;
    this.timer = setTimeout(function () { self.timer = 0; if (self.alive) { self.touch(); self.onChange(); } }, ms);
  };
  // what the derived values depend on; a change drops them (see fresh); ver: a change of our own
  TitleModel.prototype.stamp = function () {
    var s = this.session;
    return [s ? s.ver || 0 : -1, s ? Object.keys(s.inflight).length : 0, s && s.rootsPending() ? 1 : 0, prefVer, this.ver,
      this.key, this.pin, this.focus, s ? s.queueSize() : 0].join('|');
  };
  // true when the derived values were dropped (something changed since the last call)
  TitleModel.prototype.fresh = function () {
    var st = this.stamp();
    if (st === this.memoStamp) return false;
    this.memo = {}; this.memoStamp = st;
    return true;
  };
  TitleModel.prototype.touch = function () { this.ver++; this.memo = {}; };
  TitleModel.prototype.attach = function (session) {
    if (this.session !== session) this.detach();
    this.session = session; this.none = null;
    var f = this.focus;
    this.focus = 0;
    if (this.serial && f) this.show(f);   // the season on screen gets its pages now (and the claim)
    else this.claim();
    this.touch();
  };
  // the session's season on screen and rows on screen are this screen's (when it is in front)
  TitleModel.prototype.claim = function () {
    if (this.session && !this.paused) this.session.claim(this, this.focus, this.near);
  };
  // the viewer's choice changed elsewhere (the player's voice list, the quick start's menu)
  TitleModel.prototype.syncChoice = function () {
    var ch = getChoice(this.movie.id);
    if (ch.voice && ch.voice !== this.key) { this.key = ch.voice; this.pin = ''; this.pinKey = ''; }
    this.next = null;
    this.touch();
  };
  // ---- seasons ----
  // the card's own facts (Lampa passes the full TMDB card): {n: {eps, soon}} for seasons > 0
  TitleModel.prototype.cardSeasons = function () {
    if (this.card) return this.card;
    var out = {}, list = [], now = Date.now();
    (this.movie.seasons || []).forEach(function (x) {
      var n = parseInt(x.season_number, 10), air = airTime(x.air_date);
      if (!(n > 0) || (!air && !x.episode_count)) return;   // specials; only announced: TMDB knows nothing yet
      out[n] = { eps: x.episode_count || 0, soon: air > now ? x.air_date : '' };
      list.push(n);
    });
    if (!list.length) seasonRange(this.movie).forEach(function (n) { out[n] = { eps: 0, soon: '' }; });
    return (this.card = out);
  };
  // every season: the card's and the sources' ones
  TitleModel.prototype.seasons = function () {
    if (this.memo.S) return this.memo.S;
    var seen = {}, list = [];
    numKeys(this.cardSeasons()).concat(this.session ? seasonsOf(this.session) : []).forEach(function (n) { if (!seen[n]) { seen[n] = 1; list.push(n); } });
    return (this.memo.S = list.sort(function (a, b) { return a - b; }));
  };
  // the sources that list season s (not switched off)
  TitleModel.prototype.srcCount = function (s) {
    var l = this.session && this.session.seasons[s];
    return l ? l.filter(function (c) { return !srcOff(c.src); }).length : 0;
  };
  // the season pages of s have all answered
  TitleModel.prototype.loaded = function (s) { return !!this.session && !!this.session.seasonData[s] && !this.session.pending(s); };
  // nothing more to come for s: its pages and the voice pages asked for it
  TitleModel.prototype.exact = function (s) {
    var se = this.session;
    if (se && !se.rootsPending() && !se.seasons[s]) return true;   // no source lists it: nothing to come
    return this.loaded(s) && !se.queued(s);
  };
  // TMDB's episodes of s (titles, descriptions, stills; null until they are here). Every season is
  // asked in the background, 2 at a time, those nearest the season on screen first; a failed answer
  // is asked again twice (then the season stays without them) - not for a season the card does not
  // list (only a source numbers it so): TMDB answers 404 there, and Lampa's TMDB source does not say
  // which failure it was. A queue of its own, not Session.want:
  // the model asks TMDB before a session exists (and when the search finds nothing)
  var TMDB_PAR = 2, TMDB_TRIES = 3;
  // queued only: the caller pumps once all are in (so the order is by the focus, not by the calls)
  TitleModel.prototype.tmdbOf = function (s) {
    if (this.tmdb[s] === undefined) { this.tmdb[s] = null; this.tmdbQ.push(s); }
    return this.tmdb[s];
  };
  TitleModel.prototype.tmdbPump = function () {
    var f = this.focus;
    this.tmdbQ.sort(function (a, b) { return Math.abs(a - f) - Math.abs(b - f) || a - b; });
    while (this.tmdbRun < TMDB_PAR && this.tmdbQ.length) this.tmdbAsk(this.tmdbQ.shift());
  };
  TitleModel.prototype.tmdbAsk = function (s) {
    var self = this;
    this.tmdbRun++;
    tmdbSeasonOf(this.movie, s, function (eps, failed) {
      self.tmdbRun--;
      if (!self.alive) return;
      var n = self.tmdbTry[s] = (self.tmdbTry[s] || 0) + 1;
      var card = self.cardSeasons();
      if (failed && n < TMDB_TRIES && (card[s] || !numKeys(card).length)) setTimeout(function () { if (self.alive) { self.tmdbQ.push(s); self.tmdbPump(); } }, 2000 * n);
      else {
        var idx = {};
        eps.forEach(function (t) { idx[t.episode_number] = t; });
        self.tmdb[s] = eps; self.tmdbIdx[s] = idx;
        self.dropSeason(s);
        self.tmdbNew = true;
        self.onTmdb(s);
      }
      self.tmdbPump();
      // one redraw of everything when TMDB is done (the rest that may read its data: the intent, «soon»…)
      if (self.tmdbNew && !self.tmdbRun && !self.tmdbQ.length) { self.tmdbNew = false; self.touch(); self.onChange(); }
    });
  };
  // what is derived from TMDB's season s: its episode numbers, its title line, its cells
  TitleModel.prototype.dropSeason = function (s) {
    var m = this.memo, c = 'c' + s + ':';
    delete m['n' + s]; delete m['i' + s];
    for (var k in m) if (k.indexOf(c) === 0) delete m[k];
  };
  TitleModel.prototype.tmdbEp = function (s, e) { var i = this.tmdbIdx[s], next=this.movie.next_episode_to_air;return (i && i[e]) || (next && next.season_number===s && next.episode_number===e ? next : null); };
  // ---- voices ----
  TitleModel.prototype.voicesAt = function (s) { return this.session && (s === 0 || this.session.seasonData[s]) ? this.session.voices(s) : []; };
  // the title's voice in season s (the variant whose sources played last, see variantFor), or null
  TitleModel.prototype.voiceAt = function (s) {
    var k = 'v' + s;
    if (k in this.memo) return this.memo[k];
    var vs = this.key ? this.voicesAt(s) : [];
    return (this.memo[k] = this.key ? variantFor(vs, findVoice(vs, this.key), getChoice(this.movie.id).src) : null);
  };
  // every voice of the title: the season on screen first, then the other seasons loaded
  TitleModel.prototype.allVoices = function () {
    if (this.memo.all) return this.memo.all;
    var self = this, out = [], seen = {};
    var order = this.serial ? [this.focus].concat(this.seasons().filter(function (n) { return n !== self.focus; })) : [0];
    order.forEach(function (s) {
      self.voicesAt(s).forEach(function (v) {
        if (seen[v.key]) return;
        seen[v.key] = 1; out.push(v);
      });
    });
    return (this.memo.all = out);
  };
  // the title's voice as one object for the whole title (its label), or null while there is none yet
  TitleModel.prototype.voice = function () {
    if (!this.key) return null;
    var vs = this.allVoices(), v = findVoice(vs, this.key);
    if (v) return v;
    var seen = seenVoices()[this.key];   // remembered, but no source of this title has it (so far)
    return { key: this.key, label: (seen && seen.l) || keyName(this.key) || this.key, lang: keyLang(this.key) || 'und', cands: [], absent: true };
  };
  TitleModel.prototype.episodesOf = function (s, v) {
    var k = 'e' + s + ':' + v.key + '#' + v.cands.length;
    return this.memo[k] || (this.memo[k] = voiceEpisodesOf(this.session, v));
  };
  // season s: episode -> the other voices that have it (not the title's voice), one pass over them
  TitleModel.prototype.others = function (s) {
    var k = 'o' + s;
    if (this.memo[k]) return this.memo[k];
    var self = this, v = this.voiceAt(s), idx = {};
    this.voicesAt(s).forEach(function (x) { if (x !== v) for (var e in self.episodesOf(s, x)) (idx[e] = idx[e] || []).push(x); });
    return (this.memo[k] = idx);
  };
  // ---- the table ----
  // season s, episode e: {state: on | other | wait | soon | none, voice, others: [voices]}
  TitleModel.prototype.cell = function (s, e) {
    var k = 'c' + s + ':' + e;
    if (this.memo[k]) return this.memo[k];
    var v = this.voiceAt(s), eps = v ? this.episodesOf(s, v) : null, out = { state: 'none', voice: v, others: [] };
    if (this.none) { if (airTime((this.tmdbEp(s, e) || {}).air_date) > Date.now()) out.state = 'soon'; }
    else if (eps && e in eps) out.state = 'on';
    else {
      var t = this.tmdbEp(s, e);
      out.others = this.others(s)[e] || [];
      if (t && airTime(t.air_date) > Date.now()) out.state = 'soon';
      else if (out.others.length && this.key) out.state = 'other';
      else if (!this.exact(s) || !this.key) out.state = 'wait';
    }
    return (this.memo[k] = out);
  };
  // the episode numbers of a season: TMDB's, and those the title's voice has beyond them
  TitleModel.prototype.episodes = function (s) {
    var k = 'n' + s;
    if (this.memo[k]) return this.memo[k];
    var nums = {}, v = this.voiceAt(s), card = this.cardSeasons()[s];
    if (this.tmdb[s]) this.tmdb[s].forEach(function (t) { nums[t.episode_number] = 1; });
    else for (var i = 1; card && i <= card.eps; i++) nums[i] = 1;   // TMDB's season not asked yet: the card's count
    if (v) for (var e in this.episodesOf(s, v)) nums[e] = 1;
    // a season neither TMDB nor the card lists, no voice for the title yet: what any voice has there
    // (the row shows; the voice is picked from them)
    else if (!this.key && !this.tmdb[s] && !card) {
      var self = this;
      this.voicesAt(s).forEach(function (x) { for (var e in self.episodesOf(s, x)) nums[e] = 1; });
    }
    return (this.memo[k] = numKeys(nums).filter(function (n) { return n > 0; }));
  };
  // an episode's title: TMDB's, else the source's own (episodes TMDB numbers differently, e.g. anime
  // counted through all seasons) when it is more than "Episode N"; '' = none readable
  TitleModel.prototype.title = function (s, e) {
    var t = this.tmdbEp(s, e), v = this.voiceAt(s), own = v ? this.episodesOf(s, v)[e] : '';
    if (t && t.name && !PLACEHOLDER.test(String(t.name).trim())) return t.name;
    return own && !/^[^\d]{0,24}\d{1,4}\.?$/.test(String(own).trim()) ? own : '';
  };
  // what the season's title line says: {count, have, voice: label, best: label of the voice that
  // covers the most of the rest, more: how many others, soon: date, nosrc}
  TitleModel.prototype.seasonInfo = function (s) {
    var k = 'i' + s;
    if (this.memo[k]) return this.memo[k];
    var card = this.cardSeasons()[s] || {}, total = this.episodes(s).length || card.eps || 0;
    var out = { count: total, srcs: this.srcCount(s), soon: card.soon || '', exact: this.loaded(s), nosrc: false };
    if (!out.srcs && (this.none || (this.session && !this.session.rootsPending()))) out.nosrc = true;
    if (out.exact) {
      var v = this.voiceAt(s), mine = v ? this.episodesOf(s, v) : {}, idx = this.others(s), n = {}, list = [];
      out.have = v ? Object.keys(mine).length : 0;
      out.voice = v ? v.label : (this.voice() || {}).label || '';
      // per voice: how many of the episodes the title's voice lacks it has
      for (var e in idx) if (!(e in mine)) idx[e].forEach(function (x) { if (x.rank >= 5) return; if (!n[x.key]) { n[x.key] = 0; list.push(x); } n[x.key]++; });
      list.sort(function (a, b) { return n[b.key] - n[a.key]; });
      if (list.length) { out.best = list[0].label; out.more = list.length - 1; }
    }
    return (this.memo[k] = out);
  };
  // ---- choosing ----
  // the title's voice (src: a source fixed by hand, '' = automatic)
  TitleModel.prototype.setPin = function (voice, src) {
    this.key = voice.key; this.pin = src || ''; this.pinKey = voice.key; this.next = null;
    saveChoice(this.movie.id, { voice: voice.key, pin: src || '' });
    this.touch();
  };
  TitleModel.prototype.setVoice = function (v) { this.setPin(v, ''); };
  // Source of a voice: automatic (best working one, the others as fallback) or a fixed one
  // (remembered per title; the others are still the fallback when it fails)
  TitleModel.prototype.pinFor = function (voice) {
    if (!voice) return '';
    if (this.pinKey === voice.key) return this.pin || '';
    var ch = getChoice(this.movie.id);
    return ch.voice === voice.key && ch.pin && voice.cands.some(function (c) { return c.src === ch.pin; }) ? ch.pin : '';
  };
  // No voice remembered: the best one is picked where the screen opened (once; not saved until
  // something plays): in the top group (preferred languages / favourites) the one with the most
  // episodes of that season (up to 5 are checked), the next group only when the top one has none.
  // Waits for the sources like before: a preferred-language voice ROOT_WAIT after the first voice,
  // else SOFT_WAIT; with none of them anything after VOICE_WAIT.
  TitleModel.prototype.autoPick = function () {
    if (this.key) return;
    var self = this, s = this.serial ? this.pickSeason() : 0, vs = this.voicesAt(s), now = Date.now();
    if (!vs.length) return;
    if (!this.firstVoice) this.firstVoice = now;
    var pending = !this.session || this.session.pending(s), v = null;
    if (!this.serial) {
      v = defaultVoice(vs);
      if (pending && now - this.firstVoice < (v.pref ? ROOT_WAIT : SOFT_WAIT)) v = null;
    } else {
      var count = function (x) { return Object.keys(self.episodesOf(s, x)).length; };
      var best = null, any = null, checking = false;
      [0, 1].some(function (t) {
        var top = null, topN = 0;
        vs.filter(function (x) { return x.rank < 5 && (x.pref || x.fav ? 0 : 1) === t; }).slice(0, 5).forEach(function (x) {
          if (self.wantCands(s, x, 0)) checking = true;
          var n = count(x);
          if (n > topN) { topN = n; top = x; }
        });
        if (top) { best = top; return true; }
        return checking;   // still checking this group: do not look further yet
      });
      for (var a = 0; a < vs.length && !any; a++) if (count(vs[a])) any = vs[a];
      var waited = now - this.firstVoice > (best && best.pref ? ROOT_WAIT : SOFT_WAIT);
      if (best && ((!pending && !checking) || waited)) v = best;
      else if (!best && any && now - this.t0 > VOICE_WAIT) v = any;
      else if (!pending && !checking && !this.session.queued(s)) v = defaultVoice(vs);
    }
    if (v) { this.key = v.key; this.touch(); return; }
    // not yet: look again when the next wait is over (the session tells about the answers)
    var due = [this.firstVoice + ROOT_WAIT, this.firstVoice + SOFT_WAIT, this.t0 + VOICE_WAIT].filter(function (t) { return t > now; });
    if (due.length) this.wake(Math.min.apply(null, due) - now + 50);
  };
  // where the voice is picked: the season the screen opened on, else the nearest one the sources list
  // (its pages are asked)
  TitleModel.prototype.pickSeason = function () {
    var se = this.session, st = this.start;
    if (!se || se.seasons[st] || se.rootsPending()) return st;
    var list = seasonsOf(se).sort(function (a, b) { return Math.abs(a - st) - Math.abs(b - st) || b - a; });
    var s = list[0] || st, self = this;
    if (s !== st && !se.seasonData[s] && !this.asked['L' + s]) { this.asked['L' + s] = 1; se.loadSeason(s, function () { if (self.alive) self.onChange(); }); }
    return s;
  };
  // ---- loading ----
  // the voice pages of x in season s that are not loaded yet are asked (lim: at most that many,
  // 0 = all); true while some are on the way
  TitleModel.prototype.wantCands = function (s, x, pri, lim) {
    var self = this, session = this.session, waiting = false, n = 0;
    x.cands.forEach(function (c) {
      var k = cacheKey(c);
      if (session.itemsOf(c) || !c.url || session.emptyVoice[k] || session.candFailed(c)) return;
      if (lim && n >= lim) return;
      n++; waiting = true;
      session.want('c' + k, s, pri, function (done) { session.candItems(c, function () { done(); }); });
    });
    return waiting;
  };
  // a source may play another voice under the name it lists: the title's voice is checked once per
  // source (its first episode's link; not costly sources)
  TitleModel.prototype.wantChecks = function (s, v) {
    var self = this, session = this.session;
    v.cands.forEach(function (c) {
      var k = cacheKey(c), items = session.itemsOf(c);
      if (!items || !items[0] || items[0].method !== 'call' || costly(items[0]) || session.checked[k] || session.badVoice[k]) return;
      c.items = items;
      session.want('v' + k, s, 1, function (done) { session.verifyCand(c, v.key, function () { done(); }); });
    });
  };
  // season s is on screen: its pages (all sources at once), its neighbours' (3 at a time), TMDB
  TitleModel.prototype.show = function (s) {
    if (!this.serial || !s) return;
    if (!this.start) this.start = s;
    if (s === this.focus) return;
    this.focus = s;
    var self = this, session = this.session;
    this.tmdbPump();   // TMDB's queue: the seasons nearest this one first
    if (!session) return;
    this.claim();
    // (its neighbours' pages: plan(), after this change)
    session.loadSeason(s, function () { if (self.alive) self.onChange(); });
  };
  // another screen over this one (maybe of the same title): its rows wait; in front again: they count,
  // everything near is planned afresh
  TitleModel.prototype.pause = function () {
    this.paused = true;
    if (this.session) this.session.release(this);
  };
  TitleModel.prototype.resume = function () {
    this.paused = false;
    if (!this.session || !this.serial) return;
    this.claim();
    this.touch();
  };
  // the rows of these seasons are on screen (the view tells after a scroll / a redraw): they are
  // planned like the neighbours of the season on screen; those that left are not (their queued jobs go)
  TitleModel.prototype.seen = function (list) {
    if (list.join(',') === this.near.join(',')) return;
    this.near = list;
    if (!this.session || this.paused) return;
    this.claim();
    this.plan();
  };
  // after a change: what is still missing near the season on screen and in the rows on screen is asked -
  // their pages (a source listing a season later too) and the series' voice's pages there; the season on
  // screen also a page or two of every other voice (which of them has the episodes the voice lacks)
  TitleModel.prototype.plan = function () {
    var self = this, session = this.session, list = [], f = this.focus;
    if (!session || !this.serial || this.paused) return;
    [f, f + 1, f - 1].concat(this.near).forEach(function (s) { if (s > 0 && list.indexOf(s) < 0) list.push(s); });
    list.forEach(function (s) {
      var data = session.seasonData[s], v = data ? self.voiceAt(s) : null, all = data && s === f ? self.voicesAt(s) : [];
      session.wantSeason(s);   // (the season on screen: asked by loadSeason at once; a source listing it later: here)
      if (!data) return;
      if (v) { self.wantCands(s, v, 0); self.wantChecks(s, v); }
      // the other voices: enough to know which episodes they have (one or two pages each)
      all.forEach(function (x) {
        if (x === v || x.cands.some(function (c) { return session.itemsOf(c); })) return;
        self.wantCands(s, x, 2, 2);
      });
    });
  };
  // one step after a change (or a deadline): {changed: anything to draw again}
  TitleModel.prototype.update = function () {
    var changed = this.fresh();
    this.autoPick();
    if (changed) this.plan();
    changed = this.fresh() || changed;   // a voice picked / pages queued just now
    return { changed: changed };
  };
  // ---- next to watch ----
  // what «Continue» plays: Autopilot's plan (the remembered episode, else the furthest watched; kept
  // until a timeline or the choice changes: the plan reads up to 200 timelines); a season no source /
  // TMDB knows: the first one
  TitleModel.prototype.nextUp = function () {
    var list = this.seasons(), k = list.join(',');
    if (this.next && this.next.k === k) return this.next;
    var p = quickPlan(this.movie), tl = timelineOf(this.movie, p.season, p.episode);
    var n = list.length && list.indexOf(p.season) < 0 ? { s: list[0], e: 1, fresh: true }
      : { s: p.season, e: p.episode, fresh: !(tl && tl.percent > 0) && p.episode === 1 && !getChoice(this.movie.id).episode };
    n.k = k;
    return (this.next = n);
  };
  TitleModel.prototype.watchedChanged = function () { this.next = null; };
  // the episodes of voice v in season s for the player's playlist
  TitleModel.prototype.playlist = function (s, v) {
    var self = this;
    return playlistOf(this.episodesOf(s, v), function (e) { return { name: self.title(s, e), runtime: (self.tmdbEp(s, e) || {}).runtime }; });
  };
  // a voice's episodes {e: name | null (inside a multi-episode file)} -> the player's playlist cells;
  // info(e) -> {name, runtime}
  function playlistOf(avail, info) {
    return numKeys(avail).map(function (e) {
      var t = info(e) || {};
      return { e: e, title: t.name || '', runtime: t.runtime, shared: avail[e] === null };
    });
  }
  // the best quality any source of v offers (from the items it gave), 0 = unknown
  function voiceQuality(v) {
    var q = 0;
    v.cands.forEach(function (c) { if (c.items) q = Math.max(q, itemsQuality(c.items)); });
    return q;
  }
  function qualityLabel(q) { return q >= 2160 ? '4K' : q ? q + 'p' : ''; }
  function runtimeText(min) {
    min = parseInt(min, 10) || 0;
    return !min ? '' : min >= 60 ? (min % 60 ? tr('hm', Math.floor(min / 60), min % 60) : tr('h', min / 60)) : tr('min', min);
  }
  // the progress of an episode still being watched (0: none, or watched)
  function progressPct(tl) { return tl && tl.percent > 0 && tl.percent < WATCHED ? tl.percent : 0; }

  // ---------- the screen: one page, rows from top to bottom ----------
  // Series: a compact head (art, logo / title, the white «Continue · S2, E5», a round «⋯»), the voice
  // chips (one voice for the whole series), then every season as a row of episode cards. Movie: the
  // head (the white «Watch» with the progress) and every voice as a line. The «Закусь TV» theme
  // restyles it by its classes (alc-ap*, alc-chip, alc-ep*); without it, a plain version of the same.
  // Remote: up / down from row to row (each row remembers its card), left / right inside a row
  // (Lampa's Navigator over that row's items). Long seasons draw their cards lazily (a window around
  // what is seen, grown as the focus or the finger moves on).
  var ROW_ALL = 60;      // up to this many episodes a row draws all its cards; longer: a window
  var ROW_STEP = 30;     // the window grows by this many cards
  // a season the screen neither opens on nor has had the focus: its first cards only (a long anime is
  // 20+ seasons: all their cards were 10 000+ nodes and 12 000 listeners, seconds of work on a TV box);
  // the rest come as the focus or the finger gets near, as in a long season's window
  var ROW_FIRST = 12;
  var CHECK_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // «nothing found»: a magnifier with a dash
  var NF_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20 20M7.8 10.5h5.4"/></g></svg>';
  var MORE_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>';
  function AutoView(object) {
    var self = this, movie = object.movie || {}, series = isSerial(movie), alive = true;
    var html = $('<div class="alc-ap-page"></div>');
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var root = $('<div class="alc-ap' + (series ? ' alc-ap--series' : ' alc-ap--movie') + '"></div>');
    var model = new TitleModel(movie, function () { soon(); });
    // TMDB's season arrived: its row only (the model has dropped what it derived from it); a redraw of
    // everything is due anyway when the model's stamp moved or the screen still aims at that season
    model.onTmdb = function (s) {
      if (!alive || !seasonRows[s]) return;
      if ((target && target.s === s) || model.stamp() !== model.memoStamp) soon();
      else paintRow(seasonRows[s]);
    };
    var session = null, gen = 0, rt = 0, vt = 0;
    var menuOpen = false, deadSig = '', rs = 0;   // «nothing found»: «Sources ›» open, what it was found with (see onSrc)
    var intent = null;      // a tap that waits for its data: {s, e, alive, timer} (see waitFor)
    var rows = [], cur = null, head = null, chips = null, seasonRows = {}, voiceRows = null, msgBox = null, msgRow = null;
    var target = null;      // the next episode to watch, until the screen has focused it
    var tvScroll = false;   // Lampa scrolls by the remote's focus (TVs); touch screens: the finger

    this.create = function () { return this.render(); };
    this.render = function () { return html; };

    // ---- the frame ----
    this.initialize = function () {
      try { window.alc_auto_debug.model = model; } catch (e) {}   // for test harnesses
      addCss();
      try { tvScroll = !!Lampa.Platform.screen('tv'); } catch (e) {}
      if (!tvScroll) root.addClass('alc-ap--touch');   // (no focus look under the finger: a tap acts)
      // touch: the season in the middle of the screen is the one on screen (its data, its stills)
      if (series) scroll.onScroll = function () { clearTimeout(vt); vt = setTimeout(onPageScroll, 120); };
      scroll.minus();
      scroll.body().addClass('alc-ap-body');
      scroll.append(root);
      html.append(scroll.render());
      head = drawHead();
      rows.push(head);
      if (series) {
        chips = { kind: 'chips', el: $('<div class="alc-ap__chips"></div>'), sig: '' };
        chips.scroll = new Lampa.Scroll({ horizontal: true, over: true, nopadding: true });
        chips.el.append(chips.scroll.render());
        root.append(chips.el);
        rows.push(chips);
        target = model.nextUp();
        model.show(target.s);
      } else {
        voiceRows = { kind: 'voices', el: $('<div class="alc-ap__voices"></div>'), sig: '' };
        Lampa.Listener.follow('resize_end', onResize);
        root.append(voiceRows.el);
        rows.push(voiceRows);
      }
      // right under the head: a long list of episodes must not push «nothing found» off the screen
      msgBox = $('<div class="alc-ap__msg hide"></div>');
      head.el.after(msgBox);
      try { Lampa.Player.listener.follow('destroy', onPlayerClosedLater); } catch (e) {}
      search();
      refresh();
    };
    // the search (again: it found nothing and the sources / the server changed since, see onSrc)
    function search() {
      var my = ++gen, sig = srcSig();
      obtainSession(movie, function (s, why) {
        if (my !== gen) return;
        if (s) useSession(s);
        else {
          if (session) session.unlisten(soon);
          session = null; model.fail(why || [tr('not_found'), tr('nf_title')]);
          deadSig = sig; listDead(true);
          if (srcSig() !== sig) onSrc();   // (changed while it ran)
        }
        refresh();
      }, function (s) {
        // the search is still running: show what has been found so far
        if (my !== gen) return;
        useSession(s);
      });
    }
    function useSession(s) {
      if (session === s) return;
      if (session) session.unlisten(soon);
      session = s;
      s.listen(soon);
      model.attach(s);
    }
    // «nothing found» and the sources / the server changed (in «Sources ›» or the settings): searched again
    // a moment after the last change, once the menu is closed and the screen is in front again
    function onSrc() { clearTimeout(rs); rs = setTimeout(retry, 800); }
    function retry() {
      clearTimeout(rs); rs = 0;
      if (!alive || !model.none || menuOpen || model.paused || srcSig() === deadSig) return;
      listDead(false);
      search();
      refresh();
    }
    function listDead(on) {
      var i = deadScreens.indexOf(onSrc);
      if (on && i < 0) deadScreens.push(onSrc);
      if (!on && i >= 0) deadScreens.splice(i, 1);
    }
    function soon() { clearTimeout(rt); rt = setTimeout(refresh, 30); }

    // ---- the head: art, logo / title, the white button, «⋯» ----
    function drawHead() {
      var el = $('<div class="alc-ap__head"><div class="alc-ap__art"></div><div class="alc-ap__shade"></div><div class="alc-ap__info">' +
        '<div class="alc-ap__logo"><div class="alc-ap__title"></div></div><div class="alc-ap__meta"></div><div class="alc-ap__btns">' +
        '<div class="alc-ap__play selector"><svg viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14z" fill="currentColor"/></svg>' +
        '<span></span><div class="alc-ap__bar hide"><div></div></div></div><div class="alc-ap__more selector">' + MORE_ICON + '</div></div></div></div>');
      var row = { kind: 'head', el: el, label: el.find('.alc-ap__play span'), bar: el.find('.alc-ap__play .alc-ap__bar') };
      el.find('.alc-ap__title').text(movie.title || movie.name || '');
      var art = movie.backdrop_path || movie.poster_path;
      if (art) el.find('.alc-ap__art').append(tmdbImg(art, window.innerWidth > 1280 ? 'w1280' : 'w780'));
      logoOf(movie, function (path) {
        if (path && alive) el.find('.alc-ap__logo').prepend(tmdbImg(path, 'w500', function () { el.find('.alc-ap__logo').addClass('alc-ap__logo--on'); }));
      });
      var meta = [yearOf(movie) || ''];
      if (series && movie.number_of_seasons) meta.push(plural('seasons_n', movie.number_of_seasons));
      else if (!series && movie.runtime) meta.push(runtimeText(movie.runtime));
      el.find('.alc-ap__meta').text(meta.filter(Boolean).join(' · '));
      var play = el.find('.alc-ap__play'), more = el.find('.alc-ap__more');
      bindItem(row, play, function () { pressPlay(); });
      bindItem(row, more, function () { moreMenu(); });
      root.append(el);
      return row;
    }
    function paintHead() {
      var text, pct;
      if (series) {
        var np = model.nextUp();
        text = tr(np.fresh ? 'watch_se' : 'continue_s', np.s, np.e);
        pct = progressPct(timelineOf(movie, np.s, np.e));
      } else {
        pct = progressPct(timelineOf(movie, 0, 0));
        text = pct ? tr('resume') : tr('watch');
      }
      if (head.sig === text + pct) return;
      head.sig = text + pct;
      head.label.text(text);
      head.bar.toggleClass('hide', !pct).find('div').css('width', Math.max(4, pct) + '%');
    }

    // ---- the voice chips (series) ----
    function paintChips() {
      var voices = model.allVoices(), cv = model.voice(), busy = !session || session.rootsPending();
      // the order stays as first shown (a pick does not move its chip; new voices join at the end)
      chips.order = chips.order || [];
      voices.forEach(function (v) { if (chips.order.indexOf(v.key) < 0) chips.order.push(v.key); });
      var byKey = {};
      voices.forEach(function (v) { byKey[v.key] = v; });
      // voice-overs first, «original + subtitles» / several-track entries after them
      var all = chips.order.map(function (k) { return byKey[k]; }).filter(Boolean);
      var list = all.filter(function (v) { return v.rank < 5; }).concat(all.filter(function (v) { return v.rank >= 5; })).slice(0, 12);
      if (cv && !list.some(function (v) { return v.key === cv.key; })) list.unshift(cv);   // the title's voice is always there
      var sig = list.map(function (v) { return v.key; }).join('|') + '#' + (cv ? cv.key : '') + '#' + (busy ? 1 : 0) + '#' + voices.length;
      if (sig === chips.sig) return;
      chips.sig = sig;
      var had = cur === chips && chips.last ? $(chips.last).data('key') : null;
      var body = chips.scroll.body().empty();
      chips.last = null;
      list.forEach(function (v) {
        var on = cv && v.key === cv.key;
        var c = $('<div class="alc-chip selector' + (on ? ' alc-chip--on' : '') + (v.absent ? ' alc-chip--absent' : '') + '"></div>').text(v.label).data('key', v.key);
        bindItem(chips, c, function () { if (!on) pickVoice(v); });
        body.append(c);
        if (on && !had) chips.last = c[0];
        if (had && had === v.key) chips.last = c[0];
      });
      if (busy && !list.length) body.append($('<div class="alc-chip alc-chip--wait"></div>').text(tr('loading')));
      if (voices.length) {
        var all = $('<div class="alc-chip alc-chip--all selector"></div>').text(tr('all_voices') + ' ›');
        bindItem(chips, all, allVoicesMenu);
        body.append(all);
      }
      if (cur === chips) focusRow(chips);
    }
    function pickVoice(v) {
      model.setVoice(v);
      refresh();
    }
    function allVoicesMenu() {
      var cv = model.voice();
      Lampa.Select.show({
        title: tr('all_voices'),
        items: groupedVoiceItems(model.allVoices(),function (v) { var it=voiceItem(v);it.selected=cv && v.key===cv.key;return it; }),
        onSelect: function (a) { toContent(); pickVoice(a.v); },
        onBack: toContent
      });
    }

    // ---- seasons: one row each ----
    function drawSeasons() {
      var list = model.seasons();
      list.forEach(function (s) {
        if (seasonRows[s]) return;
        var row = { kind: 'season', s: s, cards: {}, a: 0, b: 0, box: $('<div class="alc-ap-season"></div>') };
        var top = $('<div class="alc-ap-season__top"></div>');
        row.head = $('<div class="alc-ap-season__head selector"><span class="alc-ap-season__title"></span><span class="alc-ap-season__sub"></span></div>');
        top.append(row.head);
        row.head.find('.alc-ap-season__title').text(tr('season_n', s));
        row.scroll = new Lampa.Scroll({ horizontal: true, over: true, nopadding: true });
        row.scroll.body().addClass('alc-ap-season__eps');
        row.spacer = $('<div class="alc-ep-spacer"></div>');
        row.scroll.append(row.spacer);
        row.scroll.onScroll = function (pos) { onRowScroll(row, pos); };
        row.el = row.scroll.render();
        row.box.append(top).append(row.el);
        row.sub = row.head.find('.alc-ap-season__sub');
        row.headRow = { kind: 'shead', s: s, el: top, box: row.box };
        bindItem(row.headRow, row.head, function () { seasonMenu(row); });
        seasonRows[s] = row;
      });
      // in order (a season a source adds later goes between the others)
      var prev = chips.el;
      list.forEach(function (s) { var b = seasonRows[s].box; if (b.prev()[0] !== prev[0]) prev.after(b); prev = b; });
      listRows();
    }
    // the rows from top to bottom: the head, «nothing found» in place of the voices (none to pick), the seasons
    function listRows() {
      rows = [head];
      if (msgRow) rows.push(msgRow);
      else rows.push(chips || voiceRows);
      if (series) model.seasons().forEach(function (s) { var r = seasonRows[s]; if (r) { rows.push(r.headRow); rows.push(r); } });
    }
    // a card: the still (16:9) and the text inside the card (Apple TV's episode card)
    function epCard(row, e) {
      var el = document.createElement('div');
      el.className = 'alc-ep selector';
      // the blurred copy under the text: shown by the theme (not in its light mode), loaded only then
      el.innerHTML = '<div class="alc-ep__blur"></div><div class="alc-ep__img"><div class="alc-ep__tag hide"></div></div>' +
        '<div class="alc-ep__info"><div class="alc-ep__cap"></div><div class="alc-ep__name"></div><div class="alc-ep__descr"></div><div class="alc-ep__time"><span></span></div></div>';
      el.querySelector('.alc-ep__cap').textContent = tr('episode_n', e);
      var card = { e: e, el: el, row: row };
      paintTmdb(card);
      paintProgress(card);
      bindItem(row, $(el), function () { play(row.s, e); }, function () { episodeMenu(row.s, e); });
      $(el).on('hover:focus', function () { growTo(row, e); loadNear(row, e); });
      return card;
    }
    // what TMDB tells about the episode: the still, the title, the description (TMDB's season may
    // come after the card is drawn: then the card is filled in place)
    function paintTmdb(card) {
      var s = card.row.s, e = card.e, el = card.el, t = model.tmdbEp(s, e) || {};
      card.tmdb = !!model.tmdb[s];
      if (t.still_path && !el.querySelector('.alc-ep__img img')) {
        [el.querySelector('.alc-ep__blur'), el.querySelector('.alc-ep__img')].forEach(function (holder) { holder.insertBefore(tmdbImg(t.still_path, ''), holder.firstChild); });
        if (card.loaded) loadImgs(card);
      }
      var name = el.querySelector('.alc-ep__name'), title = plainText(model.title(s, e));
      name.textContent = title;
      name.style.display = title ? '' : 'none';
      el.querySelector('.alc-ep__descr').textContent = plainText(t.overview);
      paintProgress(card);
    }
    function paintProgress(card) {
      var s = card.row.s, e = card.e, t = model.tmdbEp(s, e) || {}, tl = timelineOf(movie, s, e) || {};
      var time = card.el.querySelector('.alc-ep__time'), box = card.el.querySelector('.alc-ep__img');
      var bar = time.querySelector('.alc-ep__bar'), seen = box.querySelector('.alc-ep__seen');
      if (bar) bar.parentNode.removeChild(bar);
      if (seen) seen.parentNode.removeChild(seen);
      var pct = progressPct(tl);
      if (pct) time.insertAdjacentHTML('afterbegin', '<div class="alc-ep__bar"><div style="width:' + Math.max(4, pct) + '%"></div></div>');
      else if (watched(tl)) box.insertAdjacentHTML('beforeend', '<div class="alc-ep__seen">✓</div>');
      var bits = [], air = airTime(t.air_date);
      if (air > Date.now()) bits.push(tr('soon') + ' · ' + Lampa.Utils.parseTime(t.air_date).full);
      else { if (t.runtime) bits.push(runtimeText(t.runtime)); if (t.air_date) bits.push(String(t.air_date).slice(0, 4)); }
      time.lastChild.textContent = bits.join(' · ');
    }
    // the card's state: on (the voice has it) / other (other voices have it: their names) / wait / soon / none
    function paintState(card) {
      var c = model.cell(card.row.s, card.e);
      var meta=model.tmdbEp(card.row.s,card.e),tag = c.state==='soon' && meta && meta.air_date ? tr('airs_on',Lampa.Utils.parseTime(meta.air_date).full) : c.state !== 'other' ? '' : c.others.length === 1 ? c.others[0].label : plural('voices_plus', c.others.length);
      if (card.state === c.state && card.tag === tag) return;
      if (card.state) card.el.classList.remove('alc-ep--' + card.state);
      card.el.classList.add('alc-ep--' + c.state);
      card.state = c.state; card.tag = tag;
      var t = card.el.querySelector('.alc-ep__tag');
      t.textContent = tag;
      t.classList.toggle('hide', !tag);
    }
    // the card lists seasons at all (the card's facts never change: counted once)
    var cardN = -1;
    function cardHas(card) { if (cardN < 0) cardN = numKeys(card).length; return cardN > 0; }
    // the cards a row shows: all of them (up to ROW_ALL), else a window [a, b) around what is seen;
    // the cards before the window are a spacer of the same width
    // want: the episode to show (a jump to it); else the next one to watch, else the card focused before
    function paintRow(row, want) {
      var eps = model.episodes(row.s), info = model.seasonInfo(row.s), line = seasonLine(info);
      if (row.line !== line) { row.line = line; row.sub.text(line); }
      // a season TMDB does not list stays hidden until a source has episodes in it
      var card = model.cardSeasons(), extra = cardHas(card) && !card[row.s];
      if (extra && !eps.length && session) session.probe(row.s, function () { model.fresh(); return model.episodes(row.s).length > 0; });
      // a season TMDB lists stays (its episodes not known yet, TMDB's answer failed, nothing found: the
      // row with its line, no cards - not a row that comes and goes under the remote's focus)
      row.box.toggleClass('alc-ap-season--none', !eps.length && (extra || (!card[row.s] && info.exact)));
      if (!eps.length) return;
      var sig = eps.join(',') + (epReverse() ? '<' : '');
      if (sig !== row.sig || want) {
        var keep = row.last && row.last.alc_e, aim = target && target.s === row.s ? target.e : 0, asked = !!want;
        row.sig = sig;
        row.order = epReverse() ? eps.slice().reverse() : eps;
        row.pos = {};
        row.order.forEach(function (e, i) { row.pos[e] = i; });
        row.scroll.body().find('.alc-ep').remove();
        row.cards = {};
        row.step = 0; row.imgs = null;
        want = want || (aim in row.pos ? aim : 0) || keep || row.order[0];
        var at = row.pos[want] || 0;
        var n = row.order.length, open = asked || aim || row.seen || cur === row;   // a row the viewer is at
        if (n <= ROW_ALL && open) { row.a = 0; row.b = n; }
        else if (n <= ROW_ALL) { row.a = 0; row.b = Math.min(n, at + ROW_FIRST); }
        else { row.a = Math.max(0, at - 10); row.b = Math.min(n, at + (open ? ROW_STEP : ROW_FIRST)); }
        // the cards join the page at once: Lampa watches the whole document (a MutationObserver that
        // looks through the target's .selector on every insertion), so one by one was n² over a row
        addCards(row, row.a, row.b, null);
        sizeSpacer(row);
        var tc = row.cards[row.order[at]];
        row.last = tc ? tc.el : null;
        // the row scrolls to that card (only if it is not at the start already: each is a layout); the
        // stills: of the row the viewer is at, else of the rows on screen (not of all 20 seasons of a long anime)
        var moved = tc && (at > 0 || row.scroll.position());
        setTimeout(function () {
          if (!alive) return;
          try { if (moved) row.scroll.immediate(tc.el, false); } catch (x) {}
          if (tc && (aim || asked)) loadNear(row, tc.e); else stillsSoon();
        }, 30);
        if (cur === row) focusRow(row);
      }
      var tm = !!model.tmdb[row.s];
      for (var k in row.cards) {
        if (row.cards[k].tmdb !== tm) paintTmdb(row.cards[k]);
        paintState(row.cards[k]);
      }
    }
    // the cards [from, to) of the row's order, put before ref (null: at the end) in one insertion;
    // returns their elements
    function addCards(row, from, to, ref) {
      var frag = document.createDocumentFragment(), els = [];
      for (var i = from; i < to; i++) {
        var e = row.order[i], card = epCard(row, e);
        card.el.alc_e = e;
        row.cards[e] = card;
        paintState(card);
        frag.appendChild(card.el);
        els.push(card.el);
      }
      row.scroll.body(true).insertBefore(frag, ref);
      return els;
    }
    // a card's width with its margins (measured once per row build: a style read forces a layout);
    // with it how the row's stills load: the still's size for the card's width, and whether the
    // blurred copy is shown at all (the theme shows it, not in its light mode)
    function cardStep(row) {
      if (row.step) return row.step;
      var any = row.scroll.body(true).querySelector('.alc-ep');
      if (!any || !any.offsetWidth) return 0;
      var cs = window.getComputedStyle(any), blur = any.querySelector('.alc-ep__blur');
      row.imgs = { size: stillSize(any.offsetWidth), blur: !!blur && blur.offsetParent !== null };
      return (row.step = any.offsetWidth + (parseFloat(cs.marginRight) || 0) + (parseFloat(cs.marginLeft) || 0));
    }
    function sizeSpacer(row) { row.spacer.css('width', row.a ? Math.round(row.a * cardStep(row)) + 'px' : '0'); }
    // the window grows when the focus (remote) comes near its ends
    function growTo(row, e) {
      var i = row.pos[e], n = row.order.length, added = [];
      if (i === undefined || (row.a === 0 && row.b >= n)) return;
      if (i >= row.b - 6 && row.b < n) {
        var to = Math.min(n, row.b + ROW_STEP);
        added = addCards(row, row.b, to, null);
        row.b = to;
      }
      if (i <= row.a + 6 && row.a > 0) {
        var from = Math.max(0, row.a - ROW_STEP);
        added = added.concat(addCards(row, from, row.a, row.scroll.body(true).querySelector('.alc-ep')));
        row.a = from; sizeSpacer(row);
      }
      // the new cards join the remote's list of the row (as Lampa's own rows add theirs), after the
      // focus has settled
      if (added.length && cur === row) setTimeout(function () { if (alive && cur === row) Lampa.Controller.collectionAppend(added); }, 0);
    }
    // a finger moved the row: the window follows, the stills on screen load
    function onRowScroll(row, pos) {
      var step = cardStep(row);
      if (!step) return;
      var first = Math.floor(pos / step), per = Math.ceil(window.innerWidth / step);
      if (row.order && (row.a > 0 || row.b < row.order.length)) {
        if (first + per + 6 >= row.b) growTo(row, row.order[Math.min(row.order.length - 1, row.b - 1)]);
        if (first - 6 <= row.a) growTo(row, row.order[row.a]);
      }
      if (row.order) loadNear(row, row.order[Math.max(row.a, Math.min(row.b - 1, first))]);
    }
    // the page moved (or rows were drawn): the rows on screen and around get their stills and their data
    // (no tap needed); the season in the middle is the one shown. Rows drawn: soon, not put off by every
    // new answer of the sources (a scroll waits for the finger to stop)
    function stillsSoon() { if (!vt) vt = setTimeout(function () { onPageScroll(true); }, 60); }
    function onPageScroll(drawn) {
      vt = 0;
      if (!alive || model.paused) return;
      var h = window.innerHeight, mid = h * 0.45, best = null, bd = 1e9, near = [], nextS = 0, nextTop = 1e9, around = [], pos = [];
      // every read first (the rows' rects and offsets), then the writes (cards, stills): one layout
      for (var k in seasonRows) {
        var row = seasonRows[k], r = row.box[0].getBoundingClientRect();
        if (!r.height || r.bottom < -h * 0.5 || r.top > h * 1.5) continue;
        around.push(row); pos.push(rowPos(row)); cardStep(row);
        if (r.top >= h && r.top < nextTop) { nextTop = r.top; nextS = row.s; }
        if (r.bottom <= 0 || r.top >= h) continue;
        near.push(row.s);
        var d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bd) { bd = d; best = row; }
      }
      around.forEach(function (row, i) { onRowScroll(row, pos[i]); });
      // the data: the rows on screen and the next one below (the one a scroll or the remote reaches first)
      if (nextS) near.push(nextS);
      model.seen(near.sort(function (a, b) { return a - b; }));
      if (best && best.s !== model.focus && drawn !== true) { model.show(best.s); soon(); }
    }
    function rowPos(row) { return tvScroll ? -row.scroll.position() : row.el[0].scrollLeft; }
    // stills: what is on screen and the next screen
    function loadNear(row, e) {
      if (!row.order) return;
      var i = row.pos[e] || 0, per = window.innerWidth > 1300 ? 6 : 5;
      for (var j = Math.max(row.a, i - 1); j < Math.min(row.b, i + per * 2); j++) {
        var c = row.cards[row.order[j]];
        if (c && !c.loaded) loadImgs(c);
      }
    }
    // the still in the size for the card's width (the theme's choice when it is on); the blurred copy
    // (only where the theme shows it) stays small: blurred, a big file buys nothing and costs a lot.
    // Only writes: the row's sizes were read once (cardStep); a row not laid out yet loads later
    function loadImgs(c) {
      if (!cardStep(c.row)) return;
      c.loaded = true;
      var o = c.row.imgs;
      Array.prototype.forEach.call(c.el.querySelectorAll('img[data-path]'), function (im) {
        var main = im.parentNode.className.indexOf('alc-ep__img') >= 0;
        if (!main && !o.blur) return;
        im.src = tmdbUrl(im.getAttribute('data-path'), main ? o.size : 'w300');
        im.removeAttribute('data-path');
      });
    }
    // «Season 3 · in Цікава Ідея 7 of 10 · also LostFilm»
    function seasonLine(i) {
      if (i.soon && !i.srcs) return tr('airs_on', Lampa.Utils.parseTime(i.soon).full);
      if (i.nosrc) return tr('no_src');
      if (!i.exact) return [i.count ? plural('eps_count', i.count) : '', i.srcs ? plural('srcs_n', i.srcs) : tr('loading')].filter(Boolean).join(' · ');
      var parts = [];
      if (!i.voice) parts.push(plural('eps_count', i.count));
      else if (i.have >= i.count) parts.push(plural('eps_count', i.count) + ' · ' + i.voice);
      else if (i.have) parts.push(tr('in_voice', i.voice, i.have, i.count));
      else parts.push(tr('not_in', i.voice));
      if (i.best) parts.push(tr('has_in', i.best) + (i.more ? ' +' + i.more : ''));
      return parts.join(' · ');
    }

    // ---- movie: every voice as a line ----
    function paintVoices() {
      var voices = model.voicesAt(0), cv = model.voice(), busy = !session || session.rootsPending();
      var sig = voices.map(function (v) { return v.key + v.cands.length + ':' + voiceQuality(v); }).join('|') + '#' + (cv ? cv.key : '') + '#' + (busy ? 1 : 0);
      if (sig === voiceRows.sig) return;
      voiceRows.sig = sig;
      var had = cur === voiceRows && voiceRows.last ? $(voiceRows.last).data('key') : null;
      voiceRows.el.empty();
      voiceRows.last = null;
      // grouped by language (iOS-like lists under a title), the groups in the order of their best voice
      var groups = [], byLang = {};
      voices.forEach(function (v) {
        var key = v.lang && v.lang !== 'und' ? langName(v.lang) || '' : '';   // unknown codes: with the unmarked
        if (!byLang[key]) {
          var title = key ? key.charAt(0).toUpperCase() + key.slice(1) : (uiLang()==='ru'?'Язык не указан':tr('lang_other'));
          byLang[key] = $('<div class="alc-ap-vgroup"><div class="alc-ap-vgroup__title"></div><div class="alc-ap-vgroup__list"></div></div>');
          byLang[key].find('.alc-ap-vgroup__title').text(title);
          groups.push(byLang[key]);
        }
        var q = qualityLabel(voiceQuality(v)), ln = voiceLang(v), name = v.label;
        // the group says the language: "Дубляж · українська" -> "Дубляж"
        if (ln && name.slice(-(ln.length + 3)) === ' · ' + ln) name = name.slice(0, -(ln.length + 3));
        var el = $('<div class="alc-ap-voice selector"><div class="alc-ap-voice__body"><div class="alc-ap-voice__name"></div>' +
          '<div class="alc-ap-voice__sub"></div></div><div class="alc-ap-voice__check">' + CHECK_ICON + '</div></div>').data('key', v.key);
        if (cv && cv.key === v.key) el.addClass('alc-ap-voice--on');
        el.find('.alc-ap-voice__name').text(name);
        // the technical part, quiet: quality · how many sources have it
        el.find('.alc-ap-voice__sub').text([q, plural('srcs_n', sourceCount(v))].filter(Boolean).join(' · '));
        bindItem(voiceRows, el, function () { playMovie(v); }, function () { pinMenu(v); });
        byLang[key].find('.alc-ap-vgroup__list').append(el);
        if (had && had === v.key) voiceRows.last = el[0];
      });
      groups.forEach(function (g) { voiceRows.el.append(g); });
      if (busy) voiceRows.el.append($('<div class="alc-ap__vwait"></div>').text(tr('voices_more')));
      layoutVoices();
      if (cur === voiceRows) focusRow(voiceRows);
    }
    // wide screens: the voices in columns (as many as fit, at least --alc-vcol wide, --alc-vgap apart: the theme
    // sets them), a group as few columns as keep its rows even (4 -> 2 x 2, not 3 + 1), each item as wide in every
    // group (a short last row keeps to the columns). One column: the iOS list, the items straight in it.
    // resized: laid out again only if the number of columns changed (false: nothing moved)
    var vcols = 0;
    function layoutVoices(resized) {
      if (!voiceRows || !alive) return false;
      var box = voiceRows.el[0], w = box.clientWidth;
      if (!w) return false;
      var cs = getComputedStyle(box), fs = parseFloat(cs.fontSize) || 16;
      w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      var num = function (name, def) {
        var raw = cs.getPropertyValue(name).trim(), v = parseFloat(raw);
        if (isNaN(v)) return def;
        if (/rem$/.test(raw)) return v * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
        if (/em$/.test(raw)) return v * fs;
        return v;
      };
      var minW = num('--alc-vcol', fs * 24), gap = num('--alc-vgap', fs * 0.6);
      var max = Math.max(1, Math.floor((w + gap) / (minW + gap))), colW = Math.floor((w - gap * (max - 1)) / max);
      if (resized && max === vcols) {   // the same columns: only their width
        if (max > 1) voiceRows.el.find('.alc-ap-vrow > .alc-ap-voice').css('flex', '0 0 ' + colW + 'px');
        return false;
      }
      vcols = max;
      voiceRows.el.find('.alc-ap-vgroup__list').each(function () {
        var list = $(this), items = list.find('.alc-ap-voice').detach(), n = items.length;
        list.empty().toggleClass('alc-ap-vgroup__list--tiles', max > 1);
        items.css({ flex: max > 1 ? '0 0 ' + colW + 'px' : '', marginLeft: '' });
        if (max === 1) { list.append(items); return; }
        var cols = Math.ceil(n / Math.ceil(n / max));
        for (var i = 0; i < n; i += cols) {
          var row = $('<div class="alc-ap-vrow"></div>');
          row.append(items.slice(i, i + cols));
          row.children().slice(1).css('margin-left', gap + 'px');
          list.append(row);
        }
      });
      return true;
    }
    function onResize() { if (layoutVoices(true) && cur === voiceRows) focusRow(voiceRows); }

    // ---- refresh: what changed is drawn again (the cards stay; their states change) ----
    // force: draw even if the model has nothing new (the order, the progress changed)
    function refresh(force) {
      if (!alive) return;
      if (model.none) endIntent();
      var r = model.update();
      if (intent) intentStep();
      if (r.changed || force === true) {
        paintHead();
        paintSlot();
        if (series) paintSeasons();   // (also under «nothing found»: TMDB's, every episode disabled)
      }
      ensureFocus();
    }
    function paintSeasons() {
      drawSeasons();
      model.seasons().forEach(function (s) {
        model.tmdbOf(s);
        paintRow(seasonRows[s]);
      });
      model.tmdbPump();
      if (target && seasonRows[target.s] && seasonRows[target.s].cards[target.e]) {
        // the screen opens on the next episode to watch
        var tr0 = seasonRows[target.s];
        cur = tr0; tr0.last = tr0.cards[target.e].el;
        target = null;
        if (enabled()) focusRow(tr0);
        setTimeout(function () { try { scroll.immediate(tr0.box[0], true); } catch (x) {} }, 40);
      }
    }
    // the place under the head: the voices, else a card - why there is nothing to play, or «searching…»
    // (the card was up and the title is searched again)
    function slotWhy() {
      if (model.none) return model.none;
      var n = series ? model.allVoices().length : model.voicesAt(0).length, done = !!session && !session.rootsPending();
      if (series && session && session.rootsDone && !model.seasons().length) return [tr('not_found'), tr('nf_seasons')];
      if (!series && done && !n) return [tr('not_found'), tr('nf_stream')];
      if (msgRow && !done && !n) return [tr('searching'), ''];
      return null;
    }
    function paintSlot() {
      var why = slotWhy();
      if (why) showMsg(why[0], why[1]);
      else { hideMsg(); if (series) paintChips(); else paintVoices(); }   // (a source came later, one was switched on)
    }
    // where the remote's focus belongs: the row it is on, else the card's actions, else the head
    function focusTarget() { return cur && rows.indexOf(cur) >= 0 ? cur : msgRow || head; }
    // the focus is somewhere on the screen (the row it was on may have gone; under a modal: when it closes)
    function ensureFocus() {
      if (enabled() && focusTarget() !== cur) focusRow(focusTarget());
    }
    // the card in place of the voices: the reason and what can be done (the sources, Lampa's torrents
    // when it has a parser); a series' TMDB episodes stay below it, disabled (a tap says why: see play)
    function showMsg(title, text) {
      if (msgRow && msgRow.sig === title + '|' + text) return;   // refresh() calls again: drawn once
      var card = $('<div class="alc-ap__msg-card"><div class="alc-ap__msg-icon">' + NF_ICON + '</div><div class="alc-ap__msg-body">' +
        '<div class="alc-ap__msg-title"></div><div class="alc-ap__msg-text"></div><div class="alc-ap__msg-acts"></div></div></div>');
      card.find('.alc-ap__msg-title').text(title);
      card.find('.alc-ap__msg-text').text(text || '');
      msgBox.removeClass('hide').empty().append(card);
      if (chips) chips.el.addClass('hide');
      if (voiceRows) voiceRows.el.addClass('hide');
      var acts = card.find('.alc-ap__msg-acts');
      msgRow = { kind: 'msg', el: acts, sig: title + '|' + text };
      var act = function (label, fn) {
        var b = $('<div class="alc-ap__msg-btn selector"></div>').text(label);
        bindItem(msgRow, b, fn);
        acts.append(b);
      };
      act(tr('sources') + ' ›', function () { menuOpen = true; sourcesMenu(function () { menuOpen = false; toContent(); retry(); }); });
      if (torrentsOn()) act(tr('torrents'), openTorrents);
      target = null;   // the screen stays on the reason, not on an episode that cannot play
      listRows();
      // (a modal over the screen: the card is where the focus comes back to)
      if (!cur || cur.kind !== 'head') { if (enabled()) focusRow(msgRow); else cur = msgRow; }
    }
    // something to play after all: the voices again in its place (drawn afresh)
    function hideMsg() {
      if (!msgRow) return;
      if (cur === msgRow) cur = null;   // (ensureFocus: the head)
      msgRow = null;
      msgBox.addClass('hide').empty();
      if (chips) { chips.el.removeClass('hide'); chips.sig = ''; }
      if (voiceRows) { voiceRows.el.removeClass('hide'); voiceRows.sig = ''; }
      listRows();
    }
    function torrentsOn() {
      try { return !!(Lampa.Storage.field('parser_use') && (!window.lampa_settings || window.lampa_settings.torrents_use !== false)); } catch (e) { return false; }
    }
    // as Lampa's own «Torrents» button of a card does
    function openTorrents() {
      var t = movie.title || movie.name || '', o = movie.original_title || movie.original_name || t, y = String(yearOf(movie) || '');
      var q = { df: o, df_year: o + ' ' + y, df_lg: o + ' ' + t, df_lg_year: o + ' ' + t + ' ' + y, lg: t, lg_year: t + ' ' + y, lg_df: t + ' ' + o, lg_df_year: t + ' ' + o + ' ' + y };
      var lang = '';
      try { lang = Lampa.Storage.field('parse_lang'); } catch (e) {}
      Lampa.Activity.push({ url: '', title: Lampa.Lang.translate('title_torrents'), component: 'torrents', search: q[lang] || o,
        search_one: t, search_two: o, movie: movie, page: 1 });
    }

    // ---- remote and touch ----
    // an item of a row: tap / OK, long press, focus remembered by its row
    function bindItem(row, el, onEnter, onLong) {
      el.on('hover:enter', function () { onEnter(); });
      if (onLong) el.on('hover:long', function () { onLong(); });
      el.on('hover:focus', function () {
        row.last = el[0];
        row.seen = true;   // a season visited: drawn whole from now on (see paintRow)
        cur = row;
        if (row.s) { model.show(row.s); soon(); }
        if (!tvScroll) return;   // touch: the finger scrolls
        if (row.scroll) row.scroll.update(el[0], false);
        if (row.kind === 'voices') scroll.update(el[0], true);
        else scroll.update((row.box || row.el)[0], row.kind !== 'head');
      });
    }
    function enabled() { try { return Lampa.Controller.enabled().name === 'content'; } catch (e) { return false; } }
    function firstOf(row) { return row.el.find('.selector').first()[0] || null; }
    function focusRow(row, el) {
      if (!row) return;
      cur = row;
      var target = el || (row.last && $.contains(row.el[0], row.last) ? row.last : firstOf(row));
      Lampa.Controller.collectionSet(row.el);
      Lampa.Controller.collectionFocus(target || false, row.el);
    }
    // up / down: the next row that has something to focus; down skips the season titles (up stops on
    // them: the season's menu)
    function step(d) {
      // the movie's voices: a list, up / down inside it first
      if (cur && cur.kind === 'voices' && Navigator.canmove(d < 0 ? 'up' : 'down')) { Navigator.move(d < 0 ? 'up' : 'down'); return; }
      for (var j = rows.indexOf(cur) + d; j >= 0 && j < rows.length; j += d) {
        var r = rows[j];
        if (d > 0 && r.kind === 'shead') continue;   // down skips the season titles
        if (r.box && r.box.hasClass('alc-ap-season--none')) continue;
        if (firstOf(r)) { focusRow(r); return; }
      }
      if (d < 0) Lampa.Controller.toggle('head');
    }
    function toContent() { try { Lampa.Controller.toggle('content'); } catch (e) {} }

    // ---- playing ----
    function pressPlay() {
      if (series) { var np = model.nextUp(); play(np.s, np.e); return; }
      if (saidWhy()) return;
      var v = model.key ? model.voice() : null, searching = !session || session.rootsPending();
      if (!v || (v.absent && searching)) waitFor(0, 0);   // no voice yet / the remembered one may still come
      else if (v.absent) movieVoiceMenu();   // the remembered voice is not here: the viewer picks
      else playMovie(v);
    }
    // a tap on an episode: by what is known of it (the same way when its data comes later)
    function play(s, e) {
      if (saidWhy()) return;
      var c = model.cell(s, e);
      if (c.state === 'on') { playEpisode(c.voice, s, e, true); return; }
      if (c.state === 'other') { offerMenu(s, e, c.others); return; }
      if (c.state === 'soon') { var t = model.tmdbEp(s, e); noty(tr('airs_on', t ? Lampa.Utils.parseTime(t.air_date).full : '')); return; }
      if (c.state === 'wait') { waitFor(s, e); return; }
      noty(model.voice() ? tr('no_voice_ep', model.voice().label) : tr('voice_loading'));
    }
    // nothing found: a tap says why (not a wait for voices that cannot come)
    function saidWhy() { if (model.none) noty(model.none[1] || model.none[0]); return !!model.none; }
    // its data is still coming (the season's pages, the voice not picked yet): a spinner (Back cancels)
    // until it is known, then the tap goes on as above; given up after INTENT_WAIT
    var INTENT_WAIT = 25000;
    function waitFor(s, e) {
      endIntent();
      if (s) model.show(s);   // that season's pages first
      var me = intent = { s: s, e: e, alive: loading(newOp(), 'content') };
      me.timer = setTimeout(function () { if (intent === me) { endIntent(); toContent(); noty(tr('voice_loading')); } }, INTENT_WAIT);
    }
    function intentStep() {
      var i = intent;
      if (!i.alive()) { endIntent(); return; }   // cancelled
      if (!series) {
        var v = model.key ? model.voice() : null, done = session && !session.rootsPending();
        if (done && !model.voicesAt(0).length) { endIntent(); toContent(); noty(tr('nf_stream')); }
        else if (v && (!v.absent || done)) { endIntent(); pressPlay(); }
        return;
      }
      if (model.cell(i.s, i.e).state === 'wait') return;
      endIntent();
      play(i.s, i.e);
    }
    function endIntent() {
      if (!intent) return;
      clearTimeout(intent.timer);
      if (intent.alive()) { try { Lampa.Loading.stop(); } catch (x) {} }
      intent = null;
    }
    // a movie whose remembered voice is not among its voices: which one to play
    function movieVoiceMenu() {
      Lampa.Select.show({
        title: tr('choose_voice'),
        items: model.voicesAt(0).map(function (v) { return voiceItem(v); }),
        onSelect: function (a) { toContent(); playMovie(a.v); },
        onBack: toContent
      });
    }
    // voice v plays episode e of season s (a movie: 0, 0); a cancel comes back here, a watched one
    // starts from the beginning
    function startPb(v, s, e, list) {
      var pb = new Playback(session, v, s);
      pb.prefer = model.pinFor(v) || null;
      pb.ctl = 'content';
      pb.restart = watched(timelineOf(movie, s, e));
      pb.start(e, list);
    }
    // series: keep = the voice becomes the title's voice (a tap on its own card); else a one-off
    function playEpisode(v, s, e, keep) {
      if (keep) saveChoice(movie.id, { voice: v.key, season: s });
      startPb(v, s, e, model.playlist(s, v));
    }
    function playMovie(v) {
      if (v.key !== model.key) model.setVoice(v);
      saveChoice(movie.id, { voice: v.key });
      startPb(v, 0, 0, null);
    }
    // a voice in a menu: its name (or title), its language and how many sources have it
    function voiceItem(v, title) { return { title: title || v.label, subtitle: voiceLangNote(v) + plural('srcs_n', sourceCount(v)), v: v }; }
    function sourceItem(v) { return { title: tr('source_item', model.pinFor(v) || tr('src_auto')) + ' ›', subtitle: v.label, source: true }; }
    // the source of a voice: automatic or a fixed one (it becomes the title's voice)
    function pinMenu(v) { sourceMenu(v, function (src) { model.setPin(v, src); refresh(); }); }
    // the episode is not in the title's voice: watch it in one that has it, or make that one the voice
    function offerMenu(s, e, others) {
      var cv = model.voice();
      var items = [{ title: tr('series_voice') + ' ›', subtitle: cv ? cv.label : '', set: true }].concat(others.map(function (v) { return voiceItem(v, tr('watch_in', v.label)); }));
      Lampa.Select.show({
        title: tr('ep_missing', s, e, cv ? cv.label : ''),
        items: items,
        onSelect: function (a) {
          if (a.set) {
            Lampa.Select.show({
              title: tr('series_voice'),
              items: others.map(function (v) { return voiceItem(v); }),
              onSelect: function (b) { toContent(); pickVoice(b.v); },
              onBack: function () { offerMenu(s, e, others); }
            });
            return;
          }
          toContent();
          playEpisode(a.v, s, e, false);
        },
        onBack: toContent
      });
    }

    // ---- menus ----
    function sourceMenu(voice, done) {
      var cur0 = model.pinFor(voice);
      var items = [{ title: tr('src_auto'), subtitle: tr('src_auto_d'), selected: !cur0, src: '' }];
      rankCands(voice.cands).forEach(function (c) {
        var q = c.items ? itemsQuality(c.items) : 0;
        items.push({ title: c.src, subtitle: q ? qualityLabel(q) : '', selected: cur0 === c.src, src: c.src });
      });
      items.push({ title: tr('sources') + ' ›', subtitle: srcHiddenNote(), all: true });
      Lampa.Select.show({
        title: voice.label,
        items: items,
        onSelect: function (it) {
          if (it.all) { sourcesMenu(function () { sourceMenu(voice, done); }); return; }
          toContent(); done(it.src);
        },
        onBack: toContent
      });
    }
    // «⋯»: the source, the sources on / off, alc_ua's subscription, the order of the episodes
    function moreMenu() {
      var s = model.focus, v = series ? model.voiceAt(s) : model.voice(), items = [];
      if (v && !v.absent && v.cands.length > 1) items.push(sourceItem(v));
      items.push({ title: tr('sources') + ' ›', subtitle: srcHiddenNote(), sources: true });
      var sub = null;
      if (series && v && s && window.snack_ua && window.snack_ua.filterItem) {
        try { sub = window.snack_ua.filterItem(movie, v, s, numKeys(model.episodesOf(s, v))); } catch (x) {}
        if (sub) items.push(sub);
      }
      if (series) items.push({ title: tr('ep_reverse'), subtitle: epReverse() ? tr('on') : tr('as_off'), order: true });
      Lampa.Select.show({
        title: movie.title || movie.name || tr('plugin_name'),
        items: items,
        onSelect: function (a) {
          if (a.snack && typeof a.snack === 'function') { toContent(); a.snack(); return; }
          if (a.source) { pinMenu(v); return; }
          if (a.sources) { sourcesMenu(toContent); return; }
          if (a.order) {
            Lampa.Storage.set('alc_auto_ep_rev', !epReverse());
            toContent();
            refresh(true);   // (each row's signature has the order)
          }
        },
        onBack: toContent
      });
    }
    // a season's title: go to an episode by its number (long seasons)
    function seasonMenu(row) {
      Lampa.Select.show({
        title: tr('season_n', row.s),
        items: [{ title: tr('ep_jump'), jump: true }],
        onSelect: function () { jumpEpisode(row); },
        onBack: toContent
      });
    }
    function jumpEpisode(row) {
      try {
        Lampa.Input.edit({ title: tr('ep_jump_t'), value: '', free: true, nosave: true, layout: 'nums', nomic: true }, function (val) {
          var n = parseInt(String(val || '').replace(/[^\d]/g, ''), 10), i = row.pos ? row.pos[n] : undefined;
          if (n && i === undefined) noty(tr('ep_none', n));
          if (i !== undefined) {
            if (i < row.a || i >= row.b) paintRow(row, n);   // outside the window: the window moves there
            var c = row.cards[n];
            if (c) { row.last = c.el; cur = row; setTimeout(function () { row.scroll.update(c.el, false); loadNear(row, n); }, 30); }
          }
          toContent();
        });
      } catch (x) { toContent(); }
    }
    // a long press on an episode: another voice that has it, its source, watched / not watched
    function episodeMenu(s, e) {
      var c = model.cell(s, e), v = c.voice, tl = timelineOf(movie, s, e), t = model.tmdbEp(s, e) || {}, items = [];
      var others = model.others(s)[e] || [];
      if (others.length) items.push({ title: tr('other_voices') + ' ›', others: true });
      if (v && v.cands.length > 1) items.push(sourceItem(v));
      items.push({ title: watched(tl) ? tr('mark_unseen') : tr('mark_seen'), mark: true });
      Lampa.Select.show({
        title: 'S' + s + ' E' + e + (t.name ? ' · ' + t.name : ''),
        items: items,
        onSelect: function (a) {
          if (a.others) { offerMenu(s, e, others); return; }
          if (a.source) { pinMenu(v); return; }
          if (a.mark) {
            var dur = tl.duration || (t.runtime ? t.runtime * 60 : 0);
            if (watched(tl)) tl.handler(0, 0, dur); else tl.handler(100, dur, dur);
            toContent();
            var row = seasonRows[s];
            if (row && row.cards[e]) paintProgress(row.cards[e]);
            model.watchedChanged();
            refresh(true);
          }
        },
        onBack: toContent
      });
    }

    // back from the player: the voice may have been switched there (Аудиодоріжки), episodes watched
    var onPlayerClosedLater = later(onPlayerClosed);
    function onPlayerClosed() {
      if (!alive) return;
      model.syncChoice();
      for (var k in seasonRows) for (var e in seasonRows[k].cards) paintProgress(seasonRows[k].cards[e]);
      refresh(true);
    }

    this.start = function () {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (!this.ready) { this.ready = true; this.initialize(); }
      else { model.resume(); retry(); refresh(); }
      try { Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(movie)); } catch (e) {}
      Lampa.Controller.add('content', {
        toggle: function () { focusRow(focusTarget()); },
        up: function () { step(-1); },
        down: function () { step(1); },
        left: function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
        right: function () { if (Navigator.canmove('right')) Navigator.move('right'); },
        back: this.back.bind(this)
      });
      Lampa.Controller.toggle('content');
    };
    this.back = function () { Lampa.Activity.backward(); };
    this.pause = function () { model.pause(); };
    this.stop = function () {};
    this.destroy = function () {
      gen++; alive = false;
      if (voiceRows) Lampa.Listener.remove('resize_end', onResize);
      endIntent();
      model.close();
      try { Lampa.Player.listener.remove('destroy', onPlayerClosedLater); } catch (e) {}
      clearTimeout(rt); clearTimeout(vt); clearTimeout(rs); listDead(false);
      if (session) session.unlisten(soon);
      try { if (window.alc_auto_debug.model === model) delete window.alc_auto_debug.model; } catch (e) {}
      html.find('img').each(function () { this.onload = this.onerror = null; this.src = ''; });
      for (var k in seasonRows) { try { seasonRows[k].scroll.destroy(); } catch (x) {} }
      if (chips) { try { chips.scroll.destroy(); } catch (x) {} }
      scroll.destroy();
      html.remove();
    };
  }

  // a TMDB picture: the class 'loaded' once it is there; no size: lazy, the path waits in data-path
  // and the size is chosen when it loads (see loadImgs); one that fails to load goes
  function tmdbImg(path, size, onload) {
    var im = new Image();
    im.alt = '';
    im.onload = function () { im.className = 'loaded'; if (onload) onload(); };
    im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); };
    if (size) im.src = tmdbUrl(path, size); else im.setAttribute('data-path', path);
    return im;
  }
  function tmdbUrl(path, size) { return Lampa.TMDB.image('t/p/' + size + path); }
  // a TMDB still's size for a card w css px wide: the theme's (its «Картинки» option), else the same rule
  function stillSize(w) {
    try { if (window.snack_tv && window.snack_tv.imgSize) return window.snack_tv.imgSize('still', w); } catch (e) {}
    // no theme: a short ladder that mirrors the theme's TMDB_W.still (keep the two alike)
    var need = (w || 300) * (window.devicePixelRatio || 1) * 0.9;
    // (never «original»: TMDB keeps some stills in 4K, and a screen of them froze iPads)
    // (w500 too: a TV's 400 px card took w780, 2.4× the pixels to decode for nothing)
    return need <= 185 ? 'w185' : need <= 300 ? 'w300' : need <= 500 ? 'w500' : 'w780';
  }
  // the language of a voice as a word, when its label does not already say it ('' otherwise)
  function voiceLang(v) {
    if (v.unnamed || !v.lang || v.lang === 'und') return '';   // an unnamed voice's label is "<language> voice-over"
    return langName(v.lang) || '';
  }
  // the title's logo (TMDB), in the interface language, else English, else any: cb(path or '')
  var logoMem = {};
  function logoOf(movie, cb) {
    var id = tmdbId(movie), kind = isSerial(movie) ? 'tv' : 'movie', key = kind + id;
    if (typeof id !== 'number') { cb(''); return; }
    var pick = function (list) {
      var langs = [uiLang(), 'en', null], best = '';
      langs.some(function (l) {
        var hit = (list || []).filter(function (x) { return (x.iso_639_1 || null) === l && !/\.svg$/i.test(x.file_path || ''); })[0];
        if (hit) best = hit.file_path;
        return !!hit;
      });
      return best;
    };
    if (movie.images && movie.images.logos) { cb(pick(movie.images.logos)); return; }
    if (logoMem[key] !== undefined) { cb(logoMem[key]); return; }
    var url;
    try { url = Lampa.TMDB.api(kind + '/' + id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + uiLang() + ',en,null'); } catch (e) { cb(''); return; }
    $.ajax({ url: url, dataType: 'json', timeout: 6000,
      success: function (d) { cb(logoMem[key] = pick(d && d.logos)); },
      error: function () { cb(''); } });
  }

  // the screen's own sheet: a plain version of the same layout (the theme restyles it), em of Lampa's font
  function addCss() {
    if (document.getElementById('alc-ap-css')) return;
    var r = [];
    r.push('.alc-ap{padding:0 0 3em}');
    r.push('.alc-ap__head{position:relative;min-height:16em;display:flex;align-items:flex-end;padding:3em 2em 1.4em;overflow:hidden}');
    r.push('.alc-ap__art{position:absolute;left:0;top:0;width:100%;height:100%}');
    r.push('.alc-ap__art img{width:100%;height:100%;object-fit:cover;object-position:50% 25%;opacity:0;transition:opacity .4s}');
    r.push('.alc-ap__art img.loaded{opacity:.5}');
    r.push('.alc-ap__shade{position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,.15) 70%)}');
    r.push('.alc-ap__info{position:relative;max-width:42em}');
    r.push('.alc-ap__logo img{display:none;max-width:18em;max-height:5.5em;margin-bottom:.6em}');
    r.push('.alc-ap__logo--on img{display:block}.alc-ap__logo--on .alc-ap__title{display:none}');
    r.push('.alc-ap__title{font-size:2.2em;font-weight:700;line-height:1.1;margin-bottom:.3em}');
    r.push('.alc-ap__meta{opacity:.7;margin-bottom:1em}');
    r.push('.alc-ap__btns{display:flex;align-items:center}');
    r.push('.alc-ap__play{position:relative;display:flex;align-items:center;background:#fff;color:#000;border-radius:2em;padding:.65em 1.5em;font-weight:600;font-size:1.15em;overflow:hidden}');
    r.push('.alc-ap__play svg{width:1.1em;height:1.1em;margin-right:.5em}');
    r.push('.alc-ap__bar{position:absolute;left:1.5em;right:1.5em;bottom:.3em;height:.18em;border-radius:1em;background:rgba(0,0,0,.2)}.alc-ap__bar div{height:100%;background:#000;border-radius:1em}');
    r.push('.alc-ap__more{width:2.7em;height:2.7em;margin-left:.8em;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center}');
    r.push('.alc-ap__more svg{width:1.2em;height:1.2em}');
    r.push('.alc-ap__play.focus,.alc-ap__more.focus{box-shadow:0 0 0 .2em rgba(255,255,255,.9)}.alc-ap__more.focus{background:#fff;color:#000}');
    r.push('.alc-ap__chips{padding:.8em 2em 0}');
    r.push('.alc-ap__chips .scroll__body,.alc-ap-season__eps{display:flex;align-items:flex-start;white-space:nowrap}');
    r.push('.alc-chip{flex-shrink:0;padding:.45em 1.1em;margin-right:.6em;border-radius:2em;background:rgba(255,255,255,.12);white-space:nowrap}');
    r.push('.alc-chip--on{background:#fff;color:#000;font-weight:600}.alc-chip--absent{opacity:.6}.alc-chip--wait{opacity:.5}');
    r.push('.alc-chip.focus{box-shadow:0 0 0 .15em #fff}');
    r.push('.alc-ap-season{padding:1.4em 2em 0}.alc-ap-season--none{display:none}');
    r.push('.alc-ap-season__head{display:inline-block;padding:.2em .5em;margin:0 0 .6em -.5em;border-radius:.6em}');
    r.push('.alc-ap-season__head.focus{background:#fff;color:#000}');
    r.push('.alc-ap-season__title{font-size:1.4em;font-weight:700;margin-right:.6em}.alc-ap-season__sub{opacity:.65}');
    r.push('.alc-ep-spacer{flex-shrink:0;height:1px}');
    r.push('.alc-ep{position:relative;flex-shrink:0;width:16em;margin-right:1em;border-radius:.6em;overflow:hidden;background:rgba(255,255,255,.08);white-space:normal}');
    r.push('.alc-ep__blur{display:none}');
    r.push('.alc-ep__img{position:relative;padding-bottom:56.25%;background:rgba(255,255,255,.05)}');
    r.push('.alc-ep__img img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}.alc-ep__img img.loaded{opacity:1}');
    r.push('.alc-ep__info{padding:.6em .8em .7em}');
    // the dim lines by colour, not opacity: the theme sets its own colours and need not undo an opacity
    r.push('.alc-ep__cap{font-size:.75em;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.65);font-weight:600}');
    r.push('.alc-ep__name{font-weight:600;margin-top:.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
    r.push('.alc-ep__descr{font-size:.8em;color:rgba(255,255,255,.7);line-height:1.3;height:2.6em;overflow:hidden;margin-top:.2em;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}');
    r.push('.alc-ep__time{display:flex;align-items:center;font-size:.75em;color:rgba(255,255,255,.6);margin-top:.35em}');
    r.push('.alc-ep__bar{flex:0 0 3em;height:.3em;border-radius:1em;background:rgba(255,255,255,.18);overflow:hidden;margin-right:.5em}.alc-ep__bar div{height:100%;background:rgba(255,255,255,.6)}');
    r.push('.alc-ep__seen{position:absolute;right:.4em;top:.4em;width:1.5em;height:1.5em;line-height:1.5em;border-radius:50%;background:rgba(0,0,0,.6);text-align:center;font-weight:700;font-size:.85em}');
    r.push('.alc-ep__tag{position:absolute;left:.45em;bottom:.45em;max-width:85%;padding:.15em .6em;border-radius:1em;background:rgba(0,0,0,.65);color:#fff;font-size:.72em;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
    r.push('.alc-ep--other .alc-ep__img img,.alc-ep--none .alc-ep__img img{-webkit-filter:grayscale(1);filter:grayscale(1);opacity:.45}');
    r.push('.alc-ep--other .alc-ep__info,.alc-ep--none .alc-ep__info,.alc-ep--wait .alc-ep__info{opacity:.55}');
    r.push('.alc-ep--soon .alc-ep__img img{opacity:.5}');
    r.push('.alc-ep.focus{box-shadow:0 0 0 .2em #fff}');
    r.push('.alc-ap__voices{padding:1em 2em 0}');
    r.push('.alc-ap-vgroup{margin-bottom:1.1em}');
    r.push('.alc-ap-vgroup__title{font-size:.75em;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.55);padding:0 1.35em .45em}');
    // one column: the iOS list, thin separators from the text's left edge (none next to the focused row);
    // several (layoutVoices): a plain tvOS list in rows, no panels, no lines, the gaps set by it
    r.push('.alc-ap__voices{--alc-vcol:24em;--alc-vgap:.6em}');
    r.push('.alc-ap-vgroup__list{border-radius:.7em;background:rgba(255,255,255,.07)}');
    r.push('.alc-ap-voice{position:relative;display:flex;align-items:center;padding:.65em 1em;border-radius:.7em}');
    r.push('.alc-ap-voice+.alc-ap-voice:before{content:"";position:absolute;left:1em;right:0;top:0;height:1px;background:rgba(255,255,255,.1)}');
    r.push('.alc-ap-voice.focus:before,.alc-ap-voice.focus+.alc-ap-voice:before{display:none}');
    r.push('.alc-ap-vgroup__list--tiles{background:none}.alc-ap-vgroup__list--tiles .alc-ap-voice:before{display:none!important}');
    r.push('.alc-ap-vrow{display:flex}.alc-ap-vrow > .alc-ap-voice{min-width:0}.alc-ap-vrow + .alc-ap-vrow{margin-top:.2em}');
    r.push('.alc-ap-voice__body{flex:1 1 auto;min-width:0}');
    r.push('.alc-ap-voice__name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
    r.push('.alc-ap-voice__sub{font-size:.72em;color:rgba(255,255,255,.5);margin-top:.15em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
    r.push('.alc-ap-voice__check{flex-shrink:0;width:1.1em;height:1.1em;margin-left:.8em;visibility:hidden}.alc-ap-voice__check svg{display:block;width:100%;height:100%}');
    r.push('.alc-ap-voice--on .alc-ap-voice__check{visibility:visible}');
    r.push('.alc-ap__vwait{font-size:.8em;color:rgba(255,255,255,.45);padding:0 1.25em}');
    r.push('.alc-ap-voice.focus{background:#fff;color:#000}.alc-ap-voice.focus .alc-ap-voice__sub{color:rgba(0,0,0,.55)}');
    // «nothing found»: a glass card like the theme's panels, the actions as capsules (the first white: the
    // way on); in em, to scale with Lampa's font as the theme's tokens do
    r.push('.alc-ap__msg{padding:.6em 2em .2em}');
    r.push('.alc-ap__msg-card{display:flex;align-items:flex-start;max-width:44em;padding:1.15em 1.5em 1.25em 1.2em;border-radius:1.3em;' +
      'background:rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,255,255,.06)}');
    r.push('.alc-ap__msg-icon{flex:0 0 auto;width:2.9em;height:2.9em;margin-right:1.05em;border-radius:50%;background:rgba(255,255,255,.12);color:rgba(255,255,255,.88);' +
      'display:flex;align-items:center;justify-content:center}.alc-ap__msg-icon svg{width:1.45em;height:1.45em}');
    r.push('.alc-ap__msg-body{flex:1 1 auto;min-width:0}');
    // (the theme sets the title's size: its season titles')
    r.push('.alc-ap__msg-title{font-size:1.45em;font-weight:700;line-height:1.2;letter-spacing:-.01em}');
    r.push('.alc-ap__msg-text{margin-top:.3em;line-height:1.35;color:rgba(235,235,245,.62)}');
    r.push('.alc-ap__msg-acts{display:flex;flex-wrap:wrap;margin-top:.95em}');
    r.push('.alc-ap__msg-btn{height:2.35em;line-height:2.35em;padding:0 1.25em;margin:.25em .7em .1em 0;border-radius:2em;white-space:nowrap;font-weight:600;' +
      'background:rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);transition:transform .2s,background-color .15s,color .15s}');
    r.push('.alc-ap__msg-btn:first-child{background:#fff;color:#000;box-shadow:none}');
    r.push('.alc-ap__msg-btn.focus{background:#fff;color:#000;box-shadow:0 .5em 1.2em rgba(0,0,0,.4);-webkit-transform:scale(1.06);transform:scale(1.06)}');
    r.push('.alc-ap:not(.alc-ap--touch) .alc-ap__msg-btn:first-child:not(.focus){background:rgba(255,255,255,.82)}');
    r.push('.alc-ap--touch .alc-ap__msg-btn.focus{-webkit-transform:none;transform:none;box-shadow:none}' +
      '.alc-ap--touch .alc-ap__msg-btn.focus:not(:first-child){background:rgba(255,255,255,.14);color:inherit}' +
      '.alc-ap--touch .alc-ap__msg-btn:active{-webkit-transform:scale(.95);transform:scale(.95)}');
    var st = document.createElement('style');
    st.id = 'alc-ap-css';
    st.textContent = r.join('\n');
    document.head.appendChild(st);
  }

  try { Lampa.Component.add(PACK.c, AutoView); } catch (e) { console.error('AlcAuto', e && e.message); }

  function openView(movie) {
    Lampa.Activity.push({ url: '', title: tr('watch'), component: PACK.c, movie: movie, page: 1 });
  }

  // ======================= 11. QUICK START =======================
  // ---------- quick start: play at once instead of opening the screen ----------
  // Started before: the same voice (and source); a series: the "Continue · S2E5" button. A title
  // whose voice was never chosen: the voice list (see pressButton). When the source used last time is slow
  // and another source has the same voice, the viewer decides: switch now or keep waiting.
  var SLOW_SRC = 6000;

  // one tap plays (default on; switched off in the settings / long-press menu)
  function qset(name) { var v = Lampa.Storage.get(name, true); return v === true || v === 'true' || v === 1 || v === '1'; }
  function quickOn(movie) { return qset(isSerial(movie) ? 'alc_auto_quick_series' : 'alc_auto_quick_movie'); }

  // Next episode from the local history (Lampa timelines), no network: {season, episode} or null.
  function nextEpisode(movie) {
    var ch = getChoice(movie.id);
    if (!ch.voice || !ch.season) return null;
    var s = ch.season, last = 0, pct = 0;
    if (ch.episode) {   // the episode watched last
      var t0 = timelineOf(movie, s, ch.episode);
      last = ch.episode; pct = t0 ? t0.percent : 0;
    } else {            // older history: the furthest episode with progress
      var fw = furthestWatched(movie, s, 200);
      if (fw) { last = fw.e; pct = fw.pct; }
    }
    if (!last) return { season: s, episode: 1 };
    if (pct < WATCHED) return { season: s, episode: last };
    var count = 0;
    (movie.seasons || []).forEach(function (x) { if (parseInt(x.season_number, 10) === s) count = x.episode_count || 0; });
    var seasons = parseInt(movie.number_of_seasons, 10) || 0;
    if (count && last >= count && s < seasons) return { season: s + 1, episode: 1 };
    // the last episode of the last season watched: the series again from its first episode
    if (count && last >= count && seasons && s >= seasons) return { season: firstSeason(movie), episode: 1, restart: true };
    return { season: s, episode: last + 1 };
  }
  function firstSeason(movie) {
    var f = 0;
    (movie.seasons || []).forEach(function (x) { var n = parseInt(x.season_number, 10); if (n > 0 && (!f || n < f)) f = n; });
    return f || 1;
  }

  // What one tap plays. keys: voices to look for (remembered, else favourites); none found ->
  // the short voice menu. Series: the next unwatched episode (or the first one).
  function quickPlan(movie) {
    var ch = getChoice(movie.id), fav = favKeys();
    if (isSerial(movie)) {
      var ne = nextEpisode(movie);
      if (ne) return { season: ne.season, episode: ne.episode, keys: [ch.voice], src: ch.pin || ch.src, restart: ne.restart };
      var ss = ch.season || seasonWithProgress(movie, seasonRange(movie, 1)) || firstSeason(movie), fw = furthestWatched(movie, ss, 200);
      return { season: ss, episode: fw ? (fw.pct >= WATCHED ? fw.e + 1 : fw.e) : 1, keys: ch.voice ? [ch.voice] : fav, src: ch.pin || ch.src, fav: !ch.voice };
    }
    var tl = timelineOf(movie, 0, 0);
    return { season: 0, episode: 0, keys: ch.voice ? [ch.voice] : fav, src: ch.voice ? ch.pin || ch.src : null, fav: !ch.voice,
      restart: watched(tl) };
  }

  function quickStart(movie, plan) {
    primeVideo();   // the tap on «Watch» / «Continue»: the play comes seconds later (see primeVideo)
    // spinner; cancelling it returns to the card's buttons
    var backTo = plan.ctl || 'full_start';   // where a cancel returns (the card's buttons, or the caller's)
    function spin() { return loading(newOp(), backTo); }
    var alive = spin(), t0 = Date.now(), sess = null, finished = false, asking = false, timer;
    var season = plan.season;
    function stop() { finished = true; clearInterval(timer); if (sess) sess.unlisten(check); }
    function toScreen() { stop(); Lampa.Loading.stop(); openView(movie); }
    function check() {
      if (finished || asking) return;
      if (!alive()) { stop(); return; }
      if (!sess) return;
      var busy = sess.pending(season);   // (a movie: season 0)
      var voices = sess.voices(season), v = null, idx = -1;
      for (var i = 0; i < plan.keys.length && !v; i++) { v = findVoice(voices, plan.keys[i]); if (v) idx = i; }
      v = variantFor(voices, v, plan.src);
      if (!v) {
        // nothing remembered / no favourite here: the short menu (what has been found so far)
        var waited = Date.now() - t0 > (plan.keys.length ? VOICE_WAIT : ROOT_WAIT);
        if (!busy || (waited && voices.length)) { if (voices.length) shortMenu(voices); else toScreen(); }
        return;
      }
      // a favourite higher in the list may still come from a slower source
      if (idx > 0 && busy && Date.now() - t0 < VOICE_WAIT) return;
      var has = false;
      v.cands.forEach(function (c) { if (c.src === plan.src) has = true; });
      // wait for the source used last time only while it has not answered yet
      var srcBusy = busy && (!sess.answered[plan.src] || (sess.serial && sess.inflight[season + ':' + plan.src]));
      if (plan.src && !has && srcBusy) {
        if (Date.now() - t0 > SLOW_SRC && !plan.src_wait) ask(v);
        return;
      }
      go(v, has ? plan.src : null);
    }
    function ask(v) {
      asking = true;
      Lampa.Loading.stop();
      Lampa.Select.show({
        title: tr('src_slow', plan.src, v.cands[0].src),
        items: [{ title: tr('switch_yes'), yes: true }, { title: tr('keep_waiting') }],
        onSelect: function (a) {
          if (a.yes) { go(v, null); return; }
          wait();
        },
        onBack: wait
      });
    }
    function wait() { asking = false; plan.src_wait = true; alive = spin(); }
    // Top voices (preferred languages first, as in the voice list) + "All voice-overs ›". The pick is
    // remembered for the title: the next tap plays it at once.
    // The choice offered: the voices in the preferred languages (favourites too); none there: all
    // voice-overs found. One voice to offer = no question, it plays.
    function shortMenu(voices) {
      var real = voices.filter(function (x) { return x.rank < 5; });
      if (!real.length) real = voices;
      var mine = real.filter(function (x) { return x.pref || x.fav; });
      var offer = mine.length ? mine : real;
      if (offer.length === 1) { saveChoice(movie.id, { voice: offer[0].key, pin: '' }); go(offer[0], null); return; }
      asking = true;
      Lampa.Loading.stop();
      var items = offer.map(function (x) {
        return { title: x.label, subtitle: voiceLangNote(x) + tr('src_n', x.cands.length), v: x };
      });
      if (offer.length < voices.length) items.push({ title: tr('all_voices') + ' ›', all: true });
      Lampa.Select.show({
        title: movie.title || movie.name || tr('watch'),
        items: items,
        onSelect: function (a) {
          if (a.all) { toScreen(); return; }
          saveChoice(movie.id, { voice: a.v.key, pin: '' });
          go(a.v, null);
        },
        onBack: function () { stop(); try { Lampa.Controller.toggle(backTo); } catch (e) {} }
      });
    }
    function go(v, prefer) {
      stop();
      var pb = new Playback(sess, v, season);
      pb.prefer = prefer;
      pb.restart = !!plan.restart;   // everything watched: from the start
      pb.onFail = function () { openView(movie); };
      pb.ctl = backTo;   // a cancelled spinner returns to where it was started (the card's buttons by default)
      if (!sess.serial) { pb.start(0, null); return; }
      // episodes for the player's playlist: what the sources of this voice have, TMDB titles
      tmdbSeasonOf(sess.movie, season, function (tm) {
        if (!alive()) return;   // cancelled while TMDB was answering
        var byNum = {};
        tm.forEach(function (t) { byNum[t.episode_number] = t; });
        pb.start(plan.episode, playlistOf(voiceEpisodesOf(sess, v), function (e) { return byNum[e]; }));
      });
    }
    timer = setInterval(check, 500);
    obtainSession(movie, function (s, why) {
      if (finished || !alive()) return;   // already started, sent to the screen or cancelled
      if (!s) { stop(); Lampa.Loading.stop(); noty(why && why[0] !== tr('not_found') ? why[0] + ': ' + why[1] : tr('nf_title')); return; }
      sess = s;
      s.listen(check);
      if (s.serial) { s.claim(null, season); s.loadSeason(season, check); }
      check();
    }, function (s) {
      sess = s;
      s.listen(check);
      if (s.serial) s.claim(null, season);
    });
  }

  // ======================= 12. API FOR THE PACK'S OTHER PLUGINS =======================
  // ---------- the API for the pack's other plugins ----------
  // For other plugins of the pack (alc_ua: subscriptions to new episodes): the episodes one voice has in
  // one season, found the way the «Дивитися» screen finds them. cb({ seasons: [..], episodes: [..],
  // label, cands: [{src, url}] }), or cb(null) when no source answered. A fresh search each call; the
  // caller limits how often and how long.
  // Version 2 adds what «Закусь TV» (snack_tv) needs for its own «Watch» button and episode row:
  // label(movie) - the button text ("Continue · S2E5" / "Watch") and the plan behind it;
  // press(movie) - what a tap on Autopilot's button does; menu(movie) - the «Watch» screen (voices);
  // playEpisode(movie, season, episode) - one episode, with the voice remembered for the title
  // (else the favourite voices, else the short voice menu). The functions are defined further down.
  // Version 3 adds prefLangs() - the preferred voice-over languages, 2-letter codes in order, as
  // Autopilot resolves them itself (the device setting, else the server default, else the interface
  // language; [] = no preference), a copy.
  function curCtl() { try { return Lampa.Controller.enabled().name || 'content'; } catch (e) { return 'content'; } }
  window.alc_auto_api = {
    version: 3,
    // Metadata only, through the viewer's configured server; never open a stream.
    metadataQuality: function (movie, cb) {
      var done = false, timer = setTimeout(function () { finish(null); }, 6500);
      function finish(data) { if (done) return; done = true; clearTimeout(timer); cb(data); }
      withServer(function (base) {
        if (done) return;
        if (!base) { finish(null); return; }
        getJSON(base + '/lite/events?' + rootQuery(movie), function (list) {
          if (done) return;
          var entry = eventSources(base, list).filter(function (e) { return /alloha/i.test(e.name) && !srcOff(e.name); })[0];
          if (!entry) { finish(null); return; }
          getJSON(rootUrl(entry.name, movie, ownBase(entry.url)), finish, function () { finish(null); }, { bg: true });
        }, function () { finish(null); }, { bg: true });
      });
      return function () { done = true; clearTimeout(timer); };
    },
    label: buttonLabel,
    prefLangs: function () { return prefLangs().slice(); },
    // ctl: the controller a cancel returns to (default: whatever has the focus now)
    press: function (movie, ctl) { pressButton(movie, ctl || curCtl()); },
    menu: function (movie) { openView(movie); },
    // (no voice chosen for the title yet: the short voice list first, then that episode)
    playEpisode: function (movie, season, episode, ctl) {
        var ch = getChoice(movie.id), tl = timelineOf(movie, season, episode);
      quickStart(movie, { season: season, episode: episode, keys: ch.voice ? [ch.voice] : [], src: ch.voice ? ch.pin || ch.src : null,
        restart: watched(tl), ctl: ctl || curCtl() });
    },
    voiceEpisodes: function (movie, season, voiceKey, cb) {
      var s = new Session(movie), done = false;
      function fin(r) { if (!done) { done = true; cb(r); } }
      s.loadRoots(function () {
        var seasons = seasonsOf(s);
        if (!s.seasons[season]) { fin(Object.keys(s.answered).length ? { seasons: seasons, episodes: [] } : null); return; }
        s.loadSeason(season, function () {
          var v = s.voices(season).filter(function (x) { return keyMatch(x, voiceKey); })[0];
          if (!v) { fin({ seasons: seasons, episodes: [] }); return; }
          var cands = v.cands.slice(0, 3), left = cands.length;
          if (!left) { fin({ seasons: seasons, episodes: [] }); return; }
          cands.forEach(function (c) { s.candItems(c, function () { if (--left === 0) out(); }); });
          // the pages to re-read later: the voice's own page, else (the source's default voice) its season page
          function pageOf(c) {
            if (c.url) return c.url;
            var p = (s.seasons[season] || []).filter(function (x) { return x.src === c.src && x.url; })[0];
            return p ? p.url : null;
          }
          function out() {
            fin({ seasons: seasons, label: v.label, episodes: numKeys(voiceEpisodesOf(s, v)),
              cands: v.cands.filter(pageOf).slice(0, 3).map(function (c) { return { src: c.src, url: pageOf(c) }; }) });
          }
        });
      });
    }
  };

  // ======================= 13. SETTINGS, THE CARD'S BUTTON, BOOT TASKS =======================
  // ---------- CUB mirror for images ----------
  // Lampa checks its CUB mirrors itself (at start and every 15 minutes: /api/checker over https, then
  // http) and its API requests go to the mirror that answered, over the protocol that answered
  // (cub_alive), with a fallback to the other mirrors. Its images (reaction and profile icons) are no
  // such requests: they load from <protocol setting>://<cub_domain>. A mirror Lampa found alive over
  // http only (an expired https certificate) keeps giving broken icons, and Lampa never looks again
  // (its mirror answers). Only that case is handled here, and only on evidence: a CUB image on the
  // page fails to load while cub_alive is not on the images' protocol, and the mirror does not answer
  // over that protocol either. Then the first of Lampa's mirrors that does is taken the way Lampa
  // takes one (cub_domain + cub_alive) - Lampa's own search prefers https first too, it just is not
  // run again. A mirror Lampa checked over the images' protocol is Lampa's to replace (its own check
  // does it); a Lampa without the check (lampa_settings.mirrors off: a fixed domain) is left alone.
  (function () {
    var busy = false;
    function check(url, cb) {
      var r = String(Math.random());
      $.ajax({ url: url + '/api/checker', type: 'POST', data: { data: r }, dataType: 'text', timeout: 7000,
        success: function (s) { cb(s === r); }, error: function () { cb(false); } });
    }
    function onError(ev) {
      var t = ev && ev.target;
      if (busy || !t || t.tagName !== 'IMG') return;
      try {
        var M = Lampa.Manifest, proto = Lampa.Utils.protocol(), dom = M.cub_domain, alive = String(M.cub_alive || '');
        var list = (M.cub_mirrors || []).slice();
        if (!dom || !list.length || (window.lampa_settings && window.lampa_settings.mirrors === false)) return;
        if (String(t.src || '').indexOf(proto + dom + '/') !== 0 || alive.indexOf(proto) === 0) return;
        if (navigator.onLine === false) return;
        busy = true;   // (once per start, whatever the outcome)
        check(proto + dom, function (ok) {
          if (ok) return;   // the mirror answers: that one image is missing, not the mirror
          (function next() {
            var d = list.shift();
            if (!d) return;
            if (d === dom) { next(); return; }
            check(proto + d, function (good) {
              if (!good) { next(); return; }
              // (Lampa may have moved on meanwhile: then its choice stays)
              if (Lampa.Manifest.cub_domain !== dom || String(Lampa.Manifest.cub_alive || '') !== alive) return;
              Lampa.Storage.set('cub_domain', d, true);
              Lampa.Storage.set('cub_alive', proto + d, true);
              console.log('AlcAuto', 'CUB mirror for images', alive, '->', proto + d);
            });
          })();
        });
      } catch (e) {}
    }
    // image errors do not bubble: caught on their way down (capture)
    try { document.addEventListener('error', onError, true); } catch (e) {}
  })();

  // ---------- settings: Lampa settings section and the long-press menu of the button ----------
  var COMMUNITY = PACK.l;
  function freeText() { return (PACK.f || [])[langIdx()] || ''; }

  // language of a stored "seen" voice (older entries: ua flag)
  function seenLang(x) { return x && x.lang ? x.lang : x && x.ua ? 'uk' : 'und'; }
  // " · <language>" under a voice whose label does not say it
  function voiceLangNote(v) {
    var ln = voiceLang(v);
    return ln && String(v.label).indexOf(ln) < 0 ? ln + ' · ' : '';
  }
  // every source of the server, on / off. The list: the sources seen so far; none yet: the server's
  // list is asked now
  function srcHiddenNote() { var n = srcOffList().length; return n ? tr('src_hidden_n', n) : ''; }
  function groupedVoiceItems(list, make) {
    var order=[],groups={};list.forEach(function (voice) {var lang=voice.lang || 'und';if(!groups[lang]){groups[lang]=[];order.push(lang);}groups[lang].push(make(voice));});
    var items=[];order.forEach(function (lang) {items.push({title:lang==='und'?'Язык не указан':langName(lang),noenter:true});items=items.concat(groups[lang]);});return items;
  }
  function languagesMenu(onBack) {
    var codes=['ru','uk','en','ja','zh','ko','und'],seen=seenVoices();
    Object.keys(seen).forEach(function (key) { var lang=seen[key].lang;if(lang && codes.indexOf(lang)<0)codes.push(lang); });
    var off=storeArr('alc_auto_lang_off');
    Lampa.Select.show({title:'Языки озвучки',items:codes.map(function (lang) { return {title:lang==='und'?'Язык не указан':langName(lang),checkbox:true,checked:off.indexOf(lang)<0,lang:lang}; }),onCheck:function (item) {var list=storeArr('alc_auto_lang_off').filter(function (x) { return x!==item.lang; });if(!item.checked)list.push(item.lang);Lampa.Storage.set('alc_auto_lang_off',list);},onBack:onBack});
  }
  function sourcesMenu(onBack) {
    var show = function (all) {
      if (!all.length) { noty(tr('src_list_none')); if (onBack) onBack(); return; }
      var off = srcOffList();
      Lampa.Select.show({
        title: tr('sources') + (off.length ? ' · ' + srcHiddenNote() : ''),
        items: [{ title: tr('sources'), subtitle: tr('sources_d'), noenter: true }].concat(all.map(function (s) {
          return { title: s, checkbox: true, checked: off.indexOf(s) < 0, src: s };
        })),
        onCheck: function (a) {
          var list = srcOffList().filter(function (x) { return x !== a.src; });
          if (!a.checked) list.push(a.src);
          Lampa.Storage.set('alc_auto_src_off', list);
        },
        onBack: onBack
      });
    };
    var have = knownSources();
    if (have.length) { show(have); return; }
    withServer(function (base) {
      if (!base) { show([]); return; }
      getJSON(base + '/lite/events?serial=-1', function (list) {
        eventSources(base, list);
        show(knownSources());
      }, function () { show([]); });
    });
  }

  function favMenu(onBack) {
    var seen = seenVoices(), fav = favKeys();
    var keys = Object.keys(seen).sort(function (a, b) {
      var fa = fav.indexOf(a) >= 0, fb = fav.indexOf(b) >= 0;
      var pa = prefIndex(seenLang(seen[a])), pb = prefIndex(seenLang(seen[b]));
      return (fb - fa) || (seen[b].n - seen[a].n) || ((pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb)) || String(seen[a].l).localeCompare(String(seen[b].l));
    });
    if (!keys.length) { noty(tr('fav_empty')); if (onBack) onBack(); return; }
    Lampa.Select.show({
      title: tr('fav_voices'),
      items: keys.map(function (k) {
        var ln = langName(seenLang(seen[k])), lab = String(seen[k].l || '');
        return { title: lab + (ln && lab.indexOf(ln) < 0 ? ' · ' + ln : ''), subtitle: seen[k].n ? tr('chosen_n', seen[k].n) : '',
          checkbox: true, checked: fav.indexOf(k) >= 0, key: k };
      }),
      onCheck: function (a) {
        var list = favKeys().filter(function (x) { return x !== a.key; });
        if (a.checked) list.push(a.key);   // the order of ticking is the order of preference
        Lampa.Storage.set('alc_auto_fav_keys', list);
      },
      onBack: onBack
    });
  }

  // the long press of the button: what concerns this title; everything else is in «Закусь»
  function buttonMenu(movie) {
    var serial = isSerial(movie);
    function back() { Lampa.Controller.toggle('full_start'); }
    Lampa.Select.show({
      title: tr('plugin_name'),
      items: [
        { title: serial ? tr('episodes_list') : tr('choose_voice'), open: true },
        { title: tr('sources') + ' ›', subtitle: srcHiddenNote(), sources: true },
        { title: tr('all_settings') + ' ›', settings: true }
      ],
      onSelect: function (a) {
        if (a.open) openView(movie);
        else if (a.sources) sourcesMenu(function () { buttonMenu(movie); });
        // the settings panel first (Lampa draws a folder inside it), then «Закусь»
        else if (a.settings) setTimeout(function () { try { Lampa.Controller.toggle('settings'); Lampa.Settings.create('snack'); } catch (e) { back(); } }, 0);
      },
      onBack: back
    });
  }


  // ---------- the pack's settings folders (the same block in every plugin of the pack) ----------
  // Lampa lists a folder's items in the order plugins added them, and the pack's plugins load in any
  // order. Here each item names its group and its place in it; when Lampa draws a folder (it reads the
  // list through getParam every time) the list comes in that order, an item whose snack_show() says no
  // is left out, and a group with nothing left loses its title. «Закусь», the pack's own folder, is a
  // menu of sub-folders (Lampa components hidden from Settings' own list, opened from «Закусь» with
  // Back leading to it): items are still added to «Закусь» with a group, and the group decides the
  // sub-folder they are drawn in (copies of an older block, loaded first, keep working the same way).
  // Its last group, «О паке», lists the installed plugins' versions and resets the pack's options (not
  // the data: favourite voices, subscriptions…). The newest copy of this block serves all.
  var PACKSET_V = 4;
  function packSettings() {
    var S = window.snack_set;
    if (S && S.v >= PACKSET_V) return S;
    var api = Lampa.SettingsApi, old = S || {};
    function L(a) { var l = 'ru'; try { l = String(Lampa.Storage.get('language', 'ru') || 'ru'); } catch (e) {} return a[l === 'uk' ? 1 : l === 'ru' || l === 'be' ? 0 : 2]; }
    var TXT = {
      about: ['О паке', 'Про пак', 'About the pack'], versions: ['Версии', 'Версії', 'Versions'],
      reset: ['Сбросить настройки', 'Скинути налаштування', 'Reset settings'],
      reset_d: ['Все настройки, кроме ваших данных (озвучки, подписки) и адреса сервера', 'Усі налаштування, крім ваших даних (озвучення, підписки) й адреси сервера', 'Every option except personal data (voices, subscriptions) and server address'],
      reset_q: ['Сбросить настройки?', 'Скинути налаштування?', 'Reset settings?'],
      yes: ['Сбросить', 'Скинути', 'Reset'], no: ['Отмена', 'Скасувати', 'Cancel'],
      watch: ['Просмотр', 'Перегляд', 'Watching'],
      watch_d: ['Запуск, озвучки, источники', 'Запуск, озвучення, джерела', 'Playback, voices, sources'],
      langs: ['Языки и субтитры', 'Мови й субтитри', 'Languages and subtitles'],
      langs_d: ['Порядок языков озвучки и субтитров', 'Порядок мов озвучення й субтитрів', 'The order of voice and subtitle languages'],
      cards: ['Главная и карточки', 'Головна й картки', 'Home and cards'],
      cards_d: ['Метка UA, трейлеры, фильтр ленты', 'Мітка UA, трейлери, фільтр стрічки', 'UA badge, trailers, feed filter'],
      feed: ['Фильтр ленты', 'Фільтр стрічки', 'Feed filter'],
      feed_d: ['Что прятать в лентах TMDB и CUB', 'Що ховати у стрічках TMDB і CUB', 'What to hide from the TMDB and CUB lists'],
      subs: ['Подписки', 'Підписки', 'Subscriptions'],
      subs_d: ['Новые серии в выбранной озвучке', 'Нові серії в обраному озвученні', 'New episodes in a chosen voice'],
      server: ['Сервер', 'Сервер', 'Server'],
      server_d: ['Ваш сервер с онлайн-источниками', 'Ваш сервер з онлайн-джерелами', 'Your server with online sources']
    };
    S = window.snack_set = { v: PACKSET_V, pages: old.pages || {}, versions: old.versions || {}, seq: old.seq || 0, titled: old.titled || {}, txt: function (k) { return L(TXT[k] || [k, k, k]); } };
    // the sub-folders of «Закусь»: the groups drawn in them, their parent, their place in it
    var SUBS = [
      { id: 'snack_watch', group: 'watch', parent: 'snack', o: 10 },
      { id: 'snack_langs', group: 'langs', parent: 'snack', o: 20 },
      { id: 'snack_cards', group: 'cards', parent: 'snack', o: 30 },
      { id: 'snack_feed', group: 'feed', parent: 'snack_cards', o: 900 },
      { id: 'snack_subs', group: 'subs', parent: 'snack', o: 40 },
      { id: 'snack_server', group: 'server', parent: 'snack', o: 50, keep: true }   // keep: the viewer's own (reset leaves it)
    ];
    S.subs = SUBS;
    S.subId = {}; S.subGroup = {};
    SUBS.forEach(function (s) { S.subId[s.id] = s; S.subGroup[s.group] = s; });
    // a plugin may say what its sub-folder holds now (its button's line): S.describe(group, fn → text)
    S.descr = old.descr || {};
    S.describe = function (group, fn) { S.descr[group] = fn; };
    function subOf(group) { return S.subGroup[group] || null; }
    function subById(id) { return S.subId[id] || null; }
    if (!api.snack_get) {
      var get = api.getParam;
      api.snack_get = get;
      api.getParam = function (name) { var list = get.apply(this, arguments); try { return window.snack_set.list(name, list); } catch (e) { return list; } };
    }
    // the sub-folders are not in Settings' own list (they open from «Закусь»)
    if (!api.snack_all) {
      var all = api.allComponents;
      api.snack_all = all;
      api.allComponents = function () {
        var c = all.apply(this, arguments), out = {}, ids = (window.snack_set && window.snack_set.subId) || {};
        for (var k in c) if (!ids[k]) out[k] = c[k];
        return out;
      };
    }
    function visible(d) {
      if (d.snack_title) return true;
      try { return !d.snack_show || !!d.snack_show(); } catch (e) { return true; }
    }
    function seq(d) { if (d.snack_i === undefined) d.snack_i = ++S.seq; }
    function byPlace(a, b) { return (a.snack_o || 0) - (b.snack_o || 0) || a.snack_i - b.snack_i; }
    function inSub(d, group) { return d.snack_g === group && !d.snack_title; }
    // a sub-folder has something to show (its button is listed): the first shown item is enough
    function anyShown(group) {
      var l = api.snack_get('snack') || [];
      for (var i = 0; i < l.length; i++) if (inSub(l[i], group) && visible(l[i])) return true;
      return false;
    }
    // the list Lampa draws: shown items, by group, place, then the order they came in. «Закусь»: the
    // groups of the sub-folders leave it (their buttons stay); a sub-folder: the items of its group
    S.list = function (name, list) {
      var sub = subById(name);
      if (sub) {
        list = (api.snack_get('snack') || []).filter(function (d) { return inSub(d, sub.group); });
        list.forEach(seq);
        return list.filter(visible).sort(byPlace);
      }
      var pg = S.pages[name];
      if (!pg || !list) return list;
      if (name === 'snack') list = list.filter(function (d) { return !subOf(d.snack_g); });
      var rank = {}, used = {};
      pg.groups.forEach(function (g, i) { rank[g.id] = i; });
      var out = list.filter(function (d) {
        seq(d);
        if (d.snack_title) return true;
        var ok = visible(d);
        if (ok) used[d.snack_g] = 1;
        return ok;
      }).filter(function (d) { return !d.snack_title || used[d.snack_title]; });
      function r(d) { return d.snack_g === undefined ? pg.legacy : rank[d.snack_g] !== undefined ? rank[d.snack_g] : 99; }
      return out.sort(function (a, b) { return r(a) - r(b) || byPlace(a, b); });
    };
    // a folder: groups [{id, title}] in order; items of plugins that know no groups (an older copy of
    // this block) go at `legacy` (a group's index, may be fractional)
    S.page = function (id, def) {
      if (S.pages[id]) return S.pages[id];
      S.pages[id] = { groups: def.groups, legacy: def.legacy || 0 };
      api.addComponent({ component: id, name: def.name, icon: def.icon });
      return S.pages[id];
    };
    // an item: Lampa's addParam data, plus its group and place (snack_show: when to list it)
    S.add = function (id, group, order, data) {
      var pg = S.pages[id], g = pg && pg.groups.filter(function (x) { return x.id === group; })[0];
      if (g && g.title && !S.titled[id + '|' + group]) {
        S.titled[id + '|' + group] = 1;
        api.addParam({ component: id, param: { name: 'snack_t_' + id + '_' + group, type: 'title' }, field: { name: g.title }, snack_g: group, snack_o: -1e9, snack_title: group });
      }
      data.component = id;
      data.snack_g = group;
      data.snack_o = order;
      api.addParam(data);
    };
    // open a folder of the pack; a sub-folder's Back leads to its parent (also after Lampa redraws it),
    // the focus on the button of the sub-folder left (focus: an item's name)
    function focusIndex(id, name) {
      if (!name) return 0;
      var list = S.list(id, api.snack_get(id) || []) || [], i = 0, at = -1;
      list.forEach(function (d) { var t = d.param && d.param.type; if (t === 'title' || t === 'static') return; if (d.param.name === name) at = i; i++; });
      return at > 0 ? at : 0;
    }
    S.backTo = function (sub) { return function () { window.snack_set.open(sub.parent, 'snack_open_' + sub.group); }; };
    S.open = function (id, focus) {
      var sub = subById(id), params = {};
      if (sub) params.onBack = S.backTo(sub);
      var at = focusIndex(id, focus);
      if (at) params.last_index = at;
      Lampa.Settings.create(id, params);
    };
    // Lampa redraws a folder (Settings.update) without the params it was opened with: Back put back
    if (!api.snack_back) try {
      api.snack_back = true;
      Lampa.Settings.listener.follow('open', function (e) {
        var T = window.snack_set, s = e && T && T.subId && T.subId[e.name];
        if (s && e.params && !e.params.onBack) e.params.onBack = T.backTo(s);
      });
    } catch (e) {}
    // reset the pack's options (triggers, lists, fields of «Закусь» and its sub-folders) to their
    // defaults, after a question
    S.reset = function (id, done) {
      var back = function () { try { Lampa.Controller.toggle('settings_component'); } catch (e) {} };
      Lampa.Select.show({
        title: S.txt('reset_q'), items: [{ title: S.txt('yes'), yes: true }, { title: S.txt('no') }],
        onSelect: function (a) {
          back();
          if (!a.yes) return;
          (api.snack_get(id) || []).forEach(function (d) {
            var p = d.param || {}, sub = subOf(d.snack_g);
            if (sub && sub.keep) return;   // the viewer's own (the server address), like their data
            if (/^(trigger|select|input)$/.test(p.type) && p['default'] !== undefined) try { Lampa.Storage.set(p.name, p['default']); } catch (e) {}
          });
          try { if (done) done(); } catch (e) {}
          setTimeout(function () { try { Lampa.Settings.update(); } catch (e) {} }, 0);
        },
        onBack: back
      });
    };
    // «Закусь»: created by whichever plugin of the pack comes first; its sub-folders and their buttons
    S.version = function (name, v) { S.versions[name] = v; };
    var ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16l-2 16H6L4 4zm2.3 2 .3 2.5h10.8l.3-2.5H6.3z" fill="currentColor"/></svg>';
    S.pack = function () {
      if (S.pages.snack && S.pages.snack.v2) return 'snack';
      window.snack_settings = true;   // older copies: the folder is there
      var made = !!S.pages.snack;
      S.pages.snack = { v2: true, groups: [{ id: 'menu' }, { id: 'about', title: S.txt('about') }], legacy: 0.5 };
      if (!made) api.addComponent({ component: 'snack', name: 'Воспроизведение', icon: ICON });
      SUBS.forEach(function (s) {
        api.addComponent({ component: s.id, name: S.txt(s.group), icon: ICON });
        // the button: in «Закусь» (group menu) or, for a sub-folder of a sub-folder, in its parent's group
        var parent = subById(s.parent);
        S.add('snack', parent ? parent.group : 'menu', s.o, {
          param: { name: 'snack_open_' + s.group, type: 'button' }, field: { name: S.txt(s.group), description: S.txt(s.group + '_d') },
          snack_show: function () { return anyShown(s.group); },
          onRender: function (item) {
            var f = window.snack_set.descr[s.group], t = '';
            try { t = f ? f() : ''; } catch (e) {}
            if (t) item.find('.settings-param__descr').text(t);
          },
          onChange: function () { S.open(s.id); } });
      });
      var have = {};
      try { have = adopt(); } catch (e) {}
      if (!have.snack_versions) S.add('snack', 'about', 80, { param: { name: 'snack_versions', type: 'static' }, field: { name: S.txt('versions'), description: ' ' },
        onRender: function (item) {
          var v = window.snack_set.versions, list = Object.keys(v).sort().map(function (k) { return k + ' ' + v[k]; });
          item.find('.settings-param__descr').text(list.join(' · '));
        } });
      if (!have.snack_reset) S.add('snack', 'about', 90, { param: { name: 'snack_reset', type: 'button' }, field: { name: S.txt('reset'), description: S.txt('reset_d') },
        onChange: function () { window.snack_set.reset('snack'); } });
      return 'snack';
    };
    // «О паке» items an older copy added: kept (no second one), its reset button says what reset does now
    function adopt() {
      var have = {};
      (api.snack_get('snack') || []).forEach(function (d) {
        if (!d.param) return;
        have[d.param.name] = 1;
        if (d.param.name === 'snack_reset' && d.field) d.field.description = S.txt('reset_d');
      });
      return have;
    }
    // an older copy made «Закусь» already: take it over
    if (window.snack_settings && !(S.pages.snack && S.pages.snack.v2)) { delete window.snack_settings; S.pack(); }
    else try { adopt(); } catch (e) {}
    return S;
  }
  // Autopilot's options in «Закусь»: Watching, Languages, About the pack
  function addSettings() {
    function toSettings() { Lampa.Settings.create('snack_watch'); }
    if (!Lampa.SettingsApi || window.alc_auto_settings) return;
    window.alc_auto_settings = true;
    var S = packSettings(), C = S.pack();
    S.version(tr('plugin_name'), VERSION);
    S.add(C, 'watch', 10, { param: { name: 'alc_auto_quick_movie', type: 'trigger', 'default': true }, field: { name: tr('set_quick_movie') } });
    S.add(C, 'watch', 20, { param: { name: 'alc_auto_quick_series', type: 'trigger', 'default': true }, field: { name: tr('set_quick_series') } });
    S.add(C, 'watch', 30, { param: { name: 'alc_auto_fav_btn', type: 'button' }, field: { name: tr('fav_voices') + ' ›' },
      onChange: function () { favMenu(toSettings); } });
    S.add(C, 'watch', 40, { param: { name: 'alc_auto_src_btn', type: 'button' }, field: { name: tr('sources') + ' ›', description: tr('sources_d') },
      onRender: function (item) { try { var n = srcHiddenNote(); if (n) item.find('.settings-param__name').text(tr('sources') + ' › · ' + n); } catch (e) {} },
      onChange: function () { sourcesMenu(toSettings); } });
    S.add(C, 'watch', 50, { param: { name: 'alc_auto_studios_btn', type: 'button' }, field: { name: tr('studios') + ' ›', description: tr('studios_d') },
      onChange: function () { studiosMenu(toSettings); } });
    S.add(C, 'langs', 10, { param: { name: 'alc_auto_langs', type: 'input', values: '', placeholder: prefLangs().join(','), 'default': 'ru' },
      field: { name: tr('voice'), description: tr('set_langs_d') } });
    S.add(C, 'langs', 20, {param:{name:'alc_auto_visible_languages',type:'button'},field:{name:'Языки озвучки',description:'Показывать или скрывать языки в фильмах и сериалах. Неопределённые языки вынесены отдельно.'},onChange:function () {languagesMenu(function () {Lampa.Settings.create('snack_langs');});}});
    S.add(C, 'langs', 30, { param: { name: 'alc_auto_autosubs', type: 'select', values: { off: tr('as_off'), forced: tr('as_forced'), voice: tr('as_voice') }, 'default': 'forced' },
      field: { name: tr('autosubs'), description: tr('autosubs_d') } });
    // the server: empty = found by itself (the line says which one was found)
    S.add(C, 'server', 10, { param: { name: 'alc_auto_server', type: 'input', values: '', placeholder: tr('srv_auto'), 'default': '' },
      field: { name: tr('set_server'), description: tr('set_server_d') },
      onRender: function (item) {
        if (serverSetting()) return;
        withServer(function (b) { try { item.find('.settings-param__value').text(b ? tr('srv_auto') + ': ' + b : tr('srv_none')); } catch (e) {} });
      } });
    // Community promotions omitted from the integrated settings.
  }

  // Watched before, by Lampa's own timelines (a core store, kept in sync by whatever sync the viewer
  // uses): a series with progress in some season, a movie started. With no voice chosen on this
  // device, «Continue» still knows where to go on; the voice is asked first (see pressButton).
  function hasProgress(movie) {
    if (isSerial(movie)) return !!seasonWithProgress(movie, seasonRange(movie, 1));
    var tl = timelineOf(movie, 0, 0);
    return !!(tl && tl.percent > 0);
  }
  // Button text: "Continue · S2E5" for a series being watched (when enabled), else "Watch".
  function buttonLabel(movie) {
    var plan = isSerial(movie) && quickOn(movie) && (getChoice(movie.id).voice || hasProgress(movie)) ? quickPlan(movie) : null;
    return { text: plan ? tr('continue_se', plan.season, plan.episode) : tr('watch'), season: plan ? plan.season : 0, episode: plan ? plan.episode : 0 };
  }
  function labelButton(btn, movie) { btn.find('span').text(buttonLabel(movie).text); }
  // a tap: play at once (quick start), else the screen; ctl: where a cancelled spinner returns
  // (default: the card's buttons). A title whose voice was never chosen opens the screen with its
  // voice list, as without the quick start: the viewer picks the voice, the next tap plays it at once.
  // Watched before but no voice chosen on this device (another device, Lampa's own «Онлайн»): the
  // short voice menu at the episode the timelines point to; the voice picked there is remembered.
  function pressButton(movie, ctl) {
    var voice = getChoice(movie.id).voice;
    var plan = quickOn(movie) && (voice || hasProgress(movie)) ? quickPlan(movie) : null;
    if (!plan) { openView(movie); return; }
    if (!voice) { plan.keys = []; plan.fav = false; plan.src = null; }   // never a favourite at once: the viewer picks
    if (ctl) plan.ctl = ctl;
    quickStart(movie, plan);
  }

  var ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14z" fill="currentColor"/></svg>';

  // after playback the "Continue · S2E5" label moves on
  var buttons = [];
  // only the buttons of cards still on the page (Lampa keeps the last few cards; a closed one never comes
  // back - it is built anew): a closed card's button would hold its whole card head. Pruned when a card
  // closes and before a button is added, so the list stays as short as the cards Lampa keeps
  function pruneButtons() { buttons = buttons.filter(function (b) { return $.contains(document.documentElement, b.btn[0]); }); }
  try { Lampa.Listener.follow('activity', function (e) { if (e.type === 'destroy') pruneButtons(); }); } catch (e) {}
  try { Lampa.Player.listener.follow('destroy', later(function () { buttons.forEach(function (b) { labelButton(b.btn, b.movie); }); })); } catch (e) {}
  // the "Continue" option switched in Lampa's settings: the button on the open card follows
  try { Lampa.Storage.listener.follow('change', function (e) { if (/^alc_auto_quick_(series|movie)$/.test(e && e.name)) buttons.forEach(function (b) { labelButton(b.btn, b.movie); }); }); } catch (e) {}
  if (window.appready) addSettings();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addSettings(); });
  // The voice chosen per title follows the viewer to the other devices through Lampa's own sync API
  // (Lampa.Storage.sync: CUB, or any sync plugin that honours it; one entry per title, so two devices
  // do not overwrite each other). Without a sync it does nothing; the choice stays on this device.
  function declareSync() { try { if (Lampa.Storage.sync) Lampa.Storage.sync('alc_auto_choice', 'object_object'); } catch (e) {} }
  if (window.appready) declareSync();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') declareSync(); });

  // The button only when a server is there: on a stock Lampa without Lampac (lampa.mx and alike) it
  // would only take the main place to say «no server»; Lampa's own «Watch» with the viewer's other
  // online plugins stays the way in (the theme shows it too: alc_auto_server answers ''). The settings
  // stay, so an address can be set; the next card opened has the button. A server already known
  // answers at once (the button is there when the card shows); the first search on a device may take
  // a moment, then the button joins and takes the focus only from Lampa's own play button.
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;
    var now = true;
    withServer(function (base) { if (base) addButton(e, now); });
    now = false;
  });
  function addButton(e, now) {
    // Lampa View has one Watch action, routed to the installed Online provider.
    if (window.LampaView && document.body.classList.contains('lampa_view')) return;
    try {
      var render = e.object.activity.render();
      if (render.find('.button--alc-auto').length) return;
      var movie = (e.data && e.data.movie) || (e.object && e.object.card) || {};
      var btn = $('<div class="full-start__button selector button--alc-auto">' + ICON + '<span>' + tr('watch') + '</span></div>');
      labelButton(btn, movie);
      btn.on('hover:enter', function () { pressButton(movie); });
      btn.on('hover:long', function () { buttonMenu(movie); });
      pruneButtons();
      buttons.push({ btn: btn, movie: movie });
      var play = render.find('.button--play').first();
      if (play.length) play.before(btn);
      else {
        var box = render.find('.full-start-new__buttons, .full-start__buttons').first();
        if (!box.length) return;
        box.prepend(btn);
      }
      // make it the focused button. Added later: the card's buttons already have the focus, so the
      // button joins their navigation (else the next toggle of the card collects it); the focus moves
      // only while it is still on Lampa's play button of this card (the viewer may have moved on)
      if (!now) {
        // the card on screen: Lampa keeps earlier cards in the page too (their full_start is gone)
        var ctl = '', act = null;
        try { ctl = Lampa.Controller.enabled().name; } catch (er) {}
        try { act = Lampa.Activity.active(); } catch (er) {}
        var mine = act && act.activity ? act.activity === e.object.activity : render.closest('.activity--active').length > 0;
        if (ctl !== 'full_start' || !mine) return;
        try { Lampa.Controller.collectionAppend(btn); } catch (er) {}
        if (!render.find('.button--play.focus').length) return;
      }
      try { Lampa.Controller.collectionFocus(btn[0], render.find('.full-start-new__buttons, .full-start__buttons').first()); } catch (er) {}
    } catch (err) {
      console.error('AlcAuto', err && err.message);
    }
  }

  // internals for test harnesses (classifier / UI tests)
  window.alc_auto_debug = { classify: classify, saveChoice: saveChoice, Session: Session, Playback: Playback, TitleModel: TitleModel, quickStart: quickStart, quickPlan: quickPlan, labelButton: labelButton, pressButton: pressButton,
    withServer: withServer, serverCands: function () { return packSrv().cands(SCRIPT_ORIGIN); }, ownBase: ownBase, pickTrack: pickTrack, fixTrack: fixTrack, playTrack: playTrack, lang2: lang2,
    extPlaylist: extPlaylist, obtainSession: obtainSession, srcOff: srcOff, sourcesMenu: sourcesMenu, srv: srv, base: function () { return BASE; },
    downWhy: downWhy, spdOptions: spdOptions, spdMeasure: spdMeasure, spdSwitch: spdSwitch, speedCheck: speedCheck, speed: function () { return spdLast; },
    spdKey: spdKey, spdHosts: function () { return spdHosts; }, notSourceAnswer: notSourceAnswer, eventSources: eventSources,
    playingOurs: playingOurs, subsLang: subsLang, hosts: function () { return hosts; }, getJSON: getJSON, hostKey: hostKey, retryAfter: retryAfter,
    primeVideo: function () { return packPrime().prime(); } };
})();
