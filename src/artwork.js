import posterPreview from './poster-cache.js';
const premierArt='https://uma-static.rtbcdn.ru';
const jungleBanner='/pic/cardimage/38/00/38005b24f09deabf6b021d9b1829979b.jpg';
// Individual episode artwork from the Apple TV listings for season 3.
const jungleAppleEpisodes={
 2:'PjioiIA_AR3I3AI2r2kQJg',
 3:'p42MWcd4nwuS-He3cA_ZcQ',
 4:'XqR66gyXX2-uMQjleIQ9IQ',
 5:'_NwbZ4Er28_v52s0SisQjA'
};
const isJungle=card=>card?.media_type!=='movie' && Number(card?.tmdb_id || (['tmdb','cub'].includes(card?.source)?card.id:0))===273552;

export function officialBanner(card,original){
 if(isJungle(card))return premierArt+(original?jungleBanner:'/cwebp'+jungleBanner+'?size=1280&quality=85');
}
export function officialEpisodePreview(card,season,episode){
 if(!isJungle(card) || Number(season)!==3)return '';
 if(Number(episode)===1)return premierArt+'/cwebp/pic/video/86/be/86be8a6310f4bad09364a65f3ce987f8.jpg?size=692&quality=85';
 const image=jungleAppleEpisodes[Number(episode)];
 return image?'https://is1-ssl.mzstatic.com/image/thumb/'+image+'/1200x675.jpg':'';
}
export function detailBackdrop(variants,path,width,language='ru'){
 const current=variants.find(v=>v.file_path===path),needed=Math.max(1920,Number(width)||1920);
 if(!current)return path;
 const lang=String(language).split('-')[0];
 const suitable=variants.filter(v=>Number(v.width)>Number(current.width) && Number(v.width)>=needed && Number(v.height)>0 && Number(v.width)/Number(v.height)>1.4 && (!v.iso_639_1 || v.iso_639_1===lang));
 suitable.sort((a,b)=>Number(b.width)-Number(a.width) || Number(!b.iso_639_1)-Number(!a.iso_639_1) || Number(b.vote_average||0)-Number(a.vote_average||0));
 return suitable[0]?.file_path || path;
}
// High keeps the same source detail on TVs and desktops. A TV WebView can
// report a 960px viewport while displaying the artwork on a 4K panel.
export function artworkQuality(L){
 const get=(key,def)=>L.Storage && L.Storage.get?L.Storage.get(key,def):def;
 const value=get('minimal_banner_quality','maximum'),choice=get('minimal_artwork_quality_choice','');
 if(choice==='medium' || choice==='high')return choice;
 // Old automatic migration could leave medium while native TMDB explicitly
 // says High. Reconcile that conflict once; future explicit choices are tracked.
 if(Number(get('minimal_artwork_quality_revision',0))<3 && get('poster_size','')==='w500')return 'high';
 return ['medium','w1280'].includes(value)?'medium':'high';
}
export function artworkSize(L,kind){
 if(kind==='detail-backdrop')return artworkQuality(L)==='high'?'original':'w1280';
 if(artworkQuality(L)==='medium')return kind==='backdrop'?'w1280':'w500';
 if(kind!=='backdrop')return 'w780';
 // CSS pixels alone underestimate the TV panel. Keep originals behind the
 // explicit High preference; keep compact catalogue/loading images adaptive.
 if(document.body.classList.contains('pt-tv'))return 'original';
 const width=(window.innerWidth || 1920)*Math.min(2,window.devicePixelRatio || 1);
 return width>1440?'original':'w1280';
}
export function logoSize(){return typeof window!=='undefined' && window.innerWidth<=700?'w500':'original';}
export function portraitSize(L){return artworkQuality(L)==='high'?'w600_and_h600_face':'w300_and_h300_face';}
export default function installArtwork(L,enabled){
 const quality=artworkQuality(L);
 if(L.Storage.set){L.Storage.set('minimal_banner_quality',quality);L.Storage.set('minimal_artwork_quality_revision',3);L.Storage.set('poster_size',quality==='high'?'w500':'w300');}
 const wrappers=new Map(),wrapped=new WeakSet(),imageWrappers=new WeakSet();let depth=0;
 const canonical=url=>typeof url==='string'?url.replace(/\/+t\/p\/(w\d+(?:_and_h\d+_face)?|original)\/+/,'/t/p/$1/'):url;
 function wrapImage(api){
  if(!api || typeof api.image!=='function' || imageWrappers.has(api.image))return;
  const image=api.image;
  api.image=function(url,options){
   const value=image.apply(this,arguments);if(!enabled())return value;
   if(options && options.preserveSize)return canonical(value);
   return typeof value==='string'?canonical(value).replace(/(\/t\/p\/)w(\d+)(?:_and_h\d+_face)?(\/)/,(all,prefix,size,suffix)=>prefix+(/_face\//.test(all)?portraitSize(L):Number(size)<=500?artworkSize(L,'poster'):Number(size)===1280?artworkSize(L,'backdrop'):'w'+size)+suffix):value;
  };
  imageWrappers.add(api.image);
 }
 function wrap(api){
  if(!api || typeof api.img!=='function' || wrapped.has(api.img))return;
  const original=api.img;
  if(!wrappers.has(original)){
   const wrapper=function(src,size){
    if(depth || !enabled() || (size && !/^(?:w\d+(?:_and_h\d+_face)?|original)$/.test(size)))return original.apply(this,arguments);
    if(typeof src==='string' && /^https?:\/\//i.test(src))return src;
    // Native MediaLoading asks for original: it is a fullscreen backdrop,
    // never a small portrait. Delegating APIs must not classify the size twice.
    const kind=['w780','w1280','original'].includes(size)?'backdrop':'poster';
    const face=size && /_face$/.test(size);
    const requested=face?portraitSize(L):artworkSize(L,kind);
    depth++;try{return canonical(original.call(this,src,requested));}finally{depth--;}
   };
   wrappers.set(original,wrapper);wrapped.add(wrapper);
  }
  api.img=wrappers.get(original);
 }
 wrapImage(L.TMDB);wrap(L.TMDB);wrap(L.Api);
 if(L.Api && L.Api.sources){wrap(L.Api.sources.tmdb);wrap(L.Api.sources.cub);}
 const posters=posterPreview(L,enabled,()=>artworkQuality(L)==='high');
 function refresh(){
  if(!enabled())return;
  document.querySelectorAll('.card__img,.full-person img,.full-start-new__img,.full-start__img,.full-start__background,.media-loading__backdrop').forEach(image=>{
   const url=image.getAttribute('src') || '';
   if(image._minimalArtwork && image._minimalArtwork(/^https?:/.test(url)))return;
   if(!/\/t\/p\/(?:w\d+(?:_and_h\d+_face)?|original)\//.test(url))return;
   const backdrop=image.matches('.full-start__background,.media-loading__backdrop') || image.closest('.card--wide,.card--collection');
   const portrait=image.matches('.full-person img,.person-start__img');
   const next=url.replace(/(\/t\/p\/)(?:w\d+(?:_and_h\d+_face)?|original)(\/)/,'$1'+(portrait?portraitSize(L):artworkSize(L,image.matches('.full-start__background')?'detail-backdrop':backdrop?'backdrop':'poster'))+'$2');
   if(next!==url)image.src=next;
  });
  document.dispatchEvent(new Event('minimal:artwork-quality'));
 }
 let choosing=false;
 function choose(){
  const value=L.Storage.get('minimal_banner_quality','high')==='medium'?'medium':'high';
  choosing=true;
  try{L.Storage.set('minimal_artwork_quality_choice',value);L.Storage.set('poster_size',value==='high'?'w500':'w300');}finally{choosing=false;}
  refresh();
 }
 if(L.Storage.listener)L.Storage.listener.follow('change',event=>{
  if(event.name!=='poster_size' || choosing || !['w200','w300','w500'].includes(event.value))return;
  const value=event.value==='w500'?'high':'medium';
  L.Storage.set('minimal_banner_quality',value);L.Storage.set('minimal_artwork_quality_choice',value);refresh();
 });
 return {refresh,choose,...posters};
}
