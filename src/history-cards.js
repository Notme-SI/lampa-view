export default function historyCards(L,enabled){
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
