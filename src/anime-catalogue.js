import tmdbGet from './tmdb.js';
import {locale,text as t} from './i18n.js';
import {isAnime} from './metadata.js';
import {animeRecords,animeTarget,animeSeed,animeEpisodeMap,animeIndexInfo} from './anime-index.js';
import {franchiseModel,franchiseCatalogueRows,franchiseMenuGroups} from './anime-franchise.js';
import {seasonName} from './episode-metadata.js';
const positive=n=>Number.isSafeInteger(Number(n)) && Number(n)>0;
const day=value=>String(value || '').slice(0,10),time=value=>Date.parse(day(value)+'T00:00:00Z');
function inRelease(episode,release){const aired=time(episode.air_date),from=time(release.aired),until=time(release.released || (['ongoing','released'].includes(release.status)?new Date().toISOString().slice(0,10):''));return Number.isFinite(aired) && Number.isFinite(from) && Number.isFinite(until) && aired>=from-86400000 && aired<=until+86400000;}
export function releaseGroups(card,files,model,books){
 const numbers=files.map(Number).slice().sort((a,b)=>a-b),seasons=(card.seasons || []).filter(s=>Number(s.season_number)>0).slice().sort((a,b)=>a.season_number-b.season_number),episodes=[];
 if(!model || numbers.length<2 || numbers.length>3000 || !numbers.every((n,i)=>n===i+1) || seasons.reduce((n,s)=>n+Number(s.episode_count||0),0)!==numbers.length)return null;
 for(const season of seasons){const book=books[season.season_number],rows=book && (book.episodes_original || book.episodes);if(!Array.isArray(rows) || rows.length!==Number(season.episode_count))return null;const sorted=rows.slice().sort((a,b)=>a.episode_number-b.episode_number);if(!sorted.every((e,i)=>Number(e.episode_number)===i+1 && Number(e.season_number)===Number(season.season_number)))return null;episodes.push(...sorted);}
 const releases=model.nodes.filter(n=>n.record && Number(n.record.tv)===Number(card.tmdb_id || card.id) && ['tv','ona'].includes(n.kind) && Number.isSafeInteger(n.episodes) && n.episodes>0 && n.status!=='anons');
 if(releases.length<2 || releases.length>60 || releases.reduce((n,r)=>n+r.episodes,0)!==episodes.length)return null;
 const index=new Map(episodes.map((e,i)=>[Number(e.season_number)+':'+Number(e.episode_number),i+1])),used=new Set(),groups=[];
 for(const release of releases){
  let map=animeEpisodeMap(release.record,release.episodes,card,books);
  if(map && release.aired && release.released && map.some(e=>!e.metadata || !inRelease(e.metadata,release)))map=null;
  if(!map){const rows=episodes.filter(e=>inRelease(e,release));if(rows.length!==release.episodes)return null;map=rows.map((metadata,i)=>({number:i+1,season:Number(metadata.season_number),episode:Number(metadata.episode_number),metadata}));}
  const selected=map.map(e=>({number:index.get(e.season+':'+e.episode),metadata:e.metadata}));if(selected.some(e=>!e.number || !e.metadata || used.has(e.number)))return null;selected.forEach(e=>used.add(e.number));selected.sort((a,b)=>a.number-b.number);
  if(!selected.every((e,i)=>e.number===selected[0].number+i))return null;
  const book={};selected.forEach(e=>book[e.number]={...e.metadata,lampa_grouped:true,lampa_season_name:release.name});groups.push({number:0,name:release.name,count:selected.length,episodes:selected.map(e=>e.number),book,mal_id:release.id,anime_release:true});
 }
 if(used.size!==episodes.length)return null;groups.sort((a,b)=>a.episodes[0]-b.episodes[0]);groups.forEach((g,i)=>g.number=i+1);return groups;
}
const genericEpisodeName=value=>!String(value || '').trim() || /^(?:episode|серия|эпизод|folge|episodio|épisode)\s*\d+$/i.test(String(value).trim());
export function completeEpisodeData(data,fallback){
 if(!data || !fallback || Number(data.season_number)!==Number(fallback.season_number))return data;
 const rows=fallback.episodes_original || fallback.episodes || [];
 const merge=e=>{const other=rows.find(v=>Number(v.episode_number)===Number(e.episode_number) && (!v.id || !e.id || v.id===e.id));if(!other)return e;return {...e,...(genericEpisodeName(e.name) && !genericEpisodeName(other.name)?{name:other.name}:{}),...(!e.overview && other.overview?{overview:other.overview}:{}),...(!e.still_path && other.still_path?{still_path:other.still_path}:{})};};
 return {...data,...(data.episodes?{episodes:data.episodes.map(merge)}:{}),...(data.episodes_original?{episodes_original:data.episodes_original.map(merge)}:{})};
}
// A joined video list can end with full-length TV specials stored in season 0.
// Match their complete release interval, never an arbitrary "next" episode.
export function joinedPartsBook(parts,books){
 const result={};for(const part of parts){
  const source=books[part.season],rows=source && (source.episodes_original || source.episodes) || [];
  const available=Number(part.available || part.count);let selected=Array.from({length:available},(_,i)=>rows.find(e=>Number(e.episode_number)===part.offset+i+1));
  if(selected.some(e=>!e) && ['special','tv_special'].includes(part.kind) && part.aired && part.released){
   const specials=books[0],candidates=(specials && (specials.episodes_original || specials.episodes) || []).filter(e=>inRelease(e,part)).sort((a,b)=>a.air_date.localeCompare(b.air_date) || a.episode_number-b.episode_number);
   if(candidates.length===part.count && Math.abs(time(candidates[0].air_date)-time(part.aired))<=86400000 && Math.abs(time(candidates[candidates.length-1].air_date)-time(part.released))<=86400000)selected=candidates.slice(0,available);
  }
  selected.forEach((e,i)=>{if(e)result[part.offset+i+1]={...e,lampa_grouped:true};});
 }
 return Object.keys(result).length?result:null;
}
export default function animeCatalogue(L,kino){
 const cache=new Map(),pending=new Map(),queue=[],models=new Map(),modelPending=new Map(),live=new Set();let active=0,revision=0;
 function load(path,done){const key=locale()+'|'+path,hit=cache.get(key);if(hit && Date.now()-hit.at<900000)return done(hit.value);if(pending.has(key)){pending.get(key).push(done);return;}if(queue.length>=24)return done(null);const listeners=[done];pending.set(key,listeners);queue.push({path,key,listeners,revision});pump();}
 function pump(){while(active<2 && queue.length){const job=queue.shift();active++;live.add(job);let settled=false;const timer=setTimeout(()=>finish(job.fallback || null),12000);
  function finish(value){if(settled)return;settled=true;clearTimeout(timer);active--;live.delete(job);if(pending.get(job.key)===job.listeners)pending.delete(job.key);if(job.revision===revision){if(value){cache.set(job.key,{at:Date.now(),value});while(cache.size>48)cache.delete(cache.keys().next().value);}job.listeners.splice(0).forEach(fn=>fn(value));}pump();}
  job.finish=finish;try{tmdbGet(L,job.path,{},json=>{const valid=json && (Array.isArray(json.seasons) || Array.isArray(json.episodes) || Array.isArray(json.movie_results) && Array.isArray(json.tv_results));if(!valid)return finish(null);const requested=job.path.match(/tv\/(\d+)\/season\/(\d+)/),returned=String(json.url || '').match(/tv\/(\d+)\/season\/(\d+)/);if(requested && (returned && (requested[1]!==returned[1] || requested[2]!==returned[2]) || json.season_number!=null && Number(json.season_number)!==Number(requested[2])))return finish(null);const rows=json.episodes_original || json.episodes;if(requested && Array.isArray(rows) && rows.some(e=>e.season_number!=null && Number(e.season_number)!==Number(requested[2])))return finish(null);if(/season\/\d+(?:\?|$)/.test(job.path) && !/[?&]language=en(?:&|$)/.test(job.path) && locale()!=='en' && Array.isArray(rows) && rows.some(e=>genericEpisodeName(e.name))){job.fallback=json;const path=job.path.split('?')[0]+'?language=en';return tmdbGet(L,path,{langs:'en'},fallback=>finish(completeEpisodeData(json,fallback)),()=>finish(json));}finish(json);},()=>finish(null));}catch(error){finish(null);}
 }}
 function canonical(card,done){const mapped=card.source==='minimal_shiki'?animeTarget(card):null,id=Number(card.tmdb_id || mapped && mapped.type==='tv' && mapped.id || card.id);if(!positive(id) || card.media_type==='movie' || card.source==='minimal_shiki' && (!mapped || mapped.type!=='tv'))return done(null);
  if(Array.isArray(card.seasons) && Number(card.id)===id)return done(card);
  load('tv/'+id,value=>done(value && Number(value.id)===id?{...value,source:'tmdb',media_type:'tv',minimal_anime:true}:null));
 }
 function collection(card,done){if(!isAnime(card))return done(null);let seed=Number(card.shikimori_id || card.mal_id || card.source==='minimal_shiki' && card.id || (animeSeed(card)||{}).mal);if(!positive(seed))return done(null);
  const key=locale()+'|'+seed,hit=models.get(key);if(hit && Date.now()-hit.at<900000)return done(hit.model);if(modelPending.has(key)){modelPending.get(key).push(done);return;}
  const api=L.Api && L.Api.sources && L.Api.sources.minimal_shiki;if(!api || !api.franchise)return done(null);modelPending.set(key,[done]);const generation=revision;
  const finish=model=>{if(generation!==revision)return;const listeners=modelPending.get(key)||[];modelPending.delete(key);if(model){models.set(key,{at:Date.now(),model});while(models.size>24)models.delete(models.keys().next().value);}listeners.forEach(fn=>fn(model));};
  api.franchise(seed,value=>finish(franchiseModel(value.graph,seed,value.metadata)),()=>finish(null));
 }
 function resolveTarget(card,done){const target=animeTarget(card);if(target)return done(target);const records=animeRecords(card);if(records.length!==1 || (records[0].imdb || []).length!==1)return done(null);const record=records[0],type=card.media_type || (card.name?'tv':'movie');load('find/'+record.imdb[0]+'?external_source=imdb_id',json=>{const results=json && json[type==='movie'?'movie_results':'tv_results'] || [];done(results.length===1 && positive(results[0].id)?{id:Number(results[0].id),type,release:record}:null);});}
 function groups(card,files,done,knownBooks={}){canonical(card,value=>{if(!value || (value.seasons || []).filter(s=>s.season_number>0).length!==1)return done(null);const count=(value.seasons || []).filter(s=>s.season_number>0).reduce((n,s)=>n+Number(s.episode_count||0),0);if(count!==files.length || !files.map(Number).sort((a,b)=>a-b).every((n,i)=>n===i+1))return done(null);
  collection({...value,...(card.shikimori_id?{shikimori_id:card.shikimori_id}:{}),minimal_anime:true},model=>{if(!model)return done(null);const seasons=value.seasons.filter(s=>s.season_number>0),books={};let left=seasons.length;seasons.forEach(s=>{const finish=book=>{books[s.season_number]=book;if(!--left)done(releaseGroups(value,files,model,books));};if(knownBooks[s.season_number])finish(knownBooks[s.season_number]);else load('tv/'+value.id+'/season/'+s.season_number,finish);});});
 });}
 function clear(){revision++;cache.clear();models.clear();queue.splice(0);pending.forEach(rows=>rows.splice(0).forEach(fn=>fn(null)));pending.clear();modelPending.forEach(rows=>rows.forEach(fn=>fn(null)));modelPending.clear();Array.from(live).forEach(job=>job.finish(null));}
 function status(card,book,done){const number=Number((card.seasons || []).find(s=>s.season_number>0)?.season_number),rows=book && (book.episodes_original || book.episodes);if(!rows || !number)return done(null);groups(card,Array.from({length:rows.length},(_,i)=>i+1),values=>{if(!values)return done(null);const today=new Date().toISOString().slice(0,10),available=values.map(g=>({group:g,aired:Object.values(g.book).filter(e=>e.air_date && day(e.air_date)<=today)})).filter(v=>v.aired.length);if(!available.length)return done(null);const last=available[available.length-1];done({season:last.group.number,count:last.aired.length,total:last.group.count});},{[number]:book});}
 function providerBook(card,number,numbers,files,done,layout=null){
  if(!isAnime(card) || !files.length || files.length>3000 || !files.map(Number).sort((a,b)=>a-b).every((n,i)=>n===i+1))return done(null);
  const labels=[...new Set(numbers.map(Number))].filter(n=>n>0).sort((a,b)=>a-b);if(!layout && labels.length!==1 && !labels.every((n,i)=>n===i+1) || labels.length>60)return done(null);
  canonical(card,value=>{if(!value)return done(null);collection({...value,source:'tmdb',media_type:'tv',minimal_anime:true},model=>{
   if(!model || !model.complete)return done(null);const today=new Date().toISOString().slice(0,10),story=model.rows.find(r=>r.key==='story'),ids=new Set(story && story.results.map(r=>r.id)),eligible=n=>n.record && Number(n.record.tv)===Number(value.id) && ['tv','ona'].includes(n.kind) && n.episodes>0 && n.status!=='anons' && n.aired && n.aired<=today;
   const main=model.nodes.filter(n=>ids.has(n.id) && eligible(n)).sort((a,b)=>a.aired.localeCompare(b.aired)),all=model.nodes.filter(eligible).filter(n=>ids.has(n.id) || model.edges.some(e=>e.relation==='alternative_version' && (e.from===n.id || e.to===n.id))).sort((a,b)=>a.aired.localeCompare(b.aired));
   const specified=layout && layout[number] && model.nodes.find(n=>Number(n.id)===Number(layout[number].mal) && eligible(n));
   const schemes=[main,all].filter((rows,i,a)=>rows.length===labels.length && !a.slice(0,i).some(old=>old.map(n=>n.id).join()===rows.map(n=>n.id).join()));if(!specified && schemes.length!==1)return done(null);const release=specified || schemes[0][labels.length===1?0:Number(number)-1];if(!release || files.length>release.episodes || release.episodes!==files.length && release.status!=='ongoing')return done(null);
   const seasons=(value.seasons || []).filter(s=>s.season_number>0),books={};if(!seasons.length || seasons.length>100)return done(null);
   function loadSeasons(numbers,next){const unread=numbers.filter(n=>!Object.prototype.hasOwnProperty.call(books,n));let left=unread.length;if(!left)return next();unread.forEach(n=>load('tv/'+value.id+'/season/'+n,response=>{books[n]=response;if(!--left)next();}));}
   function finish(map){const book={};map.forEach(e=>book[e.number]={...e.metadata,lampa_grouped:true,lampa_season_name:seasonName({seasons:[{season_number:number,name:release.name}]},number,{...card,lampa_series_names:[main[0]?.name,main[0]?.original]})});done(Object.keys(book).length===files.length?book:null);}
   const mapped=animeEpisodeMap(release.record,files.length,value);
   loadSeasons(mapped?[...new Set(mapped.map(e=>e.season))]:[],()=>{
    const map=mapped && animeEpisodeMap(release.record,files.length,value,books);
    if(map && map.every(e=>e.metadata && inRelease(e.metadata,release)))return finish(map);
    if(files.length!==release.episodes)return done(null);
    const sorted=seasons.slice().sort((a,b)=>a.season_number-b.season_number),from=time(release.aired),until=time(release.released);
    const fallback=sorted.filter((s,i)=>{const start=time(s.air_date),next=time(sorted[i+1]?.air_date);return !(Number.isFinite(start) && Number.isFinite(until) && start>until+86400000 || Number.isFinite(next) && next<from-86400000);});
    if(!fallback.length || fallback.length>12)return done(null);
    loadSeasons(fallback.map(s=>s.season_number),()=>{const rows=fallback.flatMap(s=>books[s.season_number] && (books[s.season_number].episodes_original || books[s.season_number].episodes) || []).filter(e=>inRelease(e,release));if(rows.length!==release.episodes)return done(null);finish(rows.map((metadata,i)=>({number:i+1,metadata})));});
   });
  });});
 }
 function partsBook(card,parts,done){canonical(card,value=>{if(!value || !parts?.length)return done(null);const numbers=[...new Set(parts.map(p=>p.season).concat(parts.some(p=>['special','tv_special'].includes(p.kind))?[0]:[]))],books={};let left=numbers.length;numbers.forEach(number=>load('tv/'+value.id+'/season/'+number,book=>{books[number]=book;if(!--left)done(joinedPartsBook(parts,books));}));});}
 const api={info:animeIndexInfo,records:animeRecords,target:animeTarget,resolveTarget,canonical,collection,groups,providerBook,partsBook,seasonBook:(card,number,done)=>load('tv/'+(card.tmdb_id || card.id)+'/season/'+number,done),status,clear};
 if(L.Api){L.Api.sources=L.Api.sources || {};L.Api.sources.minimal_anime_collection={clear,list(params,ok,fail=()=>{}){let query;try{query=JSON.parse(params.url);}catch(error){return fail();}if(!positive(query.seed) || !['story','alternatives','related','announced'].includes(query.row))return fail();collection({source:'minimal_shiki',id:Number(query.seed)},model=>{if(!model)return fail();const row=franchiseCatalogueRows(model).find(r=>r.key===query.row),results=row && row.results || [],page=Math.max(1,Number(params.page)||1);ok({results:results.slice((page-1)*20,page*20),page,total_pages:Math.max(1,Math.ceil(results.length/20))});});},full(params,ok,fail){const source=L.Api.sources.minimal_shiki;if(source && source.full)return source.full(params,ok,fail);if(fail)fail();}};}
 function mount(event){const link=event && event.link,card=event && event.data && event.data.movie;if(!link || !card || !isAnime(card) || link._minimalAnimePending || link._minimalAnimeMounted || !Array.isArray(link.rows) || !Array.isArray(link.items))return;
  link._minimalAnimePending=true;let disposed=false;if(link.use)link.use({onDestroy(){disposed=true;}});
  collection(card,model=>{link._minimalAnimePending=false;if(disposed || !model || !model.rows.some(r=>r.results.some(c=>Number(c.id)!==Number(card.shikimori_id || card.mal_id))))return;
   const current=L.Activity && L.Activity.active && L.Activity.active();if(!current || !current.activity || current.activity.component!==link)return;
   const header=link.items[0],render=header && header.render(true),root=render && (render.nodeType?render:render[0]),right=root && root.querySelector('.full-start-new__right');if(!right)return;
   link._minimalAnimeMounted=true;
   const wrap=document.createElement('div');wrap.className='minimal-anime-franchise';
   const control=document.createElement('button');control.type='button';control.className='minimal-anime-franchise__button selector';control.textContent=t('Порядок просмотра');control.setAttribute('aria-haspopup','listbox');wrap.appendChild(control);right.appendChild(wrap);
   const arrow=document.createElement('span');arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');control.appendChild(arrow);
   const remember=()=>{header.last=control;},back=()=>{L.Select.hide();if(control.isConnected){remember();L.Controller.toggle('full_start');}};
   const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   function open(){
    if(disposed || !control.isConnected)return;remember();
    const groups=franchiseMenuGroups(model),items=[];
    groups.forEach(group=>{items.push({title:escape(group.title),separator:true});group.entries.forEach(entry=>items.push({title:escape(entry.title),subtitle:escape(entry.subtitle),card:entry.card,selected:Number(entry.card.id)===Number(card.shikimori_id || card.mal_id || model.seed)}));});
    L.Select.show({title:t('Порядок просмотра'),items,onFullDraw(scroll){scroll.body().find('.settings-param-title').addClass('minimal-season-section');scroll.body().find('.selectbox-item').addClass('minimal-anime-franchise__item');},onSelect(entry){
     L.Select.hide();const selected=entry.card;if(!selected)return back();
     if(Number(selected.id)===Number(card.shikimori_id || card.mal_id))return back();
     L.Activity.push({component:'full',source:selected.source,id:selected.id,method:selected.media_type,card:selected});
    },onBack:back});
   }
   control.addEventListener('hover:focus',remember);control.addEventListener('hover:enter',open);
   control.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
   control.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});

  });
 }
 if(L.Listener && L.Listener.follow){L.Listener.follow('full',event=>{if(event.type==='complite')mount(event);if(event.type==='build' && event.data && event.data.minimal_anime_collection && event.item && event.item.use){const row=event.data;event.item.use({onlyMore:()=>L.Activity.push({component:'category_full',source:row.source,url:row.url,title:row.title,page:1})});}});L.Listener.follow('activity',event=>{if(event.type!=='start')return;const current=L.Activity && L.Activity.active && L.Activity.active(),link=current && current.component==='full' && current.activity && current.activity.component;if(link && link.props && link.props.all)mount({link,data:link.props.all()});});}
 return api;
}
