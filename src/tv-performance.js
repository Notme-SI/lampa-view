// Let native navigation finish before doing optional artwork and layout work.
export default function tvPerformance(enabled){
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
