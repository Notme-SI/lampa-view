import flag from './storage-flag.js';
import {WATCHED_PERCENT} from './watch-threshold.js';
import {text as t} from './i18n.js';

// Distribution marks belong to native CUB storage; episode positions belong to
// Timeline. A shared episode must never mark every release of a title watched.
export default function torrentHistory(L,root=window){
 const Native=L.Component?.get?.('torrents');if(typeof Native!=='function')return;
 const rows=new Map(),files=new Set(),footers=new WeakMap();let timer;
 const enabled=()=>flag(L,'lampa_view_enabled');
 const saved=()=>{const list=L.Storage.get('torrents_view',[]);return Array.isArray(list)?list:[];};
 function keys(row){
  const C=root.TorrentCatalogueCore,canonical=C?.infoHash(row.MagnetUri || row.Link);
  const native=[row.hash,...(row._tcTitles || []).map(title=>L.Utils.hash(title))].filter(value=>value!==undefined && value!==null);
  return {canonical:canonical?'btih:'+canonical:'',native,aliases:[...new Set(native.map(String))]};
 }
 function write(row,add){
  const {canonical,aliases,native}=keys(row);if(!canonical)return;
  const previous=saved(),removed=canonical+':unseen',all=new Set([...aliases,canonical,removed]),next=previous.filter(value=>!all.has(String(value)));
  if(add)next.push(...new Set([...native,canonical]));
  else next.push(removed);
  if(JSON.stringify(next)!==JSON.stringify(previous))L.Storage.set('torrents_view',next);
  for(const value of previous)if(add?String(value)===removed:all.has(String(value)) && String(value)!==removed)L.Storage.remove('torrents_view',value);
 }
 function markRows(){
  const previous=saved(),marks=new Set(previous.map(String)),migrated=[];
  for(const [item,row]of rows){
   if(!item.isConnected){rows.delete(item);continue;}
   const {canonical,aliases}=keys(row),viewed=!(canonical && marks.has(canonical+':unseen')) && Boolean(canonical && marks.has(canonical) || aliases.some(key=>marks.has(key)));
   row.viewed=viewed;
   const existing=item.querySelector('.torrent-item__viewed');
   if(viewed && !existing){const icon=L.Template.get('icon_viewed',{},true),target=item.querySelector('.tc-head') || item;root.jQuery('<div class="torrent-item__viewed"></div>').html(icon).appendTo(target);}
   else if(!viewed && existing)existing.remove();
   // Migrate a verified native title alias to its actual infohash. This also
   // lets another tracker name for the same distribution recover the mark.
   if(viewed && canonical && !marks.has(canonical)){marks.add(canonical);migrated.push(canonical);}
  }
  if(migrated.length)L.Storage.set('torrents_view',previous.concat(migrated));
 }
 function fileProgress(){
  for(const line of files){
   if(!line.isConnected){files.delete(line);continue;}
   const hash=line.getAttribute('data-hash');
   line.classList.toggle('pt-torrent-complete',Boolean(hash && L.Timeline.view(hash).percent>=WATCHED_PERCENT));
  }
 }
 function history(){
  const active=L.Activity.active();if(active?.component!=='torrents')return;
  const rendered=active.activity?.render(),node=rendered?.nodeType?rendered:rendered?.[0],body=node?.querySelector('.watched-history__body'),online=root.LampaView?.online;
  if(!body || !online)return;
  const empty=L.Lang.translate('no_watch_history'),previous=footers.get(body);
  if(body.textContent.trim()!==empty && body.textContent!==previous)return;
  const card=active.movie || active.card || {},serial=card.original_name || card.name || card.media_type==='tv';
  const last=serial?online.lastWatched(card):online.reader(card)(0,0);
  const labels=[];
  if(last && (last.percent || last.time)){
   if(serial){labels.push(t('Сезон {0}',[last.season]),t('Серия {0}',[last.episode]));}
   else if(last.percent>=WATCHED_PERCENT)labels.push(t('Фильм просмотрен'));
   if(Number(last.time)>0){const seconds=Math.floor(last.time),minutes=Math.floor(seconds/60);labels.push(minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'):String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));}
  }
  const values=labels.length?labels:[empty];body.textContent='';
  for(const text of values){const span=root.document.createElement('span');span.textContent=text;body.appendChild(span);}
  footers.set(body,body.textContent);
 }
 function refresh(){timer=null;if(!enabled())return;markRows();fileProgress();history();}
 function schedule(){if(!timer)timer=setTimeout(refresh,0);}
 function Component(object){
  const comp=new Native(object),mark=comp.mark,append=comp.append,start=comp.start;
  if(typeof mark==='function')comp.mark=function(row,item,add){const result=mark.apply(this,arguments);if(enabled())write(row,add);schedule();return result;};
  // The native event is emitted before insertion. Refresh after append, when
  // all real rows and their grouped tracker metadata are mounted.
  if(typeof append==='function')comp.append=function(){const result=append.apply(this,arguments);schedule();return result;};
  if(typeof start==='function')comp.start=function(){const result=start.apply(this,arguments);schedule();return result;};
  return comp;
 }
 L.Component.add('torrents',Component);
 L.Listener.follow('torrent',event=>{if(event.type==='render'){const node=event.item?.nodeType?event.item:event.item?.[0];if(node){rows.set(node,event.element);schedule();}}});
 L.Listener.follow('torrent_file',event=>{if(event.type==='render'){const node=event.item?.nodeType?event.item:event.item?.[0],line=node?.querySelector('.time-line');if(line){files.add(line);schedule();}}});
 L.Storage.listener?.follow('change',event=>{if(event.name==='torrents_view')schedule();});
 L.Timeline.listener?.follow('update',schedule);L.Timeline.listener?.follow('read',schedule);
 L.Listener.follow('activity',event=>{if(event.type==='start')schedule();});
}
