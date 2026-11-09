import {text as t} from './i18n.js';
// Keep the catalogue list intact: native extensions and the menu editor own it.
export default function menuLayout(L,enabled){
 const $=window.jQuery;
 const excludedActions=/^(feed|dorama|catalog|myperson|relise|releases?|(?:my)?sports?|(?:my)?shots?)$/i;
 const excludedLabels=['Лента','Дорамы','Каталог','Персоны','Релизы','Спорт','Shots'];
 const removed=new Map();
 let menuButton,buttonSlot,hoverTimer;
 const expanded=()=>document.body.classList.contains('menu--open') || document.body.classList.contains('pt-menu-hover');
 function hover(open){
  clearTimeout(hoverTimer);
  if(open){if(enabled())document.body.classList.add('pt-menu-hover');groups();}
  else hoverTimer=setTimeout(()=>{
   if(panel?.matches(':hover') || menuButton?.matches(':hover'))return;
   document.body.classList.remove('pt-menu-hover');groups();
  },180);
 }
 function placeButton(menu){
  if(!document.body.classList.contains('pt-menu-pinned')){
   if(buttonSlot?.isConnected)buttonSlot.replaceWith(menuButton);
   menuButton=null;buttonSlot=null;
   return;
  }
  if(!menuButton){
   menuButton=document.querySelector('.head .head__menu-icon');
   if(!menuButton)return;
   buttonSlot=document.createComment('Lampa View menu button');
   menuButton.before(buttonSlot);
   if(!menuButton._lampaViewHover){menuButton._lampaViewHover=true;menuButton.addEventListener('pointerenter',()=>{if(document.body.classList.contains('pt-menu-pinned'))hover(true);});menuButton.addEventListener('pointerleave',()=>hover(false));}
  }
  if(expanded()){
   if(buttonSlot.isConnected && menuButton.previousSibling!==buttonSlot)buttonSlot.after(menuButton);
  }else if(menu.firstElementChild!==menuButton)menu.prepend(menuButton);
 }
 function exclude(){
  const menu=document.querySelector('.menu');if(!menu)return;
  for(const [node,anchor] of removed){
   if(!enabled() && anchor.isConnected)anchor.replaceWith(node);
   if(!anchor.isConnected)removed.delete(node);
  }
  if(!enabled())return;
  const labels=excludedLabels.flatMap(label=>[label.toLowerCase(),t(label).toLowerCase()]);
  for(const node of menu.querySelectorAll('.menu__item')){
   const label=node.querySelector('.menu__text')?.textContent.trim().toLowerCase();
   if(!excludedActions.test(node.dataset.action || '') && !labels.includes(label))continue;
   // The editor counts even CSS-hidden rows. A comment preserves the spot
   // when the theme is disabled without becoming a neighbour for Move Up/Down.
   const anchor=document.createComment('Lampa View menu');
   node.replaceWith(anchor);removed.set(node,anchor);
  }
 }
 function groups(){
  const menu=document.querySelector('.menu'),profile=document.querySelector('[data-action="minimal_profile"]');if(!menu || !profile)return;
  if(!menu._lampaViewPointer){menu._lampaViewPointer=true;menu.addEventListener('click',event=>{
   if(!enabled())return;const item=event.target.closest('.menu__item');if(!item || !menu.contains(item))return;
   event.preventDefault();event.stopImmediatePropagation();$(item).trigger('hover:enter');
  },true);}
  let account=menu.querySelector('.pt-menu-account');
  if(!account){account=document.createElement('div');account.className='menu__case nosort pt-menu-account';account.innerHTML='<ul class="pt-menu-account__list"></ul>';menu.prepend(account);}
  const list=account.firstElementChild;if(profile.parentNode!==list)list.prepend(profile);
  let notice=list.querySelector('[data-action="pt_notice"]');
  if(!notice){
   notice=document.createElement('li');notice.className='menu__item selector';notice.dataset.action='pt_notice';
   notice.innerHTML='<div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 5-1.1 6.4-2.1 7.5-.4.4-.1 1 .4 1h15.4c.5 0 .8-.6.4-1C19.1 15.4 18 14 18 9ZM10.4 20.5a1.8 1.8 0 0 0 3.2 0"/></svg></div><div class="menu__text"></div><span class="pt-menu-notices"></span>';
   $(notice).on('hover:enter',()=>{if(L.Notice && L.Notice.open)L.Notice.open();}).on('click',e=>{e.preventDefault();e.stopImmediatePropagation();$(notice).trigger('hover:enter');});list.appendChild(notice);
  }
  const label=notice.querySelector('.menu__text');if(label.textContent!==t('Уведомления'))label.textContent=t('Уведомления');
  // The native counter changes after startup and after reading a notification.
  const counter=notice.querySelector('.pt-menu-notices'),count=L.Notice && L.Notice.count?Number(L.Notice.count()) || 0:0;
  if(counter.textContent!==(count?String(count):''))counter.textContent=count?String(count):'';
  menu.querySelectorAll('.menu__item').forEach(node=>{const text=node.querySelector('.menu__text');if(text)node.setAttribute('aria-label',text.textContent);});
  const editor=menu.querySelector('[data-action="edit"] .menu__text');if(editor && editor.textContent!==t('Редактор меню'))editor.textContent=t('Редактор меню');
  const catalogue=menu.querySelector('.menu__list');
  const seasonal=Array.from(document.querySelectorAll('.head .pt-holiday-icons>.head__action'));
  menu.querySelectorAll('.pt-menu-seasonal').forEach(item=>{if(!seasonal.includes(item._nativeHoliday))item.remove();});
  for(const button of seasonal){
   if(!catalogue || Array.from(menu.querySelectorAll('.pt-menu-seasonal')).some(item=>item._nativeHoliday===button))continue;
   const glyph=button.querySelector('.pt-holiday-svg');if(!glyph)continue;
   const item=document.createElement('li');item.className='menu__item selector pt-menu-seasonal';item._nativeHoliday=button;
   const ico=document.createElement('div');ico.className='menu__ico';ico.appendChild(glyph.cloneNode(true));item.appendChild(ico);
   const text=document.createElement('div');text.className='menu__text';text.textContent=button.getAttribute('aria-label') || '';item.appendChild(text);
   $(item).on('hover:enter',()=>$(button).trigger('hover:enter'));catalogue.appendChild(item);
  }
  placeButton(menu);
 }
 let panel;
 function bind(){
  const next=document.querySelector('.wrap__left');if(next===panel || !next)return;panel=next;
  panel.addEventListener('pointerenter',()=>hover(true));
  panel.addEventListener('pointerleave',()=>hover(false));
 }
 function update(){
  const value=L.Storage.get('menu_always',false),pinned=enabled() && [true,'true',1,'1','yes'].includes(value);
  const changed=document.body.classList.contains('pt-menu-pinned')!==pinned;
  document.body.classList.toggle('pt-menu-pinned',pinned);
  if(!pinned)document.body.classList.remove('pt-menu-hover');
  if(pinned){
   const panel=document.querySelector('.wrap__left');if(panel)panel.classList.remove('wrap__left--hidden');
   if(changed && L.Controller.enabled().name==='menu')L.Controller.toggle('content');
  }
  if(changed && L.Layer && L.Layer.update)L.Layer.update();
  bind();groups();
 }
 update();
 if(L.Controller && L.Controller.listener)L.Controller.listener.follow('toggle',()=>{if(document.body.classList.contains('pt-menu-pinned'))groups();});
 if(L.Storage.listener)L.Storage.listener.follow('change',e=>{if(e.name==='menu_always' || e.name==='lampa_view_enabled')update();});
 if(L.Notice && L.Notice.listener)L.Notice.listener.follow('viewed',groups);
 if(L.Notice && L.Notice.drawCount){const draw=L.Notice.drawCount;L.Notice.drawCount=function(){const result=draw.apply(this,arguments);groups();return result;};}
 document.addEventListener('minimal:holidays',groups);
 return {update,groups,exclude};
}
