// Native size names are preserved. TV steps start at the former Normal size.
export default function interfaceSize(L){
 function update(){
  const mode=L.Storage.get('lampa_view_layout','auto'),tv=mode==='tv' || mode==='auto' && document.body.classList.contains('pt-tv');
  const factors=tv?{small:1,normal:1.05,bigger:1.12}:{small:.9,normal:1,bigger:1.05};
  const value=L.Storage.get('interface_size','normal');
  document.body.style.setProperty('--pt-interface-scale',String(factors[value] || factors.normal));
  document.body.style.setProperty('--pt-interface-max-scale',tv?'1.12':'1.05');
 }
 update();
 if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(['interface_size','lampa_view_layout'].includes(event.name))update();});
}
