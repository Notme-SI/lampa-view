// Native seasonal scripts retain their artwork, actions and calendar.
// Watch only direct header insertions, never lamp opacity animation or app rows.
export default function holidays(L,enabled){
 const value=L.Head && L.Head.render(true),head=value && (value.nodeType?value:value[0]);
 if(!head)return {update(){}};
 function update(){
  const logo=head.querySelector('.head__logo-icon');if(!logo)return;
  if(enabled()){
   for(const node of Array.from(head.children))if(node.classList.contains('garland'))logo.appendChild(node);
  }else{
   for(const node of Array.from(logo.children))if(node.classList.contains('garland'))head.insertBefore(node,head.firstChild);
  }
 }
 if(window.MutationObserver)new MutationObserver(update).observe(head,{childList:true});
 update();return {update};
}
