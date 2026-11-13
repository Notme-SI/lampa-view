import {text as lampaViewText} from './i18n.js';
import {isAnime} from './metadata.js';
import cardInfo,{releaseYear} from './card-info.js';
import {seriesName} from './shikimori-match.js';
import {animeReleaseMatches,qualityCacheKey} from './anime-release.js';
import onlineQuality,{qualityLabel} from './online-quality.js';
import cacheControl from './cache-control.js';
import badgeLayout from './badge-layout.js';
import flag from './storage-flag.js';
import seriesStatus from './series-status.js';
import posterSelection from './poster-selection.js';
import {activeCard,scrollingCard,preparingCard,observeCard,forgetCard} from './card-activity.js';
// Visible cards only, two requests at a time, bounded cache; use the user's parser.
export default function quality(L,$,preparePoster){
  const info=cardInfo(L),hydrating=new WeakSet(),status=seriesStatus(L,node=>badges.schedule(node)),badges=badgeLayout(status);
  const cache=new Map(),pending=new Map(),queue=[],tracked=new Map(),nodes=new WeakMap(),visible=new Set(),deferred=new Set(),releases=new Map(),overflow=new Set(),retries=new Set(),remembered=new WeakSet();let running=0,timer,saveTimer,generation=0;
  const storage='minimal_quality_v2',valid=entry=>entry && Date.now()-entry.time<(entry.q?21600000:120000);
  const saved=L.Storage && L.Storage.get(storage,[]);if(Array.isArray(saved))saved.slice(-400).forEach(pair=>{if(Array.isArray(pair) && typeof pair[0]==='string' && valid(pair[1]))cache.set(pair[0],pair[1]);});
  const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(L.Storage && L.Storage.set)L.Storage.set(storage,Array.from(cache.entries()));},250);};
  const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      const item=tracked.get(target);if(!item)continue;
      if(isIntersecting && activeCard(target)){
        visible.add(target);badges.track(target);schedule(item);
      }else{
        visible.delete(target);badges.forget(target);
      }
    }
  },{rootMargin:Math.min(1200,Math.max(600,window.innerHeight || 540))+'px'}):null;
  function track(item,node){
    if(tracked.has(node))return;
    preparePoster?.(node,item.data);
    tracked.set(node,item);nodes.set(item,node);observeCard(node);
    if(typeof $==='function')$(node).on('hover:focus.lampaViewQuality hover:hover.lampaViewQuality hover:touch.lampaViewQuality',()=>schedule(item));
    if(observer)observer.observe(node);else badges.track(node);
  }
  function forget(item){
    deferred.delete(item);releases.delete(item);overflow.delete(item);
    const node=nodes.get(item);if(!node)return;
    if(observer)observer.unobserve(node);visible.delete(node);badges.forget(node);forgetCard(node);
    if(typeof $==='function')$(node).off('.lampaViewQuality');tracked.delete(node);nodes.delete(item);
  }
  function revisit(){
    if(observer){for(const node of visible){const item=tracked.get(node);if(item && node.isConnected)deferred.add(item);}}
    else for(const [node,item] of tracked)if(node.isConnected)deferred.add(item);
    if(!timer && deferred.size && !document.body.classList.contains('pt-tv-busy'))timer=setTimeout(flush,100);
  }
  const norm=s=>String(s || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]/g,'');
  const label=qualityLabel;
  function paintCaption(node,data){
    const title=node.querySelector('.card__title'),text=data.title || data.name || '';
    if(title && text && title.textContent!==text)title.textContent=text;
    const year=releaseYear(data);if(!year || !title)return title;
    let age=node.querySelector('.card__age');
    if(!age){age=document.createElement('div');age.className='card__age';}
    // Late metadata belongs before the reserved watch footer, not after it.
    if(age.parentNode!==title.parentNode || age.previousElementSibling!==title)title.parentNode.insertBefore(age,title.nextSibling);
    if(age.textContent!==year)age.textContent=year;
    return title;
  }
  function measureCaption(title,clamp){
    return title && clamp?Math.ceil(parseFloat(window.getComputedStyle(title).fontSize)*1.4):0;
  }
  function sizeCaption(title,line){
    if(!title)return;
    const value=line>0?line+'px':'';
    if(title.style.getPropertyValue('--pt-caption-line')!==value){
      if(value)title.style.setProperty('--pt-caption-line',value);
      else title.style.removeProperty('--pt-caption-line');
    }
  }
  function paint(node,q){
    if(!q || !activeCard(node))return;
    if(scrollingCard(node) && !preparingCard(node)){const item=tracked.get(node);if(item)schedule(item);return;}
    const view=node.querySelector('.card__view');if(!view)return;
    // Native quality may be rendered before or after our asynchronous result.
    // Claim the slot so CSS also suppresses native badges inserted later.
    node.classList.toggle('pt-has-quality',true);
    let badge=view.querySelector('.pt-quality');
    if(!badge){badge=document.createElement('span');badge.className='pt-quality';view.appendChild(badge);}
    if(badge.textContent!==q)badge.textContent=q;
    const title=lampaViewText("Качество доступного релиза");if(badge.title!==title)badge.title=title;
    badges.schedule(node);
  }
  const readyCard=node=>activeCard(node) && (!document.body.matches('.pt-wheel-active,.pt-tv-busy') && !scrollingCard(node) || preparingCard(node));
  function drain(){
    while(running<(document.body.classList.contains('pt-tv')?1:2) && queue.length){
      const index=queue.findIndex(job=>job.nodes.some(readyCard) || !job.nodes.some(activeCard));
      if(index<0)return;
      const job=queue.splice(index,1)[0];if(!job.nodes.some(activeCard)){pending.delete(job.key);continue;}
      running++;let attempts=0,expanded=false;const tried=new Set();
      let finished=false,fallbackStarted=false;
      const finish=q=>{
        if(finished || job.generation!==generation)return;
        finished=true;pending.delete(job.key);running--;
        if(q!==undefined){
          cache.set(job.key,{q,time:Date.now()});save();
          if(cache.size>400)cache.delete(cache.keys().next().value);
          job.nodes.forEach(n=>paint(n,q));
        }
        drain();
        const next=overflow.values().next().value;if(next){overflow.delete(next);schedule(next);}
      };
      const fallback=()=>{if(finished || fallbackStarted || job.generation!==generation)return;if(!job.nodes.some(activeCard))return finish();fallbackStarted=true;if(!flag(L,'minimal_quality_fallback'))return finish('');job.cancel=onlineQuality(job.data,finish);};
      function next(){
       if(finished || job.generation!==generation)return;
       if(!job.nodes.some(activeCard))return finish();
       if(!job.base || attempts>=3)return fallback();
       if(!job.nodes.some(readyCard)){retries.add(next);return;}
       const names=info.names(job.data),variants=names.concat(job.tv && job.data.source==='minimal_shiki'?names.map(seriesName):[]);
       const query=variants.find(name=>norm(name).length>=3 && !tried.has(norm(name)));
       if(!query){if(expanded)return fallback();expanded=true;return info.fetch(job.data,()=>next());}
       tried.add(norm(query));attempts++;
       const request=new L.Reguest();job.request=request;request.timeout(4500);
       const url=job.base+'/api/v2.0/indexers/all/results?apikey='+job.apiKey+'&title='+encodeURIComponent(query)+(!job.tv && job.year?'&year='+job.year:'');
       request.silent(url,json=>{
        const list=json && (json.Results || json.results) || [],names=variants.map(norm).filter(v=>v.length>=3);
        if(job.generation!==generation)return;const rank={'CAM':1,'TS':2,'SD':3,'WEBRip':4,'BDRip':5,'WEB-DL':6,'720p':7,'1080p':8,'4K':9};let best='';
        list.forEach(release=>{
          const title=release.Title || release.title || '',compact=norm(title);
          if(isAnime(job.data) && !animeReleaseMatches(job.data,title,variants,job.tv))return;
          if(!names.some(name=>compact.indexOf(name)>=0))return;
          const years=title.match(/\b(?:19|20)\d{2}\b/g) || [];
          if(job.year && !job.tv && years.indexOf(job.year)<0)return;
          if(job.tv && years.length && !years.some(y=>Number(y)>=Number(job.year || 1870) && Number(y)<=new Date().getFullYear()))return;
          const details=release.info || release.Info || {},q=label(title+' '+(details.quality || details.resolution || ''));
          if((rank[q] || 0)>(rank[best] || 0))best=q;
        });if(best)return finish(best);
        // Enrich aliases only after the first name fails, and keep at most
        // three parser queries. Never infer a release quality from its poster.
        if(!expanded){expanded=true;return info.fetch(job.data,()=>next());}
        next();
       },fallback);
      }
      next();
    }
  }
  function inspect(item){
    const raw=item.data || {};
    const data=info.read(raw),render=item.render && item.render(true),node=render && (render.nodeType?render:render[0]);
    if(!activeCard(node) || !node.classList.contains('card') || (!data.title && !data.original_title && !data.name && !data.original_name))return;
    info.remember(raw);
    node._minimalCardData=data;track(item,node);status.track(node,data);
    const title=paintCaption(node,data);
    posterSelection(node);
    const tv=data.media_type==='movie'?false:data.media_type==='tv' || !!data.original_name || !!data.first_air_date || node.classList.contains('card--tv');
    const anime=isAnime(data);
    // Some native history/continue cards omit the rating module even though
    // their data still contains the score. Reuse that score without duplicates.
    const vote=Number(data.cub_hundred_rating || data.vote_average);
    if(Number.isFinite(vote) && vote>0 && vote<=10){
      const view=node.querySelector('.card__view');
      if(view && !view.querySelector('.card__vote')){const rating=document.createElement('div');rating.className='card__vote';rating.textContent=vote===10?'10':vote.toFixed(1);view.appendChild(rating);}
    }
    {
      const view=node.querySelector('.card__view');
      const animation=[...(data.genre_ids || []),...(data.genres || [])].some(g=>Number(g.id || g)===16);
      if(view){
       const rating=view.querySelector('.card__vote'),source=data.source==='minimal_shiki'?'Shikimori':data.cub_hundred_rating?'CUB':data.minimal_trakt?'Trakt':'TMDB';
       if(rating && rating.dataset.ratingSource!==source)rating.dataset.ratingSource=source;
       let badge=view.querySelector('.pt-kind');if(!badge){badge=document.createElement('span');badge.className='pt-kind';view.appendChild(badge);}const text=lampaViewText(anime?'Аниме':animation?(tv?'Мультсериал':'Мультфильм'):tv?'Сериал':'Фильм');if(badge.textContent!==text)badge.textContent=text;
      }
    }
    if(!observer || visible.has(node))badges.schedule(node);
    releases.set(item,{item,data,node,tv,title});
  }
  function inView(node){
    if(!activeCard(node))return false;
    const rect=node.getBoundingClientRect();
    return !(rect.width===0 || rect.bottom< -1200 || rect.top>ROOTHEIGHT()+1200 || rect.right< -200 || rect.left>window.innerWidth+200);
  }
  function inspectRelease(item,data,node,tv){
    if(!hydrating.has(node) && (info.incomplete(data) || node.matches('.focus,.hover,.pt-card-pointer'))){hydrating.add(node);info.fetch(data,result=>{if(result && node.isConnected)schedule(item);},()=>node.isConnected);}
    const native=label(data.quality || data.release_quality);if(native){paint(node,native);return;}
    const nativeNode=node.querySelector('.card__quality'),nativeLabel=nativeNode && label(nativeNode.textContent);
    if(nativeLabel){paint(node,nativeLabel);return;}
    const year=String(data.first_air_date || data.release_date || '').slice(0,4),key=qualityCacheKey(data,tv);
    const saved=cache.get(key);if(valid(saved)){paint(node,saved.q);return;}
    if(pending.has(key)){const job=pending.get(key);if(job.nodes.indexOf(node)<0)job.nodes.push(node);return;}
    if(!L.Reguest)return;
    if(queue.length>=40){overflow.add(item);return;}
    const configured=String(L.Storage.get('jackett_url','') || '').trim();if(!configured && !(window.alc_auto_api && window.alc_auto_api.metadataQuality))return;let base=configured;if(base && !/^https?:\/\//i.test(base))base='http://'+base;
    const job={key,data,year,base:base.replace(/\/$/,''),apiKey:encodeURIComponent(L.Storage.get('jackett_key','') || ''),tv,nodes:[node],generation};pending.set(key,job);queue.push(job);drain();
  }
  function ROOTHEIGHT(){return window.innerHeight || 1080;}
  // Postpone layout reads and new parser requests until pointer scrolling settles.
  function schedule(item){
    deferred.add(item);
    if(!timer && !document.body.classList.contains('pt-tv-busy'))timer=setTimeout(flush,0);
  }
  // Grids do not emit line events. Use the native card lifecycle so pagination,
  // remote navigation and touch all receive the same badges as home rows.
  if(L.Utils && L.Utils.createInstance && L.Maker && L.Maker.get){
    const create=L.Utils.createInstance,Card=L.Maker.get('Card',{});
    L.Utils.createInstance=function(Base,data){
      const item=create.apply(this,arguments);
      if(Base===Card && item && item.use){
        item.use({onCreate(){schedule(item);},onVisible(){schedule(item);},onFocus(){schedule(item);},onHover(){schedule(item);},onDestroy(){forget(item);}});
        schedule(item);
      }
      return item;
    };
  }
  // Native category_full/history still use the deprecated Card constructor
  // internally. Its public DOM card_data is also used by third-party sources.
  // Observe added cards only; avoid scanning the document on every scroll.
  function legacy(root){
    if(root.nodeType!==1)return;
    const nodes=root.matches('.card')?[root]:Array.from(root.querySelectorAll('.card'));
    nodes.forEach(node=>{if(node.card_data && !tracked.has(node)){const item={data:node.card_data,render:()=>node};track(item,node);schedule(item);}});
  }
  if(window.MutationObserver){
    new window.MutationObserver(records=>{
      for(const record of records){
        if(record.target.nodeType!==1 || record.target.closest('.nova-plus-root'))continue;
        const card=record.target.closest('.card');
        if(card){
          const tags='.card__view,.card__vote,.card__quality,.card__marker,.card__new-episode,.card__icons,.card__icons-inner,.card__icon';
          if(tracked.has(card) && (!observer || visible.has(card)) && (record.target.matches(tags) || [...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1 && node.matches(tags))))badges.schedule(card);
          continue;
        }
        record.addedNodes.forEach(legacy);
        for(const root of record.removedNodes)if(root.nodeType===1){
          const removed=root.matches('.card')?[root]:root.querySelectorAll('.card');
          for(const node of removed)if(!node.isConnected && tracked.has(node))forget(tracked.get(node));
        }
      }
    }).observe(document.body,{childList:true,subtree:true});
    legacy(document.body);
  }
  function flush(){
    clearTimeout(timer);timer=null;
    if(document.body.classList.contains('pt-tv-busy') || document.hidden)return;
    const moving=document.body.classList.contains('pt-wheel-active');
    if(moving && !document.body.classList.contains('pt-desktop'))return;
    // Make basic captions available ahead of the viewport in small groups.
    // Geometry reads and parser work resume after the desktop gesture ends.
    let count=0;
    for(const item of deferred){deferred.delete(item);inspect(item);if(++count>=(moving?4:6))break;}
    {
      const waiting=Array.from(retries);retries.clear();waiting.forEach(next=>next());
      const clamp=document.body.matches('.pt-tv.pt-tv-caption-flow'),checks=[];
      for(const [item,check] of releases){
        if(!activeCard(check.node)){releases.delete(item);continue;}
        if((moving || scrollingCard(check.node)) && !preparingCard(check.node))continue;
        releases.delete(item);
        const line=measureCaption(check.title,clamp && !check.node.closest('.pt-browser-catalogue')),near=inView(check.node);
        checks.push({...check,line,near});
        if(checks.length>=6)break;
      }
      for(const {item,data,node,tv,title,line,near} of checks){
        if(!node.closest('.pt-browser-catalogue'))sizeCaption(title,line);
        if(near)inspectRelease(item,data,node,tv);
      }
      drain();
    }
    if(deferred.size || !moving && [...releases.values()].some(check=>!scrollingCard(check.node)))timer=setTimeout(flush,moving?32:16);
  }
  L.Listener.follow('line',event=>{
    if(!event || !['append','visible','toggle'].includes(event.type))return;
    for(const card of (event.data || {}).results || []){
      if(card && typeof card==='object' && !remembered.has(card)){remembered.add(card);info.remember(card);}
    }
    (event.items || []).forEach(schedule);
  });
  document.addEventListener('minimal:wheel-idle',()=>{if(!observer)revisit();flush();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush();});
  // Focus/visibility events already queued the cards that actually changed.
  // A remote pause is not a reason to re-annotate every visible poster.
  document.addEventListener('minimal:tv-idle',flush);
  document.addEventListener('minimal:catalogue-idle',flush);
  // Native visibility fires once, sometimes before a grid is attached. Keep
  // observing cards as pointer scrolling and pagination bring them into view.
  // IntersectionObserver already follows viewport changes, including transforms.
  // Button transitions and remote focus must not rescan every cached row.
  if(!observer){document.addEventListener('scroll',revisit,true);document.addEventListener('transitionend',event=>{if(event.target.matches && event.target.matches('.scroll__body'))revisit();},true);}
  // Mouse entry is independent of Lampa's focus controller and non-bubbling custom events.
  document.addEventListener('mouseover',event=>{const node=event.target.closest && event.target.closest('.card');if(!node || scrollingCard(node) || event.relatedTarget && node.contains(event.relatedTarget))return;node.classList.add('pt-card-pointer');legacy(node);const item=tracked.get(node);if(item)schedule(item);},true);
  document.addEventListener('mouseout',event=>{const node=event.target.closest && event.target.closest('.card');if(node && !(event.relatedTarget && node.contains(event.relatedTarget)))node.classList.remove('pt-card-pointer');},true);
  // Lampa sends these custom events through jQuery.trigger, not dispatchEvent.
  // Delegation also covers legacy/history cards without a Maker onFocus hook.
  if(typeof $==='function')$(document).on('hover:focus.lampaViewQuality hover:hover.lampaViewQuality hover:touch.lampaViewQuality','.card',function(){const item=tracked.get(this);if(item)schedule(item);});
  const captionCard=target=>document.body.matches('.lampa_view.pt-touch-captions') &&
    target.closest?.('.card__title,.card__age')?.closest('.card');
  let captionTouch,captionClick;
  function revealCaption(card){
    const open=card && !card.classList.contains('pt-card-touch');
    for(const previous of document.querySelectorAll('.card.pt-card-touch'))previous.classList.remove('pt-card-touch');
    if(open){card.classList.add('pt-card-touch');legacy(card);const item=tracked.get(card);if(item)schedule(item);}
  }
  document.addEventListener('touchstart',event=>{
    captionClick=null;
    const card=captionCard(event.target),touch=event.changedTouches[0];
    captionTouch=card && event.touches.length===1 && touch ?
      {card,id:touch.identifier,x:touch.clientX,y:touch.clientY,start:Date.now(),moved:false}:null;
  },{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{
    const touch=captionTouch && Array.from(event.touches).find(t=>t.identifier===captionTouch.id);
    if(touch && Math.hypot(touch.clientX-captionTouch.x,touch.clientY-captionTouch.y)>10)captionTouch.moved=true;
  },{capture:true,passive:true});
  document.addEventListener('touchcancel',()=>{captionTouch=null;captionClick=null;},true);
  document.addEventListener('touchend',event=>{
    const gesture=captionTouch,touch=gesture && Array.from(event.changedTouches).find(t=>t.identifier===gesture.id);
    if(!touch)return;
    captionTouch=null;
    if(!gesture.card.isConnected)return;
    // The compatibility click can be retargeted to the poster after a scroll
    // or layout change. The next physical touch starts an independent action.
    captionClick={card:gesture.card,x:touch.clientX,y:touch.clientY,until:Date.now()+650};
    if(event.cancelable)event.preventDefault();
    const hit=document.elementFromPoint(touch.clientX,touch.clientY);
    if(!gesture.moved && Math.hypot(touch.clientX-gesture.x,touch.clientY-gesture.y)<=10 &&
       Date.now()-gesture.start<700 && hit && captionCard(hit)===gesture.card)revealCaption(gesture.card);
  },{capture:true,passive:false});
  window.addEventListener('click',event=>{
    const touch=event.pointerType==='touch' || event.sourceCapabilities?.firesTouchEvents;
    const card=touch && captionCard(event.target),guard=captionClick && Date.now()<captionClick.until;
    if(guard && (event.target.closest?.('.card')===captionClick.card ||
      event.detail && Math.hypot(event.clientX-captionClick.x,event.clientY-captionClick.y)<18)){
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    revealCaption(card);
    if(card){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  window.addEventListener('resize',revisit);
  document.addEventListener('minimal:interface-size',revisit);
  cacheControl(L).register('quality',()=>{generation++;clearTimeout(saveTimer);pending.forEach(job=>{if(job.cancel)job.cancel();if(job.request && job.request.clear)job.request.clear();});cache.clear();pending.clear();queue.length=0;overflow.clear();retries.clear();running=0;if(L.Storage && L.Storage.set)L.Storage.set(storage,[]);for(const [node] of tracked){node.querySelectorAll('.pt-quality').forEach(b=>b.remove());node.classList.remove('pt-has-quality');}revisit();});
}
