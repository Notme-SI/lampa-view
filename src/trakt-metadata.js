import tmdbGet from './tmdb.js';

// Localize verified Trakt→TMDB identities without replacing Trakt membership
// or rank. Shared localized lists cover common titles before individual reads.
export default function traktMetadata(L){
 const store='minimal_trakt_metadata_v1',cache=new Map(),pending=new Map(),warm=new Map(),queue=[],deadlines=new Set();
 let running=0,generation=0,saveTimer,unavailableUntil=0;
 const language=()=>String(L.Storage.get('tmdb_lang',L.Storage.get('language','ru')) || 'ru').slice(0,5);
 const key=(lang,kind,id)=>lang+':'+kind+':'+id;
 const fresh=entry=>entry && Date.now()-entry.at<86400000;
 const available=()=>!!(L.Api.sources.tmdb && L.Api.sources.tmdb.get || L.TMDB && L.TMDB.get);
 const saved=L.Storage.get(store,[]);
 if(Array.isArray(saved))saved.slice(-160).forEach(pair=>{if(Array.isArray(pair) && fresh(pair[1]))cache.set(pair[0],pair[1]);});
 function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>L.Storage.set(store,Array.from(cache.entries()).slice(-160)),250);}
 function fields(json,kind,id){
  if(!json || Number(json.id)!==Number(id) || !(json.title || json.name))return null;
  const value={};
  for(const name of ['title','name','original_title','original_name','overview','poster_path','backdrop_path','release_date','first_air_date','original_language','vote_average','vote_count','genre_ids','genres','production_companies','networks'])if(json[name]!=null)value[name]=json[name];
  value.title=json.title || json.name;
  if(kind==='tv'){value.name=json.name || json.title;value.original_title=json.original_name || json.original_title || value.title;}
  if(!value.genre_ids && value.genres)value.genre_ids=value.genres.map(g=>g.id);
  return value;
 }
 function remember(lang,kind,json){
  const value=fields(json,kind,json && json.id);if(!value)return;
  cache.set(key(lang,kind,json.id),{at:Date.now(),value});if(cache.size>160)cache.delete(cache.keys().next().value);save();
 }
 function pump(){
  while(running<2 && queue.length){const task=queue.shift();if(task.generation!==generation)continue;
   running++;let settled=false,timer;
   const finish=json=>{if(settled)return;settled=true;clearTimeout(timer);running--;if(task.generation===generation)task.done(json);pump();};
   timer=setTimeout(()=>finish(null),5000);
   try{tmdbGet(L,task.path,{langs:task.lang},finish,()=>finish(null),{life:60*24});}catch(error){finish(null);}
  }
 }
 function request(path,lang,done){queue.push({path,lang,done,generation});pump();}
 function prime(lang,done){
  const old=warm.get(lang);if(old){if(old.waiting)old.waiting.push(done);else done();return;}
  const entry={waiting:[done]};warm.set(lang,entry);let remaining=3,answers=0;
  [['trending/all/day',''],['movie/popular','movie'],['tv/popular','tv']].forEach(([path,type])=>request(path,lang,json=>{
   if(json && Array.isArray(json.results))answers++;
   for(const row of json && json.results || []){const kind=type || row.media_type;if((kind==='movie' || kind==='tv') && row.poster_path && row.backdrop_path)remember(lang,kind,row);}
   if(!--remaining){if(!answers)unavailableUntil=Date.now()+60000;const callbacks=entry.waiting;delete entry.waiting;callbacks.forEach(fn=>fn());}
  }));
 }
 function localize(card,lang,done){
  const kind=card.media_type,id=card.id,k=key(lang,kind,id),old=cache.get(k);
  if(fresh(old))return done({...card,...old.value});
  if(Date.now()<unavailableUntil)return done(card);
  if(pending.has(k)){pending.get(k).push(done);return;}
  pending.set(k,[done]);
  request(kind+'/'+id,lang,json=>{
   const value=fields(json,kind,id);if(value)remember(lang,kind,json);
   const callbacks=pending.get(k) || [];pending.delete(k);callbacks.forEach(fn=>fn(value?{...card,...value}:card));
  });
 }
 function enrich(cards,done){
  if(!cards.length || !available())return done(cards);
  const lang=language(),own=generation;
  if(cards.every(card=>fresh(cache.get(key(lang,card.media_type,card.id)))))return done(cards.map(card=>({...card,...cache.get(key(lang,card.media_type,card.id)).value})));
  const output=cards.slice();let finished=false,left=cards.length,timer;
  const publish=()=>{if(finished || own!==generation)return;finished=true;clearTimeout(timer);deadlines.delete(timer);done(output.slice());};
  // Slow artwork/localization must not hold the catalogue behind every detail request.
  timer=setTimeout(publish,2500);deadlines.add(timer);
  prime(lang,()=>{
   if(own!==generation)return;
   cards.forEach((card,index)=>localize(card,lang,value=>{if(own!==generation)return;output[index]=value;if(!--left)publish();}));
  });
 }
 function clear(){generation++;queue.length=0;pending.clear();warm.clear();deadlines.forEach(clearTimeout);deadlines.clear();}
 return {enrich,clear};
}
