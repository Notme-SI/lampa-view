import {layoutProfile} from './layout-profile.js';
// One scale contract for body text, panels and complete poster slots.
// TV Small is the previous Bigger; distance viewing needs meaningful steps.
export default function interfaceSize(L){
 function update(){
  const mode=L.Storage.get('lampa_view_layout','auto'),tv=mode==='tv' || mode==='auto' && document.body.classList.contains('pt-tv');
  const value=L.Storage.get('interface_size','normal'),profile=layoutProfile(tv,value,mode==='mobile' || (mode==='auto' || mode==='tablet') && document.body.classList.contains('pt-mobile'));
  document.body.style.setProperty('--pt-interface-scale',String(profile.scale));
  document.body.style.setProperty('--pt-poster-columns',String(profile.posters || 0));
  if(tv)document.body.style.setProperty('--pt-episode-columns',String(profile.episodes));
  else document.body.style.removeProperty('--pt-episode-columns');
  document.body.style.setProperty('--pt-interface-max-scale',tv?'1.56':document.body.classList.contains('pt-mobile')?'1.05':'1.24');
  document.body.classList.toggle('pt-tv-caption-flow',value!=='bigger');
  (window.requestAnimationFrame || (fn=>setTimeout(fn,16)))(()=>document.dispatchEvent(new Event('minimal:interface-size')));
  if(!tv)(window.requestAnimationFrame || (fn=>setTimeout(fn,16)))(()=>document.dispatchEvent(new Event('minimal:hero-layout')));
 }
 update();
 if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(['interface_size','lampa_view_layout'].includes(event.name))update();});
 return {update};
}
