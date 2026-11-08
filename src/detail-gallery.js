import {locale,text as t} from './i18n.js';
import {frameLimit} from './gallery-frames.js';
import rowOverlay from './row-overlay.js';

function airDate(value){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));if(!match)return null;
 const [year,month,day]=match.slice(1).map(Number),date=new Date(year,month-1,day);
 return year>=1900 && date.getFullYear()===year && date.getMonth()===month-1 && date.getDate()===day?{iso:match[0],date}:null;
}
export function nextDetailEpisode(card,book,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const upcoming=row=>{const date=airDate(row?.air_date);return date && date.date>today?date:null;};
 let next=upcoming(card?.next_episode_to_air);
 if(!next)for(const rows of [book?.episodes,book?.episodes_original]){
  if(!Array.isArray(rows))continue;
  for(const row of rows){const date=upcoming(row);if(date && (!next || date.iso<next.iso))next=date;}
 }
 if(!next)return null;
 const options={day:'numeric',month:'long',...(next.date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})};
 const remainingDays=Math.round((Date.UTC(next.date.getFullYear(),next.date.getMonth(),next.date.getDate())-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000);
 return {...next,remainingDays,label:new Intl.DateTimeFormat(locale(),options).format(next.date)};
}

const nodeOf=item=>{const rendered=item?.render?.(true);return rendered?.nodeType?rendered:rendered?.[0];};
const still=frame=>frame.still_path || frame.minimal_still_url;
const titleFor=card=>t(card?.media_type==='tv' || (card?.media_type!=='movie' && (card?.name || card?.first_air_date))?'Кадры из сериала':'Кадры из фильма');
const imagePath=path=>/^\/[\w.-]+\.(?:jpg|jpeg|png|webp)$/i.test(path || '');
function frameUrls(L,path,size){
 if(imagePath(path))return [L.TMDB.image('/t/p/'+size+path,{preserveSize:true})];
 if(/^https:\/\/static\.wikia\.nocookie\.net\/marvelcinematicuniverse\/images\//.test(path || '')){
  // The original Wiki host can return a challenge page for image requests.
  return [path.replace('static.wikia.nocookie.net','images.wikia.com'),path];
 }
 return [path];
}

function loadFrameImage(image,urls,loaded,failed){
 const remaining=[...new Set(urls.filter(Boolean))];
 image.referrerPolicy='no-referrer';
 image.onload=loaded;
 image.onerror=()=>{
  const next=remaining.shift();
  if(next)image.src=next;
  else{image.onerror=null;image.removeAttribute('src');failed();}
 };
 image.src=remaining.shift();
}
export function prepareScreenshotRow(event){
 const {data,link}=event;
 if(!data?.movie || (data.movie.adult && !data.minimal_gallery_eligible) || data.movie.blocked || !Array.isArray(link?.rows))return;
 const results=(data.minimal_gallery_frames || []).filter(still).slice(0,frameLimit).map(row=>({...row})).reverse();
 if(results.length)link.rows.push(['episodes',{movie:data.movie,title:titleFor(data.movie),results,minimal_gallery:true}]);
}

export function removeDetailRows(link,match){
 if(!Array.isArray(link?.rows) || !Array.isArray(link.items))return;
 const active=link.items[link.active];
 for(let i=link.rows.length-1;i>=0;i--){
  if(!match(link.rows[i]))continue;
  link.rows.splice(i,1);
  if(i>=link.items.length)continue;
  const [item]=link.items.splice(i,1);
  nodeOf(item)?.remove();
  item?.destroy?.();
 }
 link.active=Math.max(0,link.items.indexOf(active));
}

