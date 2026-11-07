import {locale,text as t} from './i18n.js';
import {frameLimit} from './gallery-frames.js';

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
export function prepareScreenshotRow(event){
 const {data,link}=event;
 if(!data?.movie || data.movie.adult || data.movie.blocked || !Array.isArray(link?.rows))return;
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
 button.setAttribute('aria-label',label);button.title=label;button.appendChild(arrow);
 button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();action();});
 button.addEventListener('hover:enter',action);
 return button;
}
const previousPath='m14 6-6 6 6 6',nextPath='m10 6 6 6-6 6';
function showFrames(L,line,frames,start){
 const $=window.jQuery;
 const viewer=document.createElement('div');viewer.className='minimal-frame-viewer';
 const image=document.createElement('img');image.className='minimal-screenshot-preview';image.draggable=false;
 const controls=document.createElement('div');controls.className='minimal-frame-controls';
 const counter=document.createElement('span');counter.setAttribute('aria-live','polite');
 let index=start,touch=null;
 const close=()=>{
  L.Modal.close();
  const node=frames[index]?.node;
  if(node?.isConnected){line.last=node;line.active=line.items.findIndex(item=>nodeOf(item)===node);line.toggle();node.focus?.({preventScroll:true});}
 };
 const move=step=>{index=(index+step+frames.length)%frames.length;draw();};
 const previous=galleryButton('minimal-row-arrow selector',t('Предыдущий кадр'),previousPath,()=>move(-1));
 const next=galleryButton('minimal-row-arrow selector',t('Следующий кадр'),nextPath,()=>move(1));
 const dismiss=galleryButton('minimal-row-arrow selector',t('Закрыть'),'m6 6 12 12m0-12L6 18',close);
 previous.hidden=next.hidden=frames.length<2;
 for(const control of [previous,counter,next,dismiss])controls.appendChild(control);
 viewer.appendChild(controls);viewer.appendChild(image);
 function draw(){
  const frame=frames[index],label=frame.node.getAttribute('aria-label');
  image.alt=label;
  const size=frame.width>1280?'original':'w1280';
  image.src=imagePath(frame.path)?L.TMDB.image('/t/p/'+size+frame.path,{preserveSize:true}):frame.path;
  counter.textContent=(index+1)+' / '+frames.length;
  if(L.Modal.opened())L.Modal.title?.(label);
 }
 viewer.addEventListener('touchstart',event=>{
  if(event.touches.length!==1 || event.target.closest('button')){touch=null;return;}
  const point=event.touches[0];touch=[point.clientX,point.clientY];
 },{passive:true});
 viewer.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
 viewer.addEventListener('touchend',event=>{
  if(!touch || !event.changedTouches.length)return;
  const point=event.changedTouches[0],dx=point.clientX-touch[0],dy=point.clientY-touch[1];touch=null;
  if(frames.length>1 && Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4){event.preventDefault();move(dx<0?1:-1);}
 },{passive:false});
 draw();
 L.Modal.open({title:image.alt,size:'large',html:$(viewer),select:dismiss,onBack:close});
 const controller=L.Controller?.enabled?.();
 if(controller?.name==='modal' && controller.controller){
  controller.controller.left=()=>move(-1);
  controller.controller.right=()=>move(1);
 }
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
  const entry={node,path,width:item.data.width};
  frames.push(entry);seen.add(path);
  node.dataset.minimalScreenshot='1';node.setAttribute('role','button');node.tabIndex=0;
  node.setAttribute('aria-label',t('Кадр {0}',[frames.length]));
  const open=()=>{
   if(!node.isConnected || !L.Modal?.open || L.Modal.opened?.())return;
   line.last=node;
   showFrames(L,line,frames.slice(),frames.indexOf(entry));
  };
  // Native thumbnails normally toggle watched status. The full episode list
  // is still available through Watch; this strip only opens images.
  window.jQuery(node).off('hover:enter').on('hover:enter',open);
  node.addEventListener('hover:enter',open);
  node.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();});
  node.addEventListener('keydown',e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();e.stopPropagation();open();}});
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
     const nodes=frames.map(item=>item.node),bounds=viewport.getBoundingClientRect();
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
