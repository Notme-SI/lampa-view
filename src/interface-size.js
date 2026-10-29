// Keep the native setting and its 0.9 / 1 / 1.05 factors. CSS uses the same
// factor for elements that need a device-specific base or viewport-sized posters.
export default function interfaceSize(L){
 function update(){
  const value=L.Storage.get('interface_size','normal'),factor={small:.9,normal:1,bigger:1.05}[value] || 1;
  document.body.style.setProperty('--pt-interface-scale',String(factor));
 }
 update();
 if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(event.name==='interface_size')update();});
}
