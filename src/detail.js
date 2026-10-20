import {localizedTitle,isAnime} from './metadata.js';
import {chooseLogo,pickStudio} from './logos.js';
import comments from './comments.js';
import {artworkSize} from './artwork.js';
import {onlineButton,watchActions} from './watch-actions.js';
export function releaseDate(card){
 const raw=String(card.release_date || card.first_air_date || ''),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
 if(!match)return /^\d{4}$/.test(raw) && Number(raw)>0?raw:'';
 const [year,month,day]=match.slice(1).map(Number),date=new Date(year,month-1,day);
 if(year<100 || date.getFullYear()!==year || date.getMonth()!==month-1 || date.getDate()!==day)return '';
 return day+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][month-1]+' '+year;
}
function readableOverview(L,card,right,link){
 if(!card.overview || !String(card.overview).trim())return;
 let text=right.querySelector('.full-start-new__description,.minimal-detail-overview');
 if(!text){text=document.createElement('p');text.className='minimal-detail-overview';text.textContent=card.overview;right.appendChild(text);}
 text.classList.add('minimal-overview-action','selector');text.setAttribute('role','button');text.setAttribute('tabindex','0');text.setAttribute('aria-haspopup','dialog');text.setAttribute('aria-label','Прочитать описание полностью');text.title='Прочитать описание полностью';
 function remember(){if(link && link.items && link.items[0])link.items[0].last=text;}
 function open(){
  if(!text.isConnected || L.Modal.opened())return;
  remember();const content=document.createElement('div');content.className='about minimal-overview-full';content.textContent=card.overview;
  L.Modal.open({title:'Описание',size:'large',html:window.jQuery(content),onBack:()=>{L.Modal.close();if(text.isConnected){remember();L.Controller.toggle('full_start');}}});
 }
 text.addEventListener('hover:focus',remember);text.addEventListener('hover:enter',open);
 text.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
 text.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});
}
function moveTechnicalDetails(L,card,right){
 const line=right.querySelector('.full-start-new__details'),genres=(card.genres || []).slice(0,5).map(g=>g.name).join(' | ').trim().toLowerCase(),prefix=L.Lang && L.Lang.translate?L.Lang.translate('player_quality')+':':'Качество:';
 let duration='',quality='';
 if(line){
  const retained=Array.from(line.children).filter(part=>{
   if(part.classList.contains('full-start-new__split'))return false;
   const text=(part.textContent || part.innerText || '').trim();
   if(!text)return false;
   if(/^\d{1,3}:\d{2}$/.test(text)){duration=text;return false;}
   if(genres && text.toLowerCase()===genres)return false;
   if(text.toLowerCase().startsWith(prefix.toLowerCase())){quality=text.slice(prefix.length).trim();return false;}
   return true;
  });
  while(line.firstChild)line.removeChild(line.firstChild);
  retained.forEach((part,index)=>{if(index){const split=document.createElement('span');split.className='full-start-new__split';split.textContent='●';line.appendChild(split);}line.appendChild(part);});
  line.classList.toggle('pt-hidden',!retained.length);
 }
 const minutes=Number(card.runtime) || Number((card.episode_run_time || [])[0]) || Number((card.last_episode_to_air || {}).runtime);
 if(!duration && isFinite(minutes) && minutes>0){const total=Math.floor(minutes),hours=Math.floor(total/60);duration=(hours<10?'0':'')+hours+':'+(total%60<10?'0':'')+(total%60);}
 const supplied=card.release_quality || card.quality;
 if(!quality && (typeof supplied==='string' || typeof supplied==='number'))quality=String(supplied).trim();
 return {duration,quality:quality.toUpperCase()};
}
export function prepareDetail(data){
 delete data.metadata;
 const persons=data.persons || {};
 const unique=list=>{const seen=new Map();list.forEach(person=>{if(!person || !(person.name || person.original_name))return;const key=String(person.id || person.name || person.original_name),old=seen.get(key);if(old){for(const field of ['popularity','episode_count','total_episode_count'])old[field]=Math.max(Number(old[field]) || 0,Number(person[field]) || 0);if(!old.profile_path && person.profile_path)old.profile_path=person.profile_path;}else seen.set(key,{...person});});return Array.from(seen.values());};
 const number=value=>Number.isFinite(Number(value))?Number(value):0;
 const allCast=unique(persons.cast || []),anime=isAnime(data.movie || {}),hasPhoto=person=>anime || !!String(person.profile_path || '').trim();
 const cast=allCast.map((person,index)=>({person,billing:person.order!=null && number(person.order)>=0?number(person.order):index,index})).filter(entry=>hasPhoto(entry.person)).sort((a,b)=>{
  // Preserve the principal billing before considering popularity. A famous
  // cameo must not displace the leads; use native credit order when absent.
  const tier=p=>p.billing<6?0:p.billing<20?1:2;
  return tier(a)-tier(b) || (tier(a)===0?a.billing-b.billing:0) || number(b.person.popularity)-number(a.person.popularity) || number(b.person.total_episode_count || b.person.episode_count)-number(a.person.total_episode_count || a.person.episode_count) || a.billing-b.billing || a.index-b.index;
 }).map(entry=>entry.person);
 const directors=unique((persons.crew || []).filter(p=>p.job==='Director').map(person=>({...person,profile_path:person.profile_path || (allCast.find(actor=>String(actor.id || actor.name)===String(person.id || person.name)) || {}).profile_path}))).filter(hasPhoto).sort((a,b)=>number(b.popularity)-number(a.popularity) || number(b.episode_count || b.total_episode_count)-number(a.episode_count || a.total_episode_count)).slice(0,5),ids=new Set(directors.map(p=>String(p.id || p.name)));
 data.persons={...persons,crew:(persons.crew || []).filter(p=>p.job!=='Director'),cast:[...directors.map(p=>{const actor=cast.find(a=>String(a.id || a.name)===String(p.id || p.name));return {...p,...actor,job:'Director',minimal_director:true,character:['Режиссёр',actor && actor.character].filter(Boolean).join(' · ')};}),...cast.filter(p=>!ids.has(String(p.id || p.name))).slice(0,20)]};
 const disabled=window.lampa_settings && window.lampa_settings.disable_features || {};
 if(!disabled.discuss)data.discuss={...(data.discuss || {}),result:((data.discuss || {}).result || []).slice()};
 if(!data.reactions || !Array.isArray(data.reactions.result))data.reactions={result:[]};
}
function orderComments(link){
 if(!link || !link.rows || !link.items)return;
 let index=link.rows.findIndex(row=>Array.isArray(row) && row[0]==='discuss');if(index<0)return;
 const cast=link.rows.findIndex(row=>Array.isArray(row) && row[0]==='persons');
 const target=Math.min(cast===1?2:1,link.rows.length-1);let built=index<link.items.length;
 // An unbuilt comments row can move ahead of other unbuilt rows without
 // constructing every recommendations row just to reach an empty discussion.
 if(!built && target>=link.items.length){link.rows.splice(target,0,link.rows.splice(index,1)[0]);}
 else{
  if(!built && document.body.classList.contains('pt-tv')){
   // Empty discussions are last in native Lampa. Build only that row, rather
   // than every collection and recommendation between it and the header.
   const next=link.items.length,previous=link.view;
   link.rows.splice(next,0,link.rows.splice(index,1)[0]);index=next;
   link.view=next+1;link.emit('scroll',0);link.view=previous;built=index<link.items.length;
  }
  if(!built){link.view=Math.max(link.view || 3,index+1);link.emit('scroll',0);built=index<link.items.length;}
  if(built){const active=link.items[link.active];link.rows.splice(target,0,link.rows.splice(index,1)[0]);link.items.splice(target,0,link.items.splice(index,1)[0]);link.active=Math.max(0,link.items.indexOf(active));}
 }
 link.view=Math.max(link.view || 3,target+1);link.emit('scroll',0);
 const item=link.items[target],render=item && item.render(true),node=render && (render.nodeType?render:render[0]);
 if(node){
  node.classList.add('minimal-comments-native');const previous=link.items[target-1],r=previous && previous.render(true),previousNode=r && (r.nodeType?r:r[0]);
  // Cast is nested in the header grid, but comments are a full-width page row.
  const anchor=previousNode && (previousNode.closest('.minimal-detail-header') || previousNode);
  if(anchor && anchor.parentNode && !anchor.contains(node))anchor.parentNode.insertBefore(node,anchor.nextSibling);
 }
}
function mountCast(columns,node){
 if(!columns || !node)return;
 // Native rows can receive viewport widths. Keep that sizing inside a
 // separate grid cell so the facts column always has its own space.
 let cell=Array.from(columns.children).find(child=>child.classList.contains('minimal-detail-cast'));
 if(!cell){cell=document.createElement('div');cell.className='minimal-detail-cast';columns.insertBefore(cell,columns.firstChild);}
 if(node.parentNode!==cell)cell.appendChild(node);
}
function removeDescription(link){
 if(!link || !link.rows || !link.items)return;
 const index=link.rows.findIndex(row=>(Array.isArray(row)?row[0]:row)==='description');if(index<0)return;
 const active=link.items[link.active];link.rows.splice(index,1);
 if(index<link.items.length){const item=link.items.splice(index,1)[0];if(item && item.destroy)item.destroy();}
 link.active=Math.max(0,link.items.indexOf(active));
}
export default function detail(L,event,loadLogo){
 if(event && event.type==='options' && event.link && event.options){
  const render=event.link.render(true),root=render && (render.nodeType?render:render[0]);
  if(root)Array.from(root.querySelectorAll('.buttons--container>.full-start__button:not(.hide)')).filter(button=>!button.classList.contains('view--torrent') && button!==onlineButton(root)).forEach(button=>{
   const label=button.querySelector('span'),subtitle=button.querySelector('.full-start__button-subtitle'),icon=button.querySelector('svg');
   event.options.push({title:(label && (label.innerText || label.textContent) || button.getAttribute('title') || '').trim(),subtitle:button.getAttribute('data-subtitle') || subtitle && (subtitle.innerText || subtitle.textContent),template:icon?'selectbox_icon':'selectbox_item',icon:icon && icon.outerHTML,onSelect:()=>{if(L.Select.close)L.Select.close();L.Controller.toggle('full_start');button.dispatchEvent(new Event('hover:enter',{bubbles:true}));}});
  });
  return;
 }
 if(event && event.type==='start' && event.data){prepareDetail(event.data);return;}
 if(event && event.type==='build' && event.name==='discuss' && event.item){const render=event.item.render(true),node=render && (render.nodeType?render:render[0]);comments(event.item,node);}
 if(event && event.type==='build' && event.name==='persons' && event.item && event.data && (event.data.title===L.Lang.translate('title_actors') || (event.data.results || []).some(p=>Object.prototype.hasOwnProperty.call(p,'character')))){
  const render=event.item.render(true),node=render && (render.nodeType?render:render[0]);
  if(node){node.classList.add('minimal-cast-native');const count=(event.data.results || []).filter(p=>p.minimal_director).length,heading=node.querySelector('.items-line__title');if(count && heading)heading.textContent=count>1?'Актёры и режиссёры':'Актёры и режиссёр';const container=event.body && event.body[0] && event.body[0].querySelector('.minimal-detail-columns');mountCast(container,node);}
  return;
 }

 if(!event || event.type!=='complite' || !event.data || !event.data.movie)return;
 const card=event.data.movie,body=event.body && (event.body.nodeType?event.body:event.body[0]);if(!body)return;
 const title=body.querySelector('.full-start-new__title'),right=body.querySelector('.full-start-new__right');
 if(!title || !right || right.dataset.minimalDetail)return;
 right.dataset.minimalDetail='1';
 // Keep native description/genres as a fallback until the replacement header
 // exists; other Lampa templates must never lose their only description row.
 readableOverview(L,card,right,event.link);removeDescription(event.link);
 const technical=moveTechnicalDetails(L,card,right);
 const episodes=right.querySelector('.full-start-new__details'),ratings=right.querySelector('.full-start-new__rate-line');if(episodes && ratings)right.insertBefore(episodes,ratings);
 const start=right.closest('.full-start-new'),left=start && start.querySelector('.full-start-new__left'),buttons=right.querySelector('.full-start-new__buttons');
 const reaction=body.querySelector('.button--reaction');if(reaction){reaction.title='Оставить реакцию';reaction.setAttribute('aria-label','Оставить реакцию');}
 if(left){
  left.classList.add('minimal-detail-identity');left.appendChild(title);if(buttons)left.appendChild(buttons);
  const heading=document.createElement('h2');heading.className='minimal-detail-heading';heading.textContent=localizedTitle(card,L.Storage.get('language','ru'));title.textContent=heading.textContent;right.prepend(heading);
  if(buttons){
   const update=()=>{const subscribed=Array.from(buttons.querySelectorAll('.button--subscribe')).some(bell=>!bell.classList.contains('hide') && !bell.classList.contains('pt-hidden') && !bell.hidden && bell.style.display!=='none');buttons.classList.remove('minimal-actions--auto');buttons.classList.toggle('minimal-actions--no-bell',!subscribed);};
   update();
   if(window.MutationObserver){const observer=new MutationObserver(records=>{if(records.some(record=>record.type==='childList' || record.target.classList.contains('button--subscribe')))update();});observer.observe(buttons,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});if(event.link && event.link.use)event.link.use({onDestroy:()=>observer.disconnect()});}
  }
  watchActions(L,body,card,event.link);
 }
 if(start){
  start.classList.add('minimal-detail-header');
  const columns=document.createElement('section');columns.className='minimal-detail-columns';start.appendChild(columns);
  const cast=body.querySelector('.minimal-cast-native');mountCast(columns,cast);
  const facts=document.createElement('aside');facts.className='minimal-detail-facts';const heading=document.createElement('h3');heading.textContent='О произведении';facts.appendChild(heading);
  const series=card.media_type==='tv' || card.name || card.first_air_date;
  const rows=[['Оригинальное название',card.original_title || card.original_name],['Тип',isAnime(card)?(series?'Аниме-сериал':'Аниме-фильм'):(series?'Сериал':'Фильм')],['Дата релиза',releaseDate(card)],[series?'Длительность серии':'Длительность',technical.duration],['Тип релиза',technical.quality],['Рейтинг TMDB',card.vote_average?Number(card.vote_average).toFixed(1):''],['Жанры',(card.genres || []).map(g=>g.name).join(', ')]];
  rows.forEach(([name,value])=>{if(!value)return;const row=document.createElement('div'),key=document.createElement('span'),text=document.createElement('span');key.textContent=name;text.textContent=value;row.appendChild(key);row.appendChild(text);facts.appendChild(row);});columns.appendChild(facts);
  // TV initially builds only three full-card rows. Load through the cast row,
  // then move both native rows and controller items into the displayed order.
  const link=event.link;
  if(link && link.rows && link.items){
   const castData=event.data.persons && event.data.persons.cast || [];
   const castIds=new Set(castData.map(p=>p.id));
   const index=link.rows.findIndex(row=>Array.isArray(row) && row[0]==='persons' && (row[1].results || []).some(p=>castIds.has(p.id) && Object.prototype.hasOwnProperty.call(p,'character')));
   if(index>=0){
    const previous=link.view;link.view=Math.max(previous || 3,index+1);
    link.emit('scroll',0);
    if(document.body.classList.contains('pt-tv'))link.view=previous;
    const node=body.querySelector('.minimal-cast-native');mountCast(columns,node);
    const castItem=node && link.items.find(item=>{const r=item.render(true);return (r.nodeType?r:r[0])===node;});
    if(castItem){const active=link.items[link.active];link.rows.splice(1,0,link.rows.splice(index,1)[0]);link.items.splice(1,0,link.items.splice(link.items.indexOf(castItem),1)[0]);link.active=Math.max(0,link.items.indexOf(active));}
   }
  }
 }
 orderComments(event.link);
 // Vertical pointer scrolling does not advance Lampa's remote active-row index.
 // Build these few page rows now; their horizontal cards and images stay lazy.
 if(event.link && event.link.rows && event.link.items){
  const link=event.link;
  if(!document.body.classList.contains('pt-tv')){link.view=Math.max(link.view || 3,link.rows.length);link.emit('scroll',0);}
  else{
   // Remote navigation retains native lazy rows. A TV mouse/touch user can
   // still reach the whole page without advancing the remote active index.
   const expand=()=>{link.view=Math.max(link.view || 3,link.rows.length);link.emit('scroll',0);cleanup();};
   const pointer=event=>{if(body.contains(event.detail))expand();};
   const cleanup=()=>{document.removeEventListener('minimal:tv-pointer-scroll',pointer);body.removeEventListener('touchstart',expand,true);};
   document.addEventListener('minimal:tv-pointer-scroll',pointer);
   body.addEventListener('touchstart',expand,{capture:true,passive:true});
   if(link.use)link.use({onDestroy:cleanup});
  }
 }

 const movie={...card,media_type:card.media_type || (card.name?'tv':'movie')};
 const metaHead=right.querySelector('.full-start-new__head');
 function showStudio(studio){
  if(!studio || !metaHead)return;
  function linkStudio(icon){
   if(!/^\d+$/.test(String(studio.id)) || Number(studio.id)<=0 || icon.dataset.studioId)return;
   icon.dataset.studioId=String(studio.id);icon.classList.add('selector');icon.setAttribute('role','button');icon.tabIndex=0;icon.setAttribute('aria-label','Проекты '+studio.name);icon.title='Проекты '+studio.name;
   const open=()=>{if(!icon.isConnected)return;L.Activity.push(studio.kind==='network'?{component:'category_full',source:'tmdb',url:'discover/tv',networks:studio.id,sort_by:'popularity.desc',title:studio.name,page:1}:{component:'company',source:'tmdb',url:movie.media_type,id:studio.id,title:studio.name});};
   window.jQuery(icon).on('hover:enter',open).on('hover:focus',()=>{if(event.link && event.link.items && event.link.items[0])event.link.items[0].last=icon;});
   icon.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
   icon.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});
  }
  const existing=metaHead.querySelector('.minimal-detail-studio');if(existing){linkStudio(existing);return;}
  const icon=document.createElement('img');icon.className='minimal-detail-studio';icon.alt=studio.name || '';icon.title=studio.name || '';icon.decoding='async';icon.hidden=true;
  linkStudio(icon);
  icon.onload=()=>{if(icon.isConnected){icon.hidden=false;metaHead.classList.remove('hide');if(icon.dataset.studioId && L.Controller && L.Controller.enabled().name==='full_start')L.Controller.collectionAppend(window.jQuery(icon));}};
  icon.onerror=()=>icon.remove();metaHead.prepend(icon);icon.src=L.TMDB.image('/t/p/w300'+studio.path);
 }
 const directStudio=pickStudio(card,movie.media_type);showStudio(directStudio);
 function showLogo(path,studio,language){
  showStudio(studio);
  if(!path || !title.isConnected)return;
  const image=document.createElement('img');image.className='minimal-detail-logo';image.alt=card.title || card.name || '';image.decoding='async';
  image.onload=()=>{if(title.isConnected){const translated=language!==String(L.Storage.get('language','ru') || 'ru').slice(0,2);title.classList.toggle('pt-hidden',!!(left || !translated) && document.body.classList.contains('lampa_view'));title.classList.toggle('minimal-detail-translation',translated && !left);image.classList.toggle('minimal-detail-logo--translated',translated && !left);image.classList.add('loaded');}};
  image.onerror=()=>{image.remove();title.classList.remove('pt-hidden','minimal-detail-translation');};
  title.before(image);image.src=L.TMDB.image('/t/p/original'+path);
 }
 const supplied=chooseLogo((event.data.images || card.images || {}).logos,L.Storage.get('language','ru'));
 if(supplied){showLogo(supplied.file_path,null,supplied.iso_639_1);if(metaHead && !directStudio)loadLogo(movie,(path,studio)=>showStudio(studio));}else loadLogo(movie,showLogo);
 const background=body.querySelector('.full-start__background');
 if(background && card.backdrop_path){
  const size=artworkSize(L,'backdrop');
  const preload=new Image();preload.onload=()=>{if(background.isConnected && artworkSize(L,'backdrop')===size)background.src=preload.src;};preload.src=L.TMDB.image('/t/p/'+size+card.backdrop_path);
 }
}