function galleryButton(className,label,path,action){
 const button=document.createElement('button');button.type='button';button.className=className;
 const arrow=icon(path);arrow.setAttribute('fill','none');arrow.setAttribute('stroke','currentColor');arrow.setAttribute('stroke-width','2');
 button.setAttribute('aria-label',label);button.appendChild(arrow);
 button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();action();});
 button.addEventListener('hover:enter',action);
 return button;
}
const previousPath='m14 6-6 6 6 6',nextPath='m10 6 6 6-6 6';
function showFrames(L,line,frames,start){
 const $=window.jQuery,viewer=document.createElement('div'),image=document.createElement('img');
 const tv=document.body.classList.contains('pt-tv');
 viewer.className='minimal-frame-viewer';image.className='minimal-screenshot-preview';image.draggable=false;image.referrerPolicy='no-referrer';
 const controls=document.createElement('div');controls.className='minimal-frame-controls';
 const counter=document.createElement('span');counter.className='minimal-frame-position';counter.setAttribute('aria-live','polite');
 const cache=new Map();let index=start,touch=null,serial=0,disposed=false,focused,controller,original;
 const wrap=n=>(n+frames.length)%frames.length;
 function dispose(){
  if(disposed)return;disposed=true;serial++;
  for(const entry of cache.values()){entry.image.onload=entry.image.onerror=null;entry.image.removeAttribute('src');}cache.clear();image.removeAttribute('src');
  if(controller && original)for(const key of Object.keys(original)){if(original[key]===undefined)delete controller[key];else controller[key]=original[key];}
  L.Modal.listener?.remove?.('close',dispose);
 }
 const close=()=>{
  if(disposed)return;L.Modal.close();dispose();
  const node=frames[index]?.node;
  if(node?.isConnected){line.last=node;line.active=line.items.findIndex(item=>nodeOf(item)===node);line.toggle();node.focus?.({preventScroll:true});}
 };
 const focus=control=>{focused=control;L.Controller.collectionFocus(control,$(viewer));control.focus?.({preventScroll:true});};
 const move=step=>{if(!disposed && frames.length>1){index=wrap(index+step);draw();}};
 const previous=galleryButton('minimal-frame-control minimal-frame-prev selector',t('Предыдущий кадр'),previousPath,()=>{focus(previous);move(-1);});
 const next=galleryButton('minimal-frame-control minimal-frame-next selector',t('Следующий кадр'),nextPath,()=>{focus(next);move(1);});
 const dismiss=galleryButton('minimal-frame-control minimal-frame-close selector',t('Закрыть'),'m6 6 12 12m0-12L6 18',close);
 previous.hidden=next.hidden=tv || frames.length<2;
 for(const control of [previous,next,dismiss,counter])controls.appendChild(control);
 viewer.appendChild(image);viewer.appendChild(controls);
 function resource(number){
  if(cache.has(number))return cache.get(number).promise;
  const frame=frames[number],preload=new Image(),entry={image:preload};
  entry.promise=new Promise(resolve=>loadFrameImage(preload,[...frameUrls(L,frame.path,frame.width>1280?'original':'w1280'),frame.image.currentSrc],()=>resolve(preload),()=>resolve(null)));
  cache.set(number,entry);return entry.promise;
 }
 function draw(){
  const request=++serial,selected=index,frame=frames[index],label=frame.node.getAttribute('aria-label');
  image.alt=label;viewer.setAttribute('aria-busy','true');counter.textContent=(index+1)+' / '+frames.length;
  if(L.Modal.opened())L.Modal.title?.(label);
  const nearby=new Set([index,wrap(index-1),wrap(index+1)]);
  for(const [number,entry] of cache)if(!nearby.has(number)){entry.image.onload=entry.image.onerror=null;entry.image.removeAttribute('src');cache.delete(number);}
  resource(index).then(loaded=>{
   if(disposed || request!==serial || selected!==index)return;
   if(loaded)image.src=loaded.currentSrc || loaded.src;
   viewer.setAttribute('aria-busy','false');
   if(loaded && frames.length>1){resource(wrap(index+1));resource(wrap(index-1));}
  });
 }
 viewer.addEventListener('touchstart',event=>{
  if(event.touches.length!==1 || event.target.closest('button')){touch=null;return;}
  const point=event.touches[0];touch=[point.clientX,point.clientY];
 },{passive:true});
 viewer.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
 viewer.addEventListener('touchmove',event=>{
  if(!touch || !event.touches.length)return;
  const point=event.touches[0],dx=point.clientX-touch[0],dy=point.clientY-touch[1];
  if(Math.abs(dx)>12 && Math.abs(dx)>Math.abs(dy)*1.4){event.preventDefault();event.stopPropagation();}
 },{passive:false});
 viewer.addEventListener('touchend',event=>{
  if(!touch || !event.changedTouches.length)return;
  const point=event.changedTouches[0],dx=point.clientX-touch[0],dy=point.clientY-touch[1];touch=null;
  if(frames.length>1 && Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4){event.preventDefault();move(dx<0?1:-1);}
 },{passive:false});
 draw();
 L.Modal.open({title:image.alt,size:'large',html:$(viewer),select:!tv && frames.length>1?next:dismiss,onBack:close});
 viewer.closest('.modal')?.classList.add('minimal-frame-modal');
 L.Modal.listener?.follow?.('close',dispose);
 const active=L.Controller?.enabled?.();
 if(active?.name==='modal' && active.controller){
  controller=active.controller;original={};
  for(const key of ['left','right','up','down','enter'])original[key]=controller[key];
  $(controls).find('.selector').off('hover:focus').on('hover:focus',event=>{focused=event.currentTarget;});
  controller.left=()=>{if(frames.length>1){if(!tv)focus(previous);move(-1);}};
  controller.right=()=>{if(frames.length>1){if(!tv)focus(next);move(1);}};
  controller.up=()=>focus(dismiss);
  controller.down=()=>focus(!tv && frames.length>1?next:dismiss);
  controller.enter=()=>focused===dismiss?close():move(focused===previous?-1:1);
 }
 focused=!tv && frames.length>1?next:dismiss;
 // DOM focus must leave the thumbnail too: after reopening, its Enter handler
 // otherwise consumes the remote OK before it reaches the modal controller.
 focused.focus?.({preventScroll:true});
 viewer.addEventListener('keydown',event=>{
  // Native Keypad owns remote input. Suppress only the button's synthetic
  // Enter click, otherwise OK would advance once via Keypad and once via click.
  if(event.key==='Enter')event.preventDefault();
 });
 // Native Modal centers its initial selector before the viewer styling exists.
 // The fixed image canvas owns navigation and must start without that offset.
 L.Modal.scroll?.()?.immediate?.(viewer);
}

