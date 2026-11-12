import homeStage from './home-stage.js';
import {layoutProfile} from './layout-profile.js';

// Whole-slot rounding can otherwise keep the same count in Bigger and make
// posters slightly smaller because only the gaps grew. Measure the normal CSS
// target once per layout; Bigger must use fewer slots, in every collection.
function normalSlots(root,font,width,scale){
 const probe=root.cloneNode(false);probe.removeAttribute('id');probe.classList.remove('minimal-fit-posters','minimal-posters-sized','minimal-home-first-row');
 probe.style.cssText='position:fixed;left:-10000px;top:0;width:'+width+'px;max-width:none;min-height:0;visibility:hidden;pointer-events:none;--pt-interface-scale:1';
 const card=document.createElement('div');card.className='card';card.style.setProperty('font-size',(font/scale/(!document.body.classList.contains('pt-desktop') && document.body.classList.contains('size--bigger') && innerWidth>=767?1.14:1))+'px','important');probe.appendChild(card);document.body.appendChild(probe);
 try{const style=getComputedStyle(card),target=parseFloat(style.width),gap=parseFloat(style.fontSize),available=width-2*Math.ceil(gap*.55);return Math.max(1,Math.round((available+gap)/(target+gap)));}finally{probe.remove();}
}

// Fit complete poster slots to the real viewport, retaining native lazy loading.
// Recalculate only when the viewport or inherited font changes, not on focus.
export default function fitRail(line,root,card,state,enabled){
 const value=line.scroll && line.scroll.render(true),view=value && (value.nodeType?value:value[0]);
 const content=view && view.querySelector('.scroll__content'),body=content && content.querySelector('.scroll__body');
 if(!body || card.parentNode!==body || !card.matches('.card:not(.card--wide):not(.card--collection)') || body.querySelector('.card--wide,.card--collection,.full-person'))return;
 line.minimalPosterRefresh=()=>fitRail(line,root,card,state,enabled);
 const font=parseFloat(getComputedStyle(card).fontSize)||16,viewWidth=view.getBoundingClientRect().width,profile=getComputedStyle(document.body),columns=profile.getPropertyValue('--pt-poster-columns'),scale=parseFloat(profile.getPropertyValue('--pt-interface-scale'))||1;
 if(!viewWidth)return;
 const hero=root.previousElementSibling,home=hero && hero.matches('.pt-hero') && !document.body.classList.contains('pt-mobile');
 const preview=root.classList.contains('minimal-hero-preview');
 const cards=Math.max(.8,Math.min(2,parseFloat(profile.getPropertyValue('--pt-card-scale'))||1));
 const key=cards+':'+columns+':'+scale+':'+Boolean(preview)+':'+innerWidth+':'+innerHeight+':'+Boolean(home)+':'+viewWidth.toFixed(3)+':'+font.toFixed(3)+':'+(document.body.classList.contains('pt-tv')?'tv':document.body.classList.contains('pt-mobile')?'mobile':'desktop');
 // Lazy append can change native scroll bounds without changing poster dimensions.
 // Reconcile the focused card after TV navigation is idle as well as after resize.
 function revealFocus(){
  if(!document.body.classList.contains('pt-tv'))return;
  const last=line.last,target=last && (last.nodeType?last:last[0]);
  if(!target || target.parentNode!==body || !target.matches('.focus') || !line.scroll.immediate)return;
  const bounds=view.getBoundingClientRect(),rect=target.getBoundingClientRect(),fit=line.scroll.minimalPosterFit,start=Math.max(0,bounds.left)+(fit?fit.inset:0),end=Math.min(innerWidth,bounds.right)-(fit?fit.inset:0);
  if(rect.left>=start-1 && rect.right<=end+1)return;
  line.scroll.immediate(target,true);
  const placed=target.getBoundingClientRect(),overflow=placed.left<start?placed.left-start:placed.right>end?placed.right-end:0;
  if(overflow && line.scroll.shift)line.scroll.shift(overflow);
 }
 if(state.posterFitKey===key){if(home)homeStage(hero,root);revealFocus();return;}

 root.classList.add('minimal-fit-posters');
 root.style.setProperty('--minimal-poster-gutter',Math.ceil(font*.55)+'px');
 root.style.removeProperty('--minimal-poster-gap');
 root.classList.remove('minimal-posters-sized','minimal-home-first-row');
 root.style.removeProperty('--minimal-poster-width');
 const target=parseFloat(getComputedStyle(card).width),padding=getComputedStyle(content),second=card.nextElementSibling;
 const trailingMargin=parseFloat(getComputedStyle(card).marginRight)||0;
 const gap=second?.matches('.card')?(parseFloat(getComputedStyle(second).marginLeft)||0)+trailingMargin:font;
 const inset=parseFloat(padding.paddingLeft)||0,available=viewWidth-inset-(parseFloat(padding.paddingRight)||0);
 if(!target || available<=0)return;
 let count=Math.max(1,Math.min(24,Math.round((available+gap)/(target+gap))));
 if(document.body.classList.contains('pt-tv')){
  // Explicit slots prevent round-to-nearest from making adjacent TV sizes equal.
  count=(parseInt(columns,10) || count)+(preview?2:0);
 }else if(scale>1){
  const normal=normalSlots(root,font,viewWidth,scale);
  if(normal>2){
   if(document.body.classList.contains('pt-mobile'))count=Math.min(count,normal-1);
   else{
    count=Math.max(2,Math.round(normal/scale));
    const normalScale=layoutProfile(false,'normal').scale,middle=Math.max(2,Math.round(normal/normalScale));
    if(scale>normalScale && middle>2)count=Math.min(count,middle-1);
   }
  }
 }
 count=Math.max(1,Math.round(count/cards));
 const width=Math.floor((available-(count-1)*gap)/count*64)/64;
 if(width<=0)return;
 root.style.setProperty('--minimal-poster-width',width+'px');
 root.style.setProperty('--pt-more-gap',Math.max(0,gap-trailingMargin)+'px');
 root.classList.add('minimal-posters-sized');
 if(home)homeStage(hero,root);
 state.posterFitKey=key;
 line.scroll.minimalPosterFit={count,width,gap,inset};
 if(!state.posterFitWrapped){
  state.posterFitWrapped=true;
  for(const method of ['update','immediate']){
   const original=line.scroll[method];if(!original)continue;
   line.scroll[method]=function(element,center){
    const fit=this.minimalPosterFit,target=element && (element.nodeType?element:element[0]);
    if(enabled() && fit && center && target && target.parentNode===body && target.matches('.card')){
     const index=Array.prototype.indexOf.call(body.children,target),anchor=body.children[Math.max(0,index-Math.floor((fit.count-1)/2))];
     if(anchor)return original.call(this,anchor,false);
    }
    return original.apply(this,arguments);
   };
  }
 }
 // The first fit may be deferred until TV navigation becomes idle. Preserve
 // the focused card when replacing the native width, just as on later resizes.
 if(line.last && line.scroll.immediate)line.scroll.immediate(line.last,true);
 revealFocus();
}

export function railSnapDelta(view,position){
 const scroll=view && view.Scroll,fit=scroll && scroll.minimalPosterFit;
 if(!fit || !scroll.position || !scroll.shift)return 0;
 if(position===undefined)position=scroll.position();
 const pitch=fit.width+fit.gap;
 return pitch>0?position-Math.round(position/pitch)*pitch:0;
}

// Touch retains the host's immediate final alignment.
export function settleRail(view){
 const delta=railSnapDelta(view);
 if(delta)view.Scroll.shift(delta);
}
