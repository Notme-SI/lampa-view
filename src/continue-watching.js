import {text as lampaViewText} from './i18n.js';
import {isAnime} from './metadata.js';
import watchHistory from './watch-history.js';
export const CONTINUE='minimal:continue';
export const ANIME_HISTORY='minimal:anime-history';
const PAGE_SIZE=20;
const historyTitle=url=>lampaViewText(url===ANIME_HISTORY?'История аниме':'История просмотра');
export const isContinue=row=>row.url===CONTINUE || row.name==='continue_watch' || /^(?:Продолжить просмотр|История просмотра)$/i.test(String(row.title || '').trim());
export const isWatching=row=>/now_playing/.test(row.url || row.id || '') || /^Сейчас смотрят$/i.test(String(row.title || '').trim());
export default function continueWatching(L){
 const history=watchHistory(L);
 const include=url=>url===ANIME_HISTORY?isAnime:card=>!isAnime(card);
 function localPage(url,page){
  const all=history.cards().filter(include(url));
  return {results:all.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),page,total_pages:Math.max(1,Math.ceil(all.length/PAGE_SIZE))};
 }
 function load(url,page,ok,fail){
  if(!history.filteredPage(page,PAGE_SIZE,include(url),ok,fail))ok(localPage(url,page));
 }
 if(L.Api.sources)L.Api.sources.minimal_continue={
  list(params,ok,fail){
   const page=Math.max(1,Number(params.page)||1);
   const deliver=json=>{
    const active=L.Activity && L.Activity.active && L.Activity.active(),grid=active && active.activity && active.activity.component;
    if(grid && grid.object===params)grid.total_pages=json.total_pages;
    ok(json);
   };
   load(params.url,page,deliver,fail || (()=>deliver(localPage(params.url,page))));
  },
  full(params,ok,fail){const card=params.card || {},source=card.source && card.source!=='minimal_continue'?card.source:L.Storage.get('source','cub'),api=L.Api.sources[source];if(api && api.full)api.full({...params,source,card:{...card,source}},ok,fail);else fail({empty:true});},clear(){}
 };
 const historyRow=(url,data=localPage(url,1))=>({...data,title:historyTitle(url),url,source:'minimal_continue',minimal_configurable:true,minimal_empty:!data.results.length});
 const build=(rows,preview)=>{
  const result=rows.filter(row=>!isContinue(row)).slice(0,6).map(row=>({...row,results:(row.results || []).slice(0,20)}));
  const index=result.findIndex(isWatching);
  result.splice(index<0?0:index+1,0,preview || historyRow(CONTINUE));
  return result;
 };
 build.preview=(url,ok)=>load(url,1,data=>ok(historyRow(url,data)),()=>ok(historyRow(url)));
 build.profile=history.profile;
 return build;
}
