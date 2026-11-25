import {text as lampaViewText,locale} from './i18n.js';
import {completedSeason,watchClock} from './series-status.js';
import {WATCHED_PERCENT} from './watch-threshold.js';
import watchHistory from './watch-history.js';

export function watchSummary(L,card,online,entry){
 const series=card.media_type!=='movie' && !!(card.name || card.original_name || card.first_air_date || card.media_type==='tv');
 const marks=L.Account?.Permit?.sync?L.Favorite?.cloud?.(card):L.Favorite?.check?.(card);
 const progress=series?online?.lastWatched?.(card):online?.reader?.(card)(0,0);
 const episode=series && (progress || entry?.last);
 const number=episode && Number(episode.episode)>0?
  (Number(episode.season)>0?lampaViewText('{0} сезон · {1} серия',[episode.season,episode.episode]):lampaViewText('Серия {0}',[episode.episode])):'';
 const time=progress?.time>0?watchClock(progress.time):'';
 if(!series && (marks?.viewed || progress?.percent>=WATCHED_PERCENT))return {label:lampaViewText('Фильм просмотрен'),number,time,complete:'movie'};
 if(series && completedSeason(L,card,online,progress))return {label:lampaViewText('Сезон {0} просмотрен',[progress.season]),number,time,complete:'season'};
 if(progress?.percent>=WATCHED_PERCENT && number)return {label:lampaViewText('{0} · просмотрено',[number]),number,time,complete:'episode'};
 if(progress && (number || time) && (progress.percent>0 || time)){
  return {label:[number,time].filter(Boolean).join(' · '),number,time,resume:true,duration:progress.duration,percent:progress.percent};
 }
 return {label:entry || marks?.history?number || lampaViewText('Есть в истории'):'',number,time};
}

export function showWatchState(L,card){
 const history=watchHistory(L),sync=window.LampaView?.sync,online=window.LampaView?.online;
 const widgets={};
 const refreshLabel=lampaViewText('Обновить историю');
 const labels={
  entry:lampaViewText('История просмотра'),
  position:lampaViewText('Время остановки'),
  updated:lampaViewText('Обновление истории')
 };
 function update(){
  const status=history.status();
  const summary=watchSummary(L,card,online,history.entry(card));
  const updated=status.lastSuccess?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(status.lastSuccess):'';
  const values={
   entry:summary.resume?summary.number || lampaViewText('Есть в истории'):summary.label || lampaViewText('Нет данных о просмотре'),
   position:summary.time || lampaViewText('Не сохранено'),
   updated:status.busy?lampaViewText('Обновляем историю…'):status.failed?
    [lampaViewText('Не удалось обновить историю'),updated].filter(Boolean).join(' · '):
    status.cloud?['CUB',updated].filter(Boolean).join(' · '):lampaViewText('На этом устройстве')
  };
  for(const key of Object.keys(labels))widgets[key]?.text(values[key]);
 }
 const unsubscribe=history.subscribe(update);
 const timeline=L.Timeline?.listener;
 const close=()=>{
  unsubscribe();
  timeline?.remove?.('update',update);timeline?.remove?.('read',update);
  L.Select.listener?.remove?.('hide',close);
  L.Account?.listener?.remove?.('profile_select',update);
 };
 timeline?.follow?.('update',update);timeline?.follow?.('read',update);
 L.Account?.listener?.follow?.('profile_select',update);
 L.Select.listener?.follow?.('hide',close);
 const items=Object.keys(labels).map(key=>({
  title:labels[key],subtitle:' ',noenter:true,
  onDraw:item=>{widgets[key]=item.find('.selectbox-item__subtitle');}
 }));
 if(history.status().cloud)items.push({title:refreshLabel,selected:true,onSelect:()=>{if(sync)sync.refresh(true);else history.refresh(true);update();}});
 L.Select.show({title:lampaViewText('Состояние просмотра'),items,nohide:true,onBack:()=>{close();L.Controller.toggle('full_start');}});
 update();
}

