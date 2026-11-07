import {locale,text as t} from './i18n.js';

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
const still=episode=>episode && !episode.comeing && (episode.still_path || (/^https?:\/\//i.test(episode.img || '')?episode.img:''));
export function styleScreenshots(L,event){
 const line=event.item,root=nodeOf(line);if(!root || !Array.isArray(event.data?.results) || !event.data.results.some(still))return;
 root.classList.add('minimal-detail-screenshots');
 const heading=root.querySelector('.items-line__title');if(heading)heading.textContent=t('Кадры из сериала');
 function frame(item){
  const node=nodeOf(item);if(!node?.classList.contains('full-episode') || node.dataset.minimalScreenshot)return;
  const path=still(item.data);if(!path){node.hidden=true;node.classList.remove('selector');return;}
  node.dataset.minimalScreenshot='1';node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',t('Кадр из серии {0}',[item.data.episode_number || '']));
  const open=()=>{
   if(!node.isConnected || !L.Modal?.open || L.Modal.opened?.())return;
   const image=document.createElement('img');image.className='minimal-screenshot-preview';image.alt=node.getAttribute('aria-label');
   image.src=item.data.still_path && !/^https?:\/\//i.test(path)?L.TMDB.image('/t/p/w1280'+path,{preserveSize:true}):path;
   line.last=node;
   L.Modal.open({title:image.alt,size:'large',html:window.jQuery(image),onBack(){L.Modal.close();if(node.isConnected)line.toggle();}});
  };
  // Native thumbnails normally toggle watched status. The full episode list
  // is still available through Watch; this strip only opens images.
  window.jQuery(node).off('hover:enter').on('hover:enter',open);
  node.addEventListener('hover:enter',open);
  node.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();});
  node.addEventListener('keydown',e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();e.stopPropagation();open();}});
 }
 (line.items || []).forEach(frame);line.use?.({onAppend:frame});
 if(line.more){const more=nodeOf(line.more);if(more){more.hidden=true;more.classList.remove('selector');}}
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
