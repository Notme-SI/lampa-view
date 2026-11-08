import {isAnime} from './metadata.js';
import {locale} from './i18n.js';
import {publishedSeasonCount,publishedEpisodeCount} from './episode-metadata.js';
import {franchiseViewingOrder} from './anime-franchise.js';
import {hasGallerySource,loadDetailGallery} from './gallery-frames.js';

// Explicitly missing artwork is not a useful catalogue preview. Unknown image
// metadata may still be supplied by a provider, so do not discard it here.
export function presentableCards(cards,russian=false){
 return cards.filter(card=>{
  if(Object.prototype.hasOwnProperty.call(card,'poster_path') && !card.poster_path && !card.img)return false;
  return !russian || /[а-яё]/i.test(String(card.title || card.name || ''));
 });
}
// The same scoped exclusion must survive More and subsequent native pages.
export function catalogueResults(path,json){
 const query=String(path || '').split('?')[1] || '';
 if(!json || !Array.isArray(json.results))return json;
 const scope=new URLSearchParams(query),kind=scope.get('minimal_kind'),regional=/^discover\/tv\?/.test(path) && (scope.has('with_origin_country') || scope.get('with_original_language')==='ru' && /10764|10767/.test(scope.get('with_genres') || ''));
 const visible=presentableCards(json.results,locale()==='ru' && (regional || kind==='dorama' || kind==='tvshow'));
 if(visible.length!==json.results.length)json={...json,results:visible};
 if(kind==='tvshow' || kind==='dorama'){
  const countries=(scope.get('minimal_countries') || 'KR,JP,CN,TW,TH').split(','),language=scope.get('minimal_language');
  return {...json,results:json.results.filter(card=>{
   const genres=[...(card.genre_ids || []),...(card.genres || [])].map(g=>Number(g.id || g)),lang=String(card.original_language || '').toLowerCase(),origin=card.origin_country || [];
   if(genres.includes(16))return false;
   if(kind==='tvshow')return (lang==='ru' || !lang && origin.includes('RU')) && genres.some(g=>[10764,10767,10751,35].includes(g));
   return !genres.some(g=>[99,10764,10767].includes(g)) && (origin.some(c=>countries.includes(c)) || !origin.length && (language?lang===language:countries.some(c=>({KR:'ko',JP:'ja',CN:'zh',TW:'zh',TH:'th'})[c]===lang)));
  })};
 }
 const liveAction=(/^discover\/(movie|tv)\?/.test(path) || /^\?/.test(path) && /(^|&)cat=(movie|tv)(&|$)/.test(query)) && (scope.get('without_genres') || '').split(',').includes('16');
 if(liveAction)return {...json,results:json.results.filter(card=>!isAnime(card) && ![...(card.genre_ids || []),...(card.genres || [])].some(g=>Number(g.id || g)===16))};
 const cartoons=/^discover\/(movie|tv)\?/.test(path) && /(^|&)with_genres=16(&|$)/.test(query) && /(^|&)without_keywords=210024(&|$)/.test(query)
  || /^\?/.test(path) && /(^|&)sort=now_playing(&|$)/.test(query) && /(^|&)genre=16(&|$)/.test(query);
 if(!cartoons)return json;
 return {...json,results:json.results.filter(card=>!isAnime({...card,genre_ids:card.genre_ids || [16]}))};
}
// Native Lampa appends these fields itself. Duplicated language values are
// rejected by TMDB even though the otherwise identical direct URL succeeds.
export function normalizeTmdb(path,params={}){
 const split=String(path || '').split('?'),base=split.shift(),pairs=split.join('?').split('&').filter(Boolean),copy={...params},keep=[];
 pairs.forEach(pair=>{
  const [raw,...rest]=pair.split('='),key=decodeURIComponent(raw),value=rest.join('=');
  if(key==='api_key')return;
  if(key==='language'){if(!copy.langs)copy.langs=decodeURIComponent(value) || locale();return;}
  if(key==='page' && copy.page)return;
  keep.push(pair);
 });
 if(!copy.langs)copy.langs=locale();
 return {path:base+(keep.length?'?'+keep.join('&'):''),params:copy};
}
export function installTmdb(L){
 const cub=L.Api && L.Api.sources && L.Api.sources.cub;
 if(cub && cub.list && !cub._minimalCatalogueFiltered){const list=cub.list;cub._minimalCatalogueFiltered=true;cub.list=function(params,ok,fail){return list.call(this,params,json=>ok(catalogueResults(params.url,json)),fail);};}
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;if(!source || source._minimalNormalized)return;
 source._minimalNormalized=true;
 if(source.get){const get=source.get;source.get=function(path,params,ok,fail,options){const clean=normalizeTmdb(path,params);return get.call(this,clean.path,clean.params,json=>ok(catalogueResults(clean.path,json)),fail,options);};}
 if(source.list){const list=source.list;source.list=function(params,ok,fail){const clean=normalizeTmdb(params.url,params),q=new URLSearchParams(clean.path.split('?')[1] || '');
  if(/^discover\/(tv|movie)\?/.test(clean.path) && q.get('with_original_language')==='ja' && (q.get('first_air_date.gte') || q.get('primary_release_date.gte') || '')>new Date().toISOString().slice(0,10))return tmdbGet(L,clean.path,clean.params,ok,fail,{unreleased:true});
  return list.call(this,{...clean.params,url:clean.path},json=>ok(catalogueResults(clean.path,json)),fail);};}
 // Aggregate credits supplement missing directors, never replace the main cast
 // with every guest performer across all seasons.
 ['tmdb','cub'].forEach(name=>{
  const catalogue=L.Api.sources[name];if(!catalogue || !catalogue.full)return;
  const full=catalogue.full;
  catalogue.full=function(params,ok,fail){
   if(params.method!=='tv' || (L.Storage && [false,'false',0,'0'].includes(L.Storage.get('lampa_view_enabled',true))))return full.apply(this,arguments);
   let credits,answer,ready=false,failed=false;
   const finish=()=>{if(ready && answer && !failed){const data=answer;answer=null;if(credits && data.persons)data.persons=normalizeCredits(credits,data.persons,params.id) || data.persons;ok(data);}};
   const request=full.call(this,params,data=>{answer=data;finish();},error=>{failed=true;if(fail)fail(error);});
   source.get('tv/'+params.id+'/aggregate_credits',{},json=>{credits=json;ready=true;finish();},()=>{ready=true;finish();},{life:86400000*7});
   return request;
  };
 });
}
export function normalizeCredits(json,original={},id){
 if(!json || json.id!=null && id!=null && String(json.id)!==String(id))return null;
 const aggregate=new Map((json.cast || []).map(person=>[String(person.id),person]));
 const primary=Array.isArray(original.cast) && original.cast.length?original.cast:(json.cast || []).slice().sort((a,b)=>(b.total_episode_count || 0)-(a.total_episode_count || 0));
 const cast=primary.map(person=>{const detail=aggregate.get(String(person.id)) || {};return {...person,total_episode_count:Math.max(Number(person.total_episode_count)||0,Number(detail.total_episode_count)||0),character:person.character || Array.from(new Set((detail.roles || person.roles || []).map(role=>role.character).filter(Boolean))).join(' / ')};});
 const directors=(json.crew || []).reduce((all,person)=>all.concat((person.jobs || [person]).filter(job=>job.job==='Director').map(job=>({...person,job:'Director',episode_count:job.episode_count || person.total_episode_count || 0}))),[]);
 return {...original,cast,crew:[...(original.crew || []),...directors]};
}
// Keep page boundaries stable while excluding repeated identities in a list.
export function installListGuard(L){
 if(!L.Api || !L.Api.list || L.Api._minimalListGuard)return;
 L.Api._minimalListGuard=true;const list=L.Api.list,pages=new Map();
 L.Api.list=function(params,ok,fail){
  const key=locale()+'|'+(params.source || '')+'|'+(params.url || ''),page=Math.max(1,Number(params.page)||1);
  let entry=pages.get(key);if(!entry || page===1){entry=new Map();pages.set(key,entry);while(pages.size>32)pages.delete(pages.keys().next().value);}
  return list.call(this,params,json=>{
   if(!json || !Array.isArray(json.results))return ok(json);
   const seen=new Set();for(const [p,ids] of entry)if(p<page)ids.forEach(id=>seen.add(id));const ids=[];
   const results=json.results.filter(card=>{if(card.id==null)return true;const type=card.media_type || (card.name || card.first_air_date?'tv':'movie'),id=type+':'+card.id;if(seen.has(id))return false;seen.add(id);ids.push(id);return true;});
   entry.set(page,ids);ok({...json,results});
  },fail);
 };
}
export function installFullGuard(L){
 if(!L.Api || !L.Api.full || L.Api._minimalFullGuard)return;
 L.Api._minimalFullGuard=true;const full=L.Api.full;
 L.Api.full=function(params,ok,fail){
  const error=status=>{if(fail)fail(status && typeof status==='object'?status:{empty:true});};
  return full.call(this,params,data=>{
   if(!data || !data.movie)return error();
   const frames=hasGallerySource(L,data) && loadDetailGallery(L,data,(path,done,failed)=>tmdbGet(L,path,{},done,failed,{life:21600000}));
   // Remember catalogue eligibility before native Full classifies keywords.
   // Native `adult` can later mean a mainstream title contains nudity.
   const publish=()=>frames?frames.then(rows=>ok({...data,minimal_gallery_eligible:true,minimal_gallery_frames:rows}),()=>ok(data)):ok(data);
   const anime=typeof window!=='undefined' && window.LampaView && window.LampaView.animeBase;
   if(!anime || !isAnime(data.movie) || !anime.collection || !anime.canonical)return publish();
   let complete=false,resolved=data.movie;
   const finish=count=>{
    if(complete)return;complete=true;clearTimeout(timer);
    data.movie={...data.movie,minimal_detail_ready:true,minimal_detail_seasons:count || publishedSeasonCount(resolved),minimal_detail_episodes:publishedEpisodeCount(resolved)};
    publish();
   };
   const timer=setTimeout(()=>finish(0),18000);
   anime.canonical(data.movie,card=>{
    if(complete || !card)return finish(0);
    resolved=card;anime.collection(card,model=>{
     if(complete)return;
     const story=model && model.complete && model.rows.find(row=>row.key==='story');
     const ids=new Set(story && story.results.map(row=>row.id));
     const date=new Date().toISOString().slice(0,10);
     const releases=model && model.nodes.filter(node=>ids.has(node.id) && node.record && Number(node.record.tv)===Number(card.id) && ['tv','ona'].includes(node.kind) && node.status!=='anons' && node.aired && node.aired<=date);
     const aired=new Set((releases || []).map(n=>Number(n.record.season)));
     const announced=model && model.nodes.filter(n=>n.record && Number(n.record.tv)===Number(card.id) && ['tv','ona'].includes(n.kind) && (n.status==='anons' || n.aired && n.aired>date)).map(n=>Number(n.record.season)).filter(n=>n>0 && !aired.has(n)) || [];
     resolved={...card,minimal_unreleased_seasons:announced};
     const guide=model && model.complete?franchiseViewingOrder(model).filter(row=>['tv','ona'].includes(row.kind) && row.season):[];
     const seasonCount=new Set(guide.filter(row=>Number(model.nodes.find(n=>n.id===row.id)?.record?.tv)===Number(card.id)).map(row=>row.season)).size;
     finish(Math.max(seasonCount,publishedSeasonCount(resolved)));
    });
   });
  },error);
 };
}
export default function tmdbGet(L,path,params,ok,fail=()=>{},options){
 const callback=ok;ok=json=>callback(catalogueResults(path,json));
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;
 // Host "released only" filters discard announced titles even for Discover.
 // Fetch this explicit feed through the same configured TMDB proxy/transport.
 const announced=options && options.unreleased && L.Reguest && L.TMDB && L.TMDB.api && L.TMDB.key;
 if(!announced && source && typeof source.get==='function'){const clean=normalizeTmdb(path,params);return source.get(clean.path,clean.params,ok,fail,options);}
 if(!announced && L.TMDB && typeof L.TMDB.get==='function')return L.TMDB.get(path,params || {},ok,fail,options);
 if(!L.Reguest || !L.TMDB || !L.TMDB.api || !L.TMDB.key)return fail();
 const request=new L.Reguest();request.timeout(10000);
 let url=path+(/[?&]api_key=/.test(path)?'':(path.includes('?')?'&':'?')+'api_key='+encodeURIComponent(L.TMDB.key()));
 if(announced){
  const clean=normalizeTmdb(path,params),query=new URLSearchParams(clean.path.split('?')[1] || '');
  if(clean.params && clean.params.page)query.set('page',clean.params.page);
  if(!query.has('language'))query.set('language',L.Storage && L.Storage.get?L.Storage.get('tmdb_lang',L.Storage.get('language','ru')):'ru');
  query.set('api_key',L.TMDB.key());url=clean.path.split('?')[0]+'?'+query;
 }
 request.silent(L.TMDB.api(url),data=>data && data.success===false?fail(data):ok(data),fail);
 return request;
}
