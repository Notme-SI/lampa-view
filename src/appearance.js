import GLASS from './glass.css';
import glassAmbient from './glass-ambient.js';
import iosChrome from './ios-chrome.js';
export function themeValue(value){return value==='glass' || value==='apple'?'glass':'minimal';}
const yes=value=>![false,'false',0,'0','no'].includes(value);
export default function appearance(L){
 if(!document.getElementById('lampa-view-glass-style')){const style=document.createElement('style');style.id='lampa-view-glass-style';style.textContent=GLASS;(document.head || document.documentElement).appendChild(style);}
 const chrome=iosChrome(L);
 const ambient=glassAmbient(()=>document.body.classList.contains('pt-theme-glass') && yes(L.Storage.get('lampa_view_enabled',true)),chrome.palette);
 function nativeValue(name,fallback){try{return L.Storage.field?L.Storage.field(name):L.Storage.get(name,fallback);}catch(error){return fallback;}}
 function update(){
  const stored=L.Storage.get('lampa_view_theme','minimal'),value=themeValue(stored),active=value==='glass' && yes(L.Storage.get('lampa_view_enabled',true));
  if(stored==='apple')L.Storage.set('lampa_view_theme','glass');
  document.body.classList.remove('pt-theme-apple');document.body.classList.toggle('pt-theme-glass',value==='glass');document.body.dataset.lampaTheme=value;
  // Use Lampa's own glass mechanism without overwriting its saved preference.
  const glass=active || yes(nativeValue('glass_style',false)),opacity=nativeValue('glass_opacity','medium') || 'medium';
  document.body.classList.toggle('glass--style',glass);
  ['easy','medium','blacked'].forEach(mode=>document.body.classList.toggle('glass--style-opacity--'+mode,glass && opacity===mode));
  document.body.style.setProperty('--pt-glass-alpha',String(({easy:.16,medium:.30,blacked:.58})[opacity] || .32));
  chrome.update(active);ambient.refresh();
  document.dispatchEvent(new Event('minimal:interface-size'));document.dispatchEvent(new Event('minimal:hero-layout'));
 }
 update();if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(['lampa_view_theme','lampa_view_enabled','glass_style','glass_opacity'].includes(event.name))update();});
 if(L.Listener)L.Listener.follow('activity',event=>{if(event.type==='start')setTimeout(ambient.refresh,0);});
 return {update};
}
