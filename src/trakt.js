import {presentableCards} from './tmdb.js';
// Trakt determines list membership and order. TMDB IDs keep native Lampa
// details, online providers and torrent search interoperable with these cards.
import flag from './storage-flag.js';
import traktMetadata from './trakt-metadata.js';
const BASE='https://api.trakt.tv/';
const TYPES={movie:'movies',tv:'shows'};
const FEEDS=[
 ['Сейчас смотрят','trending'],
 ['Популярное','popular'],
 ['Самое просматриваемое за неделю','watched/weekly'],
 ['В коллекциях за месяц','collected/monthly'],
 ['Ожидаемые','anticipated']
];
export function traktPlan(kind){
 if(kind==='dorama')return FEEDS.map(([title,path])=>({title,url:'shows/'+path+'?countries=kr,jp,cn,tw,th&genres=drama,romance,comedy,mystery'}));
 if(kind==='tvshow')return FEEDS.map(([title,path])=>({title,url:'shows/'+path+'?genres=reality,talk-show,game-show&languages=ru'}));
 if(!kind)return FEEDS.map(([title,path],index)=>({title,url:'mixed/'+path,...(index===0?{minimal_row_aliases:['?sort=now_playing','movie/now_playing','movies/trending','shows/trending']}:index===1?{minimal_row_aliases:['movie/popular','tv/popular','movies/popular','shows/popular']}:{})}));
 const types=TYPES[kind]?[TYPES[kind]]:kind==='anime'?['shows']:['movies','shows'];
 const filter=kind==='movie' || kind==='tv'?'?without_genres=animation':kind==='anime'?'?genres=animation&languages=ja':kind==='cartoon'?'?genres=animation':'';
 return types.flatMap(type=>FEEDS.map(([title,path],index)=>({title:kind==='cartoon'?(index===1?(type==='movies'?'Популярные мультфильмы':'Популярные мультсериалы'):(type==='movies'?'Мультфильмы':'Мультсериалы')+' · '+title):title,url:type+'/'+path+filter})));
}
function image(value){
 const url=Array.isArray(value)?value[0]:'';
 if(typeof url!=='string')return '';
 const full=/^https:\/\//i.test(url)?url:'https://'+url;
 return /^https:\/\/media\.trakt\.tv\//i.test(full)?full:'';
}
export function traktCards(json,type){
 const seen=new Set();
 return (Array.isArray(json)?json:[]).map(entry=>{
  const data=entry.movie || entry.show || entry,kind=entry.show?'tv':entry.movie?'movie':type;
  const id=Number(data.ids && data.ids.tmdb);if(!Number.isSafeInteger(id) || id<=0 || seen.has(kind+id))return null;
  seen.add(kind+id);const date=data.released || data.first_aired || (data.year?data.year+'-01-01':'');
  return {id,source:'tmdb',media_type:kind,title:data.title,original_title:data.original_title || data.title,
   ...(kind==='tv'?{name:data.title,original_name:data.original_title || data.title,first_air_date:date}:{release_date:date}),
   overview:data.overview || '',vote_average:Number(data.rating) || 0,vote_count:Number(data.votes) || 0,
   original_language:data.language || '',origin_country:data.country?[String(data.country).toUpperCase()]:[],genre_ids:(data.genres || []).map(g=>({animation:16,documentary:99,reality:10764,'talk-show':10767,'game-show':10764,drama:18,romance:10749,comedy:35,mystery:9648})[g]).filter(Boolean),trakt_genres:data.genres || [],trakt_id:data.ids.trakt,img:image(data.images && data.images.poster),
   minimal_trakt:true};
 }).filter(Boolean);
}
export default function installTrakt(L){
 if(!L.Api || !L.Api.sources || L.Api.sources.trakt)return;
 const cache=new Map(),pending=new Map(),queue=[],live=new Set(),metadata=traktMetadata(L);let running=0,generation=0,lastKey='',searchRevision=0;
 const client=()=>String(L.Storage.get('minimal_trakt_client_id','') || '').trim();
 const enabled=()=>flag(L,'minimal_trakt_enabled',false);
 const error=(fail,message)=>{if(fail)fail({status_message:message});};
 function pump(){
  while(running<2 && queue.length){const job=queue.shift();if(job.generation!==generation)continue;
   running++;const xhr=new XMLHttpRequest();live.add(xhr);let settled=false;
   function finish(json,message){
    if(settled)return;settled=true;live.delete(xhr);running--;
    if(job.generation===generation){
     pending.delete(job.key);
     if(json){cache.set(job.key,{at:Date.now(),value:json});if(cache.size>40)cache.delete(cache.keys().next().value);}
     job.callbacks.forEach(([ok,fail])=>json?ok(json):error(fail,message));
    }
    pump();
   }
   xhr.minimalTraktPath=job.path;
   xhr.open('GET',BASE+job.path,true);xhr.timeout=10000;
   xhr.setRequestHeader('trakt-api-key',job.client);xhr.setRequestHeader('trakt-api-version','2');xhr.setRequestHeader('Accept','application/json');
   xhr.onload=()=>{
    if(xhr.status<200 || xhr.status>=300)return finish(null,xhr.status===401 || xhr.status===403?'Trakt: проверьте Client ID':xhr.status===429?'Trakt: слишком много запросов, повторите позже':'Trakt недоступен ('+xhr.status+')');
    try {const rows=JSON.parse(xhr.responseText);if(!Array.isArray(rows))throw new Error();finish({rows,pages:Math.max(1,Number(xhr.getResponseHeader('X-Pagination-Page-Count')) || 1)});}
    catch(e){finish(null,'Trakt вернул некорректный ответ');}
   };
   xhr.onerror=xhr.ontimeout=()=>finish(null,'Не удалось подключиться к Trakt');xhr.onabort=()=>finish(null,'Запрос Trakt отменён');
   try{xhr.send();}catch(e){finish(null,'Не удалось подключиться к Trakt');}
  }
 }
 function clear(){generation++;queue.length=0;pending.clear();metadata.clear();for(const xhr of Array.from(live))xhr.abort();}
 function list(params,ok,fail){
  if(!enabled())return error(fail,'Включите Trakt в настройках каталога L A M P A');
  const id=client();if(!id)return error(fail,'Добавьте Client ID в Настройки → L A M P A → Каталог и поиск → Trakt');
  if(id!==lastKey){clear();cache.clear();lastKey=id;}
  const mixed=String(params.url || '').match(/^mixed\/(trending|popular|watched\/weekly|collected\/monthly|anticipated)$/);
  if(mixed){
   const parts=new Array(2);let left=2,reason;
   ['movies','shows'].forEach((type,index)=>list({...params,url:type+'/'+mixed[1],minimal_limit:10},json=>{parts[index]=json;finish();},e=>{reason=e;finish();}));
   function finish(){if(--left)return;const good=parts.filter(Boolean);if(!good.length)return error(fail,reason && reason.status_message || 'Trakt недоступен');
    const results=[],seen=new Set();for(let i=0;i<10;i++)for(const part of good){const card=part.results[i];if(card && !seen.has(card.media_type+':'+card.id)){seen.add(card.media_type+':'+card.id);results.push(card);}}
    ok({results,page:good[0].page,total_pages:Math.max(...good.map(part=>part.total_pages))});
   }
   return;
  }
  // Only our fixed public list routes can receive the API key.
  const path=String(params.url || 'movies/trending'),search=path.match(/^search\/(movie|show)\?query=([^&]+)$/);
  if(search)return searchPage({type:search[1],query:decodeQuery(search[2]),page:params.page},ok,fail);
  const match=path.match(/^(movies|shows)\/(trending|popular|watched\/weekly|collected\/monthly|anticipated)(\?.*)?$/);
  const allowed=new Set(['','?without_genres=animation','?genres=animation','?genres=animation&languages=ja',...['dorama','tvshow'].flatMap(kind=>traktPlan(kind).map(row=>row.url.slice(row.url.indexOf('?'))))]);
  if(!match || !allowed.has(match[3] || ''))return error(fail,'Неизвестная подборка Trakt');
  const page=Math.max(1,Math.min(1000,Number(params.page) || 1));
  const limit=params.minimal_limit===10?10:20;
  const requestPath=path.replace('?without_genres=animation','');
  const route=requestPath+(requestPath.includes('?')?'&':'?')+'extended=full&limit='+limit+'&page='+page,key=route;
  const own=generation,done=json=>{
   const rows=json.rows.filter(entry=>{const data=entry.show || entry.movie || entry;
    if(path.includes('languages=ru'))return data.language==='ru' || !data.language && data.country==='ru';
    if(path.includes('countries=kr,jp,cn,tw,th'))return ['kr','jp','cn','tw','th'].includes(String(data.country || '').toLowerCase()) && !(data.genres || []).some(g=>['animation','reality','talk-show','game-show','documentary'].includes(g));
    if(path.includes('without_genres=animation'))return !(data.genres || []).includes('animation');
    return true;
   });
   metadata.enrich(traktCards(rows,match[1]==='movies'?'movie':'tv'),results=>{if(own===generation)ok({results:presentableCards(results,path.includes('countries=kr,jp,cn,tw,th') || path.includes('languages=ru')).filter(card=>{const genres=[...(card.genre_ids || []),...(card.genres || [])].map(g=>Number(g.id || g));if(path.includes('without_genres=animation'))return !genres.includes(16);if(path.includes('countries=kr,jp,cn,tw,th'))return !genres.some(g=>[16,99,10764,10767].includes(g)) && (card.origin_country || []).some(country=>['KR','JP','CN','TW','TH'].includes(country));return true;}),page,total_pages:json.pages});});
  };
  const saved=cache.get(key);if(saved && Date.now()-saved.at<600000)return done(saved.value);
  if(pending.has(key)){pending.get(key).callbacks.push([done,fail]);return;}
  const job={key,path:route,client:id,generation,callbacks:[[done,fail]]};pending.set(key,job);queue.push(job);pump();
 }
 function cancelSearch(){
  searchRevision++;
  for(let i=queue.length-1;i>=0;i--)if(queue[i].path.startsWith('search/')){pending.delete(queue[i].key);queue.splice(i,1);}
  for(const [key,job] of pending)if(job.path.startsWith('search/'))job.callbacks=[];
  for(const xhr of Array.from(live))if((xhr.minimalTraktPath || '').startsWith('search/'))xhr.abort();
 }
 function decodeQuery(value){try{return decodeURIComponent(String(value || ''));}catch(e){return String(value || '');}}
 function searchPage(params,ok,fail){
  if(!enabled() || !client())return error(fail,'Включите Trakt и добавьте Client ID');
  const id=client();if(id!==lastKey){clear();cache.clear();lastKey=id;}
  const type=params.type==='show'?'show':'movie',query=String(params.query || '').trim().slice(0,200),page=Math.max(1,Math.min(1000,Number(params.page)||1));
  if(!query)return ok({results:[],page,total_pages:1});
  const path='search/'+type+'?query='+encodeURIComponent(query)+'&extended=full&limit=20&page='+page,key=path,own=generation;
  const done=json=>metadata.enrich(traktCards(json.rows,type==='show'?'tv':'movie'),results=>{if(own===generation)ok({results,page,total_pages:json.pages});});
  const saved=cache.get(key);if(saved && Date.now()-saved.at<600000)return done(saved.value);
  if(pending.has(key)){pending.get(key).callbacks.push([done,fail]);return;}
  const job={key,path,client:id,generation,callbacks:[[done,fail]]};pending.set(key,job);queue.push(job);pump();
 }
 function discovery(){
  return {title:'Trakt',params:{save:true},onCancel:cancelSearch,
   search(params,ok){
    cancelSearch();const token=searchRevision,query=decodeQuery(params.query),rows=new Array(2);let left=2;
    ['movie','show'].forEach((type,index)=>{
     const finish=json=>{rows[index]={title:index?'Сериалы':'Фильмы',type,...json,source:'trakt',url:'search/'+type+'?query='+encodeURIComponent(query)};if(!--left && token===searchRevision)ok(rows);};
     searchPage({type,query,page:1},finish,()=>finish({results:[],page:1,total_pages:1}));
    });
   },
   onMore(params,close){close();L.Activity.push({component:'category_full',source:'trakt',url:'search/'+(params.data.type==='show'?'show':'movie')+'?query='+encodeURIComponent(params.query),title:'Trakt · '+params.query,page:2});}
  };
 }
 function rows(object,ok,fail){
  const plan=traktPlan(object.url || object.cat),output=new Array(plan.length);let left=plan.length,failures=0,reason;
  function finish(){if(--left)return;const result=output.filter(Boolean);if(!result.length && failures)return error(fail,reason || 'Trakt недоступен');ok(result);}
  plan.forEach((row,index)=>list({url:row.url,page:1},json=>{output[index]={...json,...row,source:'trakt'};finish();},e=>{failures++;reason=e.status_message;finish();}));
 }
 const tmdb=L.Api.sources.tmdb,adapter={main:rows,category:rows,list,clear};
 // Details always use a verified TMDB ID, never the unrelated Trakt ID.
 for(const method of ['full','person','seasons','menu','menuCategory','genres','collections'])if(tmdb[method])adapter[method]=function(){return tmdb[method].apply(tmdb,arguments);};
 L.Api.sources.trakt=adapter;
 function sources(){
  if(!L.Params || !L.Params.select)return;
  const options={...(L.Params.values.source || {tmdb:'TMDB',cub:'CUB'})};delete options.trakt;
  if(enabled() && client()){options.trakt='Trakt';adapter.discovery=discovery;}else delete adapter.discovery;
  const selected=L.Storage.get('source','tmdb');
  if(selected!=='trakt' && L.Storage.get('minimal_trakt_previous_source','')!==selected)L.Storage.set('minimal_trakt_previous_source',selected);
  if(selected==='trakt' && !options.trakt){const previous=L.Storage.get('minimal_trakt_previous_source','tmdb');L.Storage.set('source',previous!=='trakt' && options[previous]?previous:'tmdb');}
  L.Params.select('source',options,'tmdb');
 }
 function refresh(){
  sources();const controller=L.Controller && L.Controller.enabled && L.Controller.enabled();
  if(L.Settings && L.Settings.update && controller && /^settings/.test(controller.name))L.Settings.update();
 }
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_trakt_enabled',type:'trigger',default:false},field:{name:'Trakt',description:'Добавить в Настройки → Остальное → Основной источник. При первом включении потребуется Client ID.'},onChange(){
  clear();cache.clear();
  if(!enabled() || client())return refresh();
  // Do not leave an unusable source enabled if the empty input is cancelled.
  L.Storage.set('minimal_trakt_enabled',false);sources();
  L.Input.edit({title:'Trakt · Client ID',value:'',free:true,nosave:true,nomic:true},value=>{
   const id=String(value || '').trim();
   L.Storage.set('minimal_trakt_client_id',id);L.Storage.set('minimal_trakt_enabled',!!id);refresh();
  });
 }});
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_trakt_client_id',type:'input',values:'',default:''},field:{name:'Trakt · Client ID',description:'Публичный Client ID собственного приложения Trakt. Выбор каталога: Настройки → Остальное → Основной источник. Client Secret не нужен.'},onChange(){clear();cache.clear();if(!client())L.Storage.set('minimal_trakt_enabled',false);refresh();}});
 sources();
 return adapter;
}