export function styleScreenshots(L,event){
 const line=event.item,root=nodeOf(line),rows=event.data?.results;
 if(!event.data?.minimal_gallery || !root || !Array.isArray(rows) || !Array.isArray(line.items))return;
 const card=event.data.movie,heading=root.querySelector('.items-line__title');
 const candidates=rows.slice(),frames=[],seen=new Set();
 let nav;
 function frame(item,path){
  const node=nodeOf(item);
  if(!node?.classList.contains('full-episode') || !path || seen.has(path) || frames.length>=frameLimit){
   if(node){node.hidden=true;node.classList.remove('selector');}
   return;
  }
  const image=node.querySelector('.full-episode__img img');
  if(!image)return;
  const entry={node,path,image,width:item.data.width};
  frames.push(entry);seen.add(path);
  node.dataset.minimalScreenshot='1';node.setAttribute('role','button');node.tabIndex=0;
  node.setAttribute('aria-label',t('Кадр {0}',[frames.length]));
  let requested=false;
  function load(){
   if(requested)return;
   requested=true;
   const thumbnails=frameUrls(L,imagePath(path)?path:item.data.img,'w780');
   loadFrameImage(image,[...thumbnails,...frameUrls(L,path,'w1280')],()=>{
    node.classList.add('full-episode--loaded');
   },()=>{
    node.hidden=true;node.classList.remove('selector');node.tabIndex=-1;
    if(frames.every(entry=>entry.node.hidden)){
     root.hidden=true;
     if(event.link)removeDetailRows(event.link,row=>row[1]===event.data);
    }
   });
  }
  // Native episode errors replace the image with a broken-image icon.
  // Keep the gallery request and its fallback separate from episode playback.
  node.addEventListener('visible',event=>{
   event.stopImmediatePropagation();
   load();
  },true);
  if(image.getAttribute('src'))load();
  const open=()=>{
   if(node.hidden || !node.isConnected || !L.Modal?.open || L.Modal.opened?.())return;
   line.last=node;
   const visible=frames.filter(entry=>!entry.node.hidden);
   showFrames(L,line,visible,visible.indexOf(entry));
  };
  // Native thumbnails normally toggle watched status. The full episode list
  // is still available through Watch; this strip only opens images.
  window.jQuery(node).off('hover:enter').on('hover:enter',open);
  node.addEventListener('hover:enter',open);
  node.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();});
  node.addEventListener('keydown',e=>{if(e.key==='Enter' || e.key===' ')e.preventDefault();});
  // Keypad activates on key release. Opening on keydown would let that same
  // release activate the new modal's focused button, especially after reopen.
  node.addEventListener('keyup',e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();open();}});
 }
 function update(){
  if(!frames.length)return;
  for(const item of line.items){
   const node=nodeOf(item);
   if(node && !node.dataset.minimalScreenshot){node.hidden=true;node.classList.remove('selector');}
  }
  root.classList.add('minimal-detail-screenshots');
  if(heading)heading.textContent=titleFor(card);
  if(!nav){
   const head=root.querySelector('.items-line__head'),viewport=line.scroll?.render(true);
   if(head && viewport){
    const page=step=>{
     const nodes=frames.filter(item=>!item.node.hidden).map(item=>item.node),bounds=viewport.getBoundingClientRect();
     if(!nodes.length)return;
     const visible=nodes.findIndex(node=>node.getBoundingClientRect().right>bounds.left+2);
     const count=Math.max(1,Math.floor(bounds.width/(nodes[0].getBoundingClientRect().width || bounds.width || 1)));
     const target=nodes[Math.max(0,Math.min(nodes.length-1,Math.max(0,visible)+step*count))];
     line.last=target;line.active=line.items.findIndex(item=>nodeOf(item)===target);
     line.scroll.update(target,false);
    };
    nav=document.createElement('div');nav.className='minimal-row-nav minimal-frame-nav';
    nav.appendChild(galleryButton('minimal-row-arrow',t('Предыдущая страница'),previousPath,()=>page(-1)));
    nav.appendChild(galleryButton('minimal-row-arrow',t('Следующая страница'),nextPath,()=>page(1)));
    head.appendChild(nav);
    const overlay=rowOverlay(root,viewport);line.use?.({onDestroy:()=>overlay.destroy()});
   }
  }
  if(nav)nav.hidden=frames.length<2;
 }
 function add(rowsToAdd){
  for(const row of rowsToAdd){
   const path=still(row);if(!path || seen.has(path) || frames.length>=frameLimit)continue;
   const existing=line.items.find(item=>item.data===row);
   if(existing){frame(existing,path);continue;}
   if(!row.params || !line.emit)continue;
   const before=line.items.length;line.emit('createAndAppend',row);
   if(line.items.length>before)frame(line.items.at(-1),path);
  }
  // The native row already owns the items; do not let its lazy append rebuild them.
  if(frames.length)rows.splice(0,rows.length,...line.items.filter(item=>item!==line.more).map(item=>item.data));
  update();
 }
 add(candidates);
}

