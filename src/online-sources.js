import {text as t} from './i18n.js';
export const sourceKey=row=>String(typeof row==='string'?row:row && (row.balanser || row.source || row.name) || '').split(' ')[0].toLowerCase().replace(/_snack$/,'');
const russian=new Set('filmix pizdatoehd kinobase phantom aladin rudub kinogo leproduction veoveo collaps hdvb rutubemovie vkmovie kinoteatrkg lordfilm vibix kinotochka kodik ailiberty aniliberty animelib animedia animevost dreamerscast animebesst anidub zetflix alloha hdrezka'.split(' '));
export function sourceLanguage(row){
 const key=sourceKey(row),label=String(row.name || row),explicit=String(row.voice_lang || row.lang || '').toLowerCase();
 if(/^(ru|en|uk|ka|uz|it|fr)$/.test(explicit))return explicit;
 if(/\beng\b|англий|english/i.test(label) || /^(videasy|movpi|vidsrc|vidlink|vidfast)$/.test(key))return 'en';
 if(/укра|ukrain/i.test(label) || /^(uafilm|eneyida|uakino|uaserials|uaflix|kinoukr|franko|starlight|oneplusone|anitube|unimay|mikai|bamboo|animeon)$/.test(key))return 'uk';
 if(/грузин|georg/i.test(label) || /^(geosaitebi|kinoflix)$/.test(key))return 'ka';
 if(/узбек|uzbek/i.test(label))return 'uz';if(/итальян|italian/i.test(label))return 'it';if(/француз|french/i.test(label))return 'fr';
 return russian.has(key)?'ru':'other';
}
export function filterSources(value,off){
 const keep=row=>!off.includes(sourceKey(row));
 if(Array.isArray(value))return value.filter(keep);
 if(value && Array.isArray(value.online))return {...value,online:value.online.filter(keep),...(Array.isArray(value.pending)?{pending:value.pending.filter(keep)}:{})};
 return value;
}
export default function onlineSources(L){
 const OFF='alc_auto_src_off',KNOWN='minimal_online_sources_v1';let revision=0,loading=false,waiters=[],until=0;
 const off=()=>{const value=L.Storage.get(OFF,[]);return Array.isArray(value)?value.map(sourceKey):[];};
 const known=()=>{const value=L.Storage.get(KNOWN,[]);return Array.isArray(value)?value:[];};
 function remember(value){const list=Array.isArray(value)?value:value && value.online;if(!Array.isArray(list))return;
  const entries=new Map(known().map(row=>[sourceKey(row),row]));
  list.forEach(row=>{const id=sourceKey(row);if(row && row.service!==true && row.url && /^[a-z0-9][a-z0-9_.-]{0,39}$/.test(id) && !/^(alc_?auto|auto|ossubs|kpid|animeid|subsx|alcmedia|alcstats)$/.test(id))entries.set(id,{balanser:id,name:String(row.name || id),lang:row.voice_lang || row.lang || ''});});
  const next=[...entries.values()].slice(0,200);if(JSON.stringify(next)!==JSON.stringify(known()))L.Storage.set(KNOWN,next);
 }
 // Preserve the native transport, authentication, abort handles and callbacks.
 // Only discovery responses are filtered. Individual playback requests are untouched.
 if(L.Reguest && !L.Reguest.lampaViewSources){const Native=L.Reguest;
  function Request(...args){const request=new Native(...args);for(const method of ['silent','native']){const send=request[method];if(typeof send!=='function')continue;request[method]=function(url,ok,...rest){
    let discovery=false;try{discovery=/\/(?:lite\/events|lifeevents)\/?$/.test(new URL(String(url),typeof location==='undefined'?undefined:location.href).pathname);}catch(error){}
    if(!discovery || typeof ok!=='function')return send.call(this,url,ok,...rest);
    return send.call(this,url,function(value,...extra){remember(value);return ok.call(this,request.lampaViewInventory?value:filterSources(value,off()),...extra);},...rest);
   };}return request;}
  Object.setPrototypeOf(Request,Native);Request.prototype=Native.prototype;Request.lampaViewSources=true;L.Reguest=Request;
 }
 function server(){const api=typeof window!=='undefined' && window.alc_auto_debug;let base=String(L.Storage.get('alc_auto_server','') || api && api.base && api.base() || '');
  if(!base && typeof location!=='undefined' && /^https?:$/.test(location.protocol))base=location.origin;
  try{const url=new URL(/^https?:\/\//i.test(base)?base:'http://'+base);return /^https?:$/.test(url.protocol)?url.origin:'';}catch(error){return '';}
 }
 function refresh(done){if(loading){waiters.push(done);return;}if(until>Date.now())return done();const base=server();if(!base || !L.Reguest)return done();loading=true;waiters=[done];let left=3;
  const finish=()=>{if(--left)return;loading=false;until=Date.now()+300000;const list=waiters.splice(0);list.forEach(fn=>fn());};
  for(const query of ['serial=0','serial=1','serial=1&anime=1']){const request=new L.Reguest();request.lampaViewInventory=true;request.timeout(4500);request.silent(base+'/lite/events?rjson=true&'+query,value=>{remember(value);finish();},finish);}
 }
 const labels={ru:'Русский',en:'Английский',uk:'Украинский',ka:'Грузинский',uz:'Узбекский',it:'Итальянский',fr:'Французский',other:'Другие / язык не указан'};
 const back=()=>L.Controller.toggle('settings');
 function group(language){const disabled=off();L.Select.show({title:t(labels[language]),items:known().filter(row=>sourceLanguage(row)===language).map(row=>({title:row.name,src:sourceKey(row),checkbox:true,checked:!disabled.includes(sourceKey(row))})),onCheck:item=>{const next=off().filter(id=>id!==item.src);if(!item.checked)next.push(item.src);L.Storage.set(OFF,next);revision++;},onBack:menu});}
 function menu(){const rows=known();L.Select.show({title:t('Источники онлайна'),items:Object.keys(labels).filter(lang=>rows.some(row=>sourceLanguage(row)===lang)).map(lang=>({title:t(labels[lang]),subtitle:String(rows.filter(row=>sourceLanguage(row)===lang).length),lang})).concat([{title:t('Обновить список'),refresh:true}]),onSelect:item=>{if(item.refresh){until=0;refresh(menu);}else group(item.lang);},onBack:back});}
 if(L.SettingsApi)L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_online_sources',type:'button'},field:{name:t('Источники онлайна'),description:t('Включение по языкам. Изменения при следующем открытии онлайн.')},onChange:()=>refresh(menu)});
 return {off,remember,menu,revision:()=>revision};
}