// Reuse the installed online provider's own handler and card metadata.
export function onlineButton(root){
 return Array.from(root.querySelectorAll('.buttons--container>.full-start__button')).find(button=>{
  if(button.classList.contains('hide') || button.hidden || button.matches('.shots-view-button,[data-action="shots"]'))return false;
  const label=button.querySelector('span');
  return button.matches('.view--online,.button--online,.button--lampac') || /^(онлайн|online)$/i.test((label && label.textContent || button.getAttribute('title') || '').trim());
 }) || null;
}
export function watchActions(L,root,card,link){
 const buttons=root.querySelector('.full-start-new__buttons'),play=buttons?.querySelector('.button--play');
 const info=root.querySelector('.full-start-new__right');if(!play || !info)return;
 const $=window.jQuery;
 const history=watchHistory(L),status=document.createElement('section');
 const heading=document.createElement('h3'),facts=document.createElement('dl'),note=document.createElement('p');
 status.className='minimal-detail-watch-status';
 heading.textContent=lampaViewText('Просмотр');
 status.appendChild(heading);status.appendChild(facts);status.appendChild(note);
 const overview=info.querySelector('.minimal-overview-action');
 if(overview)overview.after(status);else info.append(status);
 let rendered;
 function updateStatus(){
  const summary=watchSummary(L,card,window.LampaView?.online,history.entry(card));
  const title=lampaViewText(summary.resume?'Продолжить':'Смотреть'),label=play.querySelector('span');
  play.title=title;play.setAttribute('aria-label',title);
  if(label && label.textContent!==title)label.textContent=title;
  const position=summary.resume && summary.time?
   (summary.duration>0?lampaViewText('{0} из {1}',[summary.time,watchClock(summary.duration)]):summary.time):'';
  const rows=[
   [lampaViewText(summary.complete?'Последняя просмотренная серия':'Серия'),summary.number],
   [lampaViewText('Время остановки'),position],
   [lampaViewText('Просмотрено'),summary.resume && summary.percent>0?Math.round(summary.percent)+'%':'']
  ].filter(([,value])=>value);
  const message=summary.complete==='movie' || summary.complete==='season' || !rows.length?summary.label:'';
  const signature=JSON.stringify([rows,message]);
  if(signature===rendered)return;
  rendered=signature;
  status.hidden=!rows.length && !message;
  facts.hidden=!rows.length;
  note.hidden=!message;note.textContent=message;
  while(facts.firstChild)facts.removeChild(facts.firstChild);
  for(const [name,value] of rows){
   const row=document.createElement('div'),key=document.createElement('dt'),detail=document.createElement('dd');
   key.textContent=name;detail.textContent=value;
   row.appendChild(key);row.appendChild(detail);facts.appendChild(row);
  }
 }
 function open(){
  const target=onlineButton(root);
  if(target){target.dispatchEvent(new Event('hover:enter',{bubbles:true}));return;}
  // A standalone Lampa can use the bundled source coordinator when no online provider is installed.
  if(window.alc_auto_api && window.alc_auto_api.menu){window.alc_auto_api.menu(card);return;}
  L.Noty.show(lampaViewText("Онлайн-источник не подключён"));
 }
 const click=event=>{event.preventDefault();event.stopImmediatePropagation();open();};
 const enter=event=>{event.preventDefault();event.stopImmediatePropagation();open();};
 function update(){
  buttons.querySelectorAll('.button--alc-auto,.button--priority').forEach(button=>button.remove());
  play.classList.remove('minimal-source-hidden','hide');play.classList.add('selector');play.removeAttribute('aria-hidden');
  updateStatus();
  $(play).off('hover:enter').on('hover:enter.lampaViewWatch',open);
 }
 update();play.addEventListener('click',click,true);play.addEventListener('hover:enter',enter,true);
 // Only action changes can affect this button; cast, images and badges cannot.
 const observer=window.MutationObserver?new MutationObserver(update):null;
 if(observer)observer.observe(buttons,{childList:true,subtree:true});
 const stateChanged=event=>{if(event.target==='favorite' || event.target==='timeline')updateStatus();};
 if(link?.use){
  const unsubscribe=history.subscribe(updateStatus);
  L.Listener?.follow?.('state:changed',stateChanged);
  L.Timeline?.listener?.follow?.('update',updateStatus);
  L.Timeline?.listener?.follow?.('read',updateStatus);
  L.Account?.listener?.follow?.('profile_select',updateStatus);
  link.use({
   onToggle:updateStatus,
   onDestroy(){
    unsubscribe();
    L.Listener?.remove?.('state:changed',stateChanged);
    L.Timeline?.listener?.remove?.('update',updateStatus);
    L.Timeline?.listener?.remove?.('read',updateStatus);
    L.Account?.listener?.remove?.('profile_select',updateStatus);
    observer?.disconnect();
    play.removeEventListener('click',click,true);
    play.removeEventListener('hover:enter',enter,true);
    $(play).off('.lampaViewWatch');
   }
  });
 }
}
