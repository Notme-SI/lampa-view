// Reserve a normal collection at the largest native UI size. The banner and
// spacing absorb the remaining height; the first row never gets smaller cards.
function referenceRow(root,card,width,font,normalSlots,maxScale){
 const clone=root.cloneNode(false);clone.removeAttribute('id');
 clone.classList.remove('minimal-fit-posters','minimal-posters-sized','minimal-home-first-row');
 clone.style.cssText='position:fixed;left:-10000px;top:0;width:'+width+'px;max-width:none;min-height:0;font-size:'+font+'px;visibility:hidden;pointer-events:none;--pt-interface-scale:'+maxScale;
 const head=root.querySelector('.items-line__head');if(head)clone.appendChild(head.cloneNode(true));
 const holder=document.createElement('div');holder.className='items-line__body';holder.innerHTML='<div class="scroll scroll--horizontal"><div class="scroll__content"><div class="scroll__body items-cards mapping--line"></div></div></div>';
 const copy=card.cloneNode(true);copy.classList.remove('focus','hover');copy.style.removeProperty('width');copy.style.setProperty('font-size',(font*(innerWidth>=767?1.14:1))+'px','important');
 for(const image of copy.querySelectorAll('img')){image.removeAttribute('src');image.removeAttribute('srcset');}
 holder.querySelector('.scroll__body').appendChild(copy);clone.appendChild(holder);document.body.appendChild(clone);
 try{
  const cardStyle=getComputedStyle(copy),cardFont=parseFloat(cardStyle.fontSize),gap=cardFont,inset=Math.ceil(cardFont*.55),available=width-2*inset,target=parseFloat(cardStyle.width);
  const count=Math.max(1,Math.min(24,Math.round((available+gap)/(target+gap)),normalSlots(root,cardFont,width,maxScale)-(maxScale>1.05?2:1)));
  copy.style.setProperty('width',((available-(count-1)*gap)/count)+'px','important');
  const title=copy.querySelector('.card__title'),style=title && getComputedStyle(title),max=style && parseFloat(style.maxHeight);
  const reserve=max?Math.max(0,max+(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0)-title.offsetHeight):0;
  return clone.offsetHeight+reserve+(parseFloat(getComputedStyle(clone).marginBottom)||0)+8;
 }finally{clone.remove();}
}
export default function homeStage(hero,root,card,width,normalSlots){
 const style=getComputedStyle(document.body),font=parseFloat(style.fontSize)||16,scale=parseFloat(style.getPropertyValue('--pt-interface-scale'))||1,maxScale=parseFloat(style.getPropertyValue('--pt-interface-max-scale'))||1.05,reference=font*maxScale/scale;
 const rowHeight=referenceRow(root,card,width,reference,normalSlots,maxScale);
 const outer=root.closest('.scroll'),offset=outer && outer.Scroll && outer.Scroll.position?outer.Scroll.position():0;
 const margin=(parseFloat(getComputedStyle(hero).marginBottom)||0)*maxScale/scale;
 // Use the same banner frame for Small / Normal / Bigger. No viewport-based
 // poster override: all rows retain their common native-scale width.
 hero.style.height=Math.max(12*reference,Math.floor(innerHeight-(document.body.classList.contains('pt-tv')?4.5:3.6)*reference-margin-rowHeight-8))+'px';
 const rowTop=root.getBoundingClientRect().top-offset;
 root.style.setProperty('--minimal-home-row-height',Math.max(0,innerHeight-rowTop+2)+'px');
 root.classList.add('minimal-home-first-row');
}
