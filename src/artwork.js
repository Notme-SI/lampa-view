import posterPreview from './poster-cache.js';
// High keeps the same source detail on TVs and desktops. A TV WebView can
// report a 960px viewport while displaying the artwork on a 4K panel.
export function artworkQuality(L){
 const get=(key,def)=>L.Storage && L.Storage.get?L.Storage.get(key,def):def;
 const value=get('minimal_banner_quality','maximum');
 if(get('minimal_artwork_quality_revision',0)!==2)return ['high','medium','w1280'].includes(value)?'medium':'high';
 return value==='medium'?'medium':'high';
}
export function artworkSize(L,kind){
 if(artworkQuality(L)==='medium')return kind==='backdrop'?'w1280':'w500';
 if(kind!=='backdrop')return 'w780';
 // CSS pixels alone underestimate the TV panel. Keep originals behind the
 // explicit High preference; image queues and decoded caches remain bounded.
 if(document.body.classList.contains('pt-tv'))return 'original';
 const width=(window.innerWidth || 1920)*Math.min(2,window.devicePixelRatio || 1);
 return width>1440?'original':'w1280';
}
export function logoSize(){return 'original';}
export default function installArtwork(L,enabled){
 const quality=artworkQuality(L);
 if(L.Storage.set){L.Storage.set('minimal_banner_quality',quality);L.Storage.set('minimal_artwork_quality_revision',2);}
 const wrappers=new Map(),wrapped=new WeakSet(),imageWrappers=new WeakSet();let depth=0;
 const canonical=url=>typeof url==='string'?url.replace(/\/+t\/p\/(w\d+|original)\/+/,'/t/p/$1/'):url;
 function wrapImage(api){
  if(!api || typeof api.image!=='function' || imageWrappers.has(api.image))return;
  const image=api.image;
  api.image=function(){const value=image.apply(this,arguments);return enabled()?canonical(value):value;};
  imageWrappers.add(api.image);
 }
 function wrap(api){
  if(!api || typeof api.img!=='function' || wrapped.has(api.img))return;
  const original=api.img;
  if(!wrappers.has(original)){
   const wrapper=function(src,size){
    if(depth || !enabled() || (size && !/^(?:w200|w300|w500|w780|w1280|original)$/.test(size)))return original.apply(this,arguments);
    // Native MediaLoading asks for original: it is a fullscreen backdrop,
    // never a small portrait. Delegating APIs must not classify the size twice.
    const kind=['w780','w1280','original'].includes(size)?'backdrop':'poster';
    depth++;try{return canonical(original.call(this,src,artworkSize(L,kind)));}finally{depth--;}
   };
   wrappers.set(original,wrapper);wrapped.add(wrapper);
  }
  api.img=wrappers.get(original);
 }
 wrapImage(L.TMDB);wrap(L.TMDB);wrap(L.Api);
 if(L.Api && L.Api.sources){wrap(L.Api.sources.tmdb);wrap(L.Api.sources.cub);}
 posterPreview(L,enabled,()=>artworkQuality(L)==='high');
 function refresh(){
  if(!enabled())return;
  document.querySelectorAll('.card__img,.full-start-new__img,.full-start__img,.full-start__background,.pt-hero__image,.media-loading__backdrop').forEach(image=>{
   const url=image.getAttribute('src') || '';
   if(image._minimalArtwork && image._minimalArtwork(/^https?:/.test(url)))return;
   if(!/\/t\/p\/(?:w\d+|original)\//.test(url))return;
   const backdrop=image.matches('.full-start__background,.pt-hero__image,.media-loading__backdrop') || image.closest('.card--wide,.card--collection');
   const next=url.replace(/(\/t\/p\/)(?:w\d+|original)(\/)/,'$1'+artworkSize(L,backdrop?'backdrop':'poster')+'$2');
   if(next!==url)image.src=next;
  });
  document.dispatchEvent(new Event('minimal:artwork-quality'));
 }
 return {refresh};
}
