// Desktop gives the carousel the remaining first-screen height. Poster sizing belongs
// to the common rail fitter, so the first and subsequent collections match.
export default function homeStage(hero,root){
 // A covered activity can have different native padding and scroll offsets.
 if(!document.body.classList.contains('pt-home') || !root.closest('.activity--active'))return;
 const tv=document.body.classList.contains('pt-tv');
 // Rows reserve a focus gutter inside their outer margin. Align the banner
 // copy to that content edge, independently of horizontal rail scrolling.
 if(!document.body.classList.contains('pt-mobile')){
  const content=root.querySelector('.items-line__body>.scroll--horizontal>.scroll__content');
  if(content){
   const left=root.getBoundingClientRect().left-hero.getBoundingClientRect().left+(parseFloat(getComputedStyle(content).paddingLeft)||0);
   const value=left.toFixed(3)+'px';
   if(hero.style.getPropertyValue('--pt-home-copy-left')!==value)hero.style.setProperty('--pt-home-copy-left',value);
  }
 }
 // Expanded collections use native scrolling. Retain the preview's hero
 // height so entry/return only animates cards, never the banner itself.
 if(tv && !root.classList.contains('minimal-hero-preview')){root.classList.add('minimal-home-first-row');return;}

 const rowStyle=getComputedStyle(root),heroStyle=getComputedStyle(hero);
 const outer=root.closest('.scroll');
 // Native Activity animates an ancestor with translateY when returning
 // from a card. Its transient screen position is not the page's layout top.
 // offsetTop ignores both that animation and the native Scroll transform.
 let top=0;for(let node=hero;node;node=node.offsetParent)top+=node.offsetTop || 0;
 for(let node=hero.parentElement;node;node=node.parentElement)if(node!==outer)top-=node.scrollTop || 0;
 top-=window.scrollY || 0;
 const gap=parseFloat(heroStyle.marginBottom)||0,after=parseFloat(rowStyle.marginBottom)||0;
 const clearance=Math.max(4,after/2);
 // Reserve the entire row, including the watch footer. Native WebKit scroll
 // bounds cannot reveal a footer deliberately placed outside the viewport.
 // Native TV activities can reserve the floating header in their own Scroll
 // height. The window bottom is then below the real clipping viewport.
 // Budget against that viewport so captions and the watch footer remain visible.
 const bottom=tv && outer && outer.clientHeight?
  Math.min(innerHeight,outer.getBoundingClientRect().top+outer.clientHeight):innerHeight;
 let height=Math.max(100,Math.floor(bottom-top-gap-root.offsetHeight-clearance));
 // A tall, narrow window must not reserve more height than its artwork can fill.
 // Cap the inline layout calculation itself; CSS height is overridden below.
 if(!tv){
  const image=hero.querySelector('.pt-hero__image');
  const ratio=image && image.naturalWidth && image.naturalHeight?image.naturalWidth/image.naturalHeight:16/9;
  height=Math.min(height,Math.max(100,Math.floor(hero.clientWidth/ratio)));
 }
 if(hero.style.height!==height+'px')hero.style.height=height+'px';
 // Keep branding and controls inside short viewports as well as large ones.
 const body=hero.querySelector('.pt-hero__body');
 if(body){
  body.style.fontSize='';body.style.bottom='';
  const style=getComputedStyle(body),font=parseFloat(style.fontSize)||16;
  const anchored=style.position==='absolute';
  const minBottom=font*(tv?3.8:2),topInset=font*(tv?1:1.25);
  if(document.body.classList.contains('pt-personal-enlarged')){
   height=Math.max(height,Math.ceil(body.offsetHeight+minBottom+topInset));
   hero.style.height=height+'px';
   if(anchored)body.style.bottom=minBottom+'px';
   root.classList.add('minimal-home-first-row');return;
  }
  const room=Math.max(1,height-minBottom-topInset),natural=body.offsetHeight;
  if(natural>room)body.style.fontSize=(font*Math.max(.65,room/natural))+'px';
  // Both desktop themes anchor their text directly over the artwork. Mobile
  // retains normal flow, so a bottom offset must never shift its text panel.
  if(anchored){const bottom=Math.min(parseFloat(style.bottom)||font*7,height-body.offsetHeight-topInset);
   body.style.bottom=Math.max(minBottom,bottom)+'px';}
 }
 root.classList.add('minimal-home-first-row');
}
