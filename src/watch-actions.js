// Reuse the installed online provider's own handler and card metadata.
export function onlineButton(root){
 return Array.from(root.querySelectorAll('.buttons--container>.full-start__button')).find(button=>{
  if(button.classList.contains('hide') || button.hidden)return false;
  const label=button.querySelector('span');
  return button.matches('.view--online,.button--online,.button--lampac') || /^(онлайн|online)$/i.test((label && label.textContent || button.getAttribute('title') || '').trim());
 }) || null;
}
export function watchActions(L,root,card,link){
 const buttons=root.querySelector('.full-start-new__buttons'),play=buttons && buttons.querySelector('.button--play');if(!play)return;
 const $=window.jQuery;
 function open(){
  const target=onlineButton(root);
  if(target){target.dispatchEvent(new Event('hover:enter',{bubbles:true}));return;}
  // A standalone Lampa can use Autopilot when no Online provider is installed.
  if(window.alc_auto_api && window.alc_auto_api.menu){window.alc_auto_api.menu(card);return;}
  L.Noty.show('Онлайн-источник не подключён');
 }
 const click=event=>{event.preventDefault();event.stopImmediatePropagation();open();};
 const enter=event=>{event.preventDefault();event.stopImmediatePropagation();open();};
 function update(){
  buttons.querySelectorAll('.button--alc-auto,.button--priority').forEach(button=>button.remove());
  play.classList.remove('minimal-source-hidden','hide');play.classList.add('selector');play.removeAttribute('aria-hidden');play.title='Смотреть';play.setAttribute('aria-label','Смотреть');
  const label=play.querySelector('span');if(label && label.textContent!=='Смотреть')label.textContent='Смотреть';
  $(play).off('hover:enter').on('hover:enter.lampaViewWatch',open);
 }
 update();play.addEventListener('click',click,true);play.addEventListener('hover:enter',enter,true);
 // Only action changes can affect this button; cast, images and badges cannot.
 const observer=window.MutationObserver?new MutationObserver(update):null;
 if(observer)observer.observe(buttons,{childList:true,subtree:true});
 if(link && link.use)link.use({onDestroy:()=>{if(observer)observer.disconnect();play.removeEventListener('click',click,true);play.removeEventListener('hover:enter',enter,true);$(play).off('.lampaViewWatch');}});
}
