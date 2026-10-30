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
 function remembered(data){
  const key=L.Utils.hash(data.original_title || data.original_name || data.title || data.name || '');
  const all=L.Storage.get('online_watched_last',{}) || {},last=all[key];
  if(last && Number(last.episode)>0)return {season:Number(last.season)||0,episode:Number(last.episode)};
  return null;
 }
 function paint(node){
  const data=cards.get(node);if(!data || !node.matches('.focus,.hover'))return;
  const view=node.querySelector('.card__view');if(!view)return;
  const series=data.media_type!=='movie' && !!(data.name || data.original_name || data.first_air_date || data.media_type==='tv');
  const native=view.querySelector('.card-watched');
  if(!series){if(native)for(const text of native.querySelectorAll('.card-watched__item>span')){const label=episodeLabel(text.innerText || text.textContent);if(text.textContent!==label)text.textContent=label;}return;}
  const key=String(data.id),entry=cache.get(key),fresh=entry && Date.now()-entry.at<(entry.value?900000:60000),facts=fresh?entry.value:null;
  let last=remembered(data);
  // Timeline aliases are shared with the online player; never infer a season
  // from a generic episode name or from another show's ID.
  const state=window.LampaView && window.LampaView.online,reader=state && state.reader?state.reader(data):null,table=L.TimeTable && L.TimeTable.get?L.TimeTable.get(data) || []:[];
  if(reader){let latest=null;for(const ep of table){const record=reader(ep.season_number,ep.episode_number);if((record.percent || record.time) && (!latest || record.updated>latest.updated || record.updated===latest.updated && (ep.season_number>latest.season || ep.season_number===latest.season && ep.episode_number>latest.episode)))latest={season:ep.season_number,episode:ep.episode_number,updated:record.updated};}if(latest)last=latest;}
  let label=last?(last.season?'Сезон '+last.season+' · ':'')+'Серия '+last.episode:'';
  if(!label && native){const text=native.querySelector('.card-watched__item>span');if(text)label=episodeLabel(text.innerText || text.textContent);}
  const available=facts || releaseStatus(data,table);
  if(!label && available)label='Сезон '+available.season+' · '+available.count+' серий';
  if(label){
   let box=view.querySelector('.pt-series-status');if(!box){box=document.createElement('div');box.className='pt-series-status';box.innerHTML='<span class="pt-series-status__episode"></span><span class="pt-series-status__released"></span>';view.appendChild(box);}
   const caption=box.firstElementChild;if(caption.textContent!==label)caption.textContent=label;
   const released=last && available?'Вышло '+available.count+(available.total>available.count?' из '+available.total:'')+' · сезон '+available.season:'';
   const releaseLine=box.querySelector('.pt-series-status__released');if(releaseLine.textContent!==released)releaseLine.textContent=released;releaseLine.hidden=!released;
   const progress=native && native.querySelector('.time-line');let bar=box.querySelector('.time-line');
   if(progress){const width=progress.firstElementChild && progress.firstElementChild.style.width || '0%';if(!bar){bar=document.createElement('div');bar.className='time-line';bar.innerHTML='<div></div>';box.appendChild(bar);}if(bar.firstElementChild.style.width!==width)bar.firstElementChild.style.width=width;}
   if(!progress && bar)bar.remove();
   box.title=(last?'Последняя серия в истории просмотра. ':'')+(available?'В текущем сезоне вышло '+available.count+' серий.':'');node.classList.add('pt-has-series-status');
  }
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
