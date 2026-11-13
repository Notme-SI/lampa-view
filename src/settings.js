import {text as lampaViewText} from './i18n.js';
import flag from './storage-flag.js';
const GROUPS=[['appearance','Оформление','Тема, цвет, баннеры и масштаб интерфейса.'],['catalogue','Каталог и поиск','Подборки главной, подсказки поиска и фильтры каталогов.'],['playback','Воспроизведение','Онлайн-источники, качество видео и экран серий.'],['languages','Языки и субтитры','Приоритет языков, озвучки и автоматические субтитры.'],['parser','Торренты и поиск релизов','Поиск названий и определение качества раздач.'],['services','Источники данных','Дополнительные каталоги, сведения о сериях и кадры.'],['server','Подключение','Адрес сервера онлайн-источников.'],['cache','Хранилище','Очистка поисковых запросов и кеша без удаления просмотров.']];
const ORDER={
 appearance:['lampa_view_theme','lampa_view_dark_accent','lampa_view_artwork_tint','lampa_view_card_motion','lampa_view_layout','menu_always','lampa_view_hero','lampa_view_detail_art','card_interfice_cover','minimal_banner_quality'],
 catalogue:['minimal_rows','minimal_anime_catalogue','kino_suggest_status','kino_suggest_min_chars','minimal_catalogue_filters_reset'],
 playback:['lampa_view_mpv_plus','minimal_online_sources','nova_plus_enabled','nova_plus_quality','nova_plus_auto_switch','nova_plus_probe','nova_plus_meta','nova_plus_source_pos'],
 languages:['alc_auto_langs','alc_auto_visible_languages','alc_auto_fav_btn','alc_auto_studios_btn','alc_auto_autosubs'],
 parser:['mpv_plus_anime_search','minimal_quality_fallback'],
 services:['minimal_kinoapi','minimal_trakt_client_id'],
 server:['alc_auto_server'],cache:['minimal_clear_search_history','minimal_clear_ratings','minimal_clear_quality']
};
const LABELS={
 nova_plus_enabled:['Экран онлайн-просмотра','Показывать единый экран выбора источника, сезона и озвучки. При выключении используется экран самого источника.'],
 nova_plus_quality:['Качество видео','Предпочтительное качество во встроенном плеере. Внешний плеер использует свои настройки.'],
 nova_plus_meta:['Сведения о сериях','Названия, кадры, даты выхода и рейтинги серий из TMDB.'],
 alc_auto_fav_btn:['Любимые озвучки','Озвучки, которые будут предлагаться в первую очередь.'],
 alc_auto_studios_btn:['Названия студий озвучки','Объединение разных написаний одной студии у онлайн-источников.'],
 kino_suggest_status:['Подсказки поиска','Предлагать названия фильмов и сериалов при вводе запроса.'],
 kino_suggest_min_chars:['Длина запроса для подсказок','Количество введённых символов, после которого появляются подсказки.'],
 lampa_view_dark_accent:['Цвет выделения','Цвет кнопок и выделения в тёмной теме. Введите HEX, например #d8c39a.'],
 minimal_banner_quality:['Качество изображений','Баннеры, постеры и фоны загрузки. Высокое качество чётче на большом экране и требует больше трафика.']
};
export function cleanText(text){return typeof text==='string'?text.replace(/[\u2013\u2014]/g,'-').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,'').replace(/https?:\/\/(?:t\.me|telegram\.(?:me|org))\/[^\s<]*/gi,'').replace(/Lampa Minimal|Закус[ььи](?: TV)?|Alcopa|ALC Auto|Автопилот|Lampa View|mpv.plus/gi,'').replace(/\s{2,}/g,' ').trim():text;}
function groupOf(d){
 const n=d.param && d.param.name || '',g=d.snack_g;
 if(n==='menu_always')return 'appearance';
 if(n==='minimal_clear_quality' || n==='minimal_clear_ratings' || n==='minimal_clear_search_history')return 'cache';
 if(n==='minimal_quality_fallback')return 'parser';
 if(ORDER.services.includes(n))return 'services';
 if(['alc_auto_fav_btn','alc_auto_studios_btn'].includes(n))return 'languages';
 if(n==='lampa_view_mpv_plus')return 'playback';
 if(/^lampa_view_/.test(n) || n==='card_interfice_cover')return 'appearance';
 if(/minimal_(banner)/.test(n))return 'appearance';
 if(/^nova_plus_(mode|hero|art|logo|focus|fade|fullscreen)/.test(n))return 'appearance';
 if(n==='minimal_online_sources')return 'playback';
 if(/^kino_suggest_|minimal_|recent_rows/.test(n) || ['cards','feed','subs'].includes(g))return 'catalogue';
 if(g==='langs' || /langs|autosubs/.test(n))return 'languages';
 if(g==='server' || /server/.test(n))return 'server';
 if(/^mpv_plus_/.test(n))return 'parser';
 return 'playback';
}
export default function unifiedSettings(api,L,version=''){
 if(!api || !api.getParam || !api.allComponents)return;
 const get=api.getParam,all=api.allComponents;
 const prefix='minimal_settings_',scaleId=prefix+'scale',ids=GROUPS.map(g=>prefix+g[0]).concat(scaleId);
 const isScale=d=>/^lampa_view_(text_scale|cards_scale|controls_scale|scale_reset)$/.test(d.param.name);
 if(api.addComponent)api.addComponent({component:scaleId,name:lampaViewText('Масштаб'),icon:''});
 GROUPS.forEach(([id,name])=>{if(api.addComponent)api.addComponent({component:prefix+id,name,icon:''});});
 function params(){
  const source=(get.call(api,'lampa_view') || []).concat(get.call(api,'mpv_plus') || [],get.call(api,'snack') || [],get.call(api,'nova_plus') || []);
  const online=flag(L,'nova_plus_enabled'),seen=new Set();
  return source.filter(d=>{
   const n=d.param && d.param.name || '',text=String(d.field && d.field.name || '');
   if(seen.has(n))return false;seen.add(n);
   if(['lampa_view_enabled','lampa_view_metadata','nova_plus_view','nova_plus_layout','nova_plus_order','minimal_search_filters','mpv_plus_recent_rows'].includes(n))return false;
   if(d.param && d.param.type==='button' && typeof d.onChange!=='function')return false;
   if(['alc_auto_quick_movie','alc_auto_quick_series'].includes(n))return false;
   if(n==='alc_auto_src_btn' && typeof window!=='undefined' && window.LampaView && window.LampaView.onlineSources)return false;
   if(/^alc_auto_(fav_btn|src_btn|studios_btn|langs|visible_languages|autosubs)$/.test(n) && typeof window!=='undefined' && window.lampac_plugin)return false;
   if(n.startsWith('nova_plus_') && n!=='nova_plus_enabled' && !online)return false;
   if(n==='nova_plus_probe' && typeof window!=='undefined' && typeof window.nova_skin_probe_mode==='function'){
    try{if(['external','disabled'].includes(window.nova_skin_probe_mode()))return false;}catch(error){}
   }
   if(['nova_plus_mode','nova_plus_hero','nova_plus_hero_art','nova_plus_fullscreen','nova_plus_art_size','nova_plus_movie_view'].includes(n))return false;
   return d.param && !['title','static'].includes(d.param.type) && !/^snack_open_/.test(n) && !/community|versions|snack_reset|telegram|donat|support|_bot/i.test(n) && !/telegram|тг.бот|телеграм|поддержать|сообщество/i.test(text);
  }).map(d=>{const label=LABELS[d.param.name],description=cleanText(d.field && d.field.description);return {...d,param:{...d.param,values:d.param && d.param.values?Object.keys(d.param.values).reduce((out,key)=>{out[key]=lampaViewText(d.param.values[key]);return out;},{}):d.param && d.param.values},field:{...d.field,name:label?lampaViewText(label[0]):d.param.name==='alc_auto_server'?lampaViewText('Сервер онлайн-источников'):lampaViewText(cleanText(d.field && d.field.name)?.replace(/\s*[›»]\s*$/,'')),description:label?lampaViewText(label[1]):lampaViewText(description)}};});
 }
 function open(id){if(L && L.Settings)L.Settings.create(id,{onBack:()=>L.Settings.create('lampa_view')});}
 api.getParam=function(name){
  if(name==='lampa_view'){const available=params();const info={component:'lampa_view',param:{name:'lampa_view_version',type:'static'},field:{name:lampaViewText('Версия {0}',[version])},onRender:item=>item.removeClass('selector').attr('data-name','lampa_view_version')};return GROUPS.filter(([id])=>available.some(d=>groupOf(d)===id)).map(([id,title,description])=>({component:'lampa_view',param:{name:prefix+'open_'+id,type:'button'},field:{name:lampaViewText(title),description:lampaViewText(description)},onChange:()=>open(prefix+id)})).concat(info);}
  if(name===scaleId)return params().filter(isScale).map(d=>({...d,component:name}));
  if(ids.includes(name)){
   const rows=params().filter(d=>prefix+groupOf(d)===name && !isScale(d)).map(d=>({...d,component:name}));
   const order=ORDER[name.slice(prefix.length)] || [],rank=d=>{const i=order.indexOf(d.param.name);return i<0?order.length:i;};
   rows.sort((a,b)=>rank(a)-rank(b) || String(a.param.name).localeCompare(String(b.param.name)));
   if(name===prefix+'appearance' && params().some(isScale)){
    const at=rows.findIndex(d=>d.param.name==='lampa_view_layout');
    rows.splice(at<0?0:at+1,0,{component:name,param:{name:prefix+'open_scale',type:'button'},field:{name:lampaViewText('Масштаб'),description:lampaViewText('Текст, кнопки и карточки · 80–200%')},onChange:()=>open(scaleId)});
   }
   return rows;
  }
  return get.apply(this,arguments);
 };
 api.allComponents=function(){
  const entries=all.apply(this,arguments),out={};
  Object.keys(entries).forEach(key=>{if(key!=='mpv_plus' && key!=='nova_plus' && !/^snack(?:_|$)/.test(key) && !ids.includes(key))out[key]=key==='lampa_view'?{...entries[key],name:'L A M P A'}:entries[key];});
  return out;
 };
 if(L && L.Settings && L.Settings.create){
  if(L.Settings.listener)L.Settings.listener.follow('open',event=>{if(event && (event.name==='lampa_view' || ids.includes(event.name)) && event.body){const node=event.body.nodeType?event.body:event.body[0];if(node)node.classList.add('minimal-settings');}});
  const create=L.Settings.create;
  L.Settings.create=function(name,options){
   const aliases={snack:'lampa_view',mpv_plus:prefix+'parser',snack_watch:prefix+'playback',snack_langs:prefix+'languages',snack_server:prefix+'server',snack_cards:prefix+'catalogue',snack_feed:prefix+'catalogue',snack_subs:prefix+'catalogue'};
   aliases.nova_plus=prefix+'playback';const target=aliases[name] || name;
   if(ids.includes(target))options={...options,onBack:()=>L.Settings.create(target===scaleId?prefix+'appearance':'lampa_view')};
   return create.call(this,target,options);
  };
 }
}
