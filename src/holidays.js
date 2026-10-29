// Native seasonal scripts retain their artwork, actions and calendar.
// Watch only direct header insertions, never lamp opacity animation or app rows.
export default function holidays(L,enabled){
 const value=L.Head && L.Head.render(true),head=value && (value.nodeType?value:value[0]);
 if(!head)return {update(){}};
 function update(){
  const logo=head.querySelector('.head__logo-icon');if(!logo)return;
  if(logo.classList.contains('head__logo-halloween')){
   let art=logo.querySelector('.pt-holiday-art'),brand=logo.querySelector('.pt-brand');
   if(enabled()){
    if(!art){
     art=document.createElement('span');art.className='pt-holiday-art';
     for(const node of Array.from(logo.children))if(node.classList.contains('head__logo-halloween-fire') || node.classList.contains('head__logo-halloween-svg'))art.appendChild(node);
     logo.insertBefore(art,logo.firstChild);
    }
    if(!brand){brand=document.createElement('span');brand.className='pt-brand';brand.textContent='LAMPA';logo.appendChild(brand);}
   }else{
    if(brand)brand.remove();
    if(art){while(art.firstChild)logo.insertBefore(art.firstChild,art);art.remove();}
   }
  }
  if(enabled()){
   for(const node of Array.from(head.children))if(node.classList.contains('garland'))logo.appendChild(node);
  }else{
   for(const node of Array.from(logo.children))if(node.classList.contains('garland'))head.insertBefore(node,head.firstChild);
  }
 }
 if(window.MutationObserver){
  const observer=new MutationObserver(update);observer.observe(head,{childList:true});
  // Seasonal code replaces the logo after appready, inside the header body.
  const logo=head.querySelector('.head__logo-icon');
  if(logo && logo.parentNode!==head)observer.observe(logo.parentNode,{childList:true});
 }
 update();return {update};
}
