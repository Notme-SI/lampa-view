import tmdbGet from './tmdb.js';
export function chooseLogo(images,language){
 const choices=(images || []).filter(image=>image && /^\/[^\s]+\.(png|webp|svg)$/i.test(image.file_path || ''));
 const priority=lang=>lang===language?0:lang==='en'?1:!lang?2:3;
 choices.sort((a,b)=>priority(a.iso_639_1)-priority(b.iso_639_1) || Number(/\.svg$/i.test(b.file_path))-Number(/\.svg$/i.test(a.file_path)) || (b.width || 0)-(a.width || 0) || (b.vote_count || 0)-(a.vote_count || 0));
 return choices[0] || null;
}
export function pickLogo(images,language){const logo=chooseLogo(images,language);return logo && logo.file_path || '';}
const normal=s=>String(s || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]/g,'');
export function pickStudio(data,kind){
 const candidates=[...(kind==='tv'?(data.networks || []).map(company=>({...company,kind:'network'})):[]),...(data.production_companies || []).map(company=>({...company,kind:'company'}))];
 const studio=candidates.find(company=>company && /^\/[^\s]+\.(png|webp|svg)$/i.test(company.logo_path || ''));
 return studio?{path:studio.logo_path,name:studio.name || '',id:studio.id,kind:studio.kind}:null;
}
export function matchCatalogue(card,results){
 const date=String(card.first_air_date || card.release_date || ''),year=date.slice(0,4),names=[card.title,card.original_title,card.name,card.original_name].map(normal).filter(Boolean),all=results || [];
 const images=all.filter(c=>(card.poster_path && c.poster_path===card.poster_path)||(card.backdrop_path && c.backdrop_path===card.backdrop_path));
 if(images.length)return images.length===1?images[0].id:null;
 const titled=all.filter(c=>[c.title,c.original_title,c.name,c.original_name].some(n=>names.includes(normal(n))));
 const dated=/^\d{4}-\d{2}-\d{2}$/.test(date)?titled.filter(c=>(c.first_air_date || c.release_date)===date):[];
 if(dated.length)return dated.length===1?dated[0].id:null;
 const matched=titled.filter(c=>!year || String(c.first_air_date || c.release_date || '').slice(0,4)===year);
 return matched.length===1?matched[0].id:null;
}
export default function logoLoader(L){
 const cache=new Map(),queue=[];let running=0;
 function drain(){while(running<2 && queue.length){running++;queue.shift()(()=>{running--;drain();});}}
 return function load(card,callback){
  const kind=card.media_type || (card.name?'tv':'movie'),source=card.source || 'tmdb';
  const id=source==='tmdb'?card.id:card.tmdb_id;
  if(!L.TMDB || (!id && source!=='cub'))return callback('',null,null);
  const language=String(L.Storage.get('language','ru') || 'ru').slice(0,2),key=source+':'+kind+':'+(id || card.id)+':'+language;
  if(cache.has(key)){const value=cache.get(key);if(value.callbacks)value.callbacks.push(callback);else callback(value.path,value.studio,value.language);return;}
  const pending={callbacks:[callback]};cache.set(key,pending);
  queue.push(done=>{
   function finish(json){const selected=chooseLogo(json && (json.images && json.images.logos || json.logos),language),path=selected && selected.file_path || '',studio=json?pickStudio(json,kind):null,logoLanguage=selected && selected.iso_639_1 || null;cache.set(key,{path,studio,language:logoLanguage});pending.callbacks.forEach(fn=>fn(path,studio,logoLanguage));if(cache.size>64)for(const [old,value] of cache){if(!value.callbacks){cache.delete(old);break;}}done();}
   function images(tmdbId){if(!tmdbId || !/^\d+$/.test(String(tmdbId)))return finish(null);tmdbGet(L,kind+'/'+tmdbId+'?append_to_response=images&include_image_language='+encodeURIComponent(language+',en,null'),{langs:language},finish,()=>finish(null),{life:60*24});}
   if(id)return images(id);
   const query=card.original_title || card.original_name || card.title || card.name;
   if(!query)return finish(null);
   tmdbGet(L,'search/'+kind+'?query='+encodeURIComponent(query),{langs:language},json=>images(matchCatalogue(card,json.results)),()=>finish(null));
  });drain();
 };
}
