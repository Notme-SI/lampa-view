import {animeSeasonTitle} from './anime-release.js';
// Shikimori's main TV seasons are separate anime records. Resolve only an
// unambiguous Prequel chain; movies/OVA/specials and cycles prove no number.
export default function shikiSeason(related){
 const cache=new Map(),pending=new Map();
 function resolve(card,ok,seen=new Set()){
  const id=String(card.id),explicit=animeSeasonTitle(card.name);
  if(explicit)return ok(explicit);
  if(!['tv','tv_13','tv_24','ona'].includes(card.kind) || seen.has(id) || seen.size>=6)return ok(0);
  const hit=cache.get(id);if(hit && Date.now()-hit.at<900000)return ok(hit.number);
  if(seen.size===0 && pending.has(id)){pending.get(id).push(ok);return;}
  const root=seen.size===0;if(root)pending.set(id,[ok]);
  const finish=number=>{if(number){cache.set(id,{number,at:Date.now()});if(cache.size>80)cache.delete(cache.keys().next().value);}if(root){const listeners=pending.get(id) || [];pending.delete(id);listeners.forEach(fn=>fn(number));}else ok(number);};
  related(id,rows=>{
   if(!Array.isArray(rows))return finish(0);
   const prequels=rows.filter(row=>row.relation==='Prequel' && row.anime);
   if(!prequels.length)return finish(1);
   if(prequels.length!==1 || !['tv','tv_13','tv_24','ona'].includes(prequels[0].anime.kind))return finish(0);
   const previous=prequels[0].anime,part=/\bpart\s*\d+|часть\s*\d+/i.test(card.name || ''),next=new Set(seen);next.add(id);
   resolve(previous,number=>finish(number?number+(part?0:1):0),next);
  },()=>finish(0));
 }
 return resolve;
}
