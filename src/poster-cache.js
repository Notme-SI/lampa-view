// Shared final-size covers are decoded before display; no low-resolution intermediate.
// Decoded memory is bounded. The browser also retains its native HTTP cache.
import imageFiles from './image-files.js';
import catalogueImages from './catalogue-images.js';
export default function posterCache(L,enabled,highQuality){
 if(!L.Maker || !L.Utils)return;
 const files=imageFiles(L);
 const Card=L.Maker.get('Card',{}),create=L.Utils.createInstance,queue=[],cache=new Map(),visibility=new WeakMap();
 // Complete GIF89a, including its palette and pixel data. Apple's image
 // decoder can reject the old truncated placeholder as a broken cover.
 const blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 const decodedCatalogue=catalogueImages(blank);
 let running=0,timer;
 const maximum=()=>enabled();
 const tv=()=>document.body.classList.contains('pt-tv');
 const aheadY=Math.min(1800,Math.max(540,(window.innerHeight || 540)*(tv()?1.5:2))),aheadX=Math.min(1920,Math.max(360,(window.innerWidth || 960)*(tv()?.5:1)));
 const paused=()=>document.hidden;
 let gridWidths=new WeakMap(),warmQueue=[],warmRunning=0;
 function catalogueGrid(node,grid=node?.parentElement){
  if(!enabled() || !node?.matches('.card:not(.card--wide):not(.card--collection)') ||
     !grid?.closest('.activity--active') || !document.body.classList.contains('pt-desktop') && !grid.closest('.pt-browser-catalogue'))return null;
  return grid?.matches('.mapping--grid,.category-full')?grid:null;
 }
 function catalogueWidth(grid,image){
  let width=gridWidths.get(grid);
  if(!width){
   width=(image?.parentElement.clientWidth || grid.querySelector('.card__view')?.clientWidth);
   if(width)gridWidths.set(grid,width);
  }
  return width;
 }
 function catalogueSource(image,grid,url){
  if(!/\/t\/p\/w780\//.test(url) || !document.body.classList.contains('pt-desktop'))return url;
  const width=catalogueWidth(grid,image);
  return width && width*(window.devicePixelRatio || 1)<=500?url.replace('/t/p/w780/','/t/p/w500/'):url;
 }
 function warmCataloguePosters(cards,grid,active){
  if(!grid || !enabled() || !active() || document.hidden)return;
  warmQueue=Array.from(new Set(cards.slice(0,10).map(card=>{
   const url=card.poster_path?L.Api.img?.(card.poster_path):card.poster || card.img;
   return url && catalogueSource(null,grid,url);
  }).filter(url=>/^https?:|^\//i.test(url || '')))).map(url=>({url,active}));
  warmNextCover();
 }
 function warmNextCover(){
  while(warmRunning<3 && warmQueue.length){
   const {url,active}=warmQueue.shift();
   if(!enabled() || !active() || document.hidden)continue;
   const image=new Image();image.decoding='async';image.fetchPriority='low';warmRunning++;
   let finished=false;
   const timeout=setTimeout(()=>{
    if(!finished){image.removeAttribute('src');finish();}
   },8000);
   function finish(){
    if(finished)return;
    finished=true;clearTimeout(timeout);image.onload=image.onerror=null;warmRunning--;warmNextCover();
   }
   image.onload=()=>{if(image.decode)image.decode().then(finish,finish);else finish();};
   image.onerror=finish;image.src=url;
  }
 }
 function prepareCataloguePoster(node,data,hint){
  const grid=catalogueGrid(node,hint);
  if(!grid)return;
  const image=node.querySelector('.card__img');
  if(!image)return;
  if(image._minimalCataloguePoster){image._minimalCataloguePoster(grid);return;}
  // Deprecated native Card has no Maker hooks. Start the same URL it will
  // assign on visibility, so its own image state and fallback stay intact.
  if((image.getAttribute('src') && !/img_load\./.test(image.getAttribute('src'))) || !data)return;
  const url=data.poster_path?L.Api.img(data.poster_path):data.poster || data.img;
  if(!url)return;
  image.decoding='async';image.loading='lazy';image.src=url;
 }
 function resetWidths(){gridWidths=new WeakMap();}
 window.addEventListener('resize',resetWidths);
 document.addEventListener('minimal:interface-size',resetWidths);
 const observed=typeof window.IntersectionObserver==='function';
 const nearbyObserver=observed?new window.IntersectionObserver(entries=>{
  for(const entry of entries){
   const state=visibility.get(entry.target);if(!state)continue;
   state.nearby=entry.isIntersecting;
   if(state.nearby)state.enter();
  }
  schedule();
 },{rootMargin:aheadY+'px '+aheadX+'px',scrollMargin:'0px '+aheadX+'px'}):null;
 const screenObserver=observed?new window.IntersectionObserver(entries=>{
  for(const entry of entries){
   const state=visibility.get(entry.target);if(!state)continue;
   state.visible=entry.isIntersecting;
   if(state.visible)state.enter();
  }
  schedule();
 },{threshold:0}):null;
 function readVisibility(job){
  const card=job.card;
  const state=visibility.get(card);
  if(state){
   if(state.visible)return 2;
   if(state.nearby)return 1;
   return state.nearby===undefined || state.visible===undefined ? -1 : 0;
  }
  // Older TV engines fall back to native geometry. Read once per job and pass.
  const {width,height,bottom,top,right,left}=card.getBoundingClientRect();
  if(!tv() && !width && !height)return 2;
  if(width<=0 || bottom<=-aheadY || top>=innerHeight+aheadY || right<=-aheadX || left>=innerWidth+aheadX)return 0;
  return bottom>0 && top<innerHeight && right>0 && left<innerWidth ? 2 : 1;
 }
 // The artwork API already chose the source resolution. Preserve it through decoding.
 function fit(image,url){
  // High on a TV must not be downgraded from its CSS viewport dimensions.
  if(tv() && highQuality())return url.replace(/(\/t\/p\/)w(\d+)(\/)/,(all,prefix,size,suffix)=>Number(size)<780?prefix+'w780'+suffix:all);
  return url;
 }
 function trim(){
  let bytes=0;cache.forEach(entry=>bytes+=entry.bytes || 0);
  for(const [url,entry] of cache){
   if(cache.size<=40 && bytes<=64*1048576)break;
   if(entry.done){cache.delete(url);bytes-=entry.bytes || 0;if(entry.release)entry.release();entry.loader.src='';}
  }
 }
 function schedule(delay){if(!timer && queue.length)timer=setTimeout(drain,typeof delay==='number'?delay:0);}
 function paint(job,priority=readVisibility(job)){
  job.finished=true;if(!job.alive() || priority<=0)return;
  job.paint();
 }
 function drain(){
  timer=null;
  // Cached covers paint immediately. Visible requests take priority over a
  // bounded look-ahead. Movement must not serialize the next row behind one
  // slow cover; visible work still owns the remaining network slots.
  const priorities=new Map(queue.map(job=>[job,job.alive()?readVisibility(job):0]));
  queue.sort((a,b)=>priorities.get(b)-priorities.get(a));
  // Cached and shared in-flight images do not consume another network slot.
  for(let remaining=queue.length;remaining>0;remaining--){
   const job=queue.shift();if(!job.alive()){job.finished=true;continue;}
   const priority=priorities.get(job),visible=priority===2;
   if(priority<0){queue.push(job);continue;}
   if(!priority){job.finished=true;continue;}
   job.url=job.resolve();
   let entry=cache.get(job.url);
   if(entry){
    cache.delete(job.url);cache.set(job.url,entry);
    if(entry.done){paint(job,priority);continue;}
    entry.jobs.add(job);job.entry=entry;continue;
   }
   if(!visible && paused() || running>=(tv()?4:document.body.classList.contains('pt-mobile')?6:8) || !visible && running>=(tv() || document.body.classList.contains('pt-mobile')?2:4)){queue.push(job);continue;}
   const loader=new Image();loader.fetchPriority=visible?'high':'low';loader.decoding='async';
   entry={loader,jobs:new Set([job]),done:false};job.entry=entry;cache.set(job.url,entry);running++;
   let finished=false;
   const finish=ok=>{
    if(finished)return;finished=true;clearTimeout(entry.timeout);loader.onload=loader.onerror=null;running--;entry.abort=null;
    if(ok){entry.done=true;entry.bytes=(loader.naturalWidth || 1)*(loader.naturalHeight || 1)*4;trim();}else{cache.delete(job.url);if(entry.release)entry.release();}
    entry.jobs.forEach(waiting=>{waiting.entry=null;if(ok)paint(waiting);else{waiting.finished=true;if(waiting.alive())waiting.image.src='./img/img_broken.svg';}});entry.jobs.clear();
    schedule(0);
   };
   entry.abort=()=>{finish(false);if(entry.release)entry.release();loader.src='';};
   loader.onload=()=>{if(loader.decode)loader.decode().then(()=>finish(true),()=>finish(true));else finish(true);};
   loader.onerror=()=>{files.invalidate(job.url);finish(false);};
   entry.timeout=setTimeout(()=>entry.abort && entry.abort(),12000);entry.release=files.load(job.url,src=>{loader.src=src;});
  }
 }
 // Native rows scroll both with scroll offsets and translated content. Re-rank
 // waiting covers during navigation, instead of waiting for another download.
 window.addEventListener('scroll',()=>schedule(16),{capture:true,passive:true});
 document.addEventListener('wheel',()=>schedule(16),{passive:true});
 document.addEventListener('keydown',event=>{if(/^(Arrow|Page)/.test(event.key || ''))schedule(16);});
 document.addEventListener('minimal:tv-idle',schedule);
 document.addEventListener('minimal:wheel-idle',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 L.Utils.createInstance=function(Base,data){
  const item=create.apply(this,arguments);if(Base!==Card || !item || !item.use)return item;
  let image,source,original,getPoster,observedCard,disposed=false,generation=0,job,painted,release;
  function unobserve(){
   if(!observedCard)return;
   nearbyObserver.unobserve(observedCard);screenObserver.unobserve(observedCard);
   visibility.delete(observedCard);observedCard=null;
  }
  function cancel(){
   generation++;painted=null;if(release){release();release=null;}
   if(job){
    const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);
    const entry=job.entry;if(entry){entry.jobs.delete(job);if(!entry.done && !entry.jobs.size && entry.abort)entry.abort();}
   }
   job=null;
  }
  function paintSource(url){
   if(release)release();release=files.load(url,src=>{if(!disposed){painted=url;image.src=src;}});
  }
  function enqueue(){
   if(!maximum() || !original || painted===original || image.src===original || job && !job.finished && job.alive())return;
   original=fit(image,source);
   const saved=cache.get(original);
   // A disk hit still reads bytes, creates a blob URL and decodes the poster.
   // On TV it uses the same request budget as a network miss. Memory hits
   // can be displayed immediately.
   if(saved?.done || (tv()?files.peek(original):files.has(original))){paintSource(original);return;}
   const current=generation;
   job={image,card:image.closest('.card') || image,url:original,paint:()=>paintSource(original),resolve:()=>{original=fit(image,source);return original;},alive:()=>!disposed && current===generation && maximum() && image.isConnected};
   if(queue.length>=80)queue.shift().finished=true;queue.push(job);schedule();
  }
  item.use({onCreate(){
   image=item.img;getPoster=item.getPosterPath;if(!image || !getPoster)return;
   image.decoding='async';
   const nativeError=image.onerror;
   image.onerror=function(event){
    // A placeholder is not a TMDB mirror failure. Do not let the native
    // retry path put a data URI diagnostic over a successfully loaded poster.
    if(!disposed && maximum() && source && image.getAttribute('src')===blank){enqueue();return;}
    if(nativeError)return nativeError.call(this,event);
   };
   if(observed){
    observedCard=image.closest('.card') || image;
    visibility.set(observedCard,{enter(){
     if(catalogueGrid(observedCard)){image._minimalCataloguePoster();unobserve();return;}
     if(!original && maximum())item.getPosterPath();
     enqueue();
    }});
    nearbyObserver.observe(observedCard);screenObserver.observe(observedCard);
   }
   item.getPosterPath=function(){
    const url=getPoster.apply(this,arguments);
    const grid=catalogueGrid(image.closest('.card'));
    if(grid){
     if(job || release)cancel();
     unobserve();
     return decodedCatalogue.request(image,catalogueSource(image,grid,url));
    }
    if(!maximum() || !/\/t\/p\/(?:w\d+|original)\//.test(url))return url;
    if(source!==url){cancel();source=url;original=url;}
    enqueue();return painted===original || image.src===original?image.src:blank;
   };
   image._minimalCataloguePoster=hint=>{
    const grid=catalogueGrid(image.closest('.card'),hint);
    if(disposed || !grid)return false;
    const source=getPoster.call(item);
    if(!image.isConnected && /\/t\/p\/w780\//.test(source) && document.body.classList.contains('pt-desktop') && !catalogueWidth(grid,image))return true;
    const url=decodedCatalogue.request(image,catalogueSource(image,grid,source));
    if(image.getAttribute('src')!==url && image.src!==url)image.src=url;
    return true;
   };
   image._minimalArtwork=()=>{
    if(image._minimalCataloguePoster())return true;
    const next=getPoster.call(item);
    if(image.src===next || source===next && (painted===original || image.src===original || job && !job.finished && job.alive()))return true;
    cancel();source=next;
    if(!/\/t\/p\/(?:w\d+|original)\//.test(next))return false;
    if(maximum()){original=next;enqueue();}else image.src=next;
    return true;
   };
   image._minimalCatalogueSuspend=()=>decodedCatalogue.suspend(image);
  },onVisible(){
   if(catalogueGrid(image?.closest('.card'))){
    // Native visibility promotes the card even in a translated scroll pane.
    const nativeGrid=image.closest('.pt-browser-catalogue');
    // The catalogue's IntersectionObserver already selected the upcoming
    // posters. Reading each newly attached image's rect here forces a full
    // layout after every native card's writes just to choose request priority.
    // Eager loading is unchanged; let the browser prioritize viewport images.
    image.fetchPriority=nativeGrid?'auto':'high';image.loading='eager';
    clearTimeout(item.img_timer);
    if(image.complete && image.naturalWidth>1)clearTimeout(item.img_timer);
   }else if(maximum() && original){clearTimeout(item.img_timer);enqueue();}
  },onDestroy(){
   disposed=true;cancel();unobserve();if(image){decodedCatalogue.forget(image);delete image._minimalArtwork;delete image._minimalCataloguePoster;delete image._minimalCatalogueSuspend;}
  }});
  return item;
 };
 return {prepareCataloguePoster,warmCataloguePosters};
}
