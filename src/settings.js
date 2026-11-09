import {text as lampaViewText} from './i18n.js';
import flag from './storage-flag.js';
const GROUPS=[['appearance',lampaViewText("Оформление"),lampaViewText("Тема, обложки и устройство")],['catalogue',lampaViewText("Каталог и поиск"),lampaViewText("Главная, аниме, сервисы метаданных и сброс фильтров")],['playback',lampaViewText("Воспроизведение"),lampaViewText("Запуск, источники и озвучки")],['languages',lampaViewText("Языки и субтитры"),lampaViewText("Предпочтения дорожек и субтитров")],['parser',lampaViewText("Торренты и поиск релизов"),lampaViewText("Названия, раздачи и параметры поиска")],['server',lampaViewText("Подключение"),lampaViewText("Адрес сервера онлайн-источников")],['cache',lampaViewText("Кеш"),lampaViewText("Очистка сохранённых рейтингов и качества карточек")]];
export function cleanText(text){return typeof text==='string'?text.replace(/[\u2013\u2014]/g,'-').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,'').replace(/https?:\/\/(?:t\.me|telegram\.(?:me|org))\/[^\s<]*/gi,'').replace(/Lampa Minimal|Закус[ььи](?: TV)?|Alcopa|ALC Auto|Автопилот|Lampa View|mpv.plus/gi,'').replace(/\s{2,}/g,' ').trim():text;}
function groupOf(d){
 const n=d.param && d.param.name || '',g=d.snack_g;
 if(n==='menu_always')return 'appearance';
 if(n==='minimal_clear_quality' || n==='minimal_clear_ratings' || n==='minimal_clear_search_history')return 'cache';
 if(n==='minimal_quality_fallback')return 'parser';
 if(n==='lampa_view_metadata')return 'playback';
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
   if(['lampa_view_enabled','nova_plus_view','nova_plus_layout','nova_plus_order','minimal_search_filters','mpv_plus_recent_rows'].includes(n))return false;
   if(n==='minimal_kinoapi' && !flag(L,'minimal_kinoapi_enabled',!!L.Storage.get('lampa_view_kinoapi_key','')))return false;
   if(n==='minimal_trakt_client_id' && !flag(L,'minimal_trakt_enabled',false))return false;
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
  }).map(d=>({...d,param:{...d.param,values:d.param && d.param.values?Object.keys(d.param.values).reduce((out,key)=>{out[key]=lampaViewText(d.param.values[key]);return out;},{}):d.param && d.param.values},field:{...d.field,name:d.param.name==='alc_auto_server'?lampaViewText("Сервер онлайн-источников"):lampaViewText(cleanText(d.field && d.field.name)),description:lampaViewText(cleanText(d.field && d.field.description))}}));
 }
 function open(id){if(L && L.Settings)L.Settings.create(id,{onBack:()=>L.Settings.create('lampa_view')});}
 api.getParam=function(name){
  if(name==='lampa_view'){const available=params();const info={component:'lampa_view',param:{name:'lampa_view_version',type:'static'},field:{name:lampaViewText('Версия {0}',[version])},onRender:item=>item.removeClass('selector').attr('data-name','lampa_view_version')};return GROUPS.filter(([id])=>available.some(d=>groupOf(d)===id)).map(([id,title,description])=>({component:'lampa_view',param:{name:prefix+'open_'+id,type:'button'},field:{name:lampaViewText(title),description:lampaViewText(description)},onChange:()=>open(prefix+id)})).concat(info);}
  if(name===scaleId)return params().filter(isScale).map(d=>({...d,component:name}));
  if(ids.includes(name)){
   const rows=params().filter(d=>prefix+groupOf(d)===name && !isScale(d)).map(d=>({...d,component:name}));
   if(name===prefix+'appearance'){
    const order=['lampa_view_theme','lampa_view_dark_accent','lampa_view_layout','lampa_view_hero','lampa_view_detail_art','card_interfice_cover','minimal_banner_quality'];
    const rank=d=>{const i=order.indexOf(d.param.name);return i<0?order.length:i;};rows.sort((a,b)=>rank(a)-rank(b));
   }
   if(name===prefix+'catalogue'){
    const order=['minimal_rows','minimal_catalogue_filters_reset','minimal_anime_catalogue','minimal_kinoapi_enabled','minimal_kinoapi','minimal_trakt_enabled','minimal_trakt_client_id'];
    const rank=d=>{const i=order.indexOf(d.param.name);return i<0?order.length:i;};rows.sort((a,b)=>rank(a)-rank(b));
   }
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
