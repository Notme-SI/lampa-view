import watchHistory from './watch-history.js';
import {text as t} from './i18n.js';

function compactHistory(L,enabled){
 const select=L.Select,listener=select?.listener,$=window.jQuery;
 if(!listener || !$)return;
 listener.follow('preshow',({active})=>{
  if(!enabled() || L.Activity.active()?.component!=='watch_history' || !Array.isArray(active?.items))return;
  const head=active.items.find(item=>item.html?.hasClass?.('watch-history-days__head'))?.html;
  const open=active.items.find(item=>item.open && item.html?.hasClass?.('watch-history-days__continue'));
  if(!head || !open)return;
  const title=head.find('.watch-history-days__title').text().trim() || active.title;
  const journalTitle=active.title;
  const days=active.items.filter(item=>item.html?.hasClass?.('watch-history-days__day'));
  const lastLabel=L.Lang.translate('watch_history_last_episode');
  const last=head.find('.watch-history-days__text').toArray().map(node=>node.textContent.trim()).find(label=>label.startsWith(lastLabel+':'));
  const next=open.html.find('.watch-history-days__continue-title').text().trim()===L.Lang.translate('title_continue_two');
  const value=open.html.find('.watch-history-days__continue-value').text().trim().replace(', ',' · ');
  const primary={title:t('Открыть карточку'),subtitle:next && value?t('Далее · {0}',[value]):value,open:true,selected:true,
   onDraw:item=>item.addClass('pt-history-open')};
  const summary={html:$('<div class="pt-history-last">').text(last || ''),noenter:true};
  const journal={title:journalTitle,onDraw:item=>item.addClass('pt-history-journal-link'),onSelect:()=>{
   select.show({
    title:journalTitle,nomark:true,ptHistoryScreen:'journal',
    items:days.map(day=>{
     const html=day.html.clone(false);
     html.find('.watch-history-days__season').each(function(){
      const season=$(this),number=/^S(\d+)$/.exec(season.text().trim());
      if(number){
       const episode=season.next('.watch-history-days__episodes');
       const label=L.Lang.translate('watch_history_season_n').replace('{n}',Number(number[1]));
       episode.text([label,episode.text()].filter(Boolean).join(' · '));
      }
      season.remove();
     });
     return {html,noenter:true};
    }),
    onBack:()=>select.show({...active,items:[...(last?[summary]:[]),{...primary,selected:false},{...journal,selected:true}]})
   });
  }};
  Object.assign(active,{title,ptHistoryScreen:'summary',items:[...(last?[summary]:[]),primary,...(days.length?[journal]:[])]});
 });
 listener.follow('fullshow',({active,html})=>{
  html?.toggleClass?.('pt-history-compact',active?.ptHistoryScreen==='summary');
  html?.toggleClass?.('pt-history-journal',active?.ptHistoryScreen==='journal');
 });
}

export default function historyCards(L,enabled){
 watchHistory(L);
 compactHistory(L,enabled);
 function activate(event){
  if(!enabled() || !L.Activity || !L.Activity.active)return;
  const active=L.Activity.active() || {};
  if(active.component!=='favorite' || active.type!=='history')return;
  const node=event.target.closest && event.target.closest('.card');
  if(!node || !node.closest('.activity--active'))return;
  if(event.target.closest('.card__more,.card__menu,.card__favorite'))return;
  const card=node.card_data || node._minimalCardData;
  if(!card || !card.id)return;
  event.preventDefault();event.stopImmediatePropagation();
  L.Activity.push({component:'full',id:card.id,url:'',method:card.media_type || (card.name || card.original_name || card.first_air_date?'tv':'movie'),source:card.source || L.Storage.get('source','cub'),card});
 }
 document.addEventListener('click',activate,true);
 document.addEventListener('hover:enter',activate,true);
}
