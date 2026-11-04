import {text as lampaViewText} from './i18n.js';
import tmdbGet,{catalogueResults} from './tmdb.js';
import {SHIKI_ALL} from './shikimori.js';
import {DISCOVERY_KINDS,discoveryPlan,discoveryState} from './discovery-model.js';
import {DISCOVERY_SOURCE} from './discovery-source.js';
export function animeMode(L,object={}){
 const mode=object.minimal_anime_catalogue || (L.Storage.value?L.Storage.value('minimal_anime_catalogue','standard'):L.Storage.get('minimal_anime_catalogue','standard'));
 return mode==='shikimori'?'shikimori':'standard';
}
function legacyCataloguePlan(kind,mode='standard',date=new Date()){
 const year=date.getFullYear(),type=kind==='movie'?'movie':'tv',base=kind==='anime'?'with_genres=16&with_original_language=ja&':'',defs=[];
 const day=offset=>{const value=new Date(date);value.setDate(value.getDate()+offset);return value.getFullYear()+'-'+('0'+(value.getMonth()+1)).slice(-2)+'-'+('0'+value.getDate()).slice(-2);};
 if(kind==='dorama'){
  const asian='with_origin_country=KR|JP|CN|TW|TH&without_genres=16,99,10764,10767&';
  return [{key:'watch',title:lampaViewText("Сейчас смотрят"),media_type:'tv',tmdb:'discover/tv?include_adult=false&'+asian+'sort_by=popularity.desc&air_date.gte='+day(-7)+'&air_date.lte='+day(0)},...[
   [lampaViewText("Популярное"),asian+'sort_by=popularity.desc'],
   [lampaViewText("Новинки этого года"),asian+'sort_by=popularity.desc&first_air_date.gte='+year+'-01-01'],
   [lampaViewText("С высоким рейтингом"),asian+'sort_by=vote_average.desc&vote_count.gte=100'],
   [lampaViewText("Корейские дорамы"),'with_origin_country=KR&without_genres=16,99,10764,10767&sort_by=popularity.desc'],
   [lampaViewText("Японские дорамы"),'with_origin_country=JP&without_genres=16,99,10764,10767&sort_by=popularity.desc'],
   [lampaViewText("Китайские дорамы"),'with_origin_country=CN|TW&without_genres=16,99,10764,10767&sort_by=popularity.desc'],
   [lampaViewText("Тайские дорамы"),'with_origin_country=TH&without_genres=16,99,10764,10767&sort_by=popularity.desc'],
   [lampaViewText("Драмы"),asian+'with_genres=18&sort_by=popularity.desc'],
   [lampaViewText("Комедии"),asian+'with_genres=35&sort_by=popularity.desc'],
   [lampaViewText("Детективы"),asian+'with_genres=9648&sort_by=popularity.desc']
  ].map(([title,query],index)=>({key:'dorama-'+index,title,media_type:'tv',tmdb:'discover/tv?include_adult=false&'+query}))];
 }
 if(kind==='tvshow'){
  const shows='without_genres=16&with_genres=10764|10767&with_original_language=ru&';
  return [
   ['watch',lampaViewText("Сейчас смотрят"),shows+'sort_by=popularity.desc&air_date.gte='+day(-7)+'&air_date.lte='+day(0)],
   ['popular',lampaViewText("Популярное"),shows+'sort_by=popularity.desc'],
   ['year',lampaViewText("Новинки этого года"),shows+'sort_by=popularity.desc&first_air_date.gte='+year+'-01-01&first_air_date.lte='+day(0)],
   ['rated',lampaViewText("С высоким рейтингом"),shows+'sort_by=vote_average.desc&vote_count.gte=100'],
   ['reality',lampaViewText("Российские реалити"),'without_genres=16&with_genres=10764&with_original_language=ru&sort_by=popularity.desc'],
   ['talk',lampaViewText("Российские ток-шоу"),'without_genres=16&with_genres=10767&with_original_language=ru&sort_by=popularity.desc'],
   ['russian',lampaViewText("Семейные и развлекательные"),'without_genres=16&with_genres=10764|10767|10751|35&with_original_language=ru&sort_by=popularity.desc'],
   ['last-year',lampaViewText("Прошлый год"),shows+'sort_by=vote_average.desc&vote_count.gte=30&first_air_date.gte='+(year-1)+'-01-01&first_air_date.lte='+(year-1)+'-12-31']
  ].map(([key,title,query])=>({key,title,media_type:'tv',tmdb:'discover/tv?include_adult=false&'+query}));
 }
 if(kind==='cartoon')return [{key:'watch',title:lampaViewText("Сейчас смотрят"),cub:'?sort=now_playing&genre=16'},...[
  [lampaViewText("Популярные мультфильмы"),'movie','sort_by=popularity.desc'],
  [lampaViewText("Новые мультфильмы"),'movie','sort_by=popularity.desc&primary_release_date.gte='+year+'-01-01'],
  [lampaViewText("Мультфильмы с высоким рейтингом"),'movie','sort_by=vote_average.desc&vote_count.gte=200'],
  [lampaViewText("Популярные мультсериалы"),'tv','sort_by=popularity.desc'],
  [lampaViewText("Мультсериалы с высоким рейтингом"),'tv','sort_by=vote_average.desc&vote_count.gte=100'],
  [lampaViewText("Мультсериалы этого года"),'tv','sort_by=popularity.desc&first_air_date.gte='+year+'-01-01']
 ].map(([title,media_type,query])=>({title,media_type,tmdb:'discover/'+media_type+'?include_adult=false&with_genres=16&without_keywords=210024&'+query}))];
 if(kind==='anime' && mode==='shikimori')return [
  [lampaViewText("Популярное"),'order=popularity'],[lampaViewText("С высоким рейтингом"),'order=ranked'],[lampaViewText("Сейчас выходит"),'order=popularity&status=ongoing'],[lampaViewText("Ожидаемые"),'order=popularity&status=anons'],
  [lampaViewText("Новинки этого года"),'order=popularity&season='+year],[lampaViewText("Прошлый год"),'order=ranked&season='+(year-1)],[lampaViewText("Полнометражные"),'order=ranked&kind=movie'],[lampaViewText("Боевики"),'order=popularity&genre=1'],[lampaViewText("Приключения"),'order=popularity&genre=2'],[lampaViewText("Детективы"),'order=popularity&genre=7'],[lampaViewText("Все"),SHIKI_ALL]
 ].map(([title,shiki])=>({title,shiki}));
 function add(key,title,cub,query){
  const prefix='discover/'+type+'?include_adult=false&'+(kind==='tv' || kind==='movie'?'without_genres=16&':'')+(kind==='anime' && /with_genres=/.test(query || '')?'with_original_language=ja&':base);
  const previous=prefix+(query || 'sort_by=popularity.desc');
  let tmdbTitle=title;
  // TMDB has no release-quality catalogue. Rating, release dates and current
  // airings are separate feeds, rather than differently named popularity rows.
  if(kind==='movie' || kind==='tv'){
   if(key==='watch')query='sort_by=popularity.desc&'+(type==='movie'?'primary_release_date':'air_date')+'.gte='+day(type==='movie'?-60:-7)+'&'+(type==='movie'?'primary_release_date':'air_date')+'.lte='+day(0);
   if(key==='uhd'){tmdbTitle=lampaViewText("С высоким рейтингом");query='sort_by=vote_average.desc&vote_count.gte=1000';}
   if(key==='ongoing')query='sort_by=popularity.desc&air_date.gte='+day(0)+'&air_date.lte='+day(7);
   if(key==='popular')query='sort_by=popularity.desc';
   if(key==='year')query='sort_by='+(type==='movie'?'primary_release_date':'first_air_date')+'.desc&vote_count.gte=20&'+(type==='movie'?'primary_release_date':'first_air_date')+'.gte='+year+'-01-01&'+(type==='movie'?'primary_release_date':'first_air_date')+'.lte='+day(0);
   if(key==='last-year')query=query.replace('sort_by=popularity.desc','sort_by=vote_average.desc&vote_count.gte=100');
  }
  const tmdb=prefix+(query || 'sort_by=popularity.desc');
  defs.push({key,title,tmdb_title:tmdbTitle,cub:cub+(kind==='tv' || kind==='movie'?'&without_genres=16':''),tmdb,...(tmdb!==previous?{minimal_row_aliases:[previous]}:{})});
 }
 const airdate=kind==='anime'?'&airdate='+year:'';
 add('watch',lampaViewText("Сейчас смотрят"),'?cat='+kind+'&sort=now_playing'+airdate);
 if(kind==='anime')add('top',lampaViewText("В топе"),'?cat=anime&sort=top','sort_by=vote_average.desc&vote_count.gte=500');
 if(kind!=='anime')add('uhd',lampaViewText("В высоком качестве"),'?cat='+kind+'&sort=latest&uhd=true','sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100');
 if(kind!=='movie')add('ongoing',lampaViewText("Сейчас выходит"),'?cat='+kind+'&sort=airing'+airdate,'sort_by=popularity.desc&air_date.gte='+year+'-01-01');
 add('popular',lampaViewText("Популярное"),'?cat='+kind+'&sort=top'+airdate,'sort_by=popularity.desc&vote_count.gte=100'+(kind==='anime'?'&first_air_date.gte='+year+'-01-01':''));
 const field=type==='movie'?'primary_release_date':'first_air_date';
 add('year',lampaViewText("Новинки этого года"),'?cat='+kind+'&sort=now&airdate='+year,'sort_by=popularity.desc&'+field+'.gte='+year+'-01-01&'+field+'.lte='+year+'-12-31');
 add('last-year',lampaViewText("Прошлый год"),'?cat='+kind+'&sort=top&airdate='+(year-1),'sort_by=popularity.desc&'+field+'.gte='+(year-1)+'-01-01&'+field+'.lte='+(year-1)+'-12-31');
 if(kind==='anime'){
  add('rewatch',lampaViewText("Стоит пересмотреть"),'?cat=anime&sort=top&airdate='+(year-7)+'-'+(year-2)+'&vote=6-8','sort_by=popularity.desc&vote_average.gte=6&vote_average.lte=8&vote_count.gte=100&first_air_date.lte='+(year-2)+'-12-31');
  add('rated',lampaViewText("С высоким рейтингом"),'?cat=anime&sort=top&airdate='+(year-7)+'-'+(year-2)+'&vote=8-10','sort_by=vote_average.desc&vote_average.gte=8&vote_count.gte=200&first_air_date.lte='+(year-2)+'-12-31');
 }
 const genres=kind==='movie'?[[28,lampaViewText("Боевики")],[35,lampaViewText("Комедии")],[18,lampaViewText("Драмы")],[53,lampaViewText("Триллеры")],[878,lampaViewText("Фантастика")]]:kind==='anime'?[[10765,lampaViewText("Фэнтези")],[10759,lampaViewText("Приключения")]]:[[18,lampaViewText("Драмы")],[80,lampaViewText("Криминал")],[10765,lampaViewText("Фантастика и фэнтези")],[35,lampaViewText("Комедии")]];
 genres.forEach(([id,title])=>add('genre-'+id,title,'?cat='+kind+'&sort=top&genre='+id,'sort_by=popularity.desc&with_genres='+id+(kind==='anime'?',16':'')));
 return defs.slice(0,10);
}
export function cataloguePlan(kind,mode='standard',date=new Date(),selection={}){
 if(!DISCOVERY_KINDS.includes(kind))return legacyCataloguePlan(kind,mode,date);
 const state=discoveryState(kind,selection,date),plan=discoveryPlan(kind,state,date);
 const base=state.section==='overview' && !state.country && !state.genre && !state.network && !state.company && !state.period && !state.sort && !state.hero && state.format==='all';
 if(!base)return plan;
 const legacy=legacyCataloguePlan(kind,mode,date),keys={new:['year',...(kind==='dorama'?['dorama-1']:[])],rated:['uhd','rated',...(kind==='dorama'?['dorama-2']:[])],popular:['popular',...(kind==='dorama'?['dorama-0']:[])],watch:['watch','ongoing'],'russian-reality':['reality'],'russian-talk':['talk'],'country-KR':['dorama-3'],'country-JP':['dorama-4'],'country-CN':['dorama-5'],'country-TH':['dorama-6']};
 const kino={'country-KR':'korea','country-JP':'japan','country-CN':'china','country-TW':'taiwan','country-TH':'thai','russian-reality':'reality','russian-talk':'talk'};
 return plan.map(row=>{const matches=legacy.filter(old=>(keys[row.key] || [row.key]).includes(old.key));return {...row,minimal_row_aliases:matches.flatMap(old=>['minimal:tmdb:'+kind+':'+old.key,old.tmdb,old.cub,...(old.minimal_row_aliases || [])]).filter(Boolean).concat(kino[row.key]?['minimal:kino:'+kind+':'+kino[row.key]]:[])};});
}
function cubScoped(job,kind){
 const p=new URLSearchParams(job.tmdb.split('?')[1]),q=new URLSearchParams({cat:'tv',sort:job.key==='watch'?'now_playing':job.key==='year'?'now':'top',minimal_kind:kind});
 if(p.get('with_genres'))q.set('genre',p.get('with_genres').replace(/\|/g,','));
 if(p.get('with_origin_country'))q.set('minimal_countries',p.get('with_origin_country').replace(/\|/g,','));
 if(p.get('with_original_language'))q.set('minimal_language',p.get('with_original_language'));
 const year=(p.get('first_air_date.gte') || '').slice(0,4);if(year)q.set('airdate',year);
 return {...job,cub:'?'+q.toString()};
}
export default function catalogue(L,shiki,object,hidden,ok){
 const kind=object.url || object.cat;
 const selection=DISCOVERY_KINDS.includes(kind)?discoveryState(kind,object.minimal_discovery || (L.Storage.get('minimal_discovery',{}) || {})[kind]):{};
 if(DISCOVERY_KINDS.includes(kind))object.minimal_discovery=selection;
 const source=object.source || L.Storage.get('source','cub'),cub=L.Api.sources && L.Api.sources.cub && L.Api.sources.cub.list,plan=cataloguePlan(kind,animeMode(L,object),new Date(),selection).map(job=>!job.discovery && ['dorama','tvshow'].includes(kind)?cubScoped(job,kind):job),rows=new Array(plan.length);let cursor=0,running=0,done=0,ended=false,failures=0;
 const status=object.minimal_catalogue_status={state:'loading'};
 // CUB does not implement the country/language filters needed by these two
 // sections. Use real TMDB Discover feeds, not a filtered global CUB top-20.
 const scoped=['dorama','tvshow'].includes(kind);
 const useCub=job=>!!(!job.discovery && !scoped && cub && job.cub && (source==='cub' || kind==='cartoon'));
 const rowFor=job=>({title:useCub(job)?job.title:job.tmdb_title || job.title,url:job.discovery?JSON.stringify(job.discovery):job.shiki || (useCub(job)?job.cub:job.tmdb || job.cub),source:job.discovery?DISCOVERY_SOURCE:job.shiki?'minimal_shiki':useCub(job) || !job.tmdb?'cub':'tmdb',...(!useCub(job) && job.tmdb && job.key?{minimal_row_id:job.minimal_row_id || 'minimal:tmdb:'+kind+':'+job.key,minimal_row_aliases:[job.tmdb,...(scoped && job.cub?[job.cub]:[]),...(job.minimal_row_aliases || [])]}:{}),results:[]});
 function complete(){if(done===plan.length && !ended){ended=true;const result=uniquePreviews(rows.filter(Boolean));status.state=result.some(row=>row.results.length)?'ready':failures?'error':result.length===plan.length?'hidden':'empty';ok(result);}}
 function pump(){
  if(ended)return;if(object.activity && object.activity.component && object.activity.component.destroyed){ended=true;return;}if(done===plan.length){complete();return;}
  while(!ended && running<3 && cursor<plan.length){const index=cursor++,job=plan[index],row=rowFor(job);if([row.minimal_row_id,row.url,...(row.minimal_row_aliases || [])].some(url=>hidden.includes(url))){row.minimal_hidden=true;rows[index]=row;done++;continue;}
   running++;let settled=false;
   function finish(json){if(settled)return;settled=true;running--;done++;if(!json)failures++;json=catalogueResults(row.url,json);if(json && Array.isArray(json.results) && json.results.length)rows[index]={...row,page:Number(json.page)||1,total_pages:Math.max(Number(json.total_pages)||1,json.results.length>20?2:1),results:json.results.slice(0,20).map(card=>kind==='anime'?{...card,minimal_anime:true}:job.media_type?{...card,source:job.discovery?card.source || 'tmdb':row.source,media_type:card.media_type || job.media_type}:card)};pump();}
   if(job.discovery && L.Api.sources[DISCOVERY_SOURCE])L.Api.sources[DISCOVERY_SOURCE].list({url:row.url,page:1},finish,()=>finish(null));
   else if(job.discovery)finish(null);
   else if(job.shiki)shiki.list({url:job.shiki,page:1},finish,()=>finish(null));
   else if(useCub(job))cub.call(L.Api.sources.cub,{...object,url:job.cub,page:1},finish,()=>finish(null));
   else if(job.tmdb)tmdbGet(L,job.tmdb,{page:1},finish,()=>finish(null));
   else finish(null);
  }
  complete();
 }
 pump();
}

// A title may qualify for several feeds. Keep it in the first preview only;
// More still opens the full, unmodified feed with native pagination and rank.
// Use the plan order, not response arrival order, without extra API requests.
export function uniquePreviews(rows){
 const seen=new Set();
 return rows.map(row=>{
  if(row.minimal_hidden)return row;
  const results=row.results.filter(card=>{
   const type=card.media_type || (/^(?:discover\/)?movie(?:\/|\?)/.test(row.url)?'movie':/^(?:discover\/)?tv(?:\/|\?)/.test(row.url)?'tv':card.name?'tv':'movie');
   const id=Number(card.id);if(!Number.isSafeInteger(id) || id<=0)return true;
   const key=type+':'+id,duplicate=seen.has(key);seen.add(key);
   const scoped=/^discover\/tv\?/.test(row.url) && /with_origin_country=|with_original_language=ru/.test(row.url);
   return row.source!=='tmdb' || scoped || !duplicate;
  });
  return {...row,results};
 }).filter(row=>row.minimal_hidden || row.results.length);
}
