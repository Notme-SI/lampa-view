const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>';
export default function installBack(L,$,enabled){
 let button;
 function bind(button){
  button.addClass('minimal-back selector').attr({role:'button',tabindex:'0',title:'Назад','aria-label':'Назад'}).html(ARROW);
  const back=()=>{if(L.Controller && L.Controller.back)L.Controller.back();};
  button.on('click.minimalBack',event=>{event.preventDefault();event.stopImmediatePropagation();back();})
   .on('hover:enter.minimalBack',back).on('keydown.minimalBack',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();event.stopImmediatePropagation();back();}});
 }
 function overlays(){
  $('.selectbox__head,.settings__head,.modal__title').each(function(){
   const head=$(this);if(head.children('.minimal-back--overlay').length)return;
   const arrow=$('<div class="minimal-back--overlay">').prependTo(head);bind(arrow);head.addClass('minimal-back-heading');
  });
 }
 function update(){
  if(!button || !button[0] || !button[0].isConnected){
   button=$('.head__backward').first();
   if(!button.length){const head=$('.head__body').first();if(!head.length)return;button=$('<div class="head__backward">').prependTo(head);}
   else {const fresh=button[0].cloneNode(false);button.replaceWith(fresh);button=$(fresh);}
   bind(button);
  }
  const stack=L.Activity && L.Activity.all && L.Activity.all();
  const active=L.Activity && L.Activity.active && L.Activity.active();
  const visible=enabled() && (stack?stack.length>1:active && active.component!=='main');
  button.toggleClass('pt-back-visible',!!visible).attr('aria-hidden',String(!visible));
  overlays();
 }
 if(L.Listener && L.Listener.follow)L.Listener.follow('activity',event=>{if(['start','destroy'].includes(event.type))update();});
 [[L.Settings,'open'],[L.Select,'open'],[L.Modal,'fullshow'],[L.Modal,'update']].forEach(([api,event])=>{if(api && api.listener)api.listener.follow(event,overlays);});
 update();
 return {update};
}
