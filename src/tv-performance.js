// Let native navigation finish before doing optional artwork and layout work.
export default function tvPerformance(enabled,L){
 // Native enter effects add a timer and animated class for every OK press.
 // Keep basic scrolling and the saved preference; bypass only this optional
 // layer while our own focus treatment is active.
 const field=L.Storage?.field;
 if(typeof field==='function')L.Storage.field=function(name){if(name==='advanced_animation' && enabled())return false;return field.apply(this,arguments);};
 // Our artwork replaces the native background on every layout; CSS hides it.
 // Do not download, blur and crossfade three full-screen canvases behind it.
 // Keep the saved native preference and forward normally outside this layout.
 for(const name of ['change','immediately','update']){
  const original=L?.Background?.[name];if(typeof original!=='function')continue;
  L.Background[name]=function(){if(enabled() && document.body.matches('.lampa_view'))return;return original.apply(this,arguments);};
 }
 let timer;
 function finish(){
  clearTimeout(timer);timer=null;
  if(document.body.classList.contains('pt-tv-busy')){
   document.body.classList.remove('pt-tv-busy');
   document.dispatchEvent(new Event('minimal:tv-idle'));
  }
 }
 function moving(){
  if(!enabled() || !document.body.classList.contains('pt-tv'))return;
  document.body.classList.add('pt-tv-busy');
  clearTimeout(timer);timer=setTimeout(finish,360);
 }
 document.addEventListener('keydown',event=>{
  if([33,34,37,38,39,40,427,428].includes(event.keyCode) || /^(Arrow|Page)/.test(event.key || ''))moving();
 },true);
 document.addEventListener('hover:focus',moving,true);
 document.addEventListener('wheel',moving,{capture:true,passive:true});
 document.addEventListener('mousewheel',moving,{capture:true,passive:true});
 window.addEventListener('blur',finish);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
}
