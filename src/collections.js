import catalogue,{animeMode} from './catalogue.js';
import animeTabs from './anime-tabs.js';
import continueWatching,{CONTINUE,isWatching} from './continue-watching.js';
export function rowKey(row){return String(row.minimal_row_id || row.url || row.title || 'Без названия');}
function matchesRow(row,id){return rowKey(row)===id || row.url===id || (row.minimal_row_aliases || []).includes(id) || isWatching(row) && ['mixed/trending','movies/trending','shows/trending','?sort=now_playing','movie/now_playing'].includes(id);}
export function arrange(rows,prefs){
 const order=prefs.order || [],hidden=prefs.hidden || [];
 const matches=matchesRow;
 const position=row=>order.findIndex(id=>matches(row,id));
 return rows.filter(row=>!hidden.some(id=>matches(row,id))).map((row,i)=>({row,i})).sort((a,b)=>{
  const ai=position(a.row),bi=position(b.row);
  return (ai<0?10000+a.i:ai)-(bi<0?10000+b.i:bi);
 }).map(x=>x.row);
}
export default function collections(L,shiki){
 const key='minimal_collections',knownKey='minimal_collection_rows_v2';
 const read=()=>L.Storage.get(key,{}) || {},known=()=>L.Storage.get(knownKey,{}) || {};
 const captured=new Set(),homeRows=continueWatching(L);
 const labels={'main:':'Главная','category:movie':'Фильмы','category:tv':'Сериалы','category:cartoon':'Мультфильмы','category:anime':'Аниме'};
 const animeContext=o=>'category:anime:'+animeMode(L,o);
 const context=o=>{o=o || {};const component=o.component || 'main';if(component==='main')return 'main:';const kind=o.url || o.cat;return component==='category' && ['movie','tv','cartoon','anime'].includes(kind)?kind==='anime'?animeContext(o):'category:'+kind:null;};
 function remember(ctx,rows,append=false){
  if(!ctx)return;const names=known(),previous=append?(names[ctx] || []):[],next=previous.slice();
  rows.filter(row=>row && row.title && !/^(shots|спорт|расписание)$/i.test(String(row.title).trim()) && ((row.results || []).length || row.minimal_hidden || row.minimal_configurable)).forEach(row=>{const id=rowKey(row),entry={id,title:row.title,...(row.minimal_row_aliases?{aliases:row.minimal_row_aliases}:{}),...(row.minimal_empty?{subtitle:'Появится после начала просмотра'}:{})};const index=next.findIndex(old=>old.id===id);if(index<0)next.push(entry);else next[index]=entry;});
  captured.add(ctx);if(JSON.stringify(names[ctx] || [])!==JSON.stringify(next)){names[ctx]=next;L.Storage.set(knownKey,names);}
 }
 function prefs(ctx){const all=read(),p=all[ctx] || (ctx==='category:anime:standard'?all['category:anime']:null) || {};if(ctx!=='main:' || !(p.order || []).length || p.order.includes(CONTINUE))return p;const rows=known()[ctx] || [],watch=rows.find(isWatching),order=p.order.slice(),index=watch?order.findIndex(id=>matchesRow({url:watch.id,title:watch.title,minimal_row_aliases:watch.aliases},id)):-1;order.splice(index+1,0,CONTINUE);return {...p,order};}
 function save(ctx,p){const all=read();all[ctx]=p;L.Storage.set(key,all);}
 function select(title,items,onSelect,onBack){L.Select.show({title,items,onSelect,onBack:onBack || (()=>L.Controller.toggle('settings'))});}
 function contextName(ctx){return labels[ctx] || (ctx==='category:anime:shikimori'?'Аниме · Shikimori':'Аниме · Стандартные');}
 function edit(ctx){
  const p=prefs(ctx),rows=(known()[ctx] || []).slice(),order=p.order || [];
  rows.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):10000)-(order.includes(b.id)?order.indexOf(b.id):10000));
  const items=rows.length?rows.map(r=>({...r,title:((p.hidden || []).includes(r.id)?'○ ':'● ')+r.title})).concat([{id:'reset',title:'Сбросить порядок и видимость'}]):[{title:'Список пока не загружен',subtitle:'Откройте раздел, чтобы получить актуальные подборки.',noenter:true}];
  select('Подборки: '+contextName(ctx),items,r=>{
   if(r.noenter)return;
   if(r.id==='reset'){save(ctx,{});return edit(ctx);}
   select(r.title,[{id:'toggle',title:(p.hidden || []).includes(r.id)?'Показать':'Скрыть'},{id:'up',title:'Выше'},{id:'down',title:'Ниже'},{id:'first',title:'В начало'}],action=>{
    p.hidden=p.hidden || [];p.order=rows.map(x=>x.id);
    if(action.id==='toggle')p.hidden=p.hidden.includes(r.id)?p.hidden.filter(id=>id!==r.id):p.hidden.concat(r.id);
    else {const i=p.order.indexOf(r.id),to=action.id==='first'?0:Math.max(0,Math.min(rows.length-1,i+(action.id==='up'?-1:1)));p.order.splice(i,1);p.order.splice(to,0,r.id);}
    save(ctx,p);edit(ctx);
   },()=>edit(ctx));
  },menu);
 }
 function menu(){select('Подборки (изменения при следующем открытии)',Object.keys(labels).map(id=>({id,title:labels[id]})),r=>edit(r.id==='category:anime'?animeContext():r.id));}
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_rows',type:'button'},field:{name:'Управление подборками',description:'Текущие подборки последнего открытого экрана. Старые и недоступные строки не показываются.'},onChange:menu});
 const main=L.Api.main;
 L.Api.main=function(object,ok,fail){
  const ctx=context(object),compact=(!object.component || object.component==='main');
  function process(rows){const selected=compact?homeRows(rows):rows;remember(ctx,selected);ok(arrange(selected,prefs(ctx)).filter(row=>!row.minimal_empty));}
  const next=main.call(this,object,process,fail);
  return !compact && typeof next==='function'?function(resolve,reject){return next(rows=>{remember(ctx,rows,true);resolve(arrange(rows,prefs(ctx)));},reject);}:undefined;
 };
 const category=L.Api.category;
 if(category)L.Api.category=function(object,ok,fail){
  const kind=object.url || object.cat,ctx=context({...object,component:'category'});
  if(!['movie','tv','cartoon','anime'].includes(kind))return category.apply(this,arguments);
  if((object.source || L.Storage.get('source','cub'))==='trakt' && !(kind==='anime' && animeMode(L,object)==='shikimori')){
   const status=object.minimal_catalogue_status={state:'loading'};
   return category.call(this,{...object,source:'trakt'},rows=>{status.state=rows.some(row=>row.results && row.results.length)?'ready':'empty';remember(ctx,rows);ok(arrange(rows,prefs(ctx)));},error=>{status.state='error';if(fail)fail(error);});
  }
  catalogue(L,shiki,object,prefs(ctx).hidden || [],rows=>{remember(ctx,rows);ok(arrange(rows.filter(row=>!row.minimal_hidden),prefs(ctx)));});
  // Only the selected catalogue runs, with a fixed plan and no next row loader.
 };
 // Register other catalogue rows and synchronize DOM order with remote navigation.
 const create=L.Utils.createInstance,Main=L.Maker.get('Main',{});
 L.Utils.createInstance=function(Base,object){
  const item=create.apply(this,arguments);
  if(Base===Main && item && item.use && (!object || !object.component || ['main','category','category_full','search','minimal_filtered'].includes(object.component))){
   const ctx=context(object);if(!ctx)return item;
   if((object.url || object.cat)==='anime')animeTabs(L,item,object);
   item.use({onBuild:sort,onPushLoaded:sort});
   function sort(){
    if(!item.items || !item.items.length)return;
    if(!captured.has(ctx))remember(ctx,item.items.map(i=>i.data || {}));
    const active=item.items[item.active],p=prefs(ctx),all=item.items.slice();
    if(!(p.order || []).length && !(p.hidden || []).length)return;
    const arranged=arrange(all.map(i=>i.data || {}),p);
    item.items=arranged.map(data=>all.find(i=>i.data===data));
    all.filter(i=>!item.items.includes(i)).forEach(i=>i.destroy && i.destroy());
    if(all.length!==item.items.length || all.some((value,index)=>item.items[index]!==value))item.items.forEach(i=>{const node=i.render(true),el=node && (node.nodeType?node:node[0]);if(el && el.parentNode)el.parentNode.appendChild(el);});
    item.active=Math.max(0,item.items.indexOf(active));
   }
  }
  return item;
 };
 return {menu};
}
