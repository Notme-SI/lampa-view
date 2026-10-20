import {isAnime} from './metadata.js';
import cardInfo from './card-info.js';
import {seriesName} from './shikimori-match.js';
// Visible cards only, two requests at a time, bounded cache; use the user's parser.
export default function quality(L,$){
  const info=cardInfo(L),hydrating=new WeakSet();
  const cache=new Map(),pending=new Map(),queue=[],tracked=new Map(),deferred=new Set(),retries=new Set();let running=0,timer;
  const observer=typeof window.IntersectionObserver==='function'?new window.IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){const item=tracked.get(entry.target);if(item)schedule(item);}});
  },{rootMargin:'200px'}):null;
  function track(item,node){
    if(tracked.has(node))return;
    tracked.set(node,item);if(observer)observer.observe(node);
  }
  function forget(item){
    deferred.delete(item);
    for(const [node,value] of tracked)if(value===item){if(observer)observer.unobserve(node);tracked.delete(node);}
  }
  function revisit(){
    for(const [node,item] of tracked)if(node.isConnected)deferred.add(item);
    if(!timer && deferred.size && !document.body.classList.contains('pt-tv-busy'))timer=setTimeout(flush,100);
  }
  const norm=s=>String(s || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]/g,'');
  function label(value){
    const s=String(value || '');
    if(/(^|\W)(?:hd)?cam(?:rip)?(\W|$)/i.test(s))return 'CAM';
    if(/(^|\W)(?:hd)?ts(?:rip)?(\W|$)/i.test(s))return 'TS';
    if(/2160|\b4k\b|uhd/i.test(s))return '4K';
    if(/1080|fhd/i.test(s))return '1080p';
    if(/720/i.test(s))return '720p';
    if(/web[ .-]?dl/i.test(s))return 'WEB-DL';
    if(/bd[ .-]?rip|blu[ .-]?ray/i.test(s))return 'BDRip';
    if(/web[ .-]?rip/i.test(s))return 'WEBRip';
    return '';
  }
  function paint(node,q){
    if(!q || !node.isConnected)return;
    const view=node.querySelector('.card__view');if(!view)return;
    // Native quality may be rendered before or after our asynchronous result.
    // Claim the slot so CSS also suppresses native badges inserted later.
    node.classList.add('pt-has-quality');
    let badge=view.querySelector('.pt-quality');
    if(!badge){badge=document.createElement('span');badge.className='pt-quality';view.appendChild(badge);}
    badge.textContent=q;badge.title='Качество доступного релиза';
  }
  function drain(){
    while(!document.body.matches('.pt-wheel-active,.pt-tv-busy') && running<2 && queue.length){
      const job=queue.shift();if(!job.nodes.some(n=>n.isConnected)){pending.delete(job.key);continue;}
      running++;let attempts=0,expanded=false;const tried=new Set();
      const finish=q=>{cache.set(job.key,{q,time:Date.now()});if(cache.size>400)cache.delete(cache.keys().next().value);pending.delete(job.key);job.nodes.forEach(n=>paint(n,q));running--;drain();revisit();};
      function next(){
       if(!job.nodes.some(n=>n.isConnected) || attempts>=3)return finish('');
       if(document.body.matches('.pt-wheel-active,.pt-tv-busy')){retries.add(next);return;}
       const names=info.names(job.data),variants=names.concat(job.tv && job.data.source==='minimal_shiki'?names.map(seriesName):[]);
       const query=variants.find(name=>norm(name).length>=3 && !tried.has(norm(name)));
       if(!query){if(expanded)return finish('');expanded=true;return info.fetch(job.data,()=>next());}
       tried.add(norm(query));attempts++;
       const request=new L.Reguest();request.timeout(4500);
       const url=job.base+'/api/v2.0/indexers/all/results?apikey='+job.apiKey+'&title='+encodeURIComponent(query)+(!job.tv && job.year?'&year='+job.year:'');
       request.silent(url,json=>{
        const list=json && (json.Results || json.results) || [],names=variants.map(norm).filter(v=>v.length>=3);
        const rank={'CAM':1,'TS':2,'WEBRip':3,'BDRip':4,'WEB-DL':5,'720p':6,'1080p':7,'4K':8};let best='';
        list.forEach(release=>{
          const title=release.Title || release.title || '',compact=norm(title);
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
       },()=>finish(''));
      }
      next();
    }
  }
  function inspect(item){
    const raw=item.data || {};info.remember(raw);
    const data=info.read(raw),render=item.render && item.render(true),node=render && (render.nodeType?render:render[0]);
    if(!node || !node.classList.contains('card') || (!data.title && !data.original_title && !data.name && !data.original_name))return;
    track(item,node);
    const tv=data.media_type==='movie'?false:data.media_type==='tv' || !!data.original_name || !!data.first_air_date || node.classList.contains('card--tv');
    const anime=isAnime(data);
    // Some native history/continue cards omit the rating module even though
    // their data still contains the score. Reuse that score without duplicates.
    const vote=Number(data.cub_hundred_rating || data.vote_average);
    if(Number.isFinite(vote) && vote>0 && vote<=10){
      const view=node.querySelector('.card__view');
      if(view && !view.querySelector('.card__vote')){const rating=document.createElement('div');rating.className='card__vote';rating.textContent=vote===10?'10':vote.toFixed(1);view.appendChild(rating);}
    }
    if(tv || anime){
      const view=node.querySelector('.card__view');
      if(view){let badge=view.querySelector('.pt-kind');if(!badge){badge=document.createElement('span');badge.className='pt-kind';view.appendChild(badge);}const text=anime?'Аниме':'Сериал';if(badge.textContent!==text)badge.textContent=text;}
    }
    if(!node.isConnected)return;
    const rect=node.getBoundingClientRect();if(rect.width===0 || rect.bottom< -200 || rect.top>ROOTHEIGHT()+200 || rect.right< -200 || rect.left>window.innerWidth+200)return;
    if(!hydrating.has(node) && info.incomplete(data)){hydrating.add(node);info.fetch(data,result=>{if(result && node.isConnected)schedule(item);},()=>node.isConnected);}
    const native=label(data.quality || data.release_quality);if(native){paint(node,native);return;}
    const nativeNode=node.querySelector('.card__quality'),nativeLabel=nativeNode && label(nativeNode.textContent);
    if(nativeLabel){paint(node,nativeLabel);return;}
    const year=String(data.first_air_date || data.release_date || '').slice(0,4),key=(tv?'tv:':'movie:')+norm(data.title || data.name || data.original_title || data.original_name)+':'+year;
    const saved=cache.get(key);if(saved && Date.now()-saved.time<(saved.q?21600000:120000)){paint(node,saved.q);return;}
    if(pending.has(key)){const job=pending.get(key);if(job.nodes.indexOf(node)<0)job.nodes.push(node);return;}
    if(queue.length>=40 || !L.Reguest)return;
    const configured=String(L.Storage.get('jackett_url','') || '').trim();if(!configured)return;let base=configured;if(!/^https?:\/\//i.test(base))base='http://'+base;
    const job={key,data,year,base:base.replace(/\/$/,''),apiKey:encodeURIComponent(L.Storage.get('jackett_key','') || ''),tv,nodes:[node]};pending.set(key,job);queue.push(job);drain();
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
        item.use({onCreate(){schedule(item);},onVisible(){schedule(item);},onDestroy(){forget(item);}});
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
      records.forEach(record=>record.addedNodes.forEach(legacy));
      if(records.some(record=>Array.from(record.removedNodes).some(node=>node.nodeType===1 && (node.matches('.card') || node.querySelector('.card')))))for(const [node,item] of tracked)if(!node.isConnected)forget(item);
    }).observe(document.body,{childList:true,subtree:true});
    legacy(document.body);
  }
  function flush(){
    clearTimeout(timer);timer=null;
    if(document.body.classList.contains('pt-tv-busy'))return;
    if(document.body.classList.contains('pt-wheel-active')){timer=setTimeout(flush,180);return;}
    const waiting=Array.from(retries);retries.clear();waiting.forEach(next=>next());
    const items=Array.from(deferred);deferred.clear();items.forEach(inspect);drain();
  }
  L.Listener.follow('line',event=>{
    if(!event || !['append','visible','toggle'].includes(event.type))return;
    if(document.body.matches('.pt-wheel-active,.pt-tv-busy')){
      (event.items || []).forEach(item=>deferred.add(item));
      if(!timer && !document.body.classList.contains('pt-tv-busy'))timer=setTimeout(flush,180);return;
    }
    (event.items || []).forEach(inspect);
    drain();
  });
  document.addEventListener('minimal:wheel-idle',()=>{revisit();flush();});
  document.addEventListener('minimal:tv-idle',()=>{revisit();flush();});
  // Native visibility fires once, sometimes before a grid is attached. Keep
  // observing cards as pointer scrolling and pagination bring them into view.
  document.addEventListener('scroll',revisit,true);
  document.addEventListener('transitionend',revisit,true);
  document.addEventListener('hover:focus',revisit,true);
  window.addEventListener('resize',revisit);
}
