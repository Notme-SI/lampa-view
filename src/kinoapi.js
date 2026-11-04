import {text as t,locale} from './i18n.js';
import {isAnime} from './metadata.js';
import flag from './storage-flag.js';
const BASE='https://kinoapi.lampac.dev/api/v1/',KEY='lampa_view_kinoapi_key';
const positive=n=>Number.isSafeInteger(Number(n)) && Number(n)>0;
// Coordinates belong to the metadata service. Playback hashes stay with the provider.
export function animeModel(seasons,episodes,language='ru'){
 if(!Array.isArray(seasons) || !Array.isArray(episodes) || !episodes.length || episodes.length>3000)return null;
 const known=new Map(),seen=new Set(),rows=[];
 for(const s of seasons){if(!positive(s.season_number) || !positive(s.episode_count))continue;const n=Number(s.season_number);if(known.has(n))return null;known.set(n,{number:n,count:Number(s.episode_count),name:String((language==='ru'?s.name_ru:s.name_en)||s.name_en||s.name_ru||'')});}
 for(const e of episodes){
  const season=Number(e.season_number),number=Number(e.tmdb_episode_number),key=season+':'+number;
  if(!known.has(season) || !positive(number) || seen.has(key))return null;seen.add(key);
  rows.push({season,number,mal:Number(e.mal_id)||0,malNumber:Number(e.mal_episode_number)||0,scene:e.scene,
   episode:{season_number:season,episode_number:number,name:String((language==='ru'?e.name_ru:e.name_en)||e.name_en||e.name_ru||''),overview:String((language==='ru'?e.overview_ru:e.overview_en)||''),air_date:e.air_date||'',runtime:Number(e.runtime)||0,vote_average:Number(e.rating_tmdb)||0,still_path:e.still_path||'',lampa_grouped:true}});
 }
 rows.sort((a,b)=>a.season-b.season||a.number-b.number);
 // A partial catalogue cannot silently reassign the unlisted episodes.
 for(const s of known.values())if(rows.filter(e=>e.season===s.number).length!==s.count)return null;
 const groups=[...known.values()].sort((a,b)=>a.number-b.number).map(s=>({...s,rows:rows.filter(e=>e.season===s.number)}));
 return {rows,groups};
}
export function metadataBook(model,season,numbers,fileNumbers=[]){
 if(!model)return null;
 const rows=model.rows,files=[...new Set(fileNumbers.map(Number))].sort((a,b)=>a-b),group=model.groups.find(s=>s.number===Number(season));
 let chosen=group && group.rows,keys=chosen && chosen.map(e=>e.number);
 // Full absolute provider lists (e.g. 1..500) must use all metadata seasons.
 if(files.length===rows.length && files.every((n,i)=>n===i+1) && rows.every((e,i)=>e.number===i+1)){chosen=rows;keys=files;}
 else if(chosen && files.length===chosen.length && files.every((n,i)=>n===i+1) && chosen.every((e,i)=>e.number===chosen[0].number+i)){keys=files;}
 else if(!group || files.length && !files.every(n=>keys.includes(n))){
  const scene=rows.filter(e=>e.scene && Number(e.scene.season)===Number(season));
  if(!scene.length || !files.length || scene.length!==files.length || !files.every(n=>scene.filter(e=>Number(e.scene.episode)===n).length===1))return null;
  chosen=scene;keys=scene.map(e=>Number(e.scene.episode));
 }
 if(!chosen || !keys || new Set(keys).size!==chosen.length)return null;
 const book={};chosen.forEach((e,i)=>book[keys[i]]=e.episode);return book;
}
export function absoluteGroups(model,fileNumbers){
 const files=[...new Set(fileNumbers.map(Number))].sort((a,b)=>a-b);
 if(!model || model.groups.length<2 || files.length!==model.rows.length || !files.every((n,i)=>n===i+1) || !model.rows.every((e,i)=>e.number===i+1))return null;
 return model.groups.map(s=>({number:s.number,name:s.name,count:s.count,episodes:s.rows.map(e=>e.number)}));
}
export default function kinoapi(L){
 const cache=new Map(),pending=new Map(),queue=[],models=new Map(),loading=new Map();let active=0,next=0,timer,revision=0,blocked=0;
 const key=()=>String(L.Storage.value?L.Storage.value(KEY,''):L.Storage.get(KEY,'')).trim();
 const enabled=()=>flag(L,'minimal_kinoapi_enabled',!!key()) && !!key();
 function clear(){revision++;cache.clear();models.clear();const waiting=queue.splice(0);waiting.forEach(job=>settle(job,null));}
 function settle(job,value){const listeners=pending.get(job.path);if(listeners===job.listeners)pending.delete(job.path);job.listeners.splice(0).forEach(fn=>{try{fn(value);}catch(error){}});}
 function request(path,done){
  if(!enabled() || blocked>Date.now())return done(null);
  const old=cache.get(path);if(old && old.until>Date.now())return done(old.value);
  if(pending.has(path))return pending.get(path).push(done);
  if(queue.length>=24)return done(null);
  const listeners=[done];pending.set(path,listeners);queue.push({path,listeners,revision});pump();
 }
 function pump(){
  clearTimeout(timer);if(active>=2 || !queue.length)return;
  const wait=next-Date.now();if(wait>0){timer=setTimeout(pump,wait);return;}
  const job=queue.shift();if(job.revision!==revision){settle(job,null);pump();return;}
  active++;next=Date.now()+220;let finished=false;const xhr=new XMLHttpRequest();
  const finish=value=>{if(finished)return;finished=true;active--;if(job.revision===revision){cache.set(job.path,{value,until:Date.now()+(value?900000:30000)});while(cache.size>32)cache.delete(cache.keys().next().value);settle(job,value);}else settle(job,null);pump();};
  // Direct HTTPS only. Never send the personal key through Lampac proxies or URLs.
  try{xhr.open('GET',BASE+job.path,true);xhr.timeout=8000;xhr.setRequestHeader('X-API-Key',key());xhr.onload=()=>{
   if(xhr.status===429){const retry=Number(xhr.getResponseHeader('Retry-After'));blocked=Date.now()+Math.max(1000,Math.min(300000,(retry||2)*1000));while(queue.length)settle(queue.shift(),null);}
   let data=null;try{if(xhr.status===200)data=JSON.parse(xhr.responseText);}catch(error){}
   finish(data && Object.prototype.hasOwnProperty.call(data,'data')?data:null);
  };xhr.onerror=xhr.ontimeout=xhr.onabort=()=>finish(null);xhr.send();}catch(error){finish(null);}pump();
 }
 function identity(card){const shiki=card.source==='minimal_shiki' && (card.shikimori_id||card.id);return shiki?{source:'shikimori',id:shiki}: {source:'tmdb',id:card.tmdb_id||card.id};}
 function title(card,done){if(!card)return done(null);const ref=identity(card),type=card.media_type==='movie' || !card.name && !card.first_air_date?'movie':'tv';if(!positive(ref.id))return done(null);request('titles/by/'+ref.source+'/'+ref.id+(ref.source==='tmdb'?'?type='+type:''),value=>done(value && value.data || null));}
 function anime(card,done){
  if(!enabled() || !isAnime(card))return done(null);
  const id=Number(card.tmdb_id||card.id),language=locale(),stamp=id+':'+language,existing=models.get(stamp);if(existing && existing.until>Date.now())return done(existing.value);
  if(!positive(id) || card.source==='minimal_shiki')return done(null);
  const generation=revision,pendingKey=generation+':'+stamp;if(loading.has(pendingKey))return loading.get(pendingKey).push(done);loading.set(pendingKey,[done]);
  const finish=model=>{const callbacks=loading.get(pendingKey)||[];loading.delete(pendingKey);callbacks.forEach(fn=>fn(model));};
  request('tv/by/tmdb/'+id+'/seasons',seasons=>{if(!seasons || generation!==revision)return finish(null);request('anime/mappings/by/tmdb/'+id+'/episodes',episodes=>{
   if(generation!==revision)return finish(null);
   const model=episodes && Number(episodes.meta && episodes.meta.tmdb_id)===id?animeModel(seasons.data,episodes.data,language):null;
   models.set(stamp,{value:model,until:Date.now()+(model?900000:30000)});while(models.size>12)models.delete(models.keys().next().value);finish(model);
  });});
 }
 function refresh(){blocked=0;clear();const controller=L.Controller && L.Controller.enabled && L.Controller.enabled();if(L.Settings && L.Settings.update && controller && /^settings/.test(controller.name))L.Settings.update();}
 function input(){
  L.Input.edit({title:t('KinoAPI · Ключ API'),value:key(),free:true,nosave:true,nomic:true},value=>{
   // Keep the existing key name so native settings backups restore older installations too.
   const clean=String(value||'').trim();L.Storage.set(KEY,clean);L.Storage.set('minimal_kinoapi_enabled',!!clean);refresh();
  });
 }
 function setting(item){if(!item.find('.settings-param__value').length)item.append('<div class="settings-param__value"></div>');item.find('.settings-param__value').text(key());}
 if(L.SettingsApi){
  L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_kinoapi_enabled',type:'trigger',default:!!key()},field:{name:'KinoAPI',description:t('Метаданные аниме.')},onChange(){
   refresh();if(!flag(L,'minimal_kinoapi_enabled',!!key()) || key())return;
   // Cancelling the first input must leave the integration disabled.
   L.Storage.set('minimal_kinoapi_enabled',false);input();
  }});
  L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_kinoapi',type:'button'},field:{name:t('KinoAPI · Ключ API'),description:t('Получить ключ: {0}.',['https://kinoapi.lampac.dev/'])},onRender:setting,onChange:input});
 }
 return {enabled,title,anime,catalogueRequest(path,done){if(!/^titles\?/.test(path))return done(null);request(path,done);},book(card,season,numbers,files,done){anime(card,model=>done(metadataBook(model,season,numbers,files)));},groups(card,files,done){anime(card,model=>done(absoluteGroups(model,files)));},clear};
}
