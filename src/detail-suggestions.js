// Keep native full-card rows and their ordering, but create only a small
// destination control until the viewer actually requests a suggestion list.
const nodeOf=item=>{const node=item?.render?.(true);return node?.nodeType?node:node?.[0];};
const escape=value=>String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const matches=(L,row)=>Array.isArray(row) && row[0]==='cards' &&
 [L.Lang.translate('title_recomendations'),L.Lang.translate('title_similar')].includes(row[1]?.title);

function choice(L,link,data){
 const root=document.createElement('div');root.className='minimal-anime-franchise minimal-detail-suggestions minimal-suggestions-choice';
 const control=document.createElement('button');control.type='button';control.className='minimal-anime-franchise__button minimal-suggestions-button selector';
 control.setAttribute('aria-expanded','false');control.setAttribute('aria-haspopup','dialog');
 control.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9Z"/></svg><span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 control.querySelector('span').textContent=data.title;root.appendChild(control);
 const hooks={};let disposed=false,panel;
 const cleanup=()=>{panel?.classList.remove('minimal-suggestions-menu','minimal-franchise-menu');panel=null;control.setAttribute('aria-expanded','false');};
 const item={
  minimalSuggestions:true,data,create(){},visible(){},use(values){Object.assign(hooks,values);},render(js){return js?root:window.jQuery(root);},
  activate(){link.active=link.items.indexOf(item);hooks.onActive?.();},
  toggle(){
   if(disposed)return;item.activate();
   const call=(key,event)=>()=>hooks[key]?hooks[key]():link.emit(event);
   L.Controller.add('minimal_suggestions',{link:item,toggle(){L.Controller.collectionSet(root);L.Controller.collectionFocus(control,root);if(hooks.onToggle)hooks.onToggle();else link.scroll.update(root);},
    up:call('onUp','up'),down:call('onDown','down'),back:call('onBack','back'),left:call('onLeft','left'),right(){}});
   L.Controller.toggle('minimal_suggestions');
  },
  destroy(){disposed=true;if(panel)L.Select.hide();cleanup();L.Select.listener?.remove?.('hide',cleanup);window.jQuery(control).off();root.remove();hooks.onDestroy?.();}
 };
 const back=()=>{L.Select.hide();cleanup();if(!disposed && control.isConnected){item.toggle();control.focus({preventScroll:true});}};
 function open(){
  if(disposed || !control.isConnected || control.getAttribute('aria-expanded')==='true')return;
  item.activate();control.setAttribute('aria-expanded','true');
  const source=link.object?.source || L.Activity.active()?.source || 'tmdb';
  const entries=data.results.map(card=>({title:escape(card.title || card.name),subtitle:escape(String(card.release_date || card.first_air_date || '').slice(0,4)),card}));
  L.Select.show({title:data.title,items:entries,onFullDraw(scroll){
   panel=scroll.body().closest('.selectbox')[0];panel.classList.add('minimal-franchise-menu','minimal-suggestions-menu');
   const rect=control.getBoundingClientRect(),width=Math.min(560,window.innerWidth-24),height=Math.min(520,window.innerHeight-24);
   const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
   const top=rect.bottom+height+20<=window.innerHeight?rect.bottom+8:Math.max(12,Math.min(rect.top-height-8,window.innerHeight-height-12));
   for(const [key,value] of Object.entries({left,top,width,height}))panel.style.setProperty('--franchise-'+key,value+'px');
   scroll.body().find('.selectbox-item').each((index,node)=>{
    const card=entries[index].card;node.classList.add('minimal-anime-franchise__item');
    const info=document.createElement('div');info.className='minimal-related-info';while(node.firstChild)info.appendChild(node.firstChild);
    const art=document.createElement('span');art.className='minimal-related-art';
    if(card.poster_path || card.img){const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';image.onerror=()=>image.remove();image.src=card.img || L.TMDB.image('/t/p/w185'+card.poster_path);art.appendChild(image);}
    node.appendChild(art);node.appendChild(info);
   });
  },onSelect(entry){
   const card=entry.card;if(!card)return back();
   L.Select.hide();cleanup();
   L.Activity.push({component:'full',source:card.source || source,id:card.id,method:card.media_type || (card.name || card.first_air_date?'tv':'movie'),card});
  },onBack:back});
 }
 L.Select.listener?.follow?.('hide',cleanup);
 window.jQuery(control).on('hover:focus hover:touch',item.activate).on('hover:enter',open);
 control.addEventListener('hover:enter',open);
 control.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open();});
 control.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();open();}});
 return item;
}

export default function installSuggestions(L,link){
 if(!link?.use || typeof link.emit!=='function' || !Array.isArray(link.rows) || !Array.isArray(link.items))return;
 if(!link._minimalSuggestions){
  link._minimalSuggestions=true;
  const emit=link.emit;
  link.emit=function(event,...args){
   const row=args[0];
   if(event==='createAndAppend' && matches(L,row) && row[1].results?.length){
    const item=choice(L,link,row[1]);
    emit.call(this,'instance',item);item.create();emit.call(this,'append',item);return;
   }
   return emit.call(this,event,...args);
  };
  link.use({onDestroy(){link.emit=emit;}});
 }
 // Enabling the plugin on an already open native card must release the old
 // poster rows as well, including their observers and image/layout work.
 link.rows.forEach((row,index)=>{
  const previous=link.items[index];if(!matches(L,row) || !previous || previous.minimalSuggestions)return;
  const owned=L.Controller.own?.(previous) || L.Controller.enabled?.()?.controller?.link===previous;
  const item=choice(L,link,row[1]),node=nodeOf(previous);
  item.use({onDown:()=>link.emit('down'),onUp:()=>link.emit('up'),onBack:()=>link.emit('back'),onLeft:()=>link.emit('left'),onToggle:()=>link.scroll.update(item.render(true))});
  node?.replaceWith(item.render(true));link.items[index]=item;previous.destroy?.();
  if(owned)item.toggle();
 });
}
