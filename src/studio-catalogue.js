import studioContrast from './studio-contrast.js';
// Carry the already resolved studio into its native catalogue. No extra API call.
export default function studioCatalogue(L){
 const known=new Map();
 function decorate(){
  const active=L.Activity.active() || {},key=active.component==='company'?'company:'+active.id:active.networks?'network:'+active.networks:active.companies?'company:'+active.companies:'',studio=active.minimal_studio || known.get(key),activity=active.activity;
  if(studio && key){known.delete(key);known.set(key,studio);if(known.size>32)known.delete(known.keys().next().value);}
  if(!studio || !['company','category_full'].includes(active.component) || !/^\/[^\s]+\.(png|webp|svg)$/i.test(studio.path || '') || !activity)return;
  const root=activity.render(true);if(!root || root.querySelector('.minimal-studio-heading'))return;
  function mount(){
   const body=root.querySelector('.scroll__body');if(!body)return false;
   const heading=document.createElement('header');heading.className='minimal-studio-heading';
   const image=document.createElement('img');image.alt=studio.name || active.title || '';image.decoding='async';image.hidden=true;
   const name=document.createElement('h1');name.textContent=studio.name || active.title || '';
   image.onload=()=>{image.hidden=false;studioContrast(image);name.hidden=true;const focused=body.querySelector('.card.focus');if(scroll && focused)scroll.update(focused);};image.onerror=()=>image.remove();
   heading.append(image,name);body.prepend(heading);root.classList.add('minimal-studio-catalogue');
   // Native grid focus scrolls the first card to the top and can cut off a
   // preceding studio logo on TV. Keep the heading visible for the first row.
   const scroll=body.closest('.scroll').Scroll;
   if(scroll){const update=scroll.update;scroll.update=function(element,center){const target=element && (element.nodeType?element:element[0]),first=body.querySelector('.card'),card=target && target.closest('.card');if(target && first && (target.contains(first) || card && card.parentNode===first.parentNode && card.offsetTop===first.offsetTop))return update.call(this,heading,false);return update.apply(this,arguments);};scroll.update(heading,false);}
   image.src=L.TMDB.image('/t/p/w780'+studio.path);return true;
  }
  if(mount())return;
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(root,{childList:true,subtree:true});
  const component=activity.component;if(component && component.use)component.use({onDestroy:()=>observer.disconnect()});
 }
 if(L.Listener)L.Listener.follow('activity',event=>{if(event.type==='start')decorate();});decorate();
}
