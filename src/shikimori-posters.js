const EMPTY='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="#111318"/><rect x="150" y="250" width="100" height="80" rx="12" fill="none" stroke="#535b66" stroke-width="6"/><path d="m187 270 30 20-30 20z" fill="#535b66"/></svg>');
import {artworkQuality} from './artwork.js';
export function missingPoster(url){return !url || /\/assets\/globals\/missing_|\/img_(?:broken|load)\./i.test(url);}
export default function shikimoriPosters(L,shiki){
 const cache=new Map(),pending=new Map(),queue=[],Card=L.Maker.get('Card',{}),create=L.Utils.createInstance;let timer=null,running=false,lastStart=0;
 function schedule(){if(timer!==null || running || !queue.length)return;timer=setTimeout(drain,Math.max(60,750-(Date.now()-lastStart)));}
 function drain(){
  timer=null;const jobs=[];
  while(queue.length && jobs.length<12){const job=queue.shift();job.listeners=job.listeners.filter(listener=>listener.alive());if(job.listeners.length)jobs.push(job);else pending.delete(job.id);}
  if(!jobs.length)return;running=true;lastStart=Date.now();
  function finish(rows){const byId=new Map((rows || []).map(row=>{const p=row.poster || {};return [String(row.id),{urls:Array.from(new Set([p.originalUrl,p.mainUrl,p.previewUrl].filter(Boolean))),variants:{maximum:p.originalUrl || p.mainUrl || p.previewUrl,high:p.mainUrl || p.originalUrl || p.previewUrl,medium:p.previewUrl || p.mainUrl || p.originalUrl}}];}));
   jobs.forEach(job=>{const entry=byId.get(job.id) || {urls:[]};cache.set(job.id,{...entry,time:Date.now()});if(cache.size>200)cache.delete(cache.keys().next().value);pending.delete(job.id);job.listeners.forEach(listener=>{if(listener.alive())listener.paint(entry.urls,entry.variants);});});running=false;schedule();}
  shiki.posters(jobs.map(job=>job.id),finish,()=>finish([]));
 }
 function request(id,listener){
  const saved=cache.get(id);if(saved && Date.now()-saved.time<(saved.urls.length?86400000:300000))return listener.paint(saved.urls,saved.variants);
  cache.delete(id);if(pending.has(id))pending.get(id).listeners.push(listener);else{if(queue.length>=60)return listener.paint([]);const job={id,listeners:[listener]};pending.set(id,job);queue.push(job);schedule();}
 }
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use || !data || data.source!=='minimal_shiki')return item;
  const id=String(data.shikimori_id || data.id);let disposed=false,attempted=false,loading=false,needsRepair=missingPoster(data.img),image,alternatives=[],variants=data.minimalPosterSources,knownUrls=[];
  // Native lazy rows can emit visible before their fragment is attached.
  // Destruction ends the subscription; temporary detachment must not drop it.
  function alive(){return !disposed && !!image;}
  function clear(){clearTimeout(item.img_timer);clearTimeout(item.img_timer_next);}
  function choose(paint=true){
   if(!variants || !variants[artworkQuality(L)])return false;
   if(paint)clear();data.img=variants[artworkQuality(L)];alternatives=knownUrls.filter(url=>url!==data.img);if(paint)image.src=data.img;return true;
  }
  function paint(urls,sources){if(!alive())return;loading=false;clear();variants=sources;knownUrls=urls.slice();if(choose())return;alternatives=urls.slice();data.img=alternatives.shift() || EMPTY;if(data.img===EMPTY)image.onerror=()=>{};image.src=data.img;}
  function repair(){clear();if(attempted || !alive())return;attempted=true;loading=true;request(id,{alive,paint});}
  item.use({onCreate(){
   image=item.img;image._minimalArtwork=choose;knownUrls=variants?Array.from(new Set(Object.values(variants).filter(Boolean))):[];if(needsRepair)data.img=EMPTY;else choose(false);
   image.onerror=()=>{if(disposed)return;clear();if(loading)return;if(alternatives.length){data.img=alternatives.shift();image.src=data.img;}else if(attempted){cache.set(id,{urls:[],time:Date.now()});data.img=EMPTY;image.onerror=()=>{};image.src=EMPTY;}else{needsRepair=true;repair();}};
  },onVisible(){if(needsRepair)repair();},onDestroy(){disposed=true;clear();if(image)delete image._minimalArtwork;}});
  return item;
 };
}
