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
 const seconds=Math.floor(Number(value)||0);if(seconds<=0)return '00:00';
 const minutes=Math.floor(seconds/60),tail=String(seconds%60).padStart(2,'0');
 return minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+':'+tail:String(minutes).padStart(2,'0')+':'+tail;
};
function watchFooter(L,node,data,series){
 const slot=node.querySelector('.pt-card-watch');let wrap=node.querySelector('.card-watched');
 if(!slot)return;
 slot.classList.remove('pt-card-watch--has-progress');
 const state=window.LampaView && window.LampaView.online;
 const shared=series && state && state.lastWatched?state.lastWatched(data):null;
 // Manual completion and native playback use the same persisted timeline.
 // They must remain visible even when native timetable has no watched overlay.
 if(series && state && state.lastWatched && !shared){if(wrap)wrap.classList.add('pt-card-watch--empty');return;}
 if(shared && !wrap){wrap=document.createElement('div');wrap.className='card-watched';wrap.innerHTML='<div class="card-watched__inner"><div class="card-watched__body"></div></div>';slot.appendChild(wrap);}
 if(!wrap)return;
 for(const other of slot.querySelectorAll('.card-watched'))if(other!==wrap)other.remove();
 // Move the original timeline, keeping its native updates and destroy lifecycle.
 if(wrap.parentNode!==slot)slot.appendChild(wrap);
 const hash=value=>L.Utils && L.Utils.hash?L.Utils.hash(value):value;
 const view=key=>{
  // A cached native card/timeline can outlive a cleared storage record.
  // Storage is authoritative when the host exposes its active profile file.
  if(L.Timeline && L.Timeline.filename && L.Storage && L.Storage.get){
   const records=L.Storage.get(L.Timeline.filename(),{}) || {},raw=records[key];
   if(!raw || !(typeof raw==='number'?raw:Number(raw.percent) || Number(raw.time)))return null;
  }
  return L.Timeline && L.Timeline.view?L.Timeline.view(key):null;
 };
 let row=Array.from(wrap.querySelectorAll('.card-watched__item')).find(item=>{const line=item.querySelector('.time-line');return line && (!shared || line.getAttribute('data-hash')===String(shared.hash));});
 if(shared && !row && L.Timeline && L.Timeline.render){
  const rendered=L.Timeline.render(L.Timeline.view(shared.hash)),line=rendered && (rendered.nodeType?rendered:rendered[0]);
  if(line){row=document.createElement('div');row.className='card-watched__item';const span=document.createElement('span');span.textContent='Серия '+shared.episode;row.appendChild(span);row.appendChild(line);(wrap.querySelector('.card-watched__body') || wrap).appendChild(row);}
 }
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
 if(!row){wrap.classList.add('pt-card-watch--empty');return;}
 wrap.querySelectorAll('.card-watched__item').forEach(item=>item.classList.toggle('pt-card-watch__current',item===row));
 let summary=row.querySelector('.pt-card-watch__row');
 if(!summary){summary=document.createElement('div');summary.className='pt-card-watch__row';summary.innerHTML='<span class="pt-card-watch__label"></span><span class="pt-card-watch__time"></span>';row.insertBefore(summary,row.firstChild);}
 const nativeLabel=row.querySelector(':scope > span'),text=nativeLabel && nativeLabel.textContent || '';
 let label='Просмотрено',timeline=null,watchSeason=0,watchEpisode=0;
 const progressHash=row.querySelector('.time-line').getAttribute('data-hash');
 if(progressHash)timeline=view(progressHash);
 if(shared){watchSeason=shared.season;watchEpisode=shared.episode;timeline=view(shared.hash);label='Серия '+watchEpisode+' • Сезон '+watchSeason;}else if(series){
  const match=text.match(/^(\d+)\s*[-–]|(?:Эпизод|Серия|Episode)\s*(\d+)/i),episode=match && Number(match[1] || match[2]);
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  let season=0;
  for(const ep of table){
   if(Number(ep.episode_number)!==episode)continue;
   const key=hash([ep.season_number,ep.season_number>10?':':'',episode,data.original_title].join(''));
   if(progressHash && String(key)!==progressHash)continue;
   const time=view(key);
   if(time && (time.percent || time.time)){season=Number(ep.season_number);timeline=time;}
  }
  if(!season && episode){
   const last=L.Storage && L.Storage.get?L.Storage.get('online_watched_last','{}') || {}:{};
   const history=last[hash(data.original_title)];
   if(history && Number(history.episode)===episode){const key=hash([Number(history.season),Number(history.season)>10?':':'',episode,data.original_title].join(''));if(!progressHash || String(key)===progressHash){season=Number(history.season)||0;timeline=view(key);}}
  }
  watchSeason=season;watchEpisode=episode;
  label=episode?'Серия '+episode+(season?' • Сезон '+season:''):'Просмотрено';
 }else{
  if(!progressHash)timeline=L.Timeline && L.Timeline.filename?view(hash(data.original_title)):L.Timeline && L.Timeline.watched?L.Timeline.watched(data,true):view(hash(data.original_title));
  if(Array.isArray(timeline))timeline=view(hash(data.original_title));
 }
 if(!timeline || !(Number(timeline.percent)>0 || Number(timeline.time)>0)){wrap.classList.add('pt-card-watch--empty');return;}
 wrap.classList.remove('pt-card-watch--empty');
 slot.classList.add('pt-card-watch--has-progress');
 const time=clock(timeline.time),name=summary.firstElementChild,stamp=summary.lastElementChild;
 if(name.dataset.label!==label){
  name.dataset.label=label;
  name.textContent='';
  if(watchEpisode){
   const heading=document.createElement('span');heading.className='pt-card-watch__heading';heading.textContent='Просмотрена: ';name.appendChild(heading);
   const episode=document.createElement('span');episode.textContent='Серия '+watchEpisode+(watchSeason?' • ':'');name.appendChild(episode);
   if(watchSeason){const season=document.createElement('span');season.textContent='Сезон '+watchSeason;name.appendChild(season);}
  }else name.textContent=label;
 }
 if(stamp.textContent!==time)stamp.textContent=time;
 summary.title='История просмотра: '+label+(time?', '+time:'');
}
// Metadata is requested only for a focused series, with bounded shared cache.
// Native timetable data and native watch history remain authoritative.
export default function seriesStatus(L,schedule){
 const cards=new WeakMap(),cache=new Map(),pending=new Map(),queue=[];let running=0;
 function paint(node){
  const data=cards.get(node);if(!data)return;
  const view=node.querySelector('.card__view');if(!view)return;
  const series=data.media_type!=='movie' && !!(data.name || data.original_name || data.first_air_date || data.media_type==='tv');
  watchFooter(L,node,data,series);
  if(!series || !node.matches('.focus,.hover'))return;
  const key=String(data.id),entry=cache.get(key),fresh=entry && Date.now()-entry.at<(entry.value?900000:60000),facts=fresh?entry.value:null;
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  const available=facts || releaseStatus(data,table);
  let box=view.querySelector('.pt-series-status');
  if(available){
   if(!box){box=document.createElement('div');box.className='pt-series-status';box.innerHTML='<span></span><span></span>';view.appendChild(box);}
   const partial=available.total>available.count;
   const released=partial?available.count+'/'+available.total:String(available.count);
   const text='Сезон '+available.season+' • '+(partial?'Серия ':'Серий ')+released;
   if(box.textContent!==text){box.firstElementChild.textContent='Сезон '+available.season+' • ';box.lastElementChild.textContent=(partial?'Серия ':'Серий ')+released;}
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
 // Timeline writes update the original progress node directly. Refresh visible
 // rails through the batched badge queue; captions still require focus.
 if(L.Listener && L.Listener.follow)L.Listener.follow('state:changed',event=>{
  if(event.target==='timeline')for(const node of document.querySelectorAll('.card'))if(cards.has(node))schedule(node);
 });
 return {track(node,data){
  cards.set(node,data);
  if(!node.querySelector('.pt-card-watch')){const slot=document.createElement('div');slot.className='pt-card-watch';node.appendChild(slot);}
 },paint};
}
