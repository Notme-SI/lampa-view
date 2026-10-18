import {animeMode} from './catalogue.js';
export default function animeTabs(L,item,object){
 const mode=animeMode(L,object),wrapper=document.createElement('div'),nav=document.createElement('div'),status=document.createElement('div'),message=document.createElement('div'),retry=document.createElement('button'),buttons=[],$=window.jQuery;
 wrapper.className='minimal-anime-controls';status.className='minimal-anime-status';status.setAttribute('role','status');message.textContent='Загрузка подборок…';retry.type='button';retry.className='minimal-anime-retry selector';retry.textContent='Повторить загрузку';retry.hidden=true;status.appendChild(message);status.appendChild(retry);wrapper.appendChild(nav);wrapper.appendChild(status);
 nav.className='minimal-anime-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Каталог аниме');
 let index=mode==='shikimori'?1:0,disposed=false,ready=false,focusOnStart=true;
 function focus(){if(disposed)return;if(item.scroll.immediate)item.scroll.immediate(wrapper,false);else item.scroll.update(wrapper,false);L.Controller.collectionSet(wrapper);L.Controller.collectionFocus(index===2?retry:buttons[index],wrapper);}
 function toggle(){if(disposed)return;L.Controller.add('minimal_anime_tabs',{link:wrapper,toggle:focus,left(){if(index>0){index--;focus();}else L.Controller.toggle('menu');},right(){index=Math.min(1,index+1);focus();},up(){if(index===2){index=mode==='shikimori'?1:0;focus();}else L.Controller.toggle('head');},down(){if(item.items && item.items.length){item.active=0;item.items[0].toggle();}else if(!retry.hidden){index=2;focus();}},back(){L.Activity.backward();}});L.Controller.toggle('minimal_anime_tabs');}
 [['standard','Стандартные'],['shikimori','Shikimori']].forEach(([value,title],i)=>{
  const button=document.createElement('button');button.type='button';button.className='minimal-anime-tab pt-hero__action selector';button.textContent=title;button.dataset.catalogue=value;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(mode===value));
  function choose(){if(disposed)return;index=i;if(value===mode)return toggle();L.Storage.set('minimal_anime_catalogue',value);L.Activity.replace({minimal_anime_catalogue:value,minimal_anime_focus_tabs:true});}
  $(button).on('hover:enter',choose).on('hover:focus',()=>{index=i;}).on('click',e=>{e.preventDefault();e.stopImmediatePropagation();choose();});
  nav.appendChild(button);buttons.push(button);
 });
 function reload(){if(disposed)return;const source=L.Api.sources.minimal_shiki;if(source && source.retry)source.retry();L.Activity.replace({minimal_anime_focus_tabs:true});}
 $(retry).on('hover:enter',reload).on('hover:focus',()=>{index=2;}).on('click',e=>{e.preventDefault();e.stopImmediatePropagation();reload();});
 item.use({
  onCreate(){item.scroll.prepend(wrapper);},
  onBuild(){ready=true;const state=object.minimal_catalogue_status && object.minimal_catalogue_status.state || 'empty';status.hidden=state==='ready';retry.hidden=state!=='error';message.textContent=state==='error'?'Не удалось загрузить '+(mode==='shikimori'?'Shikimori':'подборки')+'. Попробуйте ещё раз.':state==='hidden'?'Все подборки скрыты в настройках.':'В этом каталоге пока нет подборок.';},
  onAppend(row){if(item.items[0]===row)row.use({onUp:toggle});},
  onController(controller){const original=controller.toggle;controller.toggle=function(){if(focusOnStart || (ready && !item.items.length)){if(ready)focusOnStart=false;toggle();}else if(original)original.apply(this,arguments);};},
  onDestroy(){disposed=true;buttons.forEach(button=>$(button).off());$(retry).off();wrapper.remove();}
 });
}
