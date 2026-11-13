// Match the existing large-viewport poster size without tying it to viewport width.
// TV retains whole-slot fitting; touch layouts retain their native responsive size.
export function desktopPosterWidth(style=getComputedStyle(document.body)){
 if(!document.body.classList.contains('pt-desktop'))return 0;
 const scale=parseFloat(style.getPropertyValue('--pt-interface-scale'))||1;
 const cards=Math.max(.8,Math.min(2,parseFloat(style.getPropertyValue('--pt-card-scale'))||1));
 return 199.8*scale*cards;
}