function icon(path){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.appendChild(line);return svg;}
export function mountRelatedRow(L,link){
 const name=row=>Array.isArray(row)?row[0]:row;
 const index=kind=>link.rows.findIndex(row=>name(row)===kind);
 const anchorIndex=Math.max(0,index('episodes')>=0?index('episodes'):Math.max(0,index('persons')));
 if(anchorIndex>=link.items.length){const view=link.view;try{link.view=Math.max(view || 3,anchorIndex+1);link.emit('scroll',0);}finally{link.view=view;}}
 const found=nodeOf(link.items[anchorIndex]),anchor=found?.closest('.minimal-detail-header') || found;
 if(!anchor?.parentNode || !L.Controller)return null;
 const wrap=document.createElement('div');wrap.className='minimal-anime-franchise';
 const control=document.createElement('button');control.type='button';control.className='minimal-anime-franchise__button selector';control.setAttribute('aria-expanded','false');control.setAttribute('aria-haspopup','dialog');
 const label=document.createElement('span');label.textContent=t('Связанные');
 control.appendChild(icon('M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7 M14 11a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7'));control.appendChild(label);control.appendChild(icon('m6 9 6 6 6-6'));wrap.appendChild(control);
 const at=anchorIndex+1,active=link.items[link.active],hooks={};
 const item={
  use(value){Object.assign(hooks,value);},render(js){return js?wrap:window.jQuery(wrap);},destroy(){wrap.remove();},
  activate(){if(wrap.isConnected)link.active=link.items.indexOf(item);},
  toggle(){
   item.activate();
   const call=(key,event)=>()=>hooks[key]?hooks[key]():link.emit(event);
   L.Controller.add('minimal_franchise',{
    link:item,toggle(){L.Controller.collectionSet(wrap);L.Controller.collectionFocus(control,wrap);if(hooks.onToggle)hooks.onToggle();else link.scroll.update(wrap);},
    up:call('onUp','up'),down:call('onDown','down'),back:call('onBack','back'),left:call('onLeft','left'),right(){}
   });L.Controller.toggle('minimal_franchise');
  }
 };
 link.rows.splice(at,0,['minimal_related',{}]);link.items.splice(at,0,item);
 link.active=Math.max(0,link.items.indexOf(active));anchor.after(wrap);orderDetailSections(link);
 return {control,item};
}

