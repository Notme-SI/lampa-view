import {artworkSize} from './artwork.js';
import flag from './storage-flag.js';

export function bannerCountries(card,language='ru',L){
 const countries=(card.production_countries || []).length?card.production_countries:(card.origin_country || []);
 let regions;try{if(typeof Intl.DisplayNames==='function')regions=new Intl.DisplayNames([language],{type:'region'});}catch(error){}
 return [...new Set(countries.map(country=>{
  const name=country && typeof country==='object'?country.name || '':'',code=String(typeof country==='string'?country:country && country.iso_3166_1 || '').toUpperCase();
  if(!/^[A-Z]{2}$/.test(code))return name || code;
  // The full card uses this same native country dictionary (US -> «США»).
  if(L && L.TMDB && typeof L.TMDB.parseCountries==='function'){
   try{const values=L.TMDB.parseCountries({production_countries:[{iso_3166_1:code,name:name || code}]});if(values && values[0])return values[0];}catch(error){}
  }
  if(L && L.Lang && L.Lang.translate){const key='country_'+code.toLowerCase(),value=L.Lang.translate(key);if(value && value!==key)return value;}
  const short=String(language).slice(0,2)==='ru'?({JP:'Япония',US:'США',GB:'Великобритания',RU:'Россия',KR:'Южная Корея',CN:'Китай',FR:'Франция',CA:'Канада',DE:'Германия'})[code]:'';
  return short || (regions && regions.of(code)) || name || code;
 }).filter(Boolean))].join(' | ');
}

// Keep the native filters, release rows and playback handlers intact.
export default function torrentBanner(L,loadLogo){
 const installed=new WeakMap();
 function refresh(){
  const active=L.Activity && L.Activity.active();
  if(!active || active.component!=='torrents' || !active.activity)return;
  const rendered=active.activity.render(),body=rendered && (rendered.nodeType?rendered:rendered[0]);
  const root=body && (body.matches('.explorer')?body:body.querySelector('.explorer'));
  const card=active.movie,left=root && root.querySelector('.explorer__left');
  if(!card || !left)return;
  if(!flag(L,'lampa_view_enabled')){root.classList.remove('minimal-torrent-view','minimal-torrent-view--classic');left.querySelectorAll('.minimal-torrent-banner').forEach(node=>node.remove());installed.delete(root);return;}
  root.classList.add('minimal-torrent-view');
  root.classList.remove('minimal-torrent-view--classic');
  const key=[card.source,card.id,card.backdrop_path,artworkSize(L,'backdrop')].join(':');
  if(installed.get(root)===key)return;
  installed.set(root,key);
  left.querySelectorAll('.minimal-torrent-banner').forEach(node=>node.remove());
  const banner=document.createElement('div');banner.className='minimal-torrent-banner';
  const image=document.createElement('img');image.className='minimal-torrent-banner__image';image.alt='';
  const path=card.backdrop_path || card.poster_path;
  if(path){image.src=/^(https?:|data:image\/)/i.test(path)?path:L.Api.img(path,artworkSize(L,card.backdrop_path?'backdrop':'poster'));image.onerror=()=>image.remove();banner.appendChild(image);}
  const shade=document.createElement('div');shade.className='minimal-torrent-banner__shade';banner.appendChild(shade);
  const meta=document.createElement('div');meta.className='minimal-torrent-banner__meta';
  const year=String(card.release_date || card.first_air_date || '').slice(0,4),rating=Number(card.vote_average);
  const countries=bannerCountries(card,L.Storage.get('language','ru'),L);
  [rating>0?'★ '+rating.toFixed(1):'',[ /^\d{4}$/.test(year)?year:'',countries].filter(Boolean).join(', ')].filter(Boolean).forEach(value=>{const span=document.createElement('span');span.textContent=value;meta.appendChild(span);});banner.appendChild(meta);
  const title=document.createElement('div');title.className='minimal-torrent-banner__title';title.textContent=card.title || card.name || card.original_title || card.original_name || '';banner.appendChild(title);
  left.prepend(banner);
  if(loadLogo)loadLogo(card,path=>{
   if(!path || !banner.isConnected || left.querySelector('.minimal-torrent-banner')!==banner)return;
   const logo=document.createElement('img');logo.alt=title.textContent;logo.className='minimal-torrent-banner__logo';
   logo.onload=()=>{if(banner.isConnected){title.textContent='';title.appendChild(logo);}};
   logo.src=L.Api.img(path,'w500');
  });
 }
 L.Listener.follow('activity',event=>{if(event.type==='start'){refresh();setTimeout(refresh,0);}});
 document.addEventListener('minimal:artwork-quality',refresh);
 return refresh;
}
