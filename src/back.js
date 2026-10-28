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
 // Settings builds its collection from the body only. Its heading button
 // must join that same native collection after every controller rebuild.
 function remoteHeading(event){
  if(!enabled() || !event || !/^(settings|settings_component|select|modal)$/.test(event.name))return;
  overlays();
  const scope=event.name==='select'?'.selectbox':event.name==='modal'?'.modal':'.settings';
  const arrows=$(scope+' .minimal-back--overlay').filter(function(){return this.isConnected && this.offsetParent!==null;});
  if(arrows.length && L.Controller.collectionAppend)L.Controller.collectionAppend(arrows);
  if(arrows.length && event.name==='modal' && !$(scope+' .selector').not('.minimal-back--overlay').filter(function(){return this.offsetParent!==null;}).length)L.Controller.collectionFocus(arrows.first(),$(scope));
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
  const visible=enabled() && active && active.component!=='main' && (stack?stack.length>1:true);
  button.toggleClass('pt-back-visible',!!visible).toggleClass('selector',!!visible).attr({'aria-hidden':String(!visible),tabindex:visible?'0':'-1'});
  overlays();
 }
 if(L.Listener && L.Listener.follow)L.Listener.follow('activity',event=>{if(['start','destroy'].includes(event.type))update();});
 if(L.Controller && L.Controller.listener)L.Controller.listener.follow('toggle',remoteHeading);
 [[L.Settings,'open'],[L.Select,'open'],[L.Modal,'fullshow'],[L.Modal,'update']].forEach(([api,event])=>{if(api && api.listener)api.listener.follow(event,overlays);});
 update();
 return {update};
}
