import detail from './detail.js';
import inputs from './inputs.js';
import {installTmdb,installFullGuard} from './tmdb.js';
import heroAssets from './hero-assets.js';
import CSS from './theme.css';
import BOOT from './boot.css';
import C from './identity.cjs';
import quality from './quality.js';
import installWheel from './wheel.js';
import logoLoader from './logos.js';
import fillRows from './rows.js';
import unifiedSettings from './settings.js';
import shikimori from './shikimori.js';
import collections from './collections.js';
import filters from './filters.js';
import branding from './branding.js';
import startup from './startup.js';
import shikimoriPosters from './shikimori-posters.js';
import torrentEpisodes from './torrent-episodes.js';
import installArtwork,{artworkSize} from './artwork.js';
import installBack from './back.js';
import mpvLaunch from './mpv-launch.cjs';
import carousel from './carousel.js';
import tvPerformance from './tv-performance.js';

const ROOT = window;
if (!ROOT.LampaView) {
  branding();
  if(!document.getElementById('lampa-minimal-boot')){
    const boot=document.createElement('style');boot.id='lampa-minimal-boot';boot.textContent=BOOT;
    (document.head || document.documentElement).appendChild(boot);
  }
  const P = ROOT.LampaView = {version: '0.4.39', identity: C.identity, ready: false, bridge: false};
  let L, $, lastCard, initialized = false, playlist = [], activeVideo,loadLogo,artwork,back;
  const metadata = new Map();
  const heroes = new WeakSet();
  const carousels = new Set();
  function refreshCarousels(){carousels.forEach(value=>value.refresh());}
  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    library: '<path d="M5 3v18m5-18v18m5-17 5 16"/>',
    settings: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>'; }
  function on(name, callback) { L.Listener.follow(name, callback); }
  function pointer(element) {
    // Register before insertion: stop Lampa's later click adapter from invoking it twice.
    element.on('click',e=>{e.preventDefault();e.stopImmediatePropagation();$(e.currentTarget).trigger('hover:enter');});
    element.on('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();$(e.currentTarget).trigger('hover:enter');}});
    return element;
  }
  function yes(key, fallback = true) { const value = L.Storage.value ? L.Storage.value(key,'') : L.Storage.get(key, fallback); return value === '' || value == null ? fallback : ![false,'false',0,'0','no'].includes(value); }
  function layout() {
    const selected=L.Storage.get('lampa_view_layout','auto') || 'auto';
    const screen=L.Platform && L.Platform.screen;
    const mobile=screen ? screen.call(L.Platform,'mobile') : ROOT.innerWidth<=600;
    // Lampa's screen('tv') also describes desktop browsers. Use its physical
    // TV detector when available, including an explicit false result.
    const tv=L.Platform && typeof L.Platform.tv==='function' ? !!L.Platform.tv() : screen ? screen.call(L.Platform,'tv') : false;
    P.layout=selected==='auto' ? (tv ? 'tv' : mobile || ROOT.innerWidth<=650 ? 'mobile' : 'desktop') : selected;
    ['mobile','tv','desktop'].forEach(mode=>document.body.classList.toggle('pt-'+mode,P.layout===mode));
  }
  function setTheme() {
    layout();
    document.body.classList.toggle('lampa_view', yes('lampa_view_enabled'));
    if(back)back.update();

    document.body.classList.remove('pt-reduce-motion');
    if (!document.getElementById('lampa_view-lampa-style')) $('<style id="lampa_view-lampa-style">').text(CSS).appendTo('head');
    const enabled = yes('lampa_view_enabled');
    $('.minimal-detail-logo.loaded').each(function(){
      $(this).siblings('.full-start-new__title').toggleClass('pt-hidden',enabled);
    });
    $('.pt-topnav,.pt-mobile-nav,.pt-nav-label,.pt-hero').toggleClass('pt-hidden',!enabled);
    $('.pt-hero').toggleClass('pt-hidden',!enabled || !yes('lampa_view_hero'));
    refreshCarousels();
    const logo = document.querySelector('.head__logo-icon');
    if (logo) {
      if (!logo.dataset.lampa_viewOriginal) logo.dataset.lampa_viewOriginal = logo.innerHTML;
      if (enabled) logo.innerHTML = '<span class="pt-brand">LAMPA</span>';
      else logo.innerHTML = logo.dataset.lampa_viewOriginal;
    }
  }
  function navigate(section) {
    if (section === 'search') return $('.head .open--search').trigger('hover:enter');
    if (section === 'settings') return $('.head .open--settings').trigger('hover:enter');
    if (section === 'home') return L.Activity.push({url:'', title:'Главная', component:'main', source:'tmdb', page:1});
    if (section === 'library') {
      const native = $('.menu__item[data-action="favorite"]');
      if (native.length) native.trigger('hover:enter');
      else L.Activity.push({url:'', title:'Медиатека', component:'bookmarks', page:1});
      return;
    }
    if (section === 'calendar') {
      const native = $('.menu__item[data-action="timetable"]');
      if (native.length) native.first().trigger('hover:enter');
      else L.Noty.show('Расписание доступно в медиатеке Lampa');
      return;
    }
    const titles = {movie:'Фильмы',tv:'Сериалы',anime:'Аниме'};
    L.Activity.push({url:section, title:titles[section], component:'category', source:section === 'anime' ? 'cub' : 'tmdb', page:1});
  }
  function shell() {
    if (!$('.pt-topnav').length) {
      const nav = $('<div class="pt-topnav" role="navigation" aria-label="Каталог">');
      [['home','Главная'],['movie','Фильмы'],['tv','Сериалы'],['anime','Аниме']].forEach(([key,label]) => {
        pointer($('<div class="pt-topnav__item selector" role="button" tabindex="0">').attr('data-section',key).text(label)
          .on('hover:enter', () => navigate(key))).appendTo(nav);
      });
      $('.head__title').before(nav);
    }
    if (!$('.pt-mobile-nav').length) {
      const nav = $('<nav class="pt-mobile-nav" aria-label="Навигация">');
      [['home','Главная','home'],['search','Поиск','search'],['calendar','Расписание','calendar'],['library','Медиатека','library'],['settings','Настройки','settings']].forEach(([key,label,glyph]) => {
        $('<div class="pt-mobile-nav__item" role="button" tabindex="0">').attr('data-section',key).html(icon(glyph) + '<span></span>').find('span').text(label).end()
          .on('click', () => navigate(key)).on('keydown', e => {if(e.key === 'Enter') navigate(key);}).appendTo(nav);
      });
      nav.appendTo('body');
    }
    // Keep Lampa's original menu, settings, account and bookmark handlers.
    // Only the native menu's presentation changes to an anchored popover.
    $('.head__menu-icon').addClass('selector').attr({role:'button',tabindex:'0','aria-label':'Меню'})
      .off('hover:enter.minimal').on('hover:enter.minimal',()=>L.Controller.toggle('menu'));
    setTheme();
    updateRoute();
  }
  function trimSections(){
    $('.menu__item,.settings-folder').each(function(){
      const label=$(this).find('.menu__text,.settings-folder__name').text().trim() || $(this).text().trim();
      if(/^(shots|спорт|расписание)$/i.test(label))$(this).addClass('pt-removed-section');
    });
    if(L.SettingsApi.allComponents && L.SettingsApi.removeComponent){
      const components=L.SettingsApi.allComponents();
      Object.keys(components).forEach(key=>{
        if(/shot|sport|timetable/i.test(key))L.SettingsApi.removeComponent(key);
      });
    }
  }
  function updateRoute() {
    const active = L.Activity.active() || {};
    if(active.component==='category_full' && active.source && active.source!=='tmdb' && /^discover\/(movie|tv)\?/.test(active.url || '') && L.Activity.replace){
      setTimeout(()=>L.Activity.replace({source:'tmdb'}),0);
    }
    const section = active.component === 'main' ? 'home' : active.url || active.component;
    document.body.classList.toggle('pt-home',active.component==='main');
    $('.pt-topnav__item,.pt-mobile-nav__item').each(function() {this.classList.toggle('active', this.getAttribute('data-section') === section);});
  }
  function openCard(card) {
    L.Activity.push({url:'',component:'full',id:card.id,method:card.media_type || (card.name ? 'tv':'movie'),card,source:card.source || 'tmdb'});
  }
  function hero(event) {
    if (!yes('lampa_view_hero') || !yes('lampa_view_enabled') || !event || !['append','visible','create'].includes(event.type)) return;
    const active=L.Activity.active() || {},object=event.params && event.params.object;
    if ((object && object.component || active.component)!=='main') return;
    const activity=object && object.activity || active.activity;
    if(!activity || heroes.has(activity))return;
    const cards=((event.data || {}).results || []).filter(v=>v.backdrop_path && (v.title || v.name) && v.overview).slice(0,8).map(card=>({...card,source:card.source || active.source || 'tmdb'}));
    if(!cards.length)return;
    heroes.add(activity);
    setTimeout(()=>{
      const root=activity.render();
      if(!root || root.find('.pt-hero').length)return;
      const line=root.find('.items-line').first();
      if(!line.length){heroes.delete(activity);return;}
      let index=0,item,focus=0;
      const element=$('<section class="pt-hero" aria-label="Подборка фильмов и сериалов">');
      const image=$('<img class="pt-hero__image" alt="" decoding="async">').appendTo(element);
      const body=$('<div class="pt-hero__body">').appendTo(element);
      const logo=$('<img class="pt-hero__logo pt-hidden" decoding="async">').appendTo(body);
      const title=$('<h1 class="pt-hero__title">').appendTo(body);
      const meta=$('<div class="pt-hero__meta">').appendTo(body);
      const studio=$('<img class="pt-hero__studio pt-hidden" decoding="async">').appendTo(meta);
      const metaText=$('<span>').appendTo(meta);
      const overview=$('<p class="pt-hero__overview">').appendTo(body);
      const buttons=$('<div class="pt-hero__actions">').appendTo(body);
      const details=$('<div class="pt-hero__action selector" role="button" tabindex="0">').html(icon('info')+'<span>Подробнее</span>').appendTo(buttons);
      const dots=$('<div class="pt-hero__dots" role="group" aria-label="Переключить обложку">').appendTo(element);
      let logoToken=0,upgradeTimer,rotation;
      const assets=heroAssets(L,cards,loadLogo);
      if(activity.component && activity.component.use)activity.component.use({onDestroy:()=>{clearTimeout(upgradeTimer);assets.dispose();}});
      function show(next){
        index=(next+cards.length)%cards.length;
        const card=cards[index],kind=card.media_type || (card.name?'tv':'movie');
        item={...card,media_type:kind,source:card.source || 'tmdb'};
        title.text(card.title || card.name);
        const token=++logoToken;
        studio.off('load error').addClass('pt-hidden').removeAttr('src alt title');
        logo.off('load error').addClass('pt-hidden').removeClass('pt-hero__logo--translated').removeAttr('src');title.removeClass('pt-hidden pt-hero__title--translation');
        assets.logo(index,(url,language)=>{
          if(token!==logoToken || !url)return;
          logo.attr('alt',card.title || card.name).on('load',()=>{
            if(token===logoToken){const translated=language!==String(L.Storage.get('language','ru') || 'ru').slice(0,2);logo.removeClass('pt-hidden').toggleClass('pt-hero__logo--translated',translated);title.toggleClass('pt-hidden',!translated).toggleClass('pt-hero__title--translation',translated);}
          }).on('error',()=>{if(token===logoToken){logo.addClass('pt-hidden');title.removeClass('pt-hidden pt-hero__title--translation');}})
            .attr('src',url);
        });
        const year=(card.release_date || card.first_air_date || '').slice(0,4);
        metaText.text([year,kind==='tv'?'Сериал':'Фильм',card.vote_average?Number(card.vote_average).toFixed(1):''].filter(Boolean).join('  ·  '));
        assets.studio(index,value=>{
          if(token!==logoToken || !value)return;
          studio.attr({alt:value.name,title:value.name}).on('load',()=>{if(token===logoToken)studio.removeClass('pt-hidden');})
            .on('error',()=>{if(token===logoToken)studio.addClass('pt-hidden');}).attr('src',value.url);
        });
        overview.text(card.overview);
        clearTimeout(upgradeTimer);
        const size=artworkSize(L,'backdrop');
        const useOriginal=size==='original',ready=assets.ready(index,size);let originalShown=!!ready;
        if(ready)image.attr('src',ready);
        assets.cover(index,useOriginal?'w780':size,url=>{
          if(token!==logoToken)return;
          if(url && !originalShown)image.attr('src',url);
          if(useOriginal && !ready)upgradeTimer=setTimeout(()=>assets.cover(index,'original',url=>{if(token===logoToken && url){originalShown=true;image.attr('src',url);}}),300);
        });
        assets.warm(index);
        dots.children().each(function(i){$(this).toggleClass('active',i===index).attr('aria-pressed',String(i===index));});
        if(rotation)rotation.refresh();
      }
      const qualityChanged=()=>show(index);
      document.addEventListener('minimal:artwork-quality',qualityChanged);
      if(activity.component && activity.component.use)activity.component.use({onDestroy:()=>document.removeEventListener('minimal:artwork-quality',qualityChanged)});
      cards.forEach((card,i)=>$('<div class="pt-hero__dot selector" role="button" tabindex="0">').attr({'aria-label':'Обложка '+(i+1),title:card.title || card.name}).on('hover:enter',()=>show(i)).appendTo(dots));
      details.on('hover:enter',()=>openCard(item));
      const controls=element.find('.selector');
      pointer(controls);
      // A swipe changes only the cover; vertical page scrolling remains native.
      let touch;
      element.on('touchstart',e=>{const t=e.originalEvent.touches[0];touch={x:t.clientX,y:t.clientY};});
      element.on('touchend',e=>{if(!touch)return;const t=e.originalEvent.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.4)show(index+(dx<0?1:-1));touch=null;});
      show(0);line.before(element);
      if(cards.length>1){
        rotation=carousel(element[0],()=>show(index+1),()=>{
          const active=L.Activity.active() || {},controller=L.Controller.enabled && L.Controller.enabled();
          return active.activity===activity && yes('lampa_view_enabled') && yes('lampa_view_hero')
            && !document.body.matches('.settings--open,.selectbox--open,.menu--open')
            && !/player|select|settings|modal|search|menu/.test(controller && controller.name || '');
        });
        carousels.add(rotation);
        if(activity.component && activity.component.use)activity.component.use({onStart:refreshCarousels,onPause:refreshCarousels,onDestroy:()=>{rotation.dispose();carousels.delete(rotation);}});
      }
      const nativeLine=event.line;
      if(L.Controller && nativeLine && nativeLine.use && nativeLine.toggle){
        const enterHero=()=>{
          if(!yes('lampa_view_enabled') || !yes('lampa_view_hero'))return L.Controller.toggle('head');
          const focusControl=()=>L.Controller.collectionFocus(controls.eq(focus),element);
          L.Controller.add('lampa_view_hero',{
            toggle:()=>{
              const component=activity.component;
              if(component && component.scroll && component.scroll.update)component.scroll.update(element[0]);
              L.Controller.collectionSet(element);focusControl();
            },
            left:()=>{focus=Math.max(0,focus-1);focusControl();},
            right:()=>{focus=Math.min(controls.length-1,focus+1);focusControl();},
            up:()=>{if(focus>0){focus=0;focusControl();}else L.Controller.toggle('head');},
            down:()=>{if(focus<1 && cards.length>1){focus=index+1;focusControl();}else nativeLine.toggle();},
            back:()=>L.Controller.toggle('head')
          });L.Controller.toggle('lampa_view_hero');
        };
        nativeLine.use({onlyUp:enterHero});
        if(activity.component && activity.component.use){
          activity.component.use({onStart:()=>{if(P.layout!=='mobile')setTimeout(()=>{if((L.Activity.active() || {}).activity===activity)enterHero();},0);}});
          const enabled=L.Controller.enabled && L.Controller.enabled();
          if(enabled && enabled.name==='content' && P.layout!=='mobile')enterHero();
        }
      }
    },0);
  }
  function cardKey(card) {return (card.source || 'tmdb') + ':' + (card.media_type || (card.name ? 'tv':'movie')) + ':' + card.id;}
  function full(event) {
    if (!event || event.type !== 'complite') return;
    const card = event.data && event.data.movie || event.object && event.object.card;
    if (!card) return;
    const kind = card.media_type || (card.name || card.original_name ? 'tv':'movie');
    lastCard = {...card, media_type:kind};
    const key = cardKey(lastCard);
    if (!metadata.has(key) && (card.source || 'tmdb') === 'tmdb' && C.integer(card.id)) {
      metadata.set(key,lastCard);
      const request = new L.Reguest(); request.timeout(4500);
      const path = kind + '/' + card.id + '?language=' + (L.Storage.get('language','ru') || 'ru') + '&append_to_response=external_ids,alternative_titles&api_key=' + L.TMDB.key();
      request.silent(L.TMDB.api(path), data => {
        if (data && data.id === card.id) metadata.set(key,{...card,...data,media_type:kind,source:'tmdb'});
      }, () => {});
      if (metadata.size > 32) metadata.delete(metadata.keys().next().value);
    }
  }
  function currentCard(video) {
    const active = L.Activity.active() || {};
    let card = video.card || active.movie || active.card;
    if (!card && /^(full|torrents|lampac|online|alc_auto_view)/.test(active.component || '')) card = lastCard;
    if (!card) return null;
    return metadata.get(cardKey(card)) || card;
  }
  function playURL(video) {
    const copy = {...video};
    // Use the same preferred quality and TorrServer adapter as the native player.
    if (copy.quality && L.Player.getUrlQuality) copy.url = L.Player.getUrlQuality(copy.quality,false) || copy.url;
    if (L.Torserver && L.Torserver.toPlayUrl) copy.url = L.Torserver.toPlayUrl(copy.url);
    return copy;
  }
  function sendContext(video) {
    if (!yes('lampa_view_metadata') || !ROOT.electronAPI || !ROOT.electronAPI.lampa_view) return;
    const card = currentCard(video);
    if (!card) return;
    try {
      const data = C.context(card,playURL(video),playlist.map(playURL));
      P.lastIdentity = data.entries[0] && data.entries[0].identity;
      ROOT.electronAPI.lampa_view.setContext(data);
    } catch(error) {console.warn('Lampa View: metadata transport failed');}
  }
  function bridge() {
    mpvLaunch.install(L,ROOT,currentCard,()=>yes('lampa_view_metadata'));
    P.bridge = !!(ROOT.electronAPI && ROOT.electronAPI.lampa_view);
    if (!P.bridge) return;
    L.Player.listener.follow('create', event => {activeVideo = event.data; playlist=[]; sendContext(event.data);});
    const original = L.Player.playlist;
    L.Player.playlist = function(items) {
      playlist = Array.isArray(items) ? items.slice(0,40) : [];
      if (activeVideo) sendContext(activeVideo);
      return original.apply(this,arguments);
    };
  }
  function settings() {
    L.SettingsApi.addComponent({component:'lampa_view',name:'L A M P A',icon:icon('play')});
    unifiedSettings(L.SettingsApi,L);
    const options=[
      ['lampa_view_enabled','Минималистичный интерфейс','Единый стиль каталога, карточек, источников и настроек.',true],
      ['lampa_view_hero','Обложка на главной','Карусель каждые 10 секунд, ручное переключение и жесты.',true]
    ];
    if(L.Platform && L.Platform.desktop && L.Platform.desktop() || ROOT.electronAPI && ROOT.electronAPI.lampa_view) options.push(['lampa_view_metadata','Уточнять данные mpv+','Передавать сведения карточки для проверки названия, сезона и серии.',true]);
    options.forEach(([name,label,description,value]) => L.SettingsApi.addParam({component:'lampa_view',param:{name,type:'trigger',default:value},field:{name:label,description},onChange:setTheme}));
    L.SettingsApi.addParam({component:'lampa_view',param:{name:'lampa_view_layout',type:'select',values:{auto:'Автоматически',tv:'Телевизор',mobile:'Телефон',desktop:'Компьютер'},default:'auto'},field:{name:'Тип устройства',description:'Авто использует режим экрана Lampa. Можно выбрать вручную.'},onChange:setTheme});
    L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_banner_quality',type:'select',values:{medium:'Среднее',high:'Высокое',maximum:'Максимальное'},default:'maximum'},field:{name:'Качество баннеров и обложек',description:'Баннеры, фоны и обложки карточек. Максимальное использует исходный размер изображения.'},onChange:()=>artwork && artwork.refresh()});
  }
  function start() {
    if (initialized || !ROOT.Lampa || !ROOT.jQuery) return;
    initialized=true; L=ROOT.Lampa; $=ROOT.jQuery;loadLogo=logoLoader(L);
    installTmdb(L);installFullGuard(L);torrentEpisodes(L,ROOT);inputs(L);
    artwork=installArtwork(L,()=>yes('lampa_view_enabled'));
    settings(); bridge(); shell();back=installBack(L,$,()=>yes('lampa_view_enabled'));artwork.refresh();
    tvPerformance(()=>yes('lampa_view_enabled'));
    trimSections();
    const menu=document.querySelector('.menu');
    if(menu && ROOT.MutationObserver)new ROOT.MutationObserver(trimSections).observe(menu,{childList:true,subtree:true});
    quality(L,$);
    if(L.Api && L.Api.sources && L.Utils && L.Utils.createInstance && L.Maker){
      const anime=shikimori(L);shikimoriPosters(L,anime);collections(L,anime);filters(L,anime);
    }
    installWheel(L,()=>yes('lampa_view_enabled'));
    on('line',event=>{
      const route=event.data && event.data.url;
      if(event.line && event.line.use && typeof route==='string' && /^discover\/(movie|tv)\?/.test(route) && !event.line._minimalMore){
        event.line._minimalMore=true;
        event.line.use({onlyMore:()=>L.Activity.push({component:'category_full',source:'tmdb',url:route.replace(/([?&])lang=/,'$1language='),title:event.data.title || 'Подборка',page:1})});
      }
      if(event.data && /^(shots|спорт|расписание)$/i.test(String(event.data.title || '').trim())){
        const root=event.line && event.line.render && event.line.render(true);
        if(root)$(root).addClass('pt-removed-section');
      }
    });
    if(L.Settings && L.Settings.listener)L.Settings.listener.follow('open',()=>{
      setTimeout(trimSections,0);
    });
    [[L.Settings,['open','close']],[L.Select,['fullshow','close']],[L.Modal,['fullshow','close']],[L.Player,['create','destroy']],[L.Controller,['toggle']]].forEach(([api,events])=>{
      if(api && api.listener)events.forEach(event=>api.listener.follow(event,()=>{if(carousels.size)setTimeout(refreshCarousels,0);}));
    });
    let resizeTimer;
    ROOT.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,180);});
    const fill=fillRows(L,()=>yes('lampa_view_enabled'));
    on('full',event=>{full(event);if(yes('lampa_view_enabled')){detail(L,event,loadLogo);if(event.type==='build' && event.name==='persons' && event.item)fill.track(event.item,event.data);}}); on('line',event=>{hero(event);fill(event);});
    on('activity',event => {
      if (event.type === 'start') {updateRoute();trimSections();}
      refreshCarousels();
    });
    // If the desktop injected after the initial card's full event, bind the visible card now.
    const active=L.Activity.active() || {};
    if(active.component==='full' && active.activity) full({type:'complite',object:active,data:{movie:active.card}});
    P.ready=true;startup(L,ROOT);
  }
  function ready() {
    if (!ROOT.Lampa) return false;
    if (ROOT.appready) start();
    else ROOT.Lampa.Listener.follow('app',event=>{if(event.type==='ready') start();});
    return true;
  }
  if(!ready()) {
    let attempts=0;
    const timer=setInterval(()=>{if(ready() || ++attempts>=150) clearInterval(timer);},200);
  }
}
