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
// Metadata is requested only for a focused series, with bounded shared cache.
// Native timetable data and native watch history remain authoritative.
export default function seriesStatus(L,schedule){
 const cards=new WeakMap(),cache=new Map(),pending=new Map(),queue=[];let running=0;
 function paint(node){
  const data=cards.get(node);if(!data || !node.matches('.focus,.hover'))return;
  const view=node.querySelector('.card__view');if(!view)return;
  const series=data.media_type!=='movie' && !!(data.name || data.original_name || data.first_air_date || data.media_type==='tv');
  if(!series)return;
  const key=String(data.id),entry=cache.get(key),fresh=entry && Date.now()-entry.at<(entry.value?900000:60000),facts=fresh?entry.value:null;
  const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  const available=facts || releaseStatus(data,table);
  let box=view.querySelector('.pt-series-status');
  if(available){
   if(!box){box=document.createElement('div');box.className='pt-series-status';box.innerHTML='<span class="pt-series-status__season"></span><span class="pt-series-status__released"></span>';view.appendChild(box);}
   const season='Сезон '+available.season,released=available.count+(available.total>available.count?' из '+available.total:' серий');
   if(box.firstElementChild.textContent!==season)box.firstElementChild.textContent=season;
   if(box.lastElementChild.textContent!==released)box.lastElementChild.textContent=released;
   box.title='Вышедшие серии: сезон '+available.season+', '+released+'. История просмотра показана отдельно в штатном таймкоде.';
  }else if(box)box.remove();
  // Do not replace, copy or hide the native timeline and watch-history overlay.
  if(!fresh && !pending.has(key) && (!data.source || ['cub','tmdb','trakt'].includes(data.source)) && Number(data.id)>0 && queue.length<8){const task={key,data,nodes:new Set([node])};pending.set(key,task);queue.push(task);pump();}
  else if(pending.has(key))pending.get(key).nodes.add(node);
 }
 function pump(){
  while(running<(document.body.classList.contains('pt-tv')?1:2) && queue.length){const task=queue.shift();running++;let done=false;
   const finish=json=>{if(done)return;done=true;running--;pending.delete(task.key);const table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(task.data) || []:[];cache.set(task.key,{at:Date.now(),value:releaseStatus(json && Number(json.id)===Number(task.data.id)?json:task.data,table)});if(cache.size>80)cache.delete(cache.keys().next().value);for(const node of task.nodes)if(node.isConnected && node.matches('.focus,.hover'))schedule(node);pump();};
   tmdbGet(L,'tv/'+task.data.id,{},finish,()=>finish(null),{life:60});
  }
 }
 return {track(node,data){cards.set(node,data);},paint};
}
