import {text as lampaViewText} from './i18n.js';
import tmdbGet from './tmdb.js';
import {namedSeason} from './episode-metadata.js';
const day=value=>String(value || '').slice(0,10);
export function releaseStatus(data={},episodes=[],today=day(new Date().toISOString())){
 const aired=episodes.filter(e=>Number(e.season_number)>0 && Number(e.episode_number)>0 && e.air_date && day(e.air_date)<=today);
 const last=data.last_episode_to_air;
 if(last && Number(last.season_number)>0 && last.air_date && day(last.air_date)<=today)aired.push(last);
 if(!aired.length)return null;
 const season=Math.max(...aired.map(e=>Number(e.season_number))),rows=aired.filter(e=>Number(e.season_number)===season);
 const count=Math.max(...rows.map(e=>Number(e.episode_number))),detail=(Array.isArray(data.seasons)?data.seasons:[]).find(s=>Number(s.season_number)===season);
 return {season,count,total:Math.max(count,Number(detail && detail.episode_count)||0)};
}
export function episodeLabel(text){
 const value=String(text || '').trim(),match=value.match(/^(\d+)\s*[-–]\s*|^(?:Эпизод|Серия|Episode)\s*(\d+)/i);
 return match?lampaViewText("Серия {0}", [Number(match[1] || match[2])]):value;
}
const clock=value=>{
 const seconds=Math.floor(Number(value)||0);if(seconds<=0)return '00:00';
 const minutes=Math.floor(seconds/60),tail=String(seconds%60).padStart(2,'0');
 return minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+':'+tail:String(minutes).padStart(2,'0')+':'+tail;
};
function watchFooter(L,node,data,series){
 const slot=node.querySelector('.pt-card-watch');let wrap=node.querySelector('.card-watched');
 if(!slot)return;
 slot.classList.remove('pt-card-watch--has-progress','pt-card-watch--complete');
 const state=window.LampaView && window.LampaView.online;
 const shared=series && state && state.lastWatched?state.lastWatched(data):null;
 const target=shared;
 const title=data.original_title || data.original_name || data.title || data.name || '';
 const targetHash=target && (target.season!==shared.season || target.episode!==shared.episode)?L.Utils.hash([target.season,target.season>10?':':'',target.episode,title].join('')):shared && shared.hash;
 // Manual completion and native playback use the same persisted timeline.
 // They must remain visible even when native timetable has no watched overlay.
 if(series && state && state.lastWatched && !shared){if(wrap)wrap.classList.add('pt-card-watch--empty');return;}
 const hash=value=>L.Utils && L.Utils.hash?L.Utils.hash(value):value;
 const view=key=>{
  // A cached native card/timeline can outlive a cleared storage record.
  // Storage is authoritative when the host exposes its active profile file.
  if(L.Timeline && L.Timeline.filename && L.Storage && L.Storage.get){
   const records=L.Storage.get(L.Timeline.filename(),{}) || {},raw=records[key];
   if(!raw || !(typeof raw==='number'?raw:Number(raw.percent) || Number(raw.time)))return null;
   const saved=typeof raw==='number'?{percent:raw,time:0,duration:0}:raw;
   return {...(L.Timeline.view?L.Timeline.view(key):{}),...saved,hash:key};
  }
  return L.Timeline && L.Timeline.view?L.Timeline.view(key):null;
 };
 // Movie progress must not depend on the native hover overlay already existing.
 const movieSaved=!series && (state && state.reader?state.reader(data)(0,0):[data.original_title,data.title].filter(Boolean).map(title=>view(hash(title))).find(value=>value && (value.percent || value.time)));
 const favorite=L.Favorite,synced=L.Account && L.Account.Permit && L.Account.Permit.sync;
 // check() is the local list even while CUB sync is enabled. cloud() follows
 // the current profile's bookmarks, including removal on another device.
 const marks=!series && favorite?(synced && favorite.cloud?favorite.cloud(data):favorite.check?favorite.check(data):null):null;
 const movieMarked=marks && (marks.wath || marks.viewed);
 const movieTime=movieMarked?{hash:hash(title),percent:100,time:0,duration:0}:movieSaved && (movieSaved.percent || movieSaved.time)?movieSaved:null;
 if((shared || movieTime) && !wrap){wrap=document.createElement('div');wrap.className='card-watched';wrap.innerHTML='<div class="card-watched__inner"><div class="card-watched__body"></div></div>';slot.appendChild(wrap);}
 if(!wrap)return;
 for(const other of slot.querySelectorAll('.card-watched'))if(other!==wrap)other.remove();
 // Move the original timeline, keeping its native updates and destroy lifecycle.
 if(wrap.parentNode!==slot)slot.appendChild(wrap);
 let row=Array.from(wrap.querySelectorAll('.card-watched__item')).find(item=>{const line=item.querySelector('.time-line');return line && (!shared || line.getAttribute('data-hash')===String(targetHash));});
 if(movieTime && !row && L.Timeline && L.Timeline.render){
  const rendered=L.Timeline.render(movieTime),line=rendered && (rendered.nodeType?rendered:rendered[0]);
  if(line){row=document.createElement('div');row.className='card-watched__item';row.appendChild(line);(wrap.querySelector('.card-watched__body') || wrap).appendChild(row);}
 }
 if(shared && !row && L.Timeline && L.Timeline.render){
  const rendered=L.Timeline.render({...L.Timeline.view(targetHash),hash:targetHash,...(target?{percent:target.percent,time:target.time}:{})}),line=rendered && (rendered.nodeType?rendered:rendered[0]);
  if(line){row=document.createElement('div');row.className='card-watched__item';const span=document.createElement('span');span.textContent=lampaViewText("Серия {0}", [shared.episode]);row.appendChild(span);row.appendChild(line);(wrap.querySelector('.card-watched__body') || wrap).appendChild(row);}
 }
 // Native timetable slicing can drop an older-season watch row entirely.
 // Restore only an existing saved timeline, using Lampa's own render/updates.
 if(!row && series && L.Timeline && L.Timeline.render){
  const last=L.Storage && L.Storage.get?L.Storage.get('online_watched_last','{}') || {}:{},history=last[hash(data.original_title)];
  if(history && Number(history.season)>0 && Number(history.episode)>0){
   const season=Number(history.season),episode=Number(history.episode),time=view(hash([season,season>10?':':'',episode,data.original_title].join('')));
   if(time && time.percent){
    const rendered=L.Timeline.render(time),line=rendered && (rendered.nodeType?rendered:rendered[0]);
    if(line){row=document.createElement('div');row.className='card-watched__item';const span=document.createElement('span');span.textContent=lampaViewText("Серия {0}", [episode]);row.appendChild(span);row.appendChild(line);(wrap.querySelector('.card-watched__body') || wrap).appendChild(row);}
   }
  }
 }
 if(!row){wrap.classList.add('pt-card-watch--empty');return;}
 wrap.querySelectorAll('.card-watched__item').forEach(item=>item.classList.toggle('pt-card-watch__current',item===row));
 let summary=row.querySelector('.pt-card-watch__row');
 if(!summary){summary=document.createElement('div');summary.className='pt-card-watch__row';summary.innerHTML='<span class="pt-card-watch__label"></span><span class="pt-card-watch__time"></span>';row.insertBefore(summary,row.firstChild);}
 const nativeLabel=row.querySelector(':scope > span'),text=nativeLabel && nativeLabel.textContent || '';
 let label=lampaViewText("Просмотрено:"),timeline=null,watchSeason=0,watchEpisode=0;
 const progressHash=row.querySelector('.time-line').getAttribute('data-hash');
 if(progressHash)timeline=view(progressHash);
 if(shared){watchSeason=target?target.season:shared.season;watchEpisode=target?target.episode:shared.episode;timeline=view(shared.hash);label=lampaViewText("Серия {0} • Сезон {1}", [watchEpisode,watchSeason]);}else if(series){
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
  label=episode?lampaViewText("Серия {0}{1}", [episode,season?lampaViewText(" • Сезон {0}", [season]):'']):lampaViewText("Просмотрено");
 }else{
  if(movieTime)timeline=movieTime;
  else if(!progressHash)timeline=L.Timeline && L.Timeline.filename?view(hash(data.original_title)):L.Timeline && L.Timeline.watched?L.Timeline.watched(data,true):view(hash(data.original_title));
  if(Array.isArray(timeline))timeline=view(hash(data.original_title));
 }
 if(!timeline || !(Number(timeline.percent)>0 || Number(timeline.time)>0)){wrap.classList.add('pt-card-watch--empty');return;}
 wrap.classList.remove('pt-card-watch--empty');
 slot.classList.add('pt-card-watch--has-progress');
 const seasonDetail=series && shared && (Array.isArray(data.seasons)?data.seasons:[]).find(season=>Number(season.season_number)===shared.season);
 const seasonTotal=Number(seasonDetail && seasonDetail.episode_count) || shared && shared.total || 0;
 const next=data.next_episode_to_air;
 const released=releaseStatus(data,L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[]);
 const ended=shared && released && (released.season>shared.season || released.season===shared.season && released.count>=seasonTotal);
 const seasonComplete=series && shared && seasonTotal>0 && ended && !(next && Number(next.season_number)===shared.season) && state && state.seasonWatched && state.seasonWatched(data,shared.season,seasonTotal);
 const complete=series?seasonComplete:Number(timeline.percent)>=90;
 const episodeComplete=series && Number(timeline.percent)>=95;
 const hideProgress=complete || episodeComplete;
 slot.classList.toggle('pt-card-watch--complete',hideProgress);
 const shown={...(target || timeline)};
 if(Number(shown.percent)>=(series?95:90))shown.percent=100;
 if(complete){watchEpisode=0;label=series?lampaViewText("Сезон {0} просмотрен", [shared.season]):lampaViewText("Фильм просмотрен");}
 // Keep the native timeline node (and data-hash) in an explicit flex progress row.
 const line=row.querySelector('.time-line');let meter=row.querySelector('.pt-card-watch__meter');
 if(!meter){meter=document.createElement('div');meter.className='pt-card-watch__meter';row.appendChild(meter);}
 if(line.parentNode!==meter)meter.appendChild(line);
 const timestamp=row.querySelector('.pt-card-watch__time');if(timestamp.parentNode!==meter)meter.appendChild(timestamp);
 line.classList.remove('hide');
 const fill=row.querySelector('.time-line>div');if(fill)fill.style.width=Math.min(100,Math.max(0,Number(shown.percent)||0))+'%';
 const time=hideProgress || !Number(shown.time)?'':clock(shown.time),name=summary.firstElementChild,stamp=row.querySelector('.pt-card-watch__time');
 const action=Number(shown.time)>0 || Number(shown.percent)>0?lampaViewText("Просмотрено: "):lampaViewText("Смотреть: ");
 if(name.dataset.label!==label || name.dataset.action!==action){
  name.dataset.label=label;name.dataset.action=action;
  name.textContent='';
  if(watchEpisode){
   const heading=document.createElement('span');heading.className='pt-card-watch__heading';heading.textContent=action;name.appendChild(heading);
   const episode=document.createElement('span');episode.textContent=lampaViewText("Серия {0}{1}", [watchEpisode,watchSeason?' • ':'']);name.appendChild(episode);
   if(watchSeason){const season=document.createElement('span');season.textContent=lampaViewText("Сезон {0}", [watchSeason]);name.appendChild(season);}
  }else name.textContent=label;
 }
 if(stamp.textContent!==time)stamp.textContent=time;
 summary.title=label+(time?', '+time:'');
}
// Metadata is requested only for a focused series, with bounded shared cache.
// Native timetable data and native watch history remain authoritative.
export default function seriesStatus(L,schedule){
 const cards=new WeakMap(),cache=new Map(),pending=new Map(),queue=[];let running=0,saveTimer;
 const storage='minimal_series_release_v2',lifetime=900000;
 const saved=L.Storage && L.Storage.get?L.Storage.get(storage,[]):[];
 if(Array.isArray(saved))for(const pair of saved.slice(-80))if(Array.isArray(pair) && typeof pair[0]==='string' && pair[1] && pair[1].details && Date.now()-pair[1].at<lifetime)cache.set(pair[0],pair[1]);
 const cacheKey=data=>(data.source==='minimal_shiki'?'shiki':'tmdb')+':'+data.id+':'+(L.Storage && L.Storage.get?L.Storage.get('language','ru'):'ru');
 function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(L.Storage && L.Storage.set)L.Storage.set(storage,Array.from(cache).filter(([,entry])=>entry.details).slice(-80));},150);}
 function detailsOnly(json){return {id:json.id,number_of_seasons:json.number_of_seasons,seasons:(Array.isArray(json.seasons)?json.seasons:[]).map(s=>({season_number:s.season_number,name:s.name,episode_count:s.episode_count,air_date:s.air_date})),last_episode_to_air:json.last_episode_to_air,next_episode_to_air:json.next_episode_to_air,episode_run_time:json.episode_run_time};}
 function paint(node){
  const data=cards.get(node);if(!data || !node.matches('.focus,.hover,.pt-card-pointer'))return;
  const view=node.querySelector('.card__view');if(!view)return;
  const series=data.media_type!=='movie' && !!(data.name || data.original_name || data.first_air_date || data.media_type==='tv');
  const key=cacheKey(data),entry=cache.get(key),fresh=entry && Date.now()-entry.at<(entry.details?lifetime:60000),facts=fresh?entry.value:null;
  const details=fresh && entry.details,historyData=details?{...data,last_episode_to_air:details.last_episode_to_air || data.last_episode_to_air,next_episode_to_air:details.next_episode_to_air,episode_run_time:details.episode_run_time || data.episode_run_time,number_of_seasons:details.number_of_seasons || data.number_of_seasons,seasons:Array.from(new Map([...(Array.isArray(data.seasons)?data.seasons:[]),...(Array.isArray(details.seasons)?details.seasons:[])].map(season=>[Number(season.season_number),season])).values())}:data;
  const fetchable=series && (!data.source || ['cub','tmdb','trakt'].includes(data.source)) && Number(data.id)>0;
  const state=window.LampaView && window.LampaView.online,last=series && state && state.lastWatched?state.lastWatched(historyData):null;
  const season=last && (Array.isArray(historyData.seasons)?historyData.seasons:[]).find(s=>Number(s.season_number)===last.season);
  const known=Number(season && season.episode_count)>0 && releaseStatus(historyData,L.TimeTable && L.TimeTable.get?L.TimeTable.get(historyData) || []:[]);
  // A completed episode may become a completed season once metadata arrives.
  // Reserve the footer while that fact is unknown, instead of flashing a false
  // intermediate episode caption. Partial episodes are immediately usable.
  if(fetchable && !fresh && last && last.percent>=95 && !known){
   const slot=node.querySelector('.pt-card-watch'),wrap=node.querySelector('.card-watched');
   if(slot){slot.classList.remove('pt-card-watch--has-progress');if(wrap && wrap.parentNode!==slot)slot.appendChild(wrap);}
  }else watchFooter(L,node,historyData,series);
  if(!series)return;
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  const available=facts || releaseStatus(data,table);
  let box=view.querySelector('.pt-series-status');
  if(available){
   if(!box){box=document.createElement('div');box.className='pt-series-status';box.innerHTML='<span></span><span></span>';view.appendChild(box);}
   const partial=available.total>available.count;
   const released=partial?available.count+'/'+available.total:String(available.count);
   const seasonName=namedSeason(historyData,available.season) || lampaViewText("Сезон {0}",[available.season]);
   const text=seasonName+" • "+(partial?lampaViewText("Серия "):lampaViewText("Серий "))+released;
   if(box.textContent!==text){box.firstElementChild.textContent=seasonName+" • ";box.lastElementChild.textContent=(partial?lampaViewText("Серия "):lampaViewText("Серий "))+released;}
   box.title=lampaViewText("Сезон {0}: вышло {1}. История просмотра — под обложкой.", [available.season,released]).replace(lampaViewText("Сезон {0}",[available.season]),seasonName);
  }else if(box)box.remove();
  // Release metadata stays independent of the native watch timeline below the cover.
  if(!fresh && !pending.has(key) && fetchable && queue.length<8){const task={key,data,nodes:new Set([node])};pending.set(key,task);queue.push(task);pump();}
  else if(pending.has(key))pending.get(key).nodes.add(node);
 }
 function pump(){
  while(running<(document.body.classList.contains('pt-tv')?1:2) && queue.length){const task=queue.shift();running++;let done=false;
   const finish=json=>{if(done)return;done=true;running--;pending.delete(task.key);const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(task.data) || []:[];cache.set(task.key,{at:Date.now(),details:json && Number(json.id)===Number(task.data.id)?detailsOnly(json):null,value:releaseStatus(json && Number(json.id)===Number(task.data.id)?json:task.data,table)});if(cache.size>80)cache.delete(cache.keys().next().value);save();for(const node of task.nodes)if(node.isConnected && node.matches('.focus,.hover,.pt-card-pointer'))schedule(node);pump();};
   tmdbGet(L,'tv/'+task.data.id,{},finish,()=>finish(null),{life:60});
  }
 }
 // Native timeline writes update progress directly. Only the focused card
 // needs its history caption refreshed by the batched badge queue.
 if(L.Listener && L.Listener.follow)L.Listener.follow('state:changed',event=>{
  if(event.target==='timeline' || event.target==='favorite')for(const node of document.querySelectorAll('.card.focus,.card.hover,.card.pt-card-pointer'))if(cards.has(node))schedule(node);
 });
 return {track(node,data){
  cards.set(node,data);
  if(!node.querySelector('.pt-card-watch')){const slot=document.createElement('div');slot.className='pt-card-watch';node.appendChild(slot);}
 },paint};
}
