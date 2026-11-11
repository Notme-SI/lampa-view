import studioContrast from './studio-contrast.js';
import {text as lampaViewText} from './i18n.js';
import {namedPartCount} from './episode-metadata.js';
import {localizedTitle,isAnime} from './metadata.js';
import {chooseLogo,pickStudio} from './logos.js';
import comments from './comments.js';
import {artworkSize,logoSize,detailBackdrop,officialBanner} from './artwork.js';
import {onlineButton,watchActions} from './watch-actions.js';
import {prepareScreenshotRow,styleScreenshots,nextDetailEpisode,orderDetailSections,styleSuggestions,removeDetailRows} from './detail-gallery.js';
export function releaseDate(card){
 const raw=String(card.release_date || card.first_air_date || ''),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
 if(!match)return /^\d{4}$/.test(raw) && Number(raw)>0?raw:'';
 const [year,month,day]=match.slice(1).map(Number),date=new Date(year,month-1,day);
 if(year<100 || date.getFullYear()!==year || date.getMonth()!==month-1 || date.getDate()!==day)return '';
 return day+' '+[lampaViewText("января"),lampaViewText("февраля"),lampaViewText("марта"),lampaViewText("апреля"),lampaViewText("мая"),lampaViewText("июня"),lampaViewText("июля"),lampaViewText("августа"),lampaViewText("сентября"),lampaViewText("октября"),lampaViewText("ноября"),lampaViewText("декабря")][month-1]+' '+year;
}
const overviewControls=new Set();let overviewDocument;
function overviewFocus(target){
 const active=document.activeElement;if(active && active.matches('.minimal-overview-action,.minimal-detail-studio') && active!==target && !active.contains(target))active.blur();
 for(const control of overviewControls){if(!control.isConnected){overviewControls.delete(control);continue;}const ring=control.querySelector('.minimal-overview-focus');if(ring)ring.hidden=!(target===control || control.contains(target));}
}
function readableOverview(L,card,right,link){
 if(!card.overview || !String(card.overview).trim())return;
 let text=right.querySelector('.full-start-new__description,.minimal-detail-overview');
 if(!text){text=document.createElement('p');text.className='minimal-detail-overview';text.textContent=card.overview;right.appendChild(text);}
 if(text.parentElement.classList.contains('minimal-overview-action'))return;
 const control=document.createElement('div');control.className='minimal-overview-action selector';text.before(control);control.appendChild(text);
 text.classList.remove('minimal-overview-action','selector','focus');
 const ring=document.createElement('span');ring.className='minimal-overview-focus';ring.setAttribute('aria-hidden','true');ring.hidden=true;control.appendChild(ring);overviewControls.add(control);
 if(overviewDocument!==document){overviewDocument=document;for(const name of ['hover:focus','hover:hover','focusin'])document.addEventListener(name,event=>overviewFocus(event.target),true);}
 control.setAttribute('role','button');control.setAttribute('tabindex','0');control.setAttribute('aria-haspopup','dialog');control.setAttribute('aria-label',lampaViewText("Прочитать описание полностью"));control.title=lampaViewText("Прочитать описание полностью");
 function remember(){if(link && link.items && link.items[0])link.items[0].last=control;}
 function open(){
  if(!text.isConnected || L.Modal.opened())return;
  remember();const content=document.createElement('div');content.className='about minimal-overview-full';content.textContent=card.overview;
  L.Modal.open({title:lampaViewText("Описание"),size:'large',html:window.jQuery(content),onBack:()=>{L.Modal.close();if(text.isConnected){remember();L.Controller.toggle('full_start');}}});
 }
 control.addEventListener('hover:focus',remember);control.addEventListener('hover:enter',open);
 control.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
 control.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});
}
function moveTechnicalDetails(L,card,right,episodeBook){
 const line=right.querySelector('.full-start-new__details'),genres=(card.genres || []).slice(0,5).map(g=>g.name).join(' | ').trim().toLowerCase(),prefix=L.Lang && L.Lang.translate?L.Lang.translate('player_quality')+':':lampaViewText("Качество:");
 let duration='',quality='';
 if(line){
  const parts=namedPartCount(card),nextPrefix=L.Lang.translate('full_next_episode')+':';
  if(parts>Number(card.number_of_seasons)){const prefix=(L.Lang.translate('title_seasons') || '')+':',counter=Array.from(line.children).find(part=>part.textContent.trim().startsWith(prefix));if(counter)counter.textContent=prefix+' '+parts;}
  const retained=Array.from(line.children).filter(part=>{
   if(part.classList.contains('full-start-new__split'))return false;
   const text=(part.textContent || part.innerText || '').trim();
   if(!text || text.startsWith(nextPrefix))return false;
   if(/^\d{1,3}:\d{2}$/.test(text)){duration=text;return false;}
   if(genres && text.toLowerCase()===genres)return false;
   if(text.toLowerCase().startsWith(prefix.toLowerCase())){quality=text.slice(prefix.length).trim();return false;}
   return true;
  });
  const dated=nextDetailEpisode(card,episodeBook);
  const date=dated || ((card.media_type==='tv' || card.original_name || card.first_air_date) && ['tmdb','cub'].includes(card.source) && L.TimeTable?.get?nextDetailEpisode(card,{episodes:L.TimeTable.get(card)}):null);
  if(date){const node=document.createElement('time');node.className='minimal-detail-next-episode';node.dateTime=date.iso;node.textContent=lampaViewText('Следующая серия: {0}',[date.label])+' / '+L.Lang.translate('full_episode_days_left')+': '+date.remainingDays;retained.push(node);}
  while(line.firstChild)line.removeChild(line.firstChild);
  retained.forEach((part,index)=>{if(index){const split=document.createElement('span');split.className='full-start-new__split';split.textContent='·';line.appendChild(split);}line.appendChild(part);});
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
 // Native credits already carry their intended billing. Keep that order,
 // including native directors before any aggregate-credit supplements.
 const known=unique(persons.cast || []);
 const hasPortrait=person=>!!String(person.profile_path || person.img || '').trim() && !/(?:^|\/)(?:actor|img_broken)\.svg(?:$|\?)/i.test(person.profile_path || person.img);
 const cast=known.filter(hasPortrait);
 const directors=unique((persons.crew || []).filter(p=>p.job==='Director').map(person=>({...person,profile_path:person.profile_path || (known.find(actor=>String(actor.id || actor.name)===String(person.id || person.name)) || {}).profile_path}))).filter(hasPortrait).slice(0,3),ids=new Set(directors.map(p=>String(p.id || p.name)));
 data.persons={...persons,crew:(persons.crew || []).filter(p=>p.job!=='Director'),cast:[...directors.map(p=>{const actor=cast.find(a=>String(a.id || a.name)===String(p.id || p.name));return {...p,...actor,job:'Director',minimal_director:true,character:[lampaViewText("Режиссёр"),actor && actor.character].filter(Boolean).join(' · ')};}),...cast.filter(p=>!ids.has(String(p.id || p.name))).slice(0,20)]};
 const disabled=window.lampa_settings && window.lampa_settings.disable_features || {};
 if(!disabled.discuss)data.discuss={...(data.discuss || {}),result:((data.discuss || {}).result || []).slice()};
 if(!data.reactions || !Array.isArray(data.reactions.result))data.reactions={result:[]};
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
function restoreDetailRows(L,link,data){
 if(!link || !Array.isArray(link.rows) || !Array.isArray(link.items))return;
 // Keyword-based restrictions can omit these informational rows even though
 // the full response already contains them. Use the native components so their
 // controllers, discussion actions and destroy handlers stay intact.
 const missing=[],cast=data.persons && data.persons.cast || [];
 const actorsTitle=L.Lang.translate('title_actors');
 const hasCast=link.rows.some(row=>Array.isArray(row) && row[0]==='persons' && (row[1].title===actorsTitle || (row[1].results || []).some(person=>cast.some(actor=>actor.id===person.id))));
 if(cast.length && !hasCast)missing.push(['persons',{results:cast,title:actorsTitle}]);
 const disabled=window.lampa_settings && window.lampa_settings.disable_features || {};
 if(!disabled.discuss && data.discuss && !link.rows.some(row=>Array.isArray(row) && row[0]==='discuss')){
  const results=data.discuss.result || [];
  missing.push(['discuss',{...data.discuss,movie:data.movie,title:L.Lang.translate('title_comments'),results}]);
 }
 for(const [key,label] of [['collection','title_collection'],['recomend','title_recomendations'],['simular','title_similar']]){
  const supplied=data[key],title=L.Lang.translate(label);
  if(!supplied || !Array.isArray(supplied.results) || !supplied.results.length)continue;
  const exists=link.rows.some(row=>Array.isArray(row) && row[0]==='cards' && (row[1]===supplied || row[1].title===title));
  if(!exists)missing.push(['cards',{...supplied,title}]);
 }
 // Insert after the built prefix. The existing cast/comment placement below
 // moves both rows and controller items together once they are constructed.
 if(missing.length)link.rows.splice(link.items.length,0,...missing);
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
 if(event && event.type==='start' && event.data){
  const card=event.data.movie,size=artworkSize(L,'detail-backdrop');
  const needed=document.body.classList.contains('pt-tv')?3840:Math.ceil((window.innerWidth || 1920)*Math.min(2,window.devicePixelRatio || 1));
  const selected=officialBanner(card,size==='original') || detailBackdrop((event.data.images || card.images || {}).backdrops || [],card.backdrop_path,needed,L.Storage?.get?.('language','ru') || 'ru');
  // Native Full requests the background immediately after this event. Choose
  // the final scene and resolution now, before it can show another backdrop.
  const background=selected && (/^https?:\/\//i.test(selected)?selected:L.TMDB.image('/t/p/'+size+selected,{preserveSize:true}));
  if(background)event.data.movie={...card,backdrop_path:background};
  prepareDetail(event.data);prepareScreenshotRow(event);return;
 }
 if(event && event.type==='build' && event.name==='cards' && event.item)styleSuggestions(L,event);
 if(event && event.type==='build' && event.name==='episodes' && event.item){styleScreenshots(L,event);return;}
 if(event && event.type==='build' && event.name==='discuss' && event.item){const render=event.item.render(true),node=render && (render.nodeType?render:render[0]);comments(L,node);}
 if(event && event.type==='build' && event.name==='persons' && event.item && event.data && (event.data.title===L.Lang.translate('title_actors') || (event.data.results || []).some(p=>Object.prototype.hasOwnProperty.call(p,'character')))){
  const render=event.item.render(true),node=render && (render.nodeType?render:render[0]);
  if(node){node.classList.add('minimal-cast-native');const heading=node.querySelector('.items-line__title');if(heading)heading.textContent=lampaViewText("Режиссёры и актёры");const container=event.body && event.body[0] && event.body[0].querySelector('.minimal-detail-columns');mountCast(container,node);}
  return;
 }

 if(!event || event.type!=='complite' || !event.data || !event.data.movie)return;
 const card=event.data.movie,body=event.body && (event.body.nodeType?event.body:event.body[0]);if(!body)return;
 const title=body.querySelector('.full-start-new__title'),right=body.querySelector('.full-start-new__right');
 if(!title || !right || right.dataset.minimalDetail)return;
 right.dataset.minimalDetail='1';
 // Keep native description/genres as a fallback until the replacement header
 // exists; other Lampa templates must never lose their only description row.
 readableOverview(L,card,right,event.link);
 removeDescription(event.link);
 removeDetailRows(event.link,row=>Array.isArray(row) && row[0]==='episodes' && !row[1]?.minimal_gallery);
 restoreDetailRows(L,event.link,event.data);
 const technical=moveTechnicalDetails(L,card,right,event.data.episodes);
 const animeBase=window.LampaView && window.LampaView.animeBase;
 if(isAnime(card)){
  const prefix=L.Lang.translate('title_seasons')+':';
  const counter=Array.from(right.querySelectorAll('.full-start-new__details>*')).find(node=>node.textContent.trim().startsWith(prefix));
  const season=Array.isArray(card.seasons)?card.seasons.find(row=>row && Number(row.season_number)===1):null;
  const count=Number(season && season.episode_count || card.number_of_episodes);
  if(counter && card.minimal_detail_seasons>0)counter.textContent=prefix+' '+card.minimal_detail_seasons;
  if(card.minimal_detail_episodes>0){const epPrefix=L.Lang.translate('title_episodes')+':',epCounter=Array.from(right.querySelectorAll('.full-start-new__details>*')).find(node=>node.textContent.trim().startsWith(epPrefix));if(epCounter)epCounter.textContent=epPrefix+' '+card.minimal_detail_episodes;}
  if(counter && !card.minimal_detail_ready && Number(card.number_of_seasons)===1 && count>1 && count<=3000 && animeBase && animeBase.groups){
   let settled=false;
   const show=groups=>{
    if(settled)return;
    settled=true;
    clearTimeout(timeout);
    if(groups && groups.length>1)counter.textContent=prefix+' '+groups.length;
    counter.hidden=false;
   };
   counter.hidden=true;
   const timeout=setTimeout(()=>show(null),3500);
   animeBase.groups(card,Array.from({length:count},(_,i)=>i+1),show);
  }
 }
 const episodes=right.querySelector('.full-start-new__details'),ratings=right.querySelector('.full-start-new__rate-line');if(episodes && ratings)right.insertBefore(episodes,ratings);
 const start=right.closest('.full-start-new'),left=start && start.querySelector('.full-start-new__left'),buttons=right.querySelector('.full-start-new__buttons');
 const reaction=body.querySelector('.button--reaction');if(reaction){reaction.title=lampaViewText("Оставить реакцию");reaction.setAttribute('aria-label',lampaViewText("Оставить реакцию"));}
 if(left){
  left.classList.add('minimal-detail-identity');left.appendChild(title);if(buttons)left.appendChild(buttons);
  const syncPoster=()=>{
   const image=left.querySelector('.full-start-new__img');
   if(image && card.poster_path && document.body.classList.contains('pt-detail-poster') && !image.dataset.minimalPoster){
    image.dataset.minimalPoster='1';image.src=L.TMDB.image('/t/p/'+artworkSize(L,'poster')+card.poster_path);
   }
  };
  syncPoster();document.addEventListener('minimal:detail-layout',syncPoster);
  if(event.link && event.link.use)event.link.use({onDestroy:()=>document.removeEventListener('minimal:detail-layout',syncPoster)});
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
  const facts=document.createElement('aside');facts.className='minimal-detail-facts';const heading=document.createElement('h3');heading.textContent=lampaViewText("О произведении");facts.appendChild(heading);
  const series=card.media_type==='tv' || card.name || card.first_air_date;
  const rows=[[lampaViewText("Оригинальное название"),card.original_title || card.original_name],[lampaViewText("Тип"),isAnime(card)?(series?lampaViewText("Аниме-сериал"):lampaViewText("Аниме-фильм")):(series?lampaViewText("Сериал"):lampaViewText("Фильм"))],[lampaViewText("Дата релиза"),releaseDate(card)],[series?lampaViewText("Длительность серии"):lampaViewText("Длительность"),technical.duration],[lampaViewText("Тип релиза"),technical.quality],[lampaViewText("Рейтинг TMDB"),card.vote_average?Number(card.vote_average).toFixed(1):''],[lampaViewText("Жанры"),(card.genres || []).map(g=>g.name).join(', ')]];
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
 orderDetailSections(event.link);
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
   icon.dataset.studioId=String(studio.id);icon.classList.add('selector');icon.setAttribute('role','button');icon.tabIndex=0;icon.setAttribute('aria-label',lampaViewText("Проекты {0}", [studio.name]));icon.title=lampaViewText("Проекты {0}", [studio.name]);
   const open=()=>{if(!icon.isConnected)return;L.Activity.push(studio.kind==='network'?{component:'category_full',source:'tmdb',url:'discover/tv',networks:studio.id,sort_by:'popularity.desc',title:studio.name,page:1,minimal_studio:{...studio}}:{component:'company',source:'tmdb',url:movie.media_type,id:studio.id,title:studio.name,minimal_studio:{...studio}});};
   window.jQuery(icon).on('hover:enter',open).on('hover:focus',()=>{if(event.link && event.link.items && event.link.items[0])event.link.items[0].last=icon;});
   icon.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
   icon.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});
  }
  const existing=metaHead.querySelector('.minimal-detail-studio');if(existing){linkStudio(existing);return;}
  const icon=document.createElement('img');icon.className='minimal-detail-studio';icon.alt=studio.name || '';icon.title=studio.name || '';icon.decoding='async';icon.hidden=true;
  linkStudio(icon);
  icon.onload=()=>{if(icon.isConnected){icon.hidden=false;studioContrast(icon);metaHead.classList.remove('hide');if(icon.dataset.studioId && L.Controller && L.Controller.enabled().name==='full_start')L.Controller.collectionAppend(window.jQuery(icon));}};
  icon.onerror=()=>icon.remove();metaHead.prepend(icon);icon.src=L.TMDB.image('/t/p/w300'+studio.path,{preserveSize:true});
 }
 // Give the studio an explicit path from the action column. Spatial
 // navigation otherwise prefers a nearer bookmark/reaction button.
 const headerItem=event.link && event.link.items && event.link.items[0];
 const wiredStudioControllers=new WeakSet();
 const wireStudioController=controller=>{
  if(wiredStudioControllers.has(controller))return;wiredStudioControllers.add(controller);
  const rightMove=controller.right,leftMove=controller.left;
  controller.right=function(){const focused=start && start.querySelector('.focus'),studio=metaHead && metaHead.querySelector('.minimal-detail-studio.selector:not([hidden])');if(studio && focused && focused.classList.contains('button--play')){headerItem.last=studio;L.Controller.collectionFocus(window.jQuery(studio),window.jQuery(start));}else if(rightMove)rightMove.apply(this,arguments);};
  controller.left=function(){const focused=start && start.querySelector('.focus'),watch=start && start.querySelector('.button--play');if(focused && focused.classList.contains('minimal-detail-studio') && watch){headerItem.last=watch;L.Controller.collectionFocus(window.jQuery(watch),window.jQuery(start));}else if(leftMove)leftMove.apply(this,arguments);};
 };
 if(headerItem && headerItem.use){headerItem.use({onController:wireStudioController});const enabled=L.Controller.enabled && L.Controller.enabled();if(enabled && enabled.controller && enabled.controller.link===headerItem)wireStudioController(enabled.controller);}
 const directStudio=pickStudio(card,movie.media_type);showStudio(directStudio);
 function showLogo(path,studio,language){
  showStudio(studio);
  if(!path || !title.isConnected)return;
  const image=document.createElement('img');image.className='minimal-detail-logo';image.alt=card.title || card.name || '';image.decoding='async';image.fetchPriority='high';
  image.onload=()=>{if(title.isConnected){const translated=language!==String(L.Storage.get('language','ru') || 'ru').slice(0,2);title.classList.toggle('pt-hidden',!!(left || !translated) && document.body.classList.contains('lampa_view'));title.classList.toggle('minimal-detail-translation',translated && !left);image.classList.toggle('minimal-detail-logo--translated',translated && !left);image.classList.add('loaded');}};
  image.onerror=()=>{image.remove();title.classList.remove('pt-hidden','minimal-detail-translation');};
  title.before(image);image.src=L.TMDB.image('/t/p/'+(/\.svg$/i.test(path)?'original':logoSize())+path,{preserveSize:true});
 }
 const supplied=chooseLogo((event.data.images || card.images || {}).logos,L.Storage.get('language','ru'));
 if(supplied){showLogo(supplied.file_path,null,supplied.iso_639_1);if(metaHead && !directStudio)loadLogo(movie,(path,studio)=>showStudio(studio));}else loadLogo(movie,showLogo);
 let background=body.querySelector('.full-start__background');
 // The native mobile template omits the backdrop entirely, even when enabled.
 if(!background && start && card.backdrop_path){
  background=document.createElement('img');background.className='full-start__background';background.alt='';background.decoding='async';
  background.onload=()=>background.classList.add('loaded');start.prepend(background);
 }
 if(background && start){
  start.classList.add('minimal-detail-backdrop');
  let shade=body.querySelector('.minimal-detail-shade');
  if(!shade){shade=document.createElement('div');shade.className='minimal-detail-shade';shade.setAttribute('aria-hidden','true');background.after(shade);}
  // This image is a sibling of the header. Follow the complete header,
  // including asynchronously mounted cast, instead of a fixed 58vh cutoff.
  const fit=()=>{if(!start.isConnected)return;const rect=background.getBoundingClientRect(),scale=rect.height/(background.offsetHeight || rect.height) || 1,height=(start.getBoundingClientRect().bottom-rect.top)/scale;if(height>0){background.style.setProperty('--pt-detail-backdrop-height',height+'px');shade.style.height=height+'px';}};
  fit();const resize=window.ResizeObserver?new ResizeObserver(fit):null;if(resize)resize.observe(start);
  if(event.link && event.link.use)event.link.use({onDestroy:()=>{if(resize)resize.disconnect();}});
 }
 if(background && card.backdrop_path){
  if(/^https?:\/\//i.test(card.backdrop_path)){
   if(!background.getAttribute('src'))background.src=card.backdrop_path;
   background._minimalArtwork=()=>{
    const url=officialBanner(card,artworkSize(L,'detail-backdrop')==='original');
    if(!url)return false;
    if(background.src!==url)background.src=url;
    return true;
   };
   return;
  }
  const variants=(event.data.images || card.images || {}).backdrops || [],needed=document.body.classList.contains('pt-tv')?3840:Math.ceil((window.innerWidth || 1920)*Math.min(2,window.devicePixelRatio || 1));
  const backdrop=detailBackdrop(variants,card.backdrop_path,needed,L.Storage.get('language','ru'));
  const size=artworkSize(L,'detail-backdrop');
  const url=L.TMDB.image('/t/p/'+size+backdrop,{preserveSize:true});
  const variant='/t/p/'+size+backdrop;
  if(background.src!==url && !background.src.includes(variant)){
   const preload=new Image();
   preload.onload=()=>{if(background.isConnected && artworkSize(L,'detail-backdrop')===size){background.src=preload.src;background.classList.add('loaded');}};
   preload.src=url;
  }
 }
}
