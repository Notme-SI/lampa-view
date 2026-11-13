// Match the existing large-viewport poster size without tying it to viewport width.
// TV retains whole-slot fitting; touch layouts retain their native responsive size.
export function desktopPosterWidth(style=getComputedStyle(document.body)){
 if(!document.body.classList.contains('pt-desktop'))return 0;
 const scale=parseFloat(style.getPropertyValue('--pt-interface-scale'))||1;
 const cards=Math.max(.8,Math.min(2,parseFloat(style.getPropertyValue('--pt-card-scale'))||1));
 return 199.8*scale*cards;
}

// Preserve distinct native size steps while fitting the entire available row.
export function desktopPosterColumns(available,gap,style=getComputedStyle(document.body)){
 const scale=parseFloat(style.getPropertyValue('--pt-interface-scale'))||1;
 const target=desktopPosterWidth(style);
 const fit=size=>{const count=Math.max(1,Math.round((available+gap)/(size+gap)));return (available-gap*(count-1))/count>size*1.1?count+1:count;};
 const normal=fit(target/scale*1.12),count=fit(target);
 return scale>1.12 && normal>=6?Math.min(count,normal-1):count;
}
