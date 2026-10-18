import tmdbGet from './tmdb.js';
export function seriesName(name){return String(name || '').replace(/\s+(?:(?:\d+(?:st|nd|rd|th)?\s+season|season\s+\d+)(?:\s+part\s+\d+)?|\d+(?:\.\s*часть\s*\d+)?)\s*$/i,'').trim();}
const normal=name=>String(name || '').toLowerCase().replace(/[^a-zа-яё0-9\u3040-\u30ff\u3400-\u9fff]/g,'');
export default function shikimoriMatch(L,details){
 const cache=new Map();
 return function full(params,ok,fail){
  const card=params.card || params,kind=card.media_type || (card.name?'tv':'movie'),id=String(card.shikimori_id || card.id),key=kind+':'+id;
  const original=card.original_title || card.original_name,local=card.title || card.name,seen=new Set(),queue=[],names=[];let expanded=false,networkError=false,searches=0,failures=0;
  const alive=()=>!(params.activity && params.activity.component && params.activity.component.destroyed);
  function add(name,base=false){name=String(name || '').trim();const n=normal(name);if(name && n && !seen.has(n)){seen.add(n);queue.push({name,base});names.push(name);}}
  function back(){L.Select.hide();fail({empty:true});L.Activity.backward();}
  function open(match){if(!alive())return;cache.set(key,match);if(cache.size>200)cache.delete(cache.keys().next().value);L.Api.sources.tmdb.full({...params,id:match.id,method:kind,source:'tmdb',card:{...match,source:'tmdb',media_type:kind}},ok,error=>{cache.delete(key);fail(error);});}
  function manual(){L.Select.hide();L.Input.edit({title:'Название аниме для поиска',value:local || original || '',free:true,nosave:true},value=>{if(!String(value || '').trim())return missing();seen.clear();queue.length=0;searches=0;failures=0;networkError=false;add(value);expanded=true;next();});}
  function missing(){if(!alive())return;L.Select.show({title:networkError?'Не удалось выполнить поиск TMDB':'Карточка аниме не найдена в TMDB',items:[{id:'search',title:'Поиск по другому названию',subtitle:'Попробуйте название всего сериала без номера сезона.'},{id:'back',title:'Вернуться к аниме'}],onSelect:item=>item.id==='search'?manual():back(),onBack:back});}
  function choose(results,base){
   if(!alive())return;
   const year=String(card.first_air_date || card.release_date || '').slice(0,4),exact=results.filter(c=>year && String(c.first_air_date || c.release_date || '').slice(0,4)===year);
   const bases=kind==='tv'?names.filter(name=>seriesName(name)!==name).map(name=>normal(seriesName(name))):[],group=base || results.some(c=>[c.title,c.name,c.original_title,c.original_name].some(name=>name && bases.includes(normal(name))));
   if(!group && (exact.length===1 || results.length===1))return open(exact[0] || results[0]);
   L.Select.show({title:group?'Откройте общую карточку сериала':'Выберите карточку аниме',items:results.slice(0,12).map(c=>({title:(c.title || c.name)+' · '+String(c.first_air_date || c.release_date || '').slice(0,4),subtitle:group?'Продолжение может быть частью общего сезона. Проверьте список серий.':'',card:c})).concat([{id:'search',title:'Поиск по другому названию'},{id:'back',title:'Вернуться к аниме'}]),onSelect:item=>{if(item.id==='search')return manual();if(item.id==='back')return back();L.Select.hide();open(item.card);},onBack:back});
  }
  function expand(meta){
   if(!alive())return;
   for(const field of ['english','japanese','synonyms']){const values=meta && meta[field];(Array.isArray(values)?values:[values]).filter(Boolean).slice(0,2).forEach(name=>add(name));}
   if(kind==='tv')names.slice().forEach(name=>{const base=seriesName(name);if(base!==name)add(base,true);});
   next();
  }
  function next(){
   if(!alive())return;if(searches>=8 || failures>=2)return missing();const query=queue.shift();
   if(!query){if(expanded)return missing();expanded=true;return details(id,expand,()=>expand({}));}
   searches++;tmdbGet(L,'search/'+kind+'?language=ru&query='+encodeURIComponent(query.name),{},json=>{const results=(json && json.results || []).filter(c=>c.id && (!c.genre_ids || c.genre_ids.includes(16)));if(results.length)choose(results,query.base);else next();},()=>{networkError=true;failures++;next();});
  }
  if(cache.has(key))return open(cache.get(key));add(original);add(local);next();
 };
}
