import homeStage from './home-stage.js';

// Whole-slot rounding can otherwise keep the same count in Bigger and make
// posters slightly smaller because only the gaps grew. Measure the normal CSS
// target once per layout; Bigger must use fewer slots, in every collection.
function normalSlots(root,font,width,scale){
 const probe=root.cloneNode(false);probe.removeAttribute('id');probe.classList.remove('minimal-fit-posters','minimal-posters-sized','minimal-home-first-row');
 probe.style.cssText='position:fixed;left:-10000px;top:0;width:'+width+'px;max-width:none;min-height:0;visibility:hidden;pointer-events:none;--pt-interface-scale:1';
 const card=document.createElement('div');card.className='card';card.style.setProperty('font-size',(font/scale/(innerWidth>=767?1.14:1))+'px','important');probe.appendChild(card);document.body.appendChild(probe);
 try{const style=getComputedStyle(card),target=parseFloat(style.width),gap=parseFloat(style.fontSize),available=width-2*Math.ceil(gap*.55);return Math.max(1,Math.round((available+gap)/(target+gap)));}finally{probe.remove();}
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
 const key=innerWidth+':'+innerHeight+':'+Boolean(home)+':'+viewWidth.toFixed(3)+':'+font.toFixed(3)+':'+(document.body.classList.contains('pt-tv')?'tv':document.body.classList.contains('pt-mobile')?'mobile':'desktop');
 if(state.posterFitKey===key)return;
 root.classList.add('minimal-fit-posters');
 root.style.setProperty('--minimal-poster-gutter',Math.ceil(font*.55)+'px');
 root.style.removeProperty('--minimal-poster-gap');
 root.classList.remove('minimal-posters-sized','minimal-home-first-row');
 root.style.removeProperty('--minimal-poster-width');
 const target=parseFloat(getComputedStyle(card).width),padding=getComputedStyle(content),second=card.nextElementSibling;
 const gap=second?(parseFloat(getComputedStyle(second).marginLeft)||0)+(parseFloat(getComputedStyle(card).marginRight)||0):font;
 const inset=parseFloat(padding.paddingLeft)||0,available=viewWidth-inset-(parseFloat(padding.paddingRight)||0);
 if(!target || available<=0)return;
 const scale=parseFloat(getComputedStyle(document.body).getPropertyValue('--pt-interface-scale'))||1;
 let count=Math.max(1,Math.min(24,Math.round((available+gap)/(target+gap))));
 if(scale>1){const normal=normalSlots(root,font,viewWidth,scale);if(normal>2)count=Math.min(count,normal-1);}
 const width=Math.floor((available-(count-1)*gap)/count*64)/64;
 if(width<=0)return;
 root.style.setProperty('--minimal-poster-width',width+'px');
 root.classList.add('minimal-posters-sized');
 if(home)homeStage(hero,root,card,viewWidth,normalSlots);
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
