import posterPreview from './poster-preview.js';
const LEVELS={medium:{poster:'w300',backdrop:'w780'},high:{poster:'w500',backdrop:'w1280'},maximum:{poster:'original',backdrop:'original'}};
export function artworkQuality(L){
 const value=L.Storage && L.Storage.get?L.Storage.get('minimal_banner_quality','maximum'):'maximum';
 return LEVELS[value]?value:value==='w1280'?'high':'maximum';
}
export function artworkSize(L,kind){return LEVELS[artworkQuality(L)][kind || 'poster'];}
export default function installArtwork(L,enabled){
 const stored=L.Storage.get('minimal_banner_quality','maximum'),quality=artworkQuality(L);
 if(stored!==quality && L.Storage.set)L.Storage.set('minimal_banner_quality',quality);
 const wrappers=new Map();
 function wrap(api){
  if(!api || typeof api.img!=='function')return;
  const original=api.img;
  if(!wrappers.has(original))wrappers.set(original,function(src,size){
   if(!enabled() || (size && !/^(?:w200|w300|w500|w780|w1280|original)$/.test(size)))return original.apply(this,arguments);
   return original.call(this,src,artworkSize(L,size==='w780' || size==='w1280'?'backdrop':'poster'));
  });
  api.img=wrappers.get(original);
 }
 wrap(L.TMDB);wrap(L.Api);
 if(L.Api && L.Api.sources){wrap(L.Api.sources.tmdb);wrap(L.Api.sources.cub);}
 posterPreview(L,enabled);
 function refresh(){
  if(!enabled())return;
  document.querySelectorAll('.card__img,.full-start-new__img,.full-start__img,.full-start__background,.pt-hero__image').forEach(image=>{
   const url=image.getAttribute('src') || '';
   if(image._minimalArtwork && image._minimalArtwork(/^https?:/.test(url)))return;
   if(!/\/t\/p\/(?:w\d+|original)\//.test(url))return;
   const backdrop=image.matches('.full-start__background,.pt-hero__image') || image.closest('.card--wide,.card--collection');
   const next=url.replace(/(\/t\/p\/)(?:w\d+|original)(\/)/,'$1'+artworkSize(L,backdrop?'backdrop':'poster')+'$2');
   if(next!==url)image.src=next;
  });
  document.dispatchEvent(new Event('minimal:artwork-quality'));
 }
 return {refresh};
}
