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
   image.onload=()=>{image.hidden=false;name.hidden=true;};image.onerror=()=>image.remove();
   heading.append(image,name);body.prepend(heading);root.classList.add('minimal-studio-catalogue');image.src=L.TMDB.image('/t/p/w780'+studio.path);return true;
  }
  if(mount())return;
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(root,{childList:true,subtree:true});
  const component=activity.component;if(component && component.use)component.use({onDestroy:()=>observer.disconnect()});
 }
 if(L.Listener)L.Listener.follow('activity',event=>{if(event.type==='start')decorate();});decorate();
}
