import tmdbGet from './tmdb.js';
const day=value=>String(value || '').slice(0,10);
export function releaseStatus(data={},episodes=[],today=day(new Date().toISOString())){
 const aired=episodes.filter(e=>Number(e.season_number)>0 && Number(e.episode_number)>0 && e.air_date && day(e.air_date)<=today);
 const last=data.last_episode_to_air;
 if(last && Number(last.season_number)>0 && last.air_date && day(last.air_date)<=today)aired.push(last);
 if(!aired.length)return null;
 const season=Math.max(...aired.map(e=>Number(e.season_number))),rows=aired.filter(e=>Number(e.season_number)===season);
 const count=Math.max(...rows.map(e=>Number(e.episode_number))),detail=(data.seasons || []).find(s=>Number(s.season_number)===season);
 return {season,count,total:Math.max(count,Number(detail && detail.episode_count)||0)};
}
export function episodeLabel(text){
 const value=String(text || '').trim(),match=value.match(/^(\d+)\s*[-–]\s*|^(?:Эпизод|Серия|Episode)\s*(\d+)/i);
 return match?'Серия '+Number(match[1] || match[2]):value;
}
const clock=value=>{
 const seconds=Math.floor(Number(value)||0);if(seconds<=0)return '';
 const minutes=Math.floor(seconds/60),tail=String(seconds%60).padStart(2,'0');
 return minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+':'+tail:String(minutes).padStart(2,'0')+':'+tail;
};
function watchFooter(L,node,data,series){
 const slot=node.querySelector('.pt-card-watch'),wrap=node.querySelector('.card-watched');
 if(!slot || !wrap)return;
 // Move the original timeline, keeping its native updates and destroy lifecycle.
 if(wrap.parentNode!==slot)slot.appendChild(wrap);
 const hash=value=>L.Utils && L.Utils.hash?L.Utils.hash(value):value;
 const view=key=>L.Timeline && L.Timeline.view?L.Timeline.view(key):null;
 let row=Array.from(wrap.querySelectorAll('.card-watched__item')).find(item=>item.querySelector('.time-line'));
 // Native timetable slicing can drop an older-season watch row entirely.
 // Restore only an existing saved timeline, using Lampa's own render/updates.
 if(!row && series && L.Timeline && L.Timeline.render){
  const last=L.Storage && L.Storage.get?L.Storage.get('online_watched_last','{}') || {}:{},history=last[hash(data.original_title)];
  if(history && Number(history.season)>0 && Number(history.episode)>0){
   const season=Number(history.season),episode=Number(history.episode),time=view(hash([season,season>10?':':'',episode,data.original_title].join('')));
   if(time && time.percent){
    const rendered=L.Timeline.render(time),line=rendered && (rendered.nodeType?rendered:rendered[0]);
    if(line){row=document.createElement('div');row.className='card-watched__item';const span=document.createElement('span');span.textContent='Серия '+episode;row.appendChild(span);row.appendChild(line);(wrap.querySelector('.card-watched__body') || wrap).appendChild(row);}
   }
  }
 }
 if(!row)return;
 wrap.querySelectorAll('.card-watched__item').forEach(item=>item.classList.toggle('pt-card-watch__current',item===row));
 let summary=row.querySelector('.pt-card-watch__row');
 if(!summary){summary=document.createElement('div');summary.className='pt-card-watch__row';summary.innerHTML='<span class="pt-card-watch__label"></span><span class="pt-card-watch__time"></span>';row.insertBefore(summary,row.firstChild);}
 const nativeLabel=row.querySelector(':scope > span'),text=nativeLabel && nativeLabel.textContent || '';
 let label='Просмотрено',timeline=null;
 if(series){
  const match=text.match(/^(\d+)\s*[-–]|(?:Эпизод|Серия|Episode)\s*(\d+)/i),episode=match && Number(match[1] || match[2]);
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  let season=0;
  for(const ep of table){
   if(Number(ep.episode_number)!==episode)continue;
   const time=view(hash([ep.season_number,ep.season_number>10?':':'',episode,data.original_title].join('')));
   if(time && time.percent){season=Number(ep.season_number);timeline=time;}
  }
  if(!season && episode){
   const last=L.Storage && L.Storage.get?L.Storage.get('online_watched_last','{}') || {}:{};
   const history=last[hash(data.original_title)];
   if(history && Number(history.episode)===episode){season=Number(history.season)||0;timeline=view(hash([season,season>10?':':'',episode,data.original_title].join('')));}
  }
  label=episode?(season?'С'+season+' · ':'')+episode+' серия':episodeLabel(text);
 }else{
  timeline=L.Timeline && L.Timeline.watched?L.Timeline.watched(data,true):view(hash(data.original_title));
  if(!timeline || Array.isArray(timeline))timeline=view(hash(data.original_title));
 }
 const time=clock(timeline && timeline.time),name=summary.firstElementChild,stamp=summary.lastElementChild;
 if(name.textContent!=='▶ '+label)name.textContent='▶ '+label;
 if(stamp.textContent!==time)stamp.textContent=time;
 summary.title='История просмотра: '+label+(time?', '+time:'');
}
// Metadata is requested only for a focused series, with bounded shared cache.
// Native timetable data and native watch history remain authoritative.
export default function seriesStatus(L,schedule){
 const cards=new WeakMap(),cache=new Map(),pending=new Map(),queue=[];let running=0;
 function paint(node){
  const data=cards.get(node);if(!data || !node.matches('.focus,.hover'))return;
  const view=node.querySelector('.card__view');if(!view)return;
  const series=data.media_type!=='movie' && !!(data.name || data.original_name || data.first_air_date || data.media_type==='tv');
  watchFooter(L,node,data,series);
  if(!series)return;
  const key=String(data.id),entry=cache.get(key),fresh=entry && Date.now()-entry.at<(entry.value?900000:60000),facts=fresh?entry.value:null;
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  const available=facts || releaseStatus(data,table);
  let box=view.querySelector('.pt-series-status');
  if(available){
   if(!box){box=document.createElement('div');box.className='pt-series-status';view.appendChild(box);}
   const released=available.total>available.count?available.count+'/'+available.total:available.count+' серий';
   const text='С'+available.season+' · вышло '+released;
   if(box.textContent!==text)box.textContent=text;
   box.title='Сезон '+available.season+': вышло '+released+'. История просмотра — под обложкой.';
  }else if(box)box.remove();
  // Release metadata stays independent of the native watch timeline below the cover.
  if(!fresh && !pending.has(key) && (!data.source || ['cub','tmdb','trakt'].includes(data.source)) && Number(data.id)>0 && queue.length<8){const task={key,data,nodes:new Set([node])};pending.set(key,task);queue.push(task);pump();}
  else if(pending.has(key))pending.get(key).nodes.add(node);
 }
 function pump(){
  while(running<(document.body.classList.contains('pt-tv')?1:2) && queue.length){const task=queue.shift();running++;let done=false;
   const finish=json=>{if(done)return;done=true;running--;pending.delete(task.key);const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(task.data) || []:[];cache.set(task.key,{at:Date.now(),value:releaseStatus(json && Number(json.id)===Number(task.data.id)?json:task.data,table)});if(cache.size>80)cache.delete(cache.keys().next().value);for(const node of task.nodes)if(node.isConnected && node.matches('.focus,.hover'))schedule(node);pump();};
   tmdbGet(L,'tv/'+task.data.id,{},finish,()=>finish(null),{life:60});
  }
 }
 // Timeline writes update the original progress node directly. Refresh only
 // focused captions, without querying metadata or rescanning cached rows.
 if(L.Listener && L.Listener.follow)L.Listener.follow('state:changed',event=>{
  if(event.target==='timeline')for(const node of document.querySelectorAll('.card.focus,.card.hover'))if(cards.has(node))schedule(node);
 });
 return {track(node,data){
  cards.set(node,data);
  if(!node.querySelector('.pt-card-watch')){const slot=document.createElement('div');slot.className='pt-card-watch';node.appendChild(slot);}
 },paint};
}
