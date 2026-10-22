// Keep file labels, thumbnails, history and external-player coordinates together.
// A verified release season replaces only the native parser's invented season 1.
export function explicitSeason(path){
 const value=String(path || '').replace(/_/g,' ');
 const expressions=[/\bs(\d{1,2})(?=\b|\.?ep?\d)/i,/\b(\d{1,2})[x-]\d{1,4}\b/i,/(?:season|сезон)\s*(\d{1,2})\b/i,/\b(\d{1,2})\s*(?:season|сезон)\b/i];
 for(const expression of expressions){const m=value.match(expression);if(m)return Number(m[1]);}
 return null;
}
export default function torrentEpisodes(L,root=window){
 if(!L.Torrent || !L.Torserver || typeof L.Torserver.parse!=='function' || typeof L.Torrent.start!=='function')return;
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
  if(!selected || !data || key(data.movie)!==selected.key || !result.serial || data.is_file)return result;
  const explicit=explicitSeason(data.path);
  if(explicit!==null && explicit!==selected.releaseSeason && explicit!==selected.season)return result;
  if(result.season===selected.season)return result;
  // The torrent's numbering may differ from the catalogue's. Its verified
  // single-season mapping is used both before Api.seasons() and for each file.
  const corrected={...result,season:selected.season};
  corrected.hash_string=[corrected.season,corrected.season>10?':':'',corrected.episode,data.movie.original_title].join('');
  corrected.hash=L.Utils.hash(corrected.hash_string);
  return corrected;
 };
 if(L.Listener)L.Listener.follow('torrent_file',event=>{
  if(event.type==='list_close')selected=null;
  if(event.type==='render'){
   const item=event.item && (event.item.nodeType?event.item:event.item[0]);
   // File render events precede Modal.update(), so mark the mounted dialog later.
   if(item)setTimeout(()=>{const modal=item.closest('.modal');if(modal)modal.classList.add('minimal-torrent-files');},0);
  }
 });
}
