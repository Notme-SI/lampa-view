// Keep file labels, thumbnails, history and external-player coordinates together.
// A verified release season replaces only the native parser's invented season 1.
export function explicitSeason(path){
 const expressions=[/\bs(\d{1,2})(?=\b|\.?ep?\d)/i,/\b(\d{1,2})[x-]\d{1,4}\b/i,/(?:season|сезон)\s*(\d{1,2})\b/i,/\b(\d{1,2})\s*(?:season|сезон)\b/i,/(?:^|[^a-zа-я])(?:tv|тв)\s*-\s*(\d{1,2})\b/i];
 // A file or its nearest season folder wins over an outer bundle folder.
 for(const value of String(path || '').replace(/_/g,' ').split(/[\\/]/).reverse()){
  if(/\bs\d+\s*-\s*s?\d+\b|(?:season|сезон)\s*\d+\s*-\s*\d+|\d+\s*-\s*\d+\s*(?:season|сезон)/i.test(value))continue;
  for(const expression of expressions){const m=value.match(expression);if(m)return Number(m[1]);}
 }
 return null;
}
const folderFamilies=new WeakMap();
export function familySeason(data){
 const folders=path=>String(path || '').replace(/\\/g,'/').split('/').slice(0,-1);
 const clean=value=>String(value).replace(/\[[^\]]*\]/g,' ').replace(/_/g,' ').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff-]+/g,' ').trim();
 const own=folders(data.path);
 if(own.some(part=>/\[(?:movie|film|ova|specials?)\]/i.test(part)))return null;
 // Bare anime sequel folders ("Jujutsu Kaisen 2 [tv]") have no S02 marker.
 // Accept them only beside the exact unnumbered series folder in this torrent.
 const files=Array.isArray(data.files)?data.files:[];
 let anchors=folderFamilies.get(files);
 if(!anchors){anchors=new Set(files.flatMap(file=>folders(file.path)).filter(part=>!explicitSeason(part) && !/\[(?:movie|film|ova|specials?)\]/i.test(part)).map(clean));folderFamilies.set(files,anchors);}
 for(const part of own.reverse()){
  const match=clean(part).match(/^(.+?)\s+([1-9]\d?)(?:-\d{1,2})?$/);
  if(match && Number(match[2])<=60 && anchors.has(match[1]))return Number(match[2]);
 }
 return null;
}
import torrentWatchMenu from './torrent-watch-menu.js';
export default function torrentEpisodes(L,root=window){
 if(!L.Torrent || !L.Torserver || typeof L.Torserver.parse!=='function' || typeof L.Torrent.start!=='function')return;
 torrentWatchMenu(L,root);
 let selected;
 const start=L.Torrent.start,parse=L.Torserver.parse,open=L.Torrent.open;
 function key(movie){return movie && movie.id!=null?(movie.source || 'tmdb')+':'+movie.id:null;}
 L.Torrent.start=function(row,movie){
  selected=null;
  movie=movie || (L.Activity.active() || {}).movie;
  const C=root.TorrentCatalogueCore;
  const details=row && (row._tc || C && C.describe(row,C.catalogue(movie || {})));
  if(key(movie) && details && details.identity.state==='matched' && !details.parsed.bundle && !details.season.issue && Number.isInteger(details.season.number)){
   selected={key:key(movie),season:details.season.number,releaseSeason:details.parsed.seasons.length===1?details.parsed.seasons[0]:null};
  }
  return start.apply(this,arguments);
 };
 if(typeof open==='function')L.Torrent.open=function(){selected=null;return open.apply(this,arguments);};
 L.Torserver.parse=function(data){
  const result=parse.apply(this,arguments);
  if(!data || !result.serial || data.is_file)return result;
  const explicit=explicitSeason(data.path),pathSeason=explicit===null?familySeason(data):explicit;
  let season=pathSeason;
  if(selected && key(data.movie)===selected.key && (pathSeason===null || pathSeason===selected.releaseSeason || pathSeason===selected.season))season=selected.season;
  if(season===null || season===undefined)return result;
  if(result.season===season)return result;
  // The torrent's numbering may differ from the catalogue's. Its verified
  // single-season mapping is used both before Api.seasons() and for each file.
  const corrected={...result,season};
  corrected.hash_string=[corrected.season,corrected.season>10?':':'',corrected.episode,data.movie.original_title].join('');
  corrected.hash=L.Utils.hash(corrected.hash_string);
  return corrected;
 };
 if(L.Listener)L.Listener.follow('torrent_file',event=>{
  if(event.type==='list_close')selected=null;
  if(event.type==='render'){
   const item=event.item && (event.item.nodeType?event.item:event.item[0]);
   const file=event.element || {},book=event.params && event.params.seasons && event.params.seasons[file.season];
   const episode=book && (book.episodes || []).find(value=>Number(value.episode_number)===Number(file.episode));
   if(item && episode && Number(file.episode)>0){
    const line=item.querySelector('.torrent-serial__line'),content=item.querySelector('.torrent-serial__content');
    if(line && Number(episode.vote_average)>0 && !line.querySelector('.minimal-episode-rating')){const rating=root.document.createElement('span');rating.className='minimal-episode-rating';rating.textContent=Number(episode.vote_average).toFixed(1);line.prepend(rating);}
    const text=String(episode.overview || '').replace(/\s+/g,' ').trim();
    if(content && text && !content.querySelector('.minimal-episode-overview')){const overview=root.document.createElement('div');overview.className='minimal-episode-overview';overview.textContent=text;content.appendChild(overview);item.classList.add('minimal-has-summary');}
   }
   // File render events precede Modal.update(), so mark the mounted dialog later.
   if(item)setTimeout(()=>{
    const modal=item.closest('.modal');
    if(modal){
     modal.classList.add('minimal-torrent-files');
     // Native Scroll in TV mode moves its body by transform and resets scrollTop.
     // Let that handler receive the entire gesture instead of browser panning.
     modal.classList.toggle('minimal-torrent-files--virtual',Boolean(L.Platform && L.Platform.screen('tv')));
    }
   },0);
  }
 });
}
