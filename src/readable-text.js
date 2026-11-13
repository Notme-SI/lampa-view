// Only clipped text is an action. Recheck after fonts, layout/scale changes and
// resize; never measure on pointer movement or on every scroll frame.
const documents=new WeakSet();
export default function readableText(L,text,control,link,{value,title,label}){
 if(!documents.has(document)){documents.add(document);document.addEventListener('hover:focus',event=>{const active=document.activeElement;if(active?.matches('.minimal-text-clipped,.minimal-detail-studio') && active!==event.target && !active.contains(event.target))active.blur();},true);}
 let clipped=false,frame=0,disposed=false;
 const header=()=>link?.items?.[0];
 const remember=()=>{const item=header();if(item)item.last=control;};
 const refreshCollection=()=>{
  const item=header(),active=L.Controller?.enabled?.();
  if(!item || active?.name!=='full_start' || active.controller?.link!==item)return;
  const root=item.render(true),focused=root.querySelector('.focus');
  L.Controller.collectionSet(window.jQuery(root));
  if(focused && focused.classList.contains('selector'))L.Controller.collectionFocus(window.jQuery(focused),window.jQuery(root));
  else L.Controller.collectionFocus(item.last || false,window.jQuery(root));
 };
 function fit(){
  frame=0;if(disposed || !text.isConnected)return;
  const singleLine=getComputedStyle(text).whiteSpace==='nowrap';
  const next=text.clientWidth>0 && text.clientHeight>0 &&
   (text.scrollWidth>text.clientWidth+1 || !singleLine && text.scrollHeight>text.clientHeight+1);
  if(clipped===next)return;
  clipped=next;control.classList.toggle('selector',clipped);control.classList.toggle('minimal-text-clipped',clipped);
  if(clipped){control.setAttribute('role','button');control.setAttribute('tabindex','0');control.setAttribute('aria-haspopup','dialog');control.setAttribute('aria-label',label);}
  else{for(const name of ['role','tabindex','aria-haspopup','aria-label'])control.removeAttribute(name);control.classList.remove('focus','hover');if(header()?.last===control)header().last=false;if(document.activeElement===control)control.blur();}
  refreshCollection();
 }
 const schedule=()=>{if(!disposed && !frame)frame=requestAnimationFrame(fit);};
 function open(){
  fit();if(!clipped || L.Modal.opened())return;
  remember();const content=document.createElement('div');content.className='about minimal-overview-full';content.textContent=value;
  L.Modal.open({title,size:'large',html:window.jQuery(content),onBack:()=>{L.Modal.close();if(control.isConnected){remember();L.Controller.toggle('full_start');}}});
 }
 control.addEventListener('hover:focus',()=>{if(clipped)remember();});
 control.addEventListener('hover:enter',open);
 control.addEventListener('click',event=>{if(clipped){event.preventDefault();event.stopImmediatePropagation();open();}});
 control.addEventListener('keydown',event=>{if(clipped && (event.key==='Enter' || event.key===' ')){event.preventDefault();event.stopImmediatePropagation();open();}});
 const resize=window.ResizeObserver?new ResizeObserver(schedule):null;
 if(resize){resize.observe(text);if(text.parentElement!==control)resize.observe(control);}
 const events=['minimal:interface-size','minimal:detail-layout','minimal:hero-layout'];
 events.forEach(name=>document.addEventListener(name,schedule));window.addEventListener('resize',schedule);
 document.fonts?.ready?.then(schedule);schedule();
 link?.use?.({onDestroy:()=>{disposed=true;if(frame)cancelAnimationFrame(frame);resize?.disconnect();events.forEach(name=>document.removeEventListener(name,schedule));window.removeEventListener('resize',schedule);}});
}
