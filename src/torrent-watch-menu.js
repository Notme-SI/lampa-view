// Native torrent file coordinates and provider hashes share the same Timeline
// writer as online. Keep playback/link handlers native; never synthesize time.
export default function torrentWatchMenu(L,root){
 if(!L.Select || !L.Listener)return;
 const pending=new WeakMap(),rendered=new WeakMap(),show=L.Select.show;
 L.Listener.follow('torrent_file',event=>{
  if(event.type==='render'){
   let rows=rendered.get(event.items);if(!rows){rows=[];rendered.set(event.items,rows);}rows.push(event);
  }
  if(event.type==='onlong' && Array.isArray(event.menu))pending.set(event.menu,event);
 });
 L.Select.show=function(options){
  const event=options && pending.get(options.items),state=root.LampaView && root.LampaView.online;
  if(!event || !state)return show.apply(this,arguments);
  pending.delete(options.items);
  const movie=event.params && event.params.movie,element=event.element || {};
  if(!movie)return show.apply(this,arguments);
  const season=Number(element.season)||0,episode=Number(element.episode)||0,hash=element.timeline && element.timeline.hash || element.hash;
  const serial=season>0 && episode>0,record=state.reader(movie)(season,episode,hash),seen=record.percent>=95;
  const rows=(rendered.get(event.items) || []).filter(row=>Number(row.element.season)===season && Number(row.element.episode)>0);
  const coordinates=row=>({season:Number(row.element.season),episode:Number(row.element.episode),hash:row.element.timeline && row.element.timeline.hash || row.element.hash});
  const restore=()=>{L.Select.hide();if(options.onBack)options.onBack();};
  function refresh(){for(const row of rendered.get(event.items) || []){const view=state.reader(movie)(Number(row.element.season)||0,Number(row.element.episode)||0,row.element.timeline && row.element.timeline.hash || row.element.hash);if(row.element.timeline)Object.assign(row.element.timeline,{percent:view.percent || 0,time:view.time || 0,duration:view.duration || 0});}if(L.Timeline.read)L.Timeline.read();}
  function execute(entry){
   restore();
   if(entry.action==='mark' || entry.action==='unmark'){if(entry.action==='unmark' && element.viewed)element.viewed(0);state.setWatched(movie,season,episode,entry.action==='mark',hash);}
   if(entry.action==='clear'){
    // Also let the native action reset an enabled TorrServer-side resume point.
    options.onSelect({timeclear:true});state.clearProgress(movie,season,episode,hash);
   }
   if(entry.action==='previous')state.setPreviousWatched(movie,season,episode,null,rows.map(coordinates));
   if(entry.action==='season')state.setWatchedRows(movie,rows.map(coordinates));
   if(entry.action==='all')state.setAllWatched(movie,refresh);
   if(entry.action==='seasonclear')for(const row of rows){const c=coordinates(row);if(row.element.viewed)row.element.viewed(0);state.clearProgress(movie,c.season,c.episode,c.hash);}
   if(entry.action==='titleclear')state.clearTitleProgress(movie,(rendered.get(event.items) || []).map(row=>coordinates(row).hash));
   refresh();
  }
  function confirm(entry){L.Select.hide();show.call(L.Select,{title:entry.title+'?',items:[{...entry,title:'Да, сбросить'},{title:'Отмена',cancel:true}],onBack:bulk,onSelect:choice=>choice.cancel?bulk():execute(choice)});}
  function native(){L.Select.hide();show.call(L.Select,{...options,items:options.items.filter(entry=>!entry.timeclear && !entry.timefull),onBack:main});}
  function bulk(){L.Select.hide();show.call(L.Select,{title:'Сезон '+season+' и весь сериал',items:[
   {title:'Отметить серии этого сезона',subtitle:'Только серии, перечисленные в открытой раздаче.',action:'season'},
   {title:'Отметить все вышедшие серии',subtitle:'Все сезоны по данным каталога, без будущих серий.',action:'all'},
   {title:'Очистить таймкоды текущего сезона',subtitle:'Только файлы сезона '+season+' в этой раздаче.',action:'seasonclear'},
   {title:'Очистить таймкоды всего сериала',subtitle:'Сбросить прогресс всех сезонов этого сериала.',action:'titleclear'}
  ],onBack:main,onSelect:entry=>/clear$/.test(entry.action)?confirm(entry):execute(entry)});}
  function main(){
   L.Select.hide();const menu=[{title:seen?'Снять отметку просмотра':(serial?'Отметить серию просмотренной':'Отметить фильм просмотренным'),subtitle:seen?'Снимет отметку и сбросит прогресс.':'Сохранённая позиция не изменится.',action:seen?'unmark':'mark'}];
   if(serial && episode>1)menu.push({title:'Отметить серии 1–'+episode+' просмотренными',subtitle:'Только сезон '+season+', включая выбранную серию '+episode+'.',action:'previous'});
   menu.push({title:'Очистить таймкод',subtitle:'Удалить сохранённую позицию и прогресс этого файла.',action:'clear',noenter:!record.time && !record.percent});
   if(serial)menu.push({title:'Сезон и сериал…',subtitle:'Массовые отметки и сброс прогресса.',action:'bulk'});
   menu.push({title:'Действия с видео…',subtitle:'Плеер и ссылка на видео.',action:'native'});
   show.call(L.Select,{title:serial?'Сезон '+season+' • Серия '+episode:(movie.title || movie.name || 'Просмотр'),items:menu,onBack:restore,onSelect:entry=>entry.action==='bulk'?bulk():entry.action==='native'?native():execute(entry)});
  }
  return main();
 };
}