// Keep native row indices and DOM order identical so Up/Down follows the page.
export function orderDetailSections(link){
 if(!Array.isArray(link?.rows) || !Array.isArray(link.items) || link._minimalOrdering)return;
 link._minimalOrdering=true;
 try{
  const kind=row=>Array.isArray(row)?row[0]:row;
  const wanted=['episodes','minimal_related','discuss'];
  const last=link.rows.reduce((n,row,i)=>wanted.includes(kind(row))?Math.max(n,i):n,-1);
  if(last<0)return;
  if(last>=link.items.length){const view=link.view;try{link.view=Math.max(view || 3,last+1);link.emit('scroll',0);}finally{link.view=view;}}
  const active=link.items[link.active],built=link.items.length,pairs=link.rows.map((row,i)=>({row,item:link.items[i]}));
  const moving=wanted.flatMap(name=>pairs.filter(p=>kind(p.row)===name));
  if(moving.some(p=>!p.item))return;
  const retained=pairs.filter(p=>!wanted.includes(kind(p.row)));
  const header=nodeOf(link.items[0])?.closest('.minimal-detail-header') || nodeOf(link.items[0]);
  let at=1;
  while(at<retained.length && retained[at].item && header?.contains(nodeOf(retained[at].item)))at++;
  retained.splice(at,0,...moving);
  link.rows.splice(0,link.rows.length,...retained.map(p=>p.row));
  link.items.splice(0,built,...retained.slice(0,built).map(p=>p.item));
  link.active=Math.max(0,link.items.indexOf(active));
  let anchor=header;
  for(const entry of retained.slice(at)){
   const node=nodeOf(entry.item);if(!node || !anchor?.parentNode || header?.contains(node))continue;
   if(kind(entry.row)==='discuss')node.classList.add('minimal-comments-native');
   anchor.after(node);anchor=node;
  }
 }finally{link._minimalOrdering=false;}
}
export function styleSuggestions(L,event){
 const labels=[L.Lang.translate('title_recomendations'),L.Lang.translate('title_similar')];
 if(!labels.includes(event.data?.title))return;
 const root=nodeOf(event.item);if(!root)return;
 root.classList.add('minimal-detail-suggestions');
 const first=event.link?.rows?.find(row=>Array.isArray(row) && row[0]==='cards' && labels.includes(row[1]?.title));
 root.classList.toggle('minimal-detail-suggestions--first',!!first && first[1].title===event.data.title);
 event.item.minimalPosterRefresh?.();
}
