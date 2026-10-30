// Reuse the native menu and its remote controller in either presentation.
export default function menuLayout(L,enabled){
 function update(){
  const value=L.Storage.get('menu_always',false),pinned=enabled() && [true,'true',1,'1','yes'].includes(value);
  const changed=document.body.classList.contains('pt-menu-pinned')!==pinned;
  document.body.classList.toggle('pt-menu-pinned',pinned);
  if(pinned){
   const panel=document.querySelector('.wrap__left');if(panel)panel.classList.remove('wrap__left--hidden');
   if(changed && L.Controller.enabled().name==='menu')L.Controller.toggle('content');
  }
  if(changed && L.Layer && L.Layer.update)L.Layer.update();
 }
 update();
 if(L.Storage.listener)L.Storage.listener.follow('change',e=>{if(e.name==='menu_always' || e.name==='lampa_view_enabled')update();});
 return {update};
}
