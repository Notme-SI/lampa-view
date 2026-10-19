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
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;if(!source || source._minimalNormalized)return;
 source._minimalNormalized=true;
 if(source.get){const get=source.get;source.get=function(path,params,ok,fail,options){const clean=normalizeTmdb(path,params);return get.call(this,clean.path,clean.params,ok,fail,options);};}
 if(source.list){const list=source.list;source.list=function(params,ok,fail){const clean=normalizeTmdb(params.url,params);return list.call(this,{...clean.params,url:clean.path},ok,fail);};}
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
 const cast=Array.isArray(original.cast) && original.cast.length?original.cast:(json.cast || []).slice().sort((a,b)=>(b.total_episode_count || 0)-(a.total_episode_count || 0)).map(person=>({...person,character:person.character || Array.from(new Set((person.roles || []).map(role=>role.character).filter(Boolean))).join(' / ')}));
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
 const source=L.Api && L.Api.sources && L.Api.sources.tmdb;
 if(source && typeof source.get==='function'){const clean=normalizeTmdb(path,params);return source.get(clean.path,clean.params,ok,fail,options);}
 if(L.TMDB && typeof L.TMDB.get==='function')return L.TMDB.get(path,params || {},ok,fail,options);
 if(!L.Reguest || !L.TMDB || !L.TMDB.api || !L.TMDB.key)return fail();
 const request=new L.Reguest();request.timeout(10000);
 const url=path+(/[?&]api_key=/.test(path)?'':(path.includes('?')?'&':'?')+'api_key='+encodeURIComponent(L.TMDB.key()));
 request.silent(L.TMDB.api(url),data=>data && data.success===false?fail(data):ok(data),fail);
 return request;
}
