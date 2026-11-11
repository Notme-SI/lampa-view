import {text as lampaViewText} from './i18n.js';
const installed=new WeakSet();

function installReader(L){
 if(installed.has(L) || !L.Select?.show || !L.Modal?.open)return;
 installed.add(L);
 let opener;
 document.addEventListener('hover:enter',event=>{
  const card=event.target.closest?.('.full-review');
  if(!card || !document.body.classList.contains('lampa_view'))return;
  const activity=L.Activity.active();
  if(!card.closest('.minimal-comments-native') && activity?.component!=='discuss')return;
  opener=card;
  Promise.resolve().then(()=>{if(opener===card)opener=null;});
 },true);
 const show=L.Select.show;
 L.Select.show=function(options){
  const card=opener;
  if(!card || !options?.onFullDraw || L.Modal.opened())return show.apply(this,arguments);
  opener=null;
  const text=document.createElement('div');
  options.onFullDraw({body:()=>text});
  const message=text.textContent || (card.classList.contains('full-review--full-text') && card.querySelector('.full-review__text')?.textContent);
  if(!message)return show.apply(this,arguments);
  text.className='minimal-comment-text';
  text.textContent=message.trim();
  const activity=L.Activity.active(),scroll=activity?.activity?.component?.scroll,position=scroll?.position?.();
  const restore=()=>{
   if(L.Activity.active()!==activity || !card.isConnected)return;
   const line=card.closest('.items-line') || card.closest('.mapping--list') || card.parentElement;
   L.Controller.collectionFocus(card,line);
   if(scroll?.shift && Number.isFinite(position)){const delta=scroll.position()-position;if(delta)scroll.shift(delta);}
  };
  function close(action){
   L.Modal.close();
   if(action)options.onSelect(action);
   else options.onBack?.();
   restore();
  }
  const buttons=(options.items || []).filter(item=>item.like===1 || item.like===-1).map(item=>({
   name:L.Lang.translate(item.like===1?'title_like':'reactions_shit'),
   onSelect:()=>close(item)
  }));
  L.Modal.open({title:options.title,size:'large',html:window.jQuery(text),onBack:()=>close(),...(buttons.length?{buttons,buttons_position:'outside'}:{})});
  L.Modal.render().addClass('minimal-comment-reader');
 };
}

export default function comments(L,node){
 if(!node || node.dataset.minimalComments)return;
 installReader(L);
 node.dataset.minimalComments='1';node.classList.add('minimal-comments-native');
 const add=node.querySelector('.full-review-add');if(add){add.setAttribute('aria-label',lampaViewText("Написать комментарий"));add.title=lampaViewText("Написать комментарий");}
}
