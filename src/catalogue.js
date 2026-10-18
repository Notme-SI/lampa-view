import tmdbGet from './tmdb.js';
import {SHIKI_ALL} from './shikimori.js';
export function animeMode(L,object={}){
 const mode=object.minimal_anime_catalogue || (L.Storage.value?L.Storage.value('minimal_anime_catalogue','standard'):L.Storage.get('minimal_anime_catalogue','standard'));
 return mode==='shikimori'?'shikimori':'standard';
}
export function cataloguePlan(kind,mode='standard',date=new Date()){
 const year=date.getFullYear(),type=kind==='movie'?'movie':'tv',base=kind==='anime'?'with_genres=16&with_original_language=ja&':'',defs=[];
 if(kind==='anime' && mode==='shikimori')return [
  ['Популярное','order=popularity'],['С высоким рейтингом','order=ranked'],['Сейчас выходит','order=popularity&status=ongoing'],['Ожидаемые','order=popularity&status=anons'],
  ['Новинки этого года','order=popularity&season='+year],['Прошлый год','order=ranked&season='+(year-1)],['Полнометражные','order=ranked&kind=movie'],['Боевики','order=popularity&genre=1'],['Приключения','order=popularity&genre=2'],['Детективы','order=popularity&genre=7'],['Все',SHIKI_ALL]
 ].map(([title,shiki])=>({title,shiki}));
 function add(key,title,cub,query){defs.push({key,title,cub,tmdb:'discover/'+type+'?include_adult=false&'+(kind==='anime' && /with_genres=/.test(query || '')?'with_original_language=ja&':base)+(query || 'sort_by=popularity.desc')});}
 const airdate=kind==='anime'?'&airdate='+year:'';
 add('watch','Сейчас смотрят','?cat='+kind+'&sort=now_playing'+airdate);
 if(kind==='anime')add('top','В топе','?cat=anime&sort=top','sort_by=vote_average.desc&vote_count.gte=500');
 if(kind!=='anime')add('uhd','В высоком качестве','?cat='+kind+'&sort=latest&uhd=true','sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100');
 if(kind!=='movie')add('ongoing','Сейчас выходит','?cat='+kind+'&sort=airing'+airdate,'sort_by=popularity.desc&air_date.gte='+year+'-01-01');
 add('popular','Популярное','?cat='+kind+'&sort=top'+airdate,'sort_by=popularity.desc&vote_count.gte=100'+(kind==='anime'?'&first_air_date.gte='+year+'-01-01':''));
 const field=type==='movie'?'primary_release_date':'first_air_date';
 add('year','Новинки этого года','?cat='+kind+'&sort=now&airdate='+year,'sort_by=popularity.desc&'+field+'.gte='+year+'-01-01&'+field+'.lte='+year+'-12-31');
 add('last-year','Прошлый год','?cat='+kind+'&sort=top&airdate='+(year-1),'sort_by=popularity.desc&'+field+'.gte='+(year-1)+'-01-01&'+field+'.lte='+(year-1)+'-12-31');
 if(kind==='anime'){
  add('rewatch','Стоит пересмотреть','?cat=anime&sort=top&airdate='+(year-7)+'-'+(year-2)+'&vote=6-8','sort_by=popularity.desc&vote_average.gte=6&vote_average.lte=8&vote_count.gte=100&first_air_date.lte='+(year-2)+'-12-31');
  add('rated','С высоким рейтингом','?cat=anime&sort=top&airdate='+(year-7)+'-'+(year-2)+'&vote=8-10','sort_by=vote_average.desc&vote_average.gte=8&vote_count.gte=200&first_air_date.lte='+(year-2)+'-12-31');
 }
 const genres=kind==='movie'?[[28,'Боевики'],[35,'Комедии'],[18,'Драмы'],[53,'Триллеры'],[878,'Фантастика']]:kind==='anime'?[[10765,'Фэнтези'],[10759,'Приключения']]:[[18,'Драмы'],[80,'Криминал'],[10765,'Фантастика и фэнтези'],[35,'Комедии']];
 genres.forEach(([id,title])=>add('genre-'+id,title,'?cat='+kind+'&sort=top&genre='+id,'sort_by=popularity.desc&with_genres='+id+(kind==='anime'?',16':'')));
 return defs.slice(0,10);
}
export default function catalogue(L,shiki,object,hidden,ok){
 const kind=object.url || object.cat;
 const source=object.source || L.Storage.get('source','cub'),cub=source==='cub' && L.Api.sources && L.Api.sources.cub && L.Api.sources.cub.list,plan=cataloguePlan(kind,animeMode(L,object)),rows=new Array(plan.length);let cursor=0,running=0,done=0,ended=false,failures=0;
 const status=object.minimal_catalogue_status={state:'loading'};
 const rowFor=job=>({title:job.title,url:job.shiki || (cub?job.cub:job.tmdb),source:job.shiki?'minimal_shiki':cub?'cub':'tmdb',results:[]});
 function complete(){if(done===plan.length && !ended){ended=true;const result=rows.filter(Boolean);status.state=result.some(row=>row.results.length)?'ready':failures?'error':result.length===plan.length?'hidden':'empty';ok(result);}}
 function pump(){
  if(ended)return;if(object.activity && object.activity.component && object.activity.component.destroyed){ended=true;return;}if(done===plan.length){complete();return;}
  while(!ended && running<3 && cursor<plan.length){const index=cursor++,job=plan[index],row=rowFor(job);if(hidden.includes(row.url)){row.minimal_hidden=true;rows[index]=row;done++;continue;}
   running++;let settled=false;
   function finish(json){if(settled)return;settled=true;running--;done++;if(!json)failures++;if(json && Array.isArray(json.results) && json.results.length)rows[index]={...row,page:Number(json.page)||1,total_pages:Math.max(Number(json.total_pages)||1,json.results.length>20?2:1),results:json.results.slice(0,20).map(card=>kind==='anime'?{...card,minimal_anime:true}:card)};pump();}
   if(job.shiki)shiki.list({url:job.shiki,page:1},finish,()=>finish(null));
   else if(cub)cub.call(L.Api.sources.cub,{...object,url:job.cub,page:1},finish,()=>finish(null));
   else tmdbGet(L,job.tmdb,{page:1},finish,()=>finish(null));
  }
  complete();
 }
 pump();
}
