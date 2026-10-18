// Suggest 1.3.2 by @nikitagk22 — https://nikitagk22.github.io/suggest.js
// Adapted for Lampa Minimal: unified settings/palette, no extension polling or manifest replacement, safe text, request cleanup.
(function () {
    'use strict';

    if (window.kino_search_suggest_plugin) return;
    window.kino_search_suggest_plugin = true;

    var PLUGIN_NAME = 'suggest';
    var PLUGIN_VERSION = '1.3.2';

    var API_URL = 'https://kinoapi.lampac.dev/api/v1/search/suggest';

    var currentSources = null;
    var currentQuery = '';
    var debounceTimer = null;
    var cache = Object.create(null);
    var searchOpen = false;
    var lastRequestId = 0;
    var isApplyingSuggestion = false;
    var lastFocusedSuggest = null;
    var scroll = null;
    var activeSuggestElements = [];
    var activeImmediateQuery = '';
    var activeImmediateTime = 0;
    var activeAbortController = null;
    var activeXhr = null;

    function getNavigator() {
        if (typeof Navigator !== 'undefined' && typeof Navigator.move === 'function') return Navigator;
        if (window.Navigator && typeof window.Navigator.move === 'function') return window.Navigator;
        if (window.Lampa && window.Lampa.Navigator && typeof window.Lampa.Navigator.move === 'function') return window.Lampa.Navigator;
        return null;
    }

    function getSetting(key, def) {
        try {
            return Lampa.Storage.get(key, def);
        } catch (e) {
            return def;
        }
    }

    function isEnabled() {
        var value = Lampa.Storage.value ? Lampa.Storage.value('kino_suggest_status', 'true') : getSetting('kino_suggest_status', true);
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function getMinChars() {
        var val = parseInt(getSetting('kino_suggest_min_chars', '3'), 10);
        return isNaN(val) ? 3 : val;
    }

    function setHistoryVisible(visible) {
        var hist = $('.search__body .search__history');
        if (hist.length) {
            if (visible) {
                hist.removeClass('hide').css('display', '');
            } else {
                hist.addClass('hide').css('display', 'none');
            }
        }
    }

    function isHistoryHidden() {
        var hist = $('.search__body .search__history');
        return hist.length > 0 && (hist.hasClass('hide') || hist.css('display') === 'none' || hist.is(':hidden'));
    }

    function injectStyles() {
        $('#kino-suggest-styles').remove();

        var css = `
            .search__history.hide {
                display: none !important;
            }

            .search__suggests {
                margin-bottom: 0.6em;
                width: 100%;
                box-sizing: border-box;
                position: relative;
            }

            .search__suggests.hide {
                display: none !important;
            }

            .search__suggests .scroll {
                padding-top: 0.2em !important;
                padding-bottom: 0.3em !important;
            }

            .search__suggests .scroll__body {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
            }

            .search-suggest-item {
                display: flex;
                align-items: center;
                box-sizing: border-box;
                background-color: var(--pt-panel, #0b0b0b);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 0.35em;
                padding: 0.35em 0.85em;
                color: var(--pt-text, #e8eaed);
                cursor: pointer;
                flex-shrink: 0;
                white-space: nowrap;
                height: 2.6em;
                margin-right: 0.6em;
                position: relative;
                transform: none !important;
                transition: background-color 0.2s, color 0.2s, border-color 0.2s;

                width: calc((100vw - 3em - 1.8em) / 4);
                min-width: 13em;
                max-width: 25em;
            }

            @media screen and (max-width: 1199px) {
                .search-suggest-item {
                    width: calc((100vw - 3em - 1.2em) / 3);
                    min-width: 11em;
                    max-width: 22em;
                }
            }

            @media screen and (max-width: 768px) {
                .search-suggest-item {
                    width: calc((100vw - 2em - 0.6em) / 2);
                    min-width: 9.5em;
                    max-width: 18em;
                    padding: 0.3em 0.6em;
                    height: 2.3em;
                }
            }

            .search-suggest-item__icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 1.15em;
                height: 1.15em;
                margin-right: 0.5em;
                flex-shrink: 0;
                opacity: 0.75;
            }

            .search-suggest-item__icon svg {
                width: 100%;
                height: 100%;
                fill: currentColor;
            }

            .search-suggest-item__title {
                font-size: 1.25em;
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1 1 auto;
                min-width: 0;
                font-weight: 500;
            }

            .search-suggest-item.focus {
                background-color: var(--pt-accent, #add9e5) !important;
                color: #000000 !important;
                border-color: var(--pt-accent, #add9e5) !important;
                transform: none !important;
                box-shadow: none;
            }

            .search-suggest-item.focus .search-suggest-item__icon {
                opacity: 1;
                color: #000000;
            }

            .search-suggest-item.focus .search-suggest-item__title {
                color: #000000;
                font-weight: 600;
            }
        `;

        $('head').append('<style id="kino-suggest-styles">' + css + '</style>');
    }

    function createScrollInstance() {
        if (scroll) {
            scroll.destroy();
            scroll = null;
        }

        scroll = new Lampa.Scroll({
            over: true,
            mask: false,
            horizontal: true
        });

        scroll.onWheel = function (step) {
            if (Lampa.Controller.enabled().name === 'search_suggests') {
                Lampa.Controller.enabled().controller[step > 0 ? 'right' : 'left']();
            }
        };

        var container = $('.search__body .search__suggests');
        if (!container.length) {
            container = $('<div class="search__suggests hide" data-area="suggests"></div>');
            var sources = $('.search__body .search__sources');
            if (sources.length) {

                sources.before(container);
            } else {
                $('.search__body').append(container);
            }
        }

        container.empty().append(scroll.render());
        return container;
    }

    function getContainer() {
        var container = $('.search__body .search__suggests');
        if (!container.length || !scroll) {
            return createScrollInstance();
        }
        return container;
    }

    function resetScroll() {
        if (!scroll) return;
        if (typeof scroll.reset === 'function') {
            scroll.reset();
        }
        try {
            scroll.render().find('.scroll__body').css({
                'transform': 'translate3d(0px, 0px, 0px)',
                '-webkit-transform': 'translate3d(0px, 0px, 0px)'
            });
            scroll.render().scrollLeft(0);
        } catch (e) {}
    }

    function clearSuggestions() {
        if (scroll) {
            scroll.clear();
            resetScroll();
        }
        var container = $('.search__body .search__suggests');
        if (container.length) {
            container.addClass('hide');
        }
        activeSuggestElements = [];
        lastFocusedSuggest = null;
    }

    function isSuggestVisible() {
        var container = $('.search__body .search__suggests');
        return container.length > 0 && !container.hasClass('hide') && activeSuggestElements.length > 0;
    }

    function hasHistory() {
        var keys = getSetting('search_history', '[]');
        if (typeof keys === 'string') {
            try { keys = JSON.parse(keys); } catch (e) { keys = []; }
        }
        return Array.isArray(keys) && keys.length > 0;
    }

    function fetchSuggestions(query, callback) {
        var normalized = query.trim().toLowerCase();
        var cached = cache[normalized];

        if (cached && (Date.now() - cached.time < 15 * 60 * 1000)) {
            return callback(cached.items);
        }

        if (activeAbortController) {
            try { activeAbortController.abort(); } catch (e) {}
            activeAbortController = null;
        }
        if (activeXhr) {
            try { activeXhr.abort(); } catch (e) {}
            activeXhr = null;
        }

        var requestId = ++lastRequestId;
        var url = API_URL + '?q=' + encodeURIComponent(query.trim()) + '&limit=8';

        var handleSuccess = function (data) {
            var items = data && Array.isArray(data.data) ? data.data : [];

            if (Object.keys(cache).length > 200) cache = Object.create(null);
            cache[normalized] = {
                items: items,
                time: Date.now()
            };

            if (requestId !== lastRequestId) return;
            callback(items);
        };

        var handleError = function (err) {
            if (requestId !== lastRequestId) return;
            if (err && err.name === 'AbortError') return;
            console.error('[KinoSuggest] Request failed:', err);
            callback([]);
        };

        if (window.fetch && typeof window.AbortController !== 'undefined') {
            activeAbortController = new window.AbortController();
            window.fetch(url, { signal: activeAbortController.signal })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(handleSuccess)
                .catch(handleError);
        } else if (window.fetch) {
            window.fetch(url)
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(handleSuccess)
                .catch(handleError);
        } else {
            var xhr = new XMLHttpRequest();
            activeXhr = xhr;
            xhr.open('GET', url, true);
            xhr.onload = function () {
                activeXhr = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        handleSuccess(JSON.parse(xhr.responseText));
                    } catch (e) {
                        handleError(e);
                    }
                } else {
                    handleError(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function (e) {
                activeXhr = null;
                handleError(e);
            };
            xhr.onabort = function () {
                activeXhr = null;
            };
            xhr.send();
        }
    }

    function renderSuggestions(items) {
        if (!items || !items.length) {
            clearSuggestions();
            return;
        }

        var container = getContainer();
        scroll.clear();
        resetScroll();
        activeSuggestElements = [];
        lastFocusedSuggest = null;

        var seenTitles = Object.create(null);
        var filteredItems = [];

        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || typeof (it.title_ru || it.title_en || it.original_title) !== 'string') continue;
            var title = (it.title_ru || it.title_en || it.original_title || '').trim();
            if (!title) continue;

            var key = title.toLowerCase();
            if (!seenTitles[key]) {
                seenTitles[key] = true;
                filteredItems.push(it);
            }
            if (filteredItems.length >= 8) break;
        }

        if (!filteredItems.length) {
            clearSuggestions();
            return;
        }

        var searchSvg = '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';

        filteredItems.forEach(function (item, index) {
            var title = item.title_ru || item.title_en || item.original_title;

            var elem = $(`
                <div class="search-suggest-item selector" data-index="${index}">
                    <div class="search-suggest-item__icon">${searchSvg}</div>
                    <div class="search-suggest-item__title"></div>
                </div>
            `);

            elem.find('.search-suggest-item__title').text(title);
            elem.on('hover:enter click', function () {
                applySuggestion(item);
            }).on('hover:focus', function (e) {
                lastFocusedSuggest = e.currentTarget || elem[0];
                if (scroll) {
                    scroll.render().find('.selector').removeClass('focus');
                    $(e.currentTarget).addClass('focus');
                    scroll.update($(e.currentTarget), true);
                }
            });

            scroll.append(elem);
            activeSuggestElements.push(elem[0]);
        });

        container.removeClass('hide');
    }

    function hookSources(sources) {
        currentSources = sources;
        if (!currentSources) return;

        if (typeof currentSources.search === 'function' && !currentSources._kinoSuggestHooked) {
            currentSources._kinoSuggestHooked = true;
            var originalSearch = currentSources.search;

            currentSources.search = function (query, immediately) {
                var norm = (query || '').toLowerCase().trim();

                if (!immediately && activeImmediateQuery && norm === activeImmediateQuery && (Date.now() - activeImmediateTime < 6000)) {
                    return;
                }

                if (immediately) {
                    activeImmediateQuery = norm;
                    activeImmediateTime = Date.now();
                } else if (norm !== activeImmediateQuery) {
                    activeImmediateQuery = '';
                }

                return originalSearch.apply(currentSources, arguments);
            };
        }

        if (currentSources.listener && !currentSources.listener._kinoSuggestHooked) {
            currentSources.listener._kinoSuggestHooked = true;

            currentSources.listener.follow('create', function (data) {
                if (data && data.result && typeof data.result.search === 'function' && !data.result._kinoSuggestHooked) {
                    data.result._kinoSuggestHooked = true;
                    var origResSearch = data.result.search;
                    data.result.search = function (value, immediately) {
                        if (immediately && value && value.length >= 3) {

                            origResSearch.call(data.result, '  ');
                        }
                        return origResSearch.apply(data.result, arguments);
                    };
                }
            });

            currentSources.listener.follow('search', function (data) {
                if (data && data.immediately) {
                    clearSuggestions();
                    return;
                }
                onQueryChange(data ? data.query : '');
            });
        }
    }

    function applySuggestion(item) {
        var title = (item.title_ru || item.title_en || item.original_title || '').trim();
        if (!title) return;

        cancelRequest();
        clearTimeout(debounceTimer);
        currentQuery = '';
        isApplyingSuggestion = true;

        clearSuggestions();
        setHistoryVisible(false);

        try {
            var historyKeys = getSetting('search_history', '[]');
            if (typeof historyKeys === 'string') historyKeys = JSON.parse(historyKeys);
            if (Array.isArray(historyKeys)) {
                var inx = historyKeys.indexOf(title);
                if (inx !== -1) historyKeys.splice(inx, 1);
                historyKeys.push(title);
                Lampa.Storage.set('search_history', historyKeys);
            }
        } catch (e) {}

        $('.search__input').toggleClass('filled', true).text(title);

        if (window.SimpleKeyboardInstances) {
            for (var k in window.SimpleKeyboardInstances) {
                var inst = window.SimpleKeyboardInstances[k];
                if (inst) {
                    if (typeof inst.setInput === 'function') {
                        inst.setInput(title);
                    }
                    if (inst.options && typeof inst.options.onChange === 'function') {
                        try {
                            inst.options.onChange(title);
                        } catch (e) {}
                    }
                }
            }
        }

        var simpleInput = $('.simple-keyboard-input');
        if (simpleInput.length) {
            simpleInput.val(title);
            simpleInput.trigger('input').trigger('change');
        }

        if (typeof window.voiceResult === 'function') {
            try {
                window.voiceResult(title);
            } catch (e) {}
        }

        if (currentSources && typeof currentSources.search === 'function') {
            currentSources.search(title, true);
        }

        if (currentSources && typeof currentSources.toggle === 'function') {
            currentSources.toggle(true);
        } else {
            Lampa.Controller.toggle('keybord');
        }

        setTimeout(function () {
            isApplyingSuggestion = false;
        }, 1500);
    }

    function cancelRequest() {
        ++lastRequestId;
        if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; }
        if (activeXhr) { activeXhr.abort(); activeXhr = null; }
    }

    function onQueryChange(query) {
        if (!searchOpen) return;
        clearTimeout(debounceTimer);
        cancelRequest();
        if (!isEnabled()) {
            clearSuggestions();
            setHistoryVisible(true);
            return;
        }

        if (isApplyingSuggestion) {
            return;
        }

        query = (query || '').trim();
        currentQuery = query;

        clearTimeout(debounceTimer);

        if (query.length > 0) {
            setHistoryVisible(false);
        } else {
            setHistoryVisible(true);
            clearSuggestions();
            return;
        }

        var minChars = getMinChars();

        if (query.length < minChars) {
            clearSuggestions();
            return;
        }

        debounceTimer = setTimeout(function () {
            fetchSuggestions(query, function (items) {
                if (currentQuery === query) {
                    renderSuggestions(items);
                }
            });
        }, 180);
    }

    function toggleSuggests(focusElement) {
        if (!isSuggestVisible() || !scroll) return;

        Lampa.Controller.add('search_suggests', {
            toggle: function () {
                var renderNode = scroll.render();
                Lampa.Controller.collectionSet(renderNode);

                var items = renderNode.find('.selector:visible');
                if (!items.length) return;

                var toFocus = focusElement;
                if (!toFocus || !items.is(toFocus)) {
                    toFocus = lastFocusedSuggest && items.is(lastFocusedSuggest) ? lastFocusedSuggest : items[0];
                }

                Lampa.Controller.collectionFocus(toFocus, renderNode);
                scroll.update($(toFocus), true);
            },
            update: function () {},
            gone: function () {
                if (scroll) {
                    scroll.render().find('.selector').removeClass('focus');
                }
            },
            up: function () {
                if (!isHistoryHidden() && hasHistory()) {
                    Lampa.Controller.toggle('search_history');
                } else {
                    Lampa.Controller.toggle('keybord');
                }
            },
            down: function () {
                if (currentSources && typeof currentSources.toggle === 'function') {
                    currentSources.toggle(true);
                } else {
                    Lampa.Controller.toggle('search_sources');
                }
            },
            right: function () {
                var nav = getNavigator();
                if (!nav || !nav.move('right')) {
                    var cur = lastFocusedSuggest ? $(lastFocusedSuggest) : scroll.render().find('.selector.focus').first();
                    if (!cur.length) cur = scroll.render().find('.selector').first();
                    var next = cur.nextAll('.selector').first();
                    if (next.length) {
                        Lampa.Controller.collectionFocus(next[0], scroll.render());
                        scroll.update(next, true);
                    }
                }
            },
            left: function () {
                var nav = getNavigator();
                if (!nav || !nav.move('left')) {
                    var cur = lastFocusedSuggest ? $(lastFocusedSuggest) : scroll.render().find('.selector.focus').first();
                    if (!cur.length) cur = scroll.render().find('.selector').last();
                    var prev = cur.prevAll('.selector').first();
                    if (prev.length) {
                        Lampa.Controller.collectionFocus(prev[0], scroll.render());
                        scroll.update(prev, true);
                    }
                }
            },
            enter: function () {
                var target = lastFocusedSuggest || (scroll ? scroll.render().find('.selector.focus')[0] : null) || (scroll ? scroll.render().find('.selector')[0] : null);
                if (target) {
                    Lampa.Utils.trigger(target, 'hover:enter');
                }
            },
            back: function () {
                Lampa.Controller.toggle('keybord');
            }
        });

        Lampa.Controller.toggle('search_suggests');
    }

    function hookControllers() {
        if (!Lampa.Controller || Lampa.Controller._kino_suggest_hooked) return;
        Lampa.Controller._kino_suggest_hooked = true;

        var origAdd = Lampa.Controller.add;

        Lampa.Controller.add = function (name, object) {
            if (name === 'search_sources' && object && !object._suggest_hooked) {
                object._suggest_hooked = true;
                var origUp = object.up;
                object.up = function () {
                    if (isSuggestVisible()) {
                        toggleSuggests();
                        return;
                    }
                    if (isHistoryHidden()) {
                        Lampa.Controller.toggle('keybord');
                        return;
                    }
                    if (origUp) origUp.apply(this, arguments);
                };

                var origToggleSources = object.toggle;
                object.toggle = function (from_search) {
                    if (!from_search && isSuggestVisible() && Lampa.Controller.enabled().name === 'keybord') {
                        toggleSuggests();
                        return;
                    }
                    if (origToggleSources) origToggleSources.apply(this, arguments);
                };
            }

            if (name === 'search_history' && object && !object._suggest_hooked) {
                object._suggest_hooked = true;

                var origToggleHist = object.toggle;
                object.toggle = function () {

                    if (isHistoryHidden()) {
                        if (isSuggestVisible()) {
                            toggleSuggests();
                            return;
                        } else if (currentSources && typeof currentSources.toggle === 'function') {
                            currentSources.toggle(true);
                            return;
                        } else {
                            Lampa.Controller.toggle('keybord');
                            return;
                        }
                    }
                    if (origToggleHist) origToggleHist.apply(this, arguments);
                };

                var origDown = object.down;
                object.down = function () {
                    if (isSuggestVisible()) {
                        toggleSuggests();
                        return;
                    }
                    if (origDown) origDown.apply(this, arguments);
                };
            }

            if (name === 'keybord' && object && !object._suggest_hooked) {
                object._suggest_hooked = true;
                var origDownKb = object.down;
                object.down = function () {
                    var nav = getNavigator();
                    if (!nav || !nav.canmove('down')) {
                        if (isSuggestVisible()) {
                            toggleSuggests();
                            return;
                        }
                    }
                    if (origDownKb) origDownKb.apply(this, arguments);
                };
            }

            return origAdd.call(Lampa.Controller, name, object);
        };
    }

    function registerSettings() {
        if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;

        var component = 'lampa_view';

        Lampa.SettingsApi.addParam({
            component: component,
            param: {
                name: 'kino_suggest_status',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Включить подсказки',
                description: 'Отображать подсказки тайтлов при вводе в строке поиска'
            }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: {
                name: 'kino_suggest_min_chars',
                type: 'select',
                values: {
                    '2': '2 символа',
                    '3': '3 символа (рекомендуется)',
                    '4': '4 символа'
                },
                default: '3'
            },
            field: {
                name: 'Минимум символов',
                description: 'С какого количества введённых букв запрашивать подсказки'
            }
        });
    }

    function init() {
        injectStyles();
        hookControllers();
        registerSettings();

        $(document).on('keydown', function () {
            isApplyingSuggestion = false;
        });

        if (Lampa.Search && Lampa.Search.listener) {
            Lampa.Search.listener.follow('open', function () {
                searchOpen = true;
                currentQuery = '';
                cancelRequest();
                createScrollInstance();
                setHistoryVisible(true);
                activeImmediateQuery = '';
                activeImmediateTime = 0;
                isApplyingSuggestion = false;
                var initialInput = $('.search__body .search__input.filled');
                if (initialInput.length) onQueryChange(initialInput.text());
            });

            Lampa.Search.listener.follow('sources', function (e) {
                hookSources(e.sources);
            });

            Lampa.Search.listener.follow('close', function () {
                searchOpen = false;
                currentQuery = '';
                cancelRequest();
                clearSuggestions();
                clearTimeout(debounceTimer);
                setHistoryVisible(true);
                if (scroll) {
                    scroll.destroy();
                    scroll = null;
                }
                currentSources = null;
                activeImmediateQuery = '';
                activeImmediateTime = 0;
                isApplyingSuggestion = false;
            });
        }

        $(document).on('input', '.simple-keyboard-input', function (e) {
            onQueryChange($(e.target).val());
        });

        console.log('[KinoSuggest] Plugin initialized v' + PLUGIN_VERSION);
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

})();
