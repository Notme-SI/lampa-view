// One reference card measures the largest captions only on a layout change.
// No poster loads, listeners, observers or complete-row clones are created.
function referenceOverhead(root,card,width,font,cardFont,target){
 const clone=root.cloneNode(false);clone.removeAttribute('id');
 clone.classList.remove('minimal-fit-posters','minimal-posters-sized','minimal-home-first-row');
 clone.style.cssText='position:fixed;left:-10000px;top:0;width:'+width+'px;max-width:none;min-height:0;font-size:'+font+'px;visibility:hidden;pointer-events:none';
 clone.setAttribute('aria-hidden','true');
 const head=root.querySelector('.items-line__head');if(head)clone.appendChild(head.cloneNode(true));
 const holder=document.createElement('div');holder.className='items-line__body';holder.innerHTML='<div class="scroll scroll--horizontal"><div class="scroll__content"><div class="scroll__body items-cards mapping--line"></div></div></div>';
 const copy=card.cloneNode(true);copy.classList.remove('focus','hover');copy.style.setProperty('width',target+'px','important');copy.style.setProperty('font-size',cardFont+'px','important');
 for(const image of copy.querySelectorAll('img')){image.removeAttribute('src');image.removeAttribute('srcset');}
 holder.querySelector('.scroll__body').appendChild(copy);clone.appendChild(holder);document.body.appendChild(clone);
 try{
  const thumb=copy.querySelector('.card__view'),title=copy.querySelector('.card__title'),style=title && getComputedStyle(title),max=style && parseFloat(style.maxHeight);
  const reserve=max?Math.max(0,max+(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0)-title.offsetHeight):0;
  return clone.offsetHeight-(thumb?thumb.offsetHeight:0)+reserve;
 }finally{clone.remove();}
}

// Fit complete poster slots to the real viewport, retaining native lazy loading.
// Recalculate only when the viewport or inherited font changes, not on focus.
export default function fitRail(line,root,card,state,enabled){
 const value=line.scroll && line.scroll.render(true),view=value && (value.nodeType?value:value[0]);
 const content=view && view.querySelector('.scroll__content'),body=content && content.querySelector('.scroll__body');
 if(!body || card.parentNode!==body || !card.matches('.card:not(.card--wide):not(.card--collection)') || body.querySelector('.card--wide,.card--collection,.full-person'))return;
 const font=parseFloat(getComputedStyle(card).fontSize)||16,viewWidth=view.getBoundingClientRect().width;
 if(!viewWidth)return;
 const hero=root.previousElementSibling,home=hero && hero.matches('.pt-hero') && !document.body.classList.contains('pt-mobile');
 const key=innerWidth+':'+innerHeight+':'+(home?hero.offsetHeight:0)+':'+viewWidth.toFixed(3)+':'+font.toFixed(3)+':'+(document.body.classList.contains('pt-tv')?'tv':document.body.classList.contains('pt-mobile')?'mobile':'desktop');
 if(state.posterFitKey===key)return;
 root.classList.add('minimal-fit-posters');
 const scale=parseFloat(getComputedStyle(document.body).getPropertyValue('--pt-interface-scale'))||1,reference=home?1.05/scale:1;
 const baseFont=parseFloat(getComputedStyle(document.body).fontSize)||font,referenceFont=baseFont*reference;
 const referenceCardFont=home?referenceFont*(innerWidth>=767?1.14:1):font;
 root.style.setProperty('--minimal-poster-gutter',Math.ceil(referenceCardFont*.55)+'px');
 if(home)root.style.setProperty('--minimal-poster-gap',referenceCardFont+'px');else root.style.removeProperty('--minimal-poster-gap');
 root.classList.remove('minimal-posters-sized','minimal-home-first-row');
 root.style.removeProperty('--minimal-poster-width');
 const target=card.getBoundingClientRect().width,padding=getComputedStyle(content),second=card.nextElementSibling;
 const gap=second?(parseFloat(getComputedStyle(second).marginLeft)||0)+(parseFloat(getComputedStyle(card).marginRight)||0):font;
 const inset=parseFloat(padding.paddingLeft)||0,available=viewWidth-inset-(parseFloat(padding.paddingRight)||0);
 if(!target || available<=0)return;
 let count=Math.max(1,Math.min(24,Math.round((available+gap)/(target+gap))));
 let rowHeight=0;
 if(home){
  const outer=root.closest('.scroll'),offset=outer && outer.Scroll && outer.Scroll.position?outer.Scroll.position():0;
  rowHeight=Math.max(0,innerHeight-(root.getBoundingClientRect().top-offset));
  const thumb=card.querySelector('.card__view');
  if(thumb && thumb.offsetHeight){
   // Reserve the Bigger-size text and two title lines for all three settings.
   // This keeps Bigger from needing smaller posters just to fit the viewport.
   const overhead=referenceOverhead(root,card,root.getBoundingClientRect().width,referenceFont,referenceCardFont,available/10),ratio=(parseFloat(getComputedStyle(thumb).paddingBottom)||thumb.offsetHeight)/target;
   const referenceHeight=innerHeight-hero.offsetHeight-5.8*referenceFont,maxWidth=(Math.floor(referenceHeight)-overhead-6)/ratio;
   if(maxWidth>0)count=Math.min(24,Math.max(count,Math.ceil((available+gap)/(maxWidth+gap))));
  }
 }
 const width=Math.floor((available-(count-1)*gap)/count*64)/64;
 if(width<=0)return;
 root.style.setProperty('--minimal-poster-width',width+'px');
 root.classList.add('minimal-posters-sized');
 if(home){root.style.setProperty('--minimal-home-row-height',rowHeight+'px');root.classList.add('minimal-home-first-row');}
 const previous=state.posterFitKey;state.posterFitKey=key;
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
 if(previous && line.last && line.scroll.immediate)line.scroll.immediate(line.last,true);
}

// Finish a pointer gesture on a complete slot, through the native bounds check.
export function settleRail(view){
 const scroll=view && view.Scroll,fit=scroll && scroll.minimalPosterFit;
 if(!fit || !scroll.position || !scroll.shift)return;
 const position=scroll.position(),pitch=fit.width+fit.gap;
 if(pitch>0)scroll.shift(position-Math.round(position/pitch)*pitch);
}
