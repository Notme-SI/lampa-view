// Give the carousel the remaining first-screen height. Poster sizing belongs
// to the common rail fitter, so the first and subsequent collections match.
export default function homeStage(hero,root){
 const rowStyle=getComputedStyle(root),heroStyle=getComputedStyle(hero);
 const outer=root.closest('.scroll');
 // Scroll.position() is the animation target on TV, not the current transform.
 // Read the rendered offset so autofocus cannot shrink the first slide mid-scroll.
 const scrollBody=outer && outer.Scroll && outer.Scroll.body?outer.Scroll.body(true):null;
 const transform=scrollBody && getComputedStyle(scrollBody).transform;
 const matrix=transform && transform.match(/^matrix(3d)?\((.+)\)$/);
 const translated=matrix?Number(matrix[2].split(',')[matrix[1]?13:5]) || 0:0;
 const top=hero.getBoundingClientRect().top-translated+(outer?outer.scrollTop:0);
 const gap=parseFloat(heroStyle.marginBottom)||0,after=parseFloat(rowStyle.marginBottom)||0;
 const clearance=Math.max(4,after/2);
 const height=Math.max(100,Math.floor(innerHeight-top-gap-root.offsetHeight-clearance));
 if(hero.style.height!==height+'px')hero.style.height=height+'px';
 // Keep branding and controls inside short viewports as well as large ones.
 const body=hero.querySelector('.pt-hero__body');
 if(body){
  body.style.fontSize='';body.style.bottom='';
  const style=getComputedStyle(body),font=parseFloat(style.fontSize)||16;
  const minBottom=font*3,topInset=font*1.25;
  const room=Math.max(1,height-minBottom-topInset),natural=body.offsetHeight;
  if(natural>room)body.style.fontSize=(font*Math.max(.65,room/natural))+'px';
  const bottom=Math.min(parseFloat(style.bottom)||font*7,height-body.offsetHeight-topInset);
  body.style.bottom=Math.max(minBottom,bottom)+'px';
 }
 root.classList.add('minimal-home-first-row');
}
