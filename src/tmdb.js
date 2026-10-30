import {isAnime} from './metadata.js';

// The same scoped exclusion must survive More and subsequent native pages.
export function catalogueResults(path,json){
 const query=String(path || '').split('?')[1] || '';
 if(!json || !Array.isArray(json.results))return json;
 const scope=new URLSearchParams(query),kind=scope.get('minimal_kind');
 if(kind==='tvshow' || kind==='dorama'){
  const countries=(scope.get('minimal_countries') || 'KR,JP,CN,TW,TH').split(','),language=scope.get('minimal_language');
  return {...json,results:json.results.filter(card=>{
   const genres=[...(card.genre_ids || []),...(card.genres || [])].map(g=>Number(g.id || g)),lang=String(card.original_language || '').toLowerCase(),origin=card.origin_country || [];
   if(genres.includes(16))return false;
   if(kind==='tvshow')return (lang==='ru' || !lang && origin.includes('RU')) && genres.some(g=>[10764,10767,10751,35].includes(g));
   return !genres.some(g=>[99,10764,10767].includes(g)) && (origin.some(c=>countries.includes(c)) || !origin.length && (language?lang===language:countries.some(c=>({KR:'ko',JP:'ja',CN:'zh',TW:'zh',TH:'th'})[c]===lang)));
  })};
 }
 const liveAction=(/^discover\/(movie|tv)\?/.test(path) || /^\?/.test(path) && /(^|&)cat=(movie|tv)(&|$)/.test(query)) && /(^|&)without_genres=16(&|$)/.test(query);
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
  if(key==='language'){if(!copy.langs)copy.langs=decodeURIComponent(value);return;}
  if(key==='page' && copy.page)return;
  keep.push(pair);
 });
 return {path:base+(keep.length?'?'+keep.join('&'):''),params:copy};
}
export function installTmdb(L){
 const cub=L.Api && L.Api.sources && L.Api.sources.cub;
 if(cub && cub.list && !cub._minimalCatalogueFiltered){const list=cub.list;cub._minimalCatalogueFiltered=true;cub.list=function(params,ok,fail){return list.call(this,params,json=>ok(catalogueResults(params.url,json)),fail);};}
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;if(!source || source._minimalNormalized)return;
 source._minimalNormalized=true;
 if(source.get){const get=source.get;source.get=function(path,params,ok,fail,options){const clean=normalizeTmdb(path,params);return get.call(this,clean.path,clean.params,json=>ok(catalogueResults(clean.path,json)),fail,options);};}
 if(source.list){const list=source.list;source.list=function(params,ok,fail){const clean=normalizeTmdb(params.url,params);return list.call(this,{...clean.params,url:clean.path},json=>ok(catalogueResults(clean.path,json)),fail);};}
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
export function installFullGuard(L){
 if(!L.Api || !L.Api.full || L.Api._minimalFullGuard)return;
 L.Api._minimalFullGuard=true;const full=L.Api.full;
 L.Api.full=function(params,ok,fail){
  const error=status=>{if(fail)fail(status && typeof status==='object'?status:{empty:true});};
  return full.call(this,params,data=>data && data.movie?ok(data):error(),error);
 };
}
export default function tmdbGet(L,path,params,ok,fail=()=>{},options){
 const callback=ok;ok=json=>callback(catalogueResults(path,json));
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;
 if(source && typeof source.get==='function'){const clean=normalizeTmdb(path,params);return source.get(clean.path,clean.params,ok,fail,options);}
 if(L.TMDB && typeof L.TMDB.get==='function')return L.TMDB.get(path,params || {},ok,fail,options);
 if(!L.Reguest || !L.TMDB || !L.TMDB.api || !L.TMDB.key)return fail();
 const request=new L.Reguest();request.timeout(10000);
 const url=path+(/[?&]api_key=/.test(path)?'':(path.includes('?')?'&':'?')+'api_key='+encodeURIComponent(L.TMDB.key()));
 request.silent(L.TMDB.api(url),data=>data && data.success===false?fail(data):ok(data),fail);
 return request;
}
