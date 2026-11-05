import {text as lampaViewText} from './i18n.js';
import {presentableCards} from './tmdb.js';
import catalogue,{animeMode,cataloguePlan,catalogueRow} from './catalogue.js';
import {traktPlan} from './trakt.js';
import animeTabs from './anime-tabs.js';
import continueWatching,{CONTINUE,isWatching} from './continue-watching.js';
import discoverySource from './discovery-source.js';
import {DISCOVERY_KINDS,discoveryState,discoverySelected} from './discovery-model.js';
export function rowKey(row){return String(row.minimal_row_id || row.url || row.title || lampaViewText("Без названия"));}
export function removedHomeRow(row){
 if([row.minimal_row_id,row.id,row.url].includes('minimal:annual:current_anime') || row.name==='mpv_plus_current_anime')return true;
 const route=String(row.url || row.id || ''),query=new URLSearchParams(route.split('?')[1] || '');
 // Only the general CUB latest row, never UHD releases or category feeds.
 return /^\?/.test(route) && query.get('sort')==='latest' && !query.has('cat') && !query.has('uhd')
  || /^(?:Последнее добавление|Последние добавления|Last addition|Latest additions)$/i.test(String(row.title || '').trim());
}
const isMyShowsUnwatched=row=>row.url==='myshows://unwatched' || row.line_type==='myshows_unwatched';
export function homeOrder(rows){
 const rank=row=>isMyShowsUnwatched(row)?-1:isWatching(row)?0:row.url===CONTINUE?1:({'minimal:annual:new_movies':2,'minimal:annual:popular_series':3,'minimal:annual:popular_movies':4}[rowKey(row)] ?? 6);
 return rows.filter(row=>!removedHomeRow(row)).map((row,i)=>({row,i})).sort((a,b)=>rank(a.row)-rank(b.row) || a.i-b.i).map(entry=>entry.row);
}
function annualKey(id){
 const match=String(id).match(/^discover\/(movie|tv)\?(.+)$/);if(!match)return '';
 const q=new URLSearchParams(match[2]),field=match[1]==='movie'?'primary_release_date':'first_air_date';
 if(!q.has(field+'.gte') || !q.has(field+'.lte'))return '';
 const key=match[1]==='tv' && q.get('sort_by')==='popularity.desc' && q.get('vote_count.gte')==='20'?'popular_series':match[1]==='movie' && q.get('sort_by')==='popularity.desc' && q.get('vote_count.gte')==='50'?'popular_movies':match[1]==='movie' && q.get('sort_by')==='primary_release_date.desc' && q.get('vote_count.gte')==='20'?'new_movies':'';
 return key?'minimal:annual:'+key:'';
}
function defaultHidden(row,p){return !!row.minimal_default_hidden && !(p.shown || []).some(id=>matchesRow(row,id)) && !(p.order || []).some(id=>matchesRow(row,id));}
function matchesRow(row,id){return rowKey(row)===id || row.url===id || (row.minimal_row_aliases || []).includes(id) || String(row.minimal_row_id || row.id || '').startsWith('minimal:annual:') && annualKey(id)===rowKey(row) || isWatching(row) && ['mixed/trending','movies/trending','shows/trending','?sort=now_playing','movie/now_playing'].includes(id);}
export function arrange(rows,prefs){
 const order=prefs.order || [],hidden=prefs.hidden || [];
 const matches=matchesRow;
 const position=row=>order.findIndex(id=>matches(row,id));
 return rows.filter(row=>!hidden.some(id=>matches(row,id)) && !defaultHidden(row,prefs)).map((row,i)=>({row,i})).sort((a,b)=>{
  const ai=position(a.row),bi=position(b.row);
  return (ai<0?10000+a.i:ai)-(bi<0?10000+b.i:bi);
 }).map(x=>x.row);
}
export default function collections(L,shiki,kino,kinoFeeds){
 discoverySource(L);
 const key='minimal_collections',knownKey='minimal_collection_rows_v2';
 const read=()=>L.Storage.get(key,{}) || {},known=()=>L.Storage.get(knownKey,{}) || {};
 const captured=new Set(),homeRows=continueWatching(L);
 let mainSource=null;
 const labels={'main:':lampaViewText("Главная"),'category:movie':lampaViewText("Фильмы"),'category:tv':lampaViewText("Сериалы"),'category:tvshow':lampaViewText("ТВ-шоу"),'category:cartoon':lampaViewText("Мультфильмы"),'category:anime':lampaViewText("Аниме")};
 const animeContext=o=>'category:anime:'+animeMode(L,o);
 const context=o=>{o=o || {};const component=o.component || 'main';if(component==='main')return 'main:';const kind=o.url || o.cat;return component==='category' && ['movie','tv','cartoon','anime','dorama','tvshow'].includes(kind)?kind==='anime'?animeContext(o):'category:'+kind:null;};
 function remember(ctx,rows,append=false){
  if(!ctx)return;const names=known(),before=JSON.stringify(names),previous=append?(names[ctx] || []).filter(row=>ctx!=='main:' || !removedHomeRow(row)):[],next=previous.slice();
  rows.filter(row=>row && row.title && (ctx!=='main:' || !removedHomeRow(row)) && !/^(shots|спорт|расписание)$/i.test(String(row.title).trim()) && ((row.results || []).length || row.minimal_hidden || row.minimal_configurable)).forEach(row=>{const id=rowKey(row),entry={id,title:row.title,...(row.minimal_row_aliases?{aliases:row.minimal_row_aliases}:{}),...(row.minimal_empty?{subtitle:lampaViewText("Появится после добавления в историю")}:{})};const index=next.findIndex(old=>old.id===id);if(index<0)next.push(entry);else next[index]=entry;});
  captured.add(ctx);if(ctx==='main:' && mainSource)names[ctx+mainSource]=next;
  if(before!==JSON.stringify({...names,[ctx]:next})){names[ctx]=next;L.Storage.set(knownKey,names);}
 }
 function prefs(ctx){
  const all=read(),p=all[ctx] || (ctx==='category:anime:standard'?all['category:anime']:null) || {};
  const kind=String(ctx).replace('category:','');
  if(L.Storage.get('source','cub')!=='trakt' && ['movie','tv','cartoon','tvshow'].includes(kind) && (p.order || []).length && p.watching_first_revision!==1){
   const watch=cataloguePlan(kind).find(row=>row.key==='now-watching');
   if(watch){p.order=[rowKey(watch),...p.order.filter(id=>!matchesRow(watch,id))];p.watching_first_revision=1;save(ctx,p);}
  }
  if(ctx!=='main:' || !(p.order || []).length || p.order.includes(CONTINUE))return p;
  const rows=known()[ctx] || [],watch=rows.find(isWatching),order=p.order.slice(),index=watch?order.findIndex(id=>matchesRow({url:watch.id,title:watch.title,minimal_row_aliases:watch.aliases},id)):-1;
  order.splice(index+1,0,CONTINUE);return {...p,order};
 }
 function save(ctx,p){const all=read();all[ctx]=p;L.Storage.set(key,all);}
 function select(title,items,onSelect,onBack){L.Select.show({title,items,onSelect,onBack:onBack || (()=>L.Controller.toggle('settings'))});}
 function contextName(ctx){return labels[ctx] || (ctx==='category:anime:shikimori'?lampaViewText("Аниме · Shikimori"):lampaViewText("Аниме · Стандартные"));}
 function hiddenIds(ctx,object){const p=prefs(ctx),kind=object.url || object.cat;return [...(p.hidden || []),...cataloguePlan(kind,animeMode(L,object),new Date(),object.minimal_discovery || {}).map(job=>catalogueRow(job,kind,object.source || L.Storage.get('source','cub'),!!(L.Api.sources && L.Api.sources.cub))).filter(row=>defaultHidden(row,p)).map(rowKey)];}
 function edit(ctx){
  const kind=String(ctx).replace('category:','').split(':')[0],selected=L.Storage.get('source','cub'),source=ctx==='main:'?mainSource || selected:kind==='anime'?'cub':selected;
  const mode=animeMode(L),trakt=source==='trakt' && (ctx==='main:' || ['movie','tv','cartoon'].includes(kind));
  const plan=trakt?traktPlan(ctx==='main:'?undefined:kind):['movie','tv','cartoon','tvshow','anime'].includes(kind)?cataloguePlan(kind,mode).map(job=>catalogueRow(job,kind,source,!!(L.Api.sources && L.Api.sources.cub))):null;
  let definitions=plan && plan.map(row=>({id:rowKey(row),title:row.title,aliases:row.minimal_row_aliases || [],minimal_default_hidden:row.minimal_default_hidden}));
  if(ctx==='main:' && definitions)definitions.splice(1,0,{id:CONTINUE,title:lampaViewText('История просмотра')});
  if(ctx==='main:' && (known()[ctx+source] || []).length)definitions=known()[ctx+source].slice();
  const p=prefs(ctx),rows=(definitions || (known()[ctx==='main:'?ctx+source:ctx] || []).slice()).filter(row=>ctx!=='main:' || !removedHomeRow(row)),order=p.order || [];
  const matches=(r,id)=>matchesRow({minimal_row_id:r.id,minimal_row_aliases:r.aliases,title:r.title},id),hidden=r=>(p.hidden || []).some(id=>matches(r,id)) || defaultHidden({minimal_row_id:r.id,minimal_row_aliases:r.aliases,minimal_default_hidden:r.minimal_default_hidden},p),position=r=>{const index=order.findIndex(id=>matches(r,id));return index<0?10000:index;};
  rows.sort((a,b)=>position(a)-position(b));
  const items=rows.length?rows.map(r=>({...r,title:(hidden(r)?'○ ':'● ')+r.title})).concat([{id:'reset',title:lampaViewText("Сбросить порядок и видимость")}]):[{title:lampaViewText("Список пока не загружен"),subtitle:lampaViewText("Откройте раздел, чтобы получить актуальные подборки."),noenter:true}];
  select(lampaViewText("Подборки: {0}", [contextName(ctx)]),items,r=>{
   if(r.noenter)return;
   if(r.id==='reset'){save(ctx,{});return edit(ctx);}
   select(r.title,[{id:'toggle',title:hidden(r)?lampaViewText("Показать"):lampaViewText("Скрыть")},{id:'up',title:lampaViewText("Выше")},{id:'down',title:lampaViewText("Ниже")},{id:'first',title:lampaViewText("В начало")}],action=>{
    const wasHidden=hidden(r);p.hidden=rows.filter(hidden).map(x=>x.id);p.shown=rows.filter(x=>!hidden(x)).map(x=>x.id);p.order=rows.map(x=>x.id);
    if(action.id==='toggle'){p.hidden=wasHidden?p.hidden.filter(id=>!matches(r,id)):p.hidden.concat(r.id);p.shown=wasHidden?p.shown.concat(r.id):p.shown.filter(id=>!matches(r,id));}
    else {const i=p.order.indexOf(r.id),to=action.id==='first'?0:Math.max(0,Math.min(rows.length-1,i+(action.id==='up'?-1:1)));p.order.splice(i,1);p.order.splice(to,0,r.id);}
    save(ctx,p);edit(ctx);
   },()=>edit(ctx));
  },menu);
 }
 function menu(){select(lampaViewText("Подборки (изменения при следующем открытии)"),Object.keys(labels).map(id=>({id,title:labels[id]})),r=>edit(r.id==='category:anime'?animeContext():r.id));}
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_rows',type:'button'},field:{name:lampaViewText("Управление подборками"),description:lampaViewText("Порядок и видимость подборок выбранного каталога.")},onChange:menu});
 const main=L.Api.main;
 L.Api.main=function(object,ok,fail){
  const ctx=context(object),compact=(!object.component || object.component==='main');
  function process(rows){if(compact)return homeRows.ready(()=>render(rows));render(rows);}
  function render(rows){if(compact){mainSource=object.source || L.Storage.get('source','cub');rows=rows.filter(row=>!/недавние.*(?:эпизод|сери)|recent.*episode/i.test(String(row.title || '')));}rows=rows.map(row=>({...row,results:isMyShowsUnwatched(row)?(row.results || []):presentableCards(row.results || [])}));const selected=compact?homeOrder(homeRows(homeOrder(rows))):rows;remember(ctx,selected);ok(arrange(selected,prefs(ctx)).filter(row=>!row.minimal_empty));}
  const next=main.call(this,object,process,fail);
  return !compact && typeof next==='function'?function(resolve,reject){return next(rows=>{remember(ctx,rows,true);resolve(arrange(rows,prefs(ctx)));},reject);}:undefined;
 };
 // CUB bookmarks can arrive after the cached home has rendered. Refresh only
 // when membership changed, and never take focus from an open actions menu.
 let historyTimer;
 if(L.Listener && L.Listener.follow)L.Listener.follow('state:changed',event=>{
  if(event.target!=='favorite' || event.reason==='sync')return;
  clearTimeout(historyTimer);
  const refresh=()=>{
   const active=L.Activity && L.Activity.active && L.Activity.active();
   if(!active || active.component!=='main')return;
   if(L.Select && L.Select.opened && L.Select.opened()){historyTimer=setTimeout(refresh,500);return;}
   const component=active.activity && active.activity.component,items=component && component.items;
   if(!items)return;
   const row=items.find(item=>item.data && item.data.url===CONTINUE);
   const signature=cards=>(cards || []).map(card=>(card.source || '')+':'+card.id).join('|');
   if(signature(row && row.data.results)!==signature(homeRows.cards().slice(0,20)) && L.Activity.replace)L.Activity.replace({component:'main',source:active.source,url:active.url || '',page:1});
  };
  historyTimer=setTimeout(refresh,400);
 });
 const category=L.Api.category;
 if(category)L.Api.category=function(object,ok,fail){
  const kind=object.url || object.cat,ctx=context({...object,component:'category'});
  if(!['movie','tv','cartoon','anime','dorama','tvshow'].includes(kind))return category.apply(this,arguments);
  const selected=DISCOVERY_KINDS.includes(kind) && discoverySelected(discoveryState(kind,object.minimal_discovery || {}));
  if(!selected && (object.source || L.Storage.get('source','cub'))==='trakt' && !['dorama','tvshow'].includes(kind) && !(kind==='anime' && animeMode(L,object)==='shikimori')){
   const status=object.minimal_catalogue_status={state:'loading'};
   function accept(rows){status.state=rows.some(row=>row.results && row.results.length)?'ready':'empty';remember(ctx,rows);ok(arrange(rows,prefs(ctx)));}
   return category.call(this,{...object,source:'trakt'},accept,error=>{status.state='error';if(fail)fail(error);});
  }
  let cursor=0,busy=false,finished=false,remembered=false,waiters=[];
  const load=(resolve,reject,append)=>{if(finished || object.minimal_catalogue_cancelled){if(reject)reject();return;}waiters.push({resolve,reject});if(busy)return;busy=true;
   function batch(){object.minimal_catalogue_offset=cursor;object.minimal_catalogue_limit=3;object.minimal_catalogue_order=prefs(ctx).order || [];
    catalogue(L,shiki,object,hiddenIds(ctx,object),rows=>{if(object.minimal_catalogue_cancelled)return;cursor=object.minimal_catalogue_next;finished=cursor>=object.minimal_catalogue_total;remember(ctx,rows,remembered);remembered=true;const visible=arrange(rows.filter(row=>!row.minimal_hidden),prefs(ctx));if(!visible.length && !finished && object.minimal_catalogue_status.state!=='error')return batch();busy=false;const ready=waiters.splice(0);ready.forEach(w=>{if(visible.length || !append)w.resolve(visible);else if(w.reject)w.reject();});});
   }batch();
  };
  load(ok,fail,false);return (resolve,reject)=>load(resolve,reject,true);
 };
 // Register other catalogue rows and synchronize DOM order with remote navigation.
 const create=L.Utils.createInstance,Main=L.Maker.get('Main',{}),attached=new WeakSet();
 L.Utils.createInstance=function(Base,object){
  const item=create.apply(this,arguments);
  if(Base===Main)attach(item,object);return item;
 };
 function attach(item,object={}){
  if(item && item.use && !attached.has(item) && (!object || !object.component || ['main','category','category_full','search','minimal_filtered'].includes(object.component))){
   const ctx=context(object);if(!ctx)return item;attached.add(item);if(ctx==='main:')mainSource=object.source || L.Storage.get('source','cub');
   if((object.url || object.cat)==='anime')animeTabs(L,item,object);
   if(object && object.component==='category' && ['movie','tv','cartoon','tvshow','anime','dorama'].includes(object.url || object.cat))item.use({onDestroy(){object.minimal_catalogue_cancelled=true;}});
   item.use({onBuild:sort,onPushLoaded:sort});
   function sort(){
    if(ctx==='main:' && item.loaded)item.loaded=item.loaded.map(rows=>homeOrder(rows).filter(row=>!/(?:недавние.*(?:эпизод|сери)|recent.*episode)/i.test(String(row.title || ''))));
    if(!item.items || !item.items.length)return;
    if(ctx==='main:'){
     const recent=item.items.filter(line=>line.data && (removedHomeRow(line.data) || line.data.name==='timetable_recently' || /недавние.*(?:эпизод|сери)|recent.*episode/i.test(String(line.data.title || ''))));
     if(recent.length){item.items=item.items.filter(line=>!recent.includes(line));recent.forEach(line=>line.destroy && line.destroy());item.active=Math.min(item.active || 0,Math.max(0,item.items.length-1));}
    }
    if(ctx==='main:' || !captured.has(ctx))remember(ctx,item.items.map(i=>i.data || {}),ctx==='main:');
    const active=item.items[item.active],p=prefs(ctx),all=item.items.slice();
    if(ctx!=='main:' && !(p.order || []).length && !(p.hidden || []).length)return;
    const data=all.map(i=>i.data || {}),arranged=arrange(ctx==='main:'?homeOrder(data):data,p);
    item.items=arranged.map(data=>all.find(i=>i.data===data));
    all.filter(i=>!item.items.includes(i)).forEach(i=>i.destroy && i.destroy());
    if(all.length!==item.items.length || all.some((value,index)=>item.items[index]!==value))item.items.forEach(i=>{const node=i.render(true),el=node && (node.nodeType?node:node[0]);if(el && el.parentNode)el.parentNode.appendChild(el);});
    item.active=Math.max(0,item.items.indexOf(active));
   }
   sort();
  }
  return item;
 }
 const active=L.Activity && L.Activity.active && L.Activity.active();
 if(active && active.component==='main' && active.activity)attach(active.activity.component,active);
 return {menu};
}
