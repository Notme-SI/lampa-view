import tmdbGet,{presentableCards} from './tmdb.js';
import catalogueCache from './catalogue-cache.js';
import {locale,text as t} from './i18n.js';
import {DISCOVERY_KINDS,discoveryState,discoverySpecs,discoveryAccepts} from './discovery-model.js';
export const DISCOVERY_SOURCE='minimal_discovery';
export function discoverySpec(value){
 if(!value || !DISCOVERY_KINDS.includes(value.kind) || !['movie','tv',''].includes(value.type))return null;
 const state=discoveryState(value.kind,{...value,section:'overview'});
 if(value.genre && state.genre!==String(value.genre) || value.network && state.network!==Number(value.network) || value.company && state.company!==Number(value.company) || value.hero && state.hero!==String(value.hero) || value.country && state.country!==value.country || value.sort && (value.hero?value.sort!=='popular':state.sort!==value.sort) || value.feed && !['airing','current','active','completed','trending','recent','upcoming'].includes(value.feed))return null;
 if(value.kind!=='cartoon' && value.type!==(value.kind==='movie'?'movie':'tv') || !value.type && value.kind!=='cartoon')return null;
 if(value.sort==='revenue' && value.type!=='movie')return null;
 let period=state.period;
 if(value.period){const match=String(value.period).match(/^(\d{4})-(\d{4})$/);if(!match || Number(match[1])<1870 || Number(match[2])<Number(match[1]) || Number(match[2])>new Date().getFullYear())return null;period=value.period;}
 return {...(value.ordered?{ordered:true}:{}),kind:value.kind,type:value.type,country:state.country,genre:state.genre,network:state.network,company:state.company,period,sort:state.sort || 'popular',hero:state.hero,...(['airing','current','active','completed','trending','recent','upcoming'].includes(value.feed)?{feed:value.feed}:{}),...(value.kind==='cartoon' && value.family?{family:true}:{})};
}
export default function discoverySource(L){
 const cache=new Map(),pending=new Map(),queue=[],cursors=new Map(),live=new Set();let active=0,generation=0;
 const disk=catalogueCache(L);
 const endpoint=()=>{try{const u=new URL(L.TMDB.api(''));return u.origin+u.pathname;}catch(error){return 'tmdb';}};
 const error=()=>({status_message:t('Не удалось загрузить {0}. Попробуйте ещё раз.',[t('подборки')])});
 function request(path,page,ok,fail,unreleased=false){
  const key=endpoint()+'|'+locale()+'|'+path+'|'+page+'|'+unreleased,old=cache.get(key) || (page===1?disk.get(key):null);
  if(old && Date.now()-old.at<300000)return ok(old.value);
  // Deliver a recent saved page once. Refresh only the cache, never replace
  // focused rows or change the pagination of an already displayed cursor.
  if(old && Date.now()-old.at<86400000){ok(old.value);ok=()=>{};fail=()=>{};}
  if(pending.has(key)){pending.get(key).listeners.push({ok,fail});return;}
  if(queue.length>=64)return fail(error());
  const job={key,path,page,unreleased,listeners:[{ok,fail}],generation};pending.set(key,job);queue.push(job);pump();
 }
 function pump(){while(active<3 && queue.length){
  const job=queue.shift();if(job.generation!==generation){pending.delete(job.key);continue;}active++;live.add(job);let settled=false,timer;
  const finish=json=>{if(settled)return;settled=true;clearTimeout(timer);active--;live.delete(job);if(pending.get(job.key)===job)pending.delete(job.key);
   const valid=job.generation===generation && json && Array.isArray(json.results);
   if(valid){const at=Date.now();cache.set(job.key,{value:json,at});if(job.page===1)disk.put(job.key,json,at);while(cache.size>96)cache.delete(cache.keys().next().value);}
   if(job.generation===generation)job.listeners.forEach(cb=>{if(valid)cb.ok(json);else cb.fail(error());});pump();
  };
  job.finish=finish;timer=setTimeout(()=>finish(null),15000);
  try{tmdbGet(L,job.path,{page:job.page},finish,()=>finish(null),{unreleased:job.unreleased});}catch(e){finish(null);}
 }}
 function clear(){generation++;cache.clear();queue.splice(0);pending.clear();cursors.forEach(c=>{c.cancelled=true;});cursors.clear();Array.from(live).forEach(job=>job.finish(null));}
 const source={clear,full(params,ok,fail){return L.Api.sources.tmdb.full({...params,source:'tmdb',method:params.card && params.card.media_type || params.method || 'tv'},ok,fail);},list(params,ok,fail=()=>{}){
  let parsed;try{parsed=JSON.parse(params.url);}catch(e){return fail(error());}const spec=discoverySpec(parsed);if(!spec)return fail(error());
  const page=Math.max(1,Math.min(500,Number(params.page)||1)),key=endpoint()+'|'+locale()+'|'+JSON.stringify(spec);let cursor=cursors.get(key);
  if(!cursor || Date.now()-cursor.at>300000){if(cursor)cursor.cancelled=true;cursor={at:Date.now(),spec,streams:discoverySpecs(spec).map(s=>({...s,next:1,total:1,finished:false})),pages:[],buffer:[],seen:new Set(),waiters:[],busy:false,cancelled:false};cursors.set(key,cursor);while(cursors.size>32){const first=cursors.keys().next().value;cursors.get(first).cancelled=true;cursors.delete(first);}}
  if(!cursor.streams.length || page>cursor.pages.length+2)return fail(error());
  if(cursor.pages[page-1])return ok(cursor.pages[page-1]);
  if(cursor.pages.length && cursor.streams.every(s=>s.finished && !(s.buffer || []).length) && !cursor.buffer.length)return ok({results:[],page,total_pages:cursor.pages.length});
  cursor.waiters.push({page,ok,fail,cancelled:params.minimal_cancelled || (()=>false)});load(cursor);
 }};
 function load(cursor){
  if(cursor.busy || cursor.cancelled || !cursor.waiters.length)return;cursor.busy=true;
  let rounds=0,building=cursor.pages.length+1;
  function finishPage(){
   if(cursor.cancelled)return;
   const results=cursor.buffer.splice(0,20),ended=cursor.streams.every(s=>s.finished && !(s.buffer || []).length) && !cursor.buffer.length;
   const json={results,page:building,total_pages:ended?building:building+1};cursor.pages.push(json);cursor.at=Date.now();cursor.busy=false;
   const ready=cursor.waiters.filter(w=>w.page<=cursor.pages.length);cursor.waiters=cursor.waiters.filter(w=>w.page>cursor.pages.length);ready.forEach(w=>w.ok(cursor.pages[w.page-1]));load(cursor);
  }
  function failPage(){cursor.busy=false;const waiters=cursor.waiters.splice(0);waiters.forEach(w=>w.fail(error()));}
  function next(){
   if(cursor.cancelled)return;
   cursor.waiters=cursor.waiters.filter(w=>!w.cancelled());
   if(!cursor.waiters.length){cursor.busy=false;return;}
   const ordered=cursor.spec.ordered;
   if(ordered){
    cursor.streams.forEach(s=>{if(!s.buffer)s.buffer=[];});
    const score=card=>cursor.spec.sort==='rated'?Number(card.vote_average)||0:cursor.spec.sort==='new'?String(card.media_type==='movie'?card.release_date:card.first_air_date):Number(card.popularity)||0;
    while(cursor.buffer.length<20 && !cursor.streams.some(s=>!s.finished && !s.buffer.length)){
     const candidates=cursor.streams.filter(s=>s.buffer.length);if(!candidates.length)break;
     candidates.sort((a,b)=>{const x=score(a.buffer[0]),y=score(b.buffer[0]);return x===y?0:x>y?-1:1;});const card=candidates[0].buffer.shift(),key=card.media_type+':'+card.id;if(!cursor.seen.has(key)){cursor.seen.add(key);cursor.buffer.push(card);}
    }
   }
   const available=cursor.streams.filter(s=>!s.finished && (!ordered || !s.buffer.length));
   // A display page owns its accepted rows. Partial pages never make the next
   // page skip accepted cards, and sparse foreign feeds have a bounded scan.
   if(cursor.buffer.length>=20 || !available.length || rounds>=4)return finishPage();rounds++;
   const replies=new Array(available.length);let left=available.length,failed=false;
   available.forEach((stream,index)=>request(stream.path,stream.next,json=>{if(cursor.cancelled)return;replies[index]=json;complete();},()=>{failed=true;complete();},cursor.spec.feed==='upcoming'));
   function complete(){if(--left)return;if(cursor.cancelled)return;if(failed)return failPage();
    const accepted=available.map((stream,i)=>{
     const json=replies[i],strict=['movie','tv','dorama','tvshow'].includes(cursor.spec.kind),russian=strict && locale()==='ru',rows=presentableCards(json.results.map(card=>{const name=[card.title,card.name].find(v=>/[а-яё]/i.test(v || ''));return russian && name?{...card,title:name,...(stream.type==='tv'?{name}:{})}:card;}),russian).filter(card=>!strict || !!(card.poster_path || card.img) && (!Object.prototype.hasOwnProperty.call(card,'backdrop_path') || !!card.backdrop_path));
     stream.total=Math.min(500,Math.max(1,Number(json.total_pages)||1));stream.next++;stream.finished=stream.next>stream.total || !json.results.length;
     return rows.filter(card=>Number.isSafeInteger(Number(card.id)) && Number(card.id)>0 && discoveryAccepts(card,{...cursor.spec,type:stream.type})).map(card=>({...card,source:'tmdb',media_type:stream.type}));
    });
    if(ordered){accepted.forEach((rows,i)=>available[i].buffer.push(...rows));return next();}
    const length=Math.max(0,...accepted.map(a=>a.length));for(let i=0;i<length;i++)for(const rows of accepted){const card=rows[i];if(!card)continue;const key=card.media_type+':'+card.id;if(!cursor.seen.has(key)){cursor.seen.add(key);cursor.buffer.push(card);}}
    next();
   }
  }
  next();
 }
 L.Api.sources=L.Api.sources || {};L.Api.sources[DISCOVERY_SOURCE]=source;return source;
}
