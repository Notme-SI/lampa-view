import APPLE from './apple.css';
export function themeValue(value){return value==='apple'?'apple':'minimal';}
export default function appearance(L){
 if(!document.getElementById('lampa-view-apple-style')){const style=document.createElement('style');style.id='lampa-view-apple-style';style.textContent=APPLE;(document.head || document.documentElement).appendChild(style);}
 function update(){
  const value=themeValue(L.Storage.get('lampa_view_theme','minimal'));
  document.body.classList.toggle('pt-theme-apple',value==='apple');document.body.dataset.lampaTheme=value;
  document.dispatchEvent(new Event('minimal:interface-size'));
  document.dispatchEvent(new Event('minimal:hero-layout'));
 }
 update();
 if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(event.name==='lampa_view_theme')update();});
 return {update};
}
