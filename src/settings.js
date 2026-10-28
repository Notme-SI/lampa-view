import flag from './storage-flag.js';
const GROUPS=[['appearance','Оформление','Тема, обложки и устройство'],['catalogue','Каталог и поиск','Подборки, аниме и фильтры'],['playback','Воспроизведение','Запуск, источники и озвучки'],['languages','Языки и субтитры','Предпочтения дорожек и субтитров'],['parser','Торренты и поиск релизов','Названия, раздачи и параметры поиска'],['server','Подключение','Адрес сервера онлайн-источников'],['cache','Кеш','Очистка сохранённых рейтингов и качества карточек']];
export function cleanText(text){return typeof text==='string'?text.replace(/[\u2013\u2014]/g,'-').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,'').replace(/https?:\/\/(?:t\.me|telegram\.(?:me|org))\/[^\s<]*/gi,'').replace(/Lampa Minimal|Закус[ььи](?: TV)?|Alcopa|ALC Auto|Автопилот|Lampa View|mpv.plus/gi,'').replace(/\s{2,}/g,' ').trim():text;}
function groupOf(d){
 const n=d.param && d.param.name || '',g=d.snack_g;
 if(n==='minimal_clear_quality' || n==='minimal_clear_ratings')return 'cache';
 if(n==='minimal_quality_fallback')return 'parser';
 if(/^lampa_view_/.test(n))return 'appearance';
 if(/minimal_(banner)/.test(n))return 'appearance';
 if(/^nova_plus_(mode|hero|art|logo|focus|fade|fullscreen)/.test(n))return 'appearance';
 if(/^kino_suggest_|minimal_|recent_rows/.test(n) || ['cards','feed','subs'].includes(g))return 'catalogue';
 if(g==='langs' || /langs|autosubs/.test(n))return 'languages';
 if(g==='server' || /server/.test(n))return 'server';
 if(/^mpv_plus_/.test(n))return 'parser';
 return 'playback';
}
export default function unifiedSettings(api,L){
 if(!api || !api.getParam || !api.allComponents)return;
 const get=api.getParam,all=api.allComponents;
 const prefix='minimal_settings_',ids=GROUPS.map(g=>prefix+g[0]);
 GROUPS.forEach(([id,name])=>{if(api.addComponent)api.addComponent({component:prefix+id,name,icon:''});});
 function params(){
  const source=(get.call(api,'lampa_view') || []).concat(get.call(api,'mpv_plus') || [],get.call(api,'snack') || [],get.call(api,'nova_plus') || []);
  const online=flag(L,'nova_plus_enabled'),seen=new Set();
  return source.filter(d=>{
   const n=d.param && d.param.name || '',text=String(d.field && d.field.name || '');
   if(seen.has(n))return false;seen.add(n);
   if(n==='minimal_trakt_client_id' && !flag(L,'minimal_trakt_enabled',false))return false;
   if(d.param && d.param.type==='button' && typeof d.onChange!=='function')return false;
   if(['alc_auto_quick_movie','alc_auto_quick_series'].includes(n))return false;
   if(/^alc_auto_(fav_btn|src_btn|studios_btn|langs|visible_languages|autosubs)$/.test(n) && typeof window!=='undefined' && window.lampac_plugin)return false;
   if(n.startsWith('nova_plus_') && n!=='nova_plus_enabled' && !online)return false;
   if(n==='nova_plus_layout' && L && L.Storage && L.Storage.get('nova_plus_view','list')!=='grid')return false;
   if(n==='nova_plus_probe' && typeof window!=='undefined' && typeof window.nova_skin_probe_mode==='function'){
    try{if(['external','disabled'].includes(window.nova_skin_probe_mode()))return false;}catch(error){}
   }
   if(['nova_plus_mode','nova_plus_hero','nova_plus_hero_art','nova_plus_fullscreen','nova_plus_art_size','nova_plus_movie_view'].includes(n))return false;
   return d.param && !['title','static'].includes(d.param.type) && !/^snack_open_/.test(n) && !/community|versions|snack_reset|telegram|donat|support|_bot/i.test(n) && !/telegram|тг.бот|телеграм|поддержать|сообщество/i.test(text);
  }).map(d=>({...d,field:{...d.field,name:d.param.name==='alc_auto_server'?'Сервер онлайн-источников':cleanText(d.field && d.field.name),description:cleanText(d.field && d.field.description)}}));
 }
 function open(id){if(L && L.Settings)L.Settings.create(id,{onBack:()=>L.Settings.create('lampa_view')});}
 api.getParam=function(name){
  if(name==='lampa_view'){const available=params();return GROUPS.filter(([id])=>available.some(d=>groupOf(d)===id)).map(([id,title,description])=>({component:'lampa_view',param:{name:prefix+'open_'+id,type:'button'},field:{name:title,description},onChange:()=>open(prefix+id)}));}
  if(ids.includes(name))return params().filter(d=>prefix+groupOf(d)===name).map(d=>({...d,component:name}));
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
   if(ids.includes(target))options={...options,onBack:()=>L.Settings.create('lampa_view')};
   return create.call(this,target,options);
  };
 }
}
