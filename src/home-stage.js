// Desktop gives the carousel the remaining first-screen height. Poster sizing belongs
// to the common rail fitter, so the first and subsequent collections match.
export default function homeStage(hero,root){
 const tv=document.body.classList.contains('pt-tv');
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
 // The desktop hero preview prioritizes full poster captions. Its normally
 // reserved watch footer remains in the scrollable row and is revealed by
 // native card focus; no poster is shrunk or rebuilt to enlarge the banner.
 let previewRoom=0;
 if(!tv){
  const captions=Array.from(root.querySelectorAll('.card__age'));
  if(captions.length){const rowTop=root.getBoundingClientRect().top;
   const captionBottom=Math.max(...captions.map(node=>node.getBoundingClientRect().bottom-rowTop));
   previewRoom=Math.max(0,Math.min(innerHeight*.08,root.offsetHeight-captionBottom-clearance));
  }
 }
 const height=Math.max(100,Math.floor(innerHeight-top-gap-root.offsetHeight-clearance+previewRoom));
 if(hero.style.height!==height+'px')hero.style.height=height+'px';
 // Keep branding and controls inside short viewports as well as large ones.
 const body=hero.querySelector('.pt-hero__body');
 if(body){
  body.style.fontSize='';body.style.bottom='';
  const style=getComputedStyle(body),font=parseFloat(style.fontSize)||16;
  const glass=document.body.classList.contains('pt-theme-glass');
  const minBottom=font*(glass?2:tv?1.5:3),topInset=font*(tv?1:1.25);
  const room=Math.max(1,height-minBottom-topInset),natural=body.offsetHeight;
  if((glass || !tv) && natural>room)body.style.fontSize=(font*Math.max(.65,room/natural))+'px';
  // Glass uses normal flex centering; a relative bottom offset would move it
  // above the hero after adaptive sizing. Minimal retains its anchored layout.
  if(!glass){const bottom=Math.min(parseFloat(style.bottom)||font*7,height-body.offsetHeight-topInset);
   body.style.bottom=Math.max(minBottom,bottom)+'px';}
 }
 root.classList.add('minimal-home-first-row');
}
