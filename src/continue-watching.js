import watchHistory from './watch-history.js';
export const CONTINUE='minimal:continue';
export const isContinue=row=>row.url===CONTINUE || row.name==='continue_watch' || /^(?:Продолжить просмотр|История просмотра)$/i.test(String(row.title || '').trim());
export const isWatching=row=>/now_playing/.test(row.url || row.id || '') || /^Сейчас смотрят$/i.test(String(row.title || '').trim());
export default function continueWatching(L){
 const history=watchHistory(L);
 const cards=()=>history.cards();
 if(L.Api.sources)L.Api.sources.minimal_continue={
  list(params,ok){const all=cards(),page=Math.max(1,Number(params.page)||1);ok({results:all.slice((page-1)*20,page*20),page,total_pages:Math.max(1,Math.ceil(all.length/20))});},
  full(params,ok,fail){const card=params.card || {},source=card.source && card.source!=='minimal_continue'?card.source:L.Storage.get('source','cub'),api=L.Api.sources[source];if(api && api.full)api.full({...params,source,card:{...card,source}},ok,fail);else fail({empty:true});},clear(){}
 };
 const build=rows=>{
  const result=rows.filter(row=>!isContinue(row)).slice(0,6).map(row=>({...row,results:(row.results || []).slice(0,20)}));
  const index=result.findIndex(isWatching),history=cards();
  result.splice(index<0?0:index+1,0,{title:'История просмотра',url:CONTINUE,source:'minimal_continue',results:history.slice(0,20),minimal_configurable:true,minimal_empty:!history.length});
  return result;
 };
 build.cards=cards;return build;
}
