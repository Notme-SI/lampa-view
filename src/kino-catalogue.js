import {text as t,locale} from './i18n.js';
export function kinoPlan(kind,date=new Date()){
 const year=date.getFullYear(),make=(key,title,countries,genres=[],extra={})=>({key,title:t(title),spec:{kind,countries,genres,sort:'popularity',...extra}});
 if(kind==='dorama')return [
  make('korea','Корейские дорамы',['Южная Корея','Корея Южная']),make('japan','Японские дорамы',['Япония']),make('china','Китайские дорамы',['Китай']),make('taiwan','Тайвань',['Тайвань']),make('thai','Тайские дорамы',['Таиланд']),
  make('new','Новые корейские дорамы',['Южная Корея','Корея Южная'],[],{year}),make('rated','Корейские дорамы с высоким рейтингом',['Южная Корея','Корея Южная'],[],{sort:'kinopoisk',minRating:8})
 ];
 if(kind==='tvshow')return [make('reality','Российские реалити',['Россия'],['Реалити-шоу','реальное ТВ']),make('talk','Российские ток-шоу',['Россия'],['Ток-шоу']),
  make('new-reality','Новые реалити',['Россия'],['Реалити-шоу','реальное ТВ'],{year}),make('new-talk','Новые ток-шоу',['Россия'],['Ток-шоу'],{year}),
  make('rated-reality','Реалити с высоким рейтингом',['Россия'],['Реалити-шоу','реальное ТВ'],{sort:'kinopoisk',minRating:7}),make('rated-talk','Ток-шоу с высоким рейтингом',['Россия'],['Ток-шоу'],{sort:'kinopoisk',minRating:7})];
 return [];
}
export function cataloguePaths(spec,page){
 if(!spec || !['dorama','tvshow'].includes(spec.kind) || !Array.isArray(spec.countries) || !spec.countries.length)return [];
 const queries=[];for(const country of spec.countries.slice(0,2))for(const genre of (spec.genres?.length?spec.genres:['']).slice(0,2)){
  const p=new URLSearchParams({type:'tv',country,sort:['popularity','kinopoisk','year'].includes(spec.sort)?spec.sort:'popularity',order:'desc',page:String(Math.max(1,Number(page)||1)),limit:'24'});
  if(genre)p.set('genre',genre);if(spec.year)p.set('year',String(spec.year));if(spec.minRating)p.set('minRating',String(spec.minRating));queries.push('titles?'+p);
 }return queries;
}
export function catalogueCard(value,spec,language='ru'){
 const id=Number(value?.id?.tmdb),genres=(value?.genres || []).map(v=>String(v).toLowerCase()),countries=value?.countries || [];
 if(value?.type!=='tv' || !Number.isSafeInteger(id) || id<=0 || !spec.countries.some(country=>countries.includes(country)))return null;
 if(value.anime || genres.some(g=>/мульт|аниме|animation/.test(g)))return null;
 if(spec.kind==='dorama' && genres.some(g=>/документ|реал|ток-шоу|talk|reality/.test(g)))return null;
 if(spec.kind==='tvshow' && !genres.some(g=>spec.genres.some(w=>g===w.toLowerCase())))return null;
 const name=String(value.title?.[language] || value.title?.ru || value.title?.en || value.title?.original || '');if(!name)return null;
 const image=value.images || {},date=value.release?.date || (value.release?.year?value.release.year+'-01-01':'');
 return {id,tmdb_id:id,media_type:'tv',source:'tmdb',name,title:name,original_name:value.title?.original || name,first_air_date:date,overview:value.description?.[language] || '',poster_path:image.poster || image.posters?.[0] || image.kinopoisk?.poster || '',backdrop_path:image.backdrop || image.backdrops?.[0] || image.cover || '',vote_average:Number(value.ratings?.tmdb?.value)||0,imdb_id:value.id.imdb || '',kinopoisk_id:value.id.kinopoisk || null,minimal_kinoapi:true};
}
export default function kinoCatalogue(L,kino){
 const source={clear(){},full:(p,ok,fail)=>L.Api.sources.tmdb.full({...p,source:'tmdb',method:'tv'},ok,fail),list(params,ok,fail=()=>{}){
  let spec;try{spec=JSON.parse(params.url);}catch(error){return fail();}const page=Math.max(1,Number(params.page)||1),paths=cataloguePaths(spec,page);if(!paths.length)return fail();
  const replies=new Array(paths.length);let left=paths.length;paths.forEach((path,index)=>kino.catalogueRequest(path,value=>{replies[index]=value;if(--left)return;
   // Do not cache or silently truncate one half of a merged feed after an error.
   if(replies.some(row=>!Array.isArray(row?.data)))return fail();
   const seen=new Set(),results=[];for(let i=0;i<24;i++)for(const row of replies){const card=catalogueCard(row.data[i],spec,locale());if(card && !seen.has(card.id)){seen.add(card.id);results.push(card);}}
   ok({results,page,total_pages:replies.some(row=>row.meta?.hasNext)?page+1:page});
  }));
 }};
 L.Api.sources.minimal_kino=source;
 function load(kind,hidden,ok,fail){const plan=kinoPlan(kind),rows=new Array(plan.length);let cursor=0,active=0,done=0,ended=false;
  function pump(){if(ended)return;if(done===plan.length){ended=true;const visible=rows.filter(Boolean);return visible.length?ok(visible):fail();}
   while(!ended && active<2 && cursor<plan.length){const index=cursor++,job=plan[index],url=JSON.stringify(job.spec),id='minimal:kino:'+kind+':'+job.key,row={title:job.title,source:'minimal_kino',url,minimal_row_id:id,results:[]};
    if(hidden.includes(id) || hidden.includes(url)){rows[index]={...row,minimal_hidden:true};done++;continue;}
    active++;source.list({url,page:1},json=>{rows[index]={...row,...json,results:json.results.slice(0,20)};active--;done++;pump();},()=>{active--;done++;pump();});
   }if(done===plan.length)pump();
  }pump();
 }
 return {...source,load};
}
