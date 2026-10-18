const GROUPS=[['appearance','Оформление','Тема, обложки и устройство'],['catalogue','Каталог и поиск','Подборки, аниме и фильтры'],['playback','Воспроизведение','Запуск, источники и озвучки'],['languages','Языки и субтитры','Предпочтения дорожек и субтитров'],['parser','Торренты и поиск релизов','Названия, раздачи и параметры поиска'],['server','Подключение','Адрес сервера онлайн-источников']];
export function cleanText(text){return typeof text==='string'?text.replace(/[\u2013\u2014]/g,'-').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,'').replace(/https?:\/\/(?:t\.me|telegram\.(?:me|org))\/[^\s<]*/gi,'').replace(/Lampa Minimal|Закус[ььи](?: TV)?|Alcopa|ALC Auto|Автопилот|Lampa View|mpv.plus/gi,'').replace(/\s{2,}/g,' ').trim():text;}
function groupOf(d){
 const n=d.param && d.param.name || '',g=d.snack_g;
 if(/^lampa_view_/.test(n))return 'appearance';
 if(/minimal_(banner)/.test(n))return 'appearance';
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
  const source=(get.call(api,'lampa_view') || []).concat(get.call(api,'mpv_plus') || [],get.call(api,'snack') || []);
  return source.filter(d=>{
   const n=d.param && d.param.name || '',text=String(d.field && d.field.name || '');
   return d.param && !['title','static'].includes(d.param.type) && !/^snack_open_/.test(n) && !/community|versions|snack_reset|telegram|donat|support|_bot/i.test(n) && !/telegram|тг.бот|телеграм|поддержать|сообщество/i.test(text);
  }).map(d=>({...d,field:{...d.field,name:cleanText(d.field && d.field.name),description:cleanText(d.field && d.field.description)}}));
 }
 function open(id){if(L && L.Settings)L.Settings.create(id,{onBack:()=>L.Settings.create('lampa_view')});}
 api.getParam=function(name){
  if(name==='lampa_view')return GROUPS.map(([id,title,description])=>({component:'lampa_view',param:{name:prefix+'open_'+id,type:'button'},field:{name:title,description},onChange:()=>open(prefix+id)}));
  if(ids.includes(name))return params().filter(d=>prefix+groupOf(d)===name).map(d=>({...d,component:name}));
  return get.apply(this,arguments);
 };
 api.allComponents=function(){
  const entries=all.apply(this,arguments),out={};
  Object.keys(entries).forEach(key=>{if(key!=='mpv_plus' && !/^snack(?:_|$)/.test(key) && !ids.includes(key))out[key]=key==='lampa_view'?{...entries[key],name:'L A M P A'}:entries[key];});
  return out;
 };
 if(L && L.Settings && L.Settings.create){
  const create=L.Settings.create;
  L.Settings.create=function(name,options){
   const aliases={snack:'lampa_view',mpv_plus:prefix+'parser',snack_watch:prefix+'playback',snack_langs:prefix+'languages',snack_server:prefix+'server',snack_cards:prefix+'catalogue',snack_feed:prefix+'catalogue',snack_subs:prefix+'catalogue'};
   const target=aliases[name] || name;
   if(ids.includes(target))options={...options,onBack:()=>L.Settings.create('lampa_view')};
   return create.call(this,target,options);
  };
 }
}
