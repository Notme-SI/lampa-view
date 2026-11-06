// Only studio/channel marks: never recolour title artwork or multicolour logos.
const cache=new Map();
export function darkMonochrome(pixels){
 let weight=0,dark=0,coloured=0;
 for(let i=0;i<pixels.length;i+=4){
  const a=pixels[i+3]/255;if(a<.2)continue;
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
  weight+=a;if(hi-lo>30)coloured+=a;
  if(.2126*r+.7152*g+.0722*b<110)dark+=a;
 }
 return weight>0 && dark/weight>.85 && coloured/weight<.04;
}
export default function studioContrast(image){
 const url=image.currentSrc || image.src;if(!url)return;
 image.classList.remove('pt-studio-white','pt-studio-unreadable');
 const apply=value=>{if((image.currentSrc || image.src)!==url)return;image.classList.toggle('pt-studio-white',value===true);image.classList.toggle('pt-studio-unreadable',value===null);};
 if(cache.has(url)){apply(cache.get(url));return;}
 function sample(source){
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=48;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,96,48);
  return darkMonochrome(ctx.getImageData(0,0,96,48).data);
 }
 function finish(value){cache.set(url,value);if(cache.size>128)cache.delete(cache.keys().next().value);apply(value);}
 try{finish(sample(image));}catch(error){
  // The displayed image remains intact even if its server does not allow CORS.
  const probe=new Image();probe.crossOrigin='anonymous';
  probe.onload=()=>{try{finish(sample(probe));}catch(error){finish(null);}};
  probe.onerror=()=>finish(null);probe.src=url;
 }
}
