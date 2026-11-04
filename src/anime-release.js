import {isAnime} from './metadata.js';
export const animeSeasonTitle=value=>{
 const match=String(value || '').match(/(?:season\s+(\d+)|(\d+)(?:st|nd|rd|th)?\s+season|(\d+)\s+сезон)(?=$|[\s:.-])/i);
 return match?Number(match[1] || match[2] || match[3]):0;
};
export function qualityCacheKey(card,tv){
 const norm=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]/g,'');
 const key=(tv?'tv:':'movie:')+norm(card.title || card.name || card.original_title || card.original_name)+':'+String(card.first_air_date || card.release_date || '').slice(0,4);
 return key+(isAnime(card)?':anime3:'+String(card.source==='minimal_shiki'?'shiki':'tmdb')+':'+(card.shikimori_id || card.tmdb_id || card.id || ''):'');
}
// The parser searches substrings across films, remasters and entire franchises.
// An anime entry needs its own title/year evidence, not the largest resolution.
export function animeReleaseMatches(card,title,names,tv){
 const text=String(title || '').toLowerCase().replace(/ё/g,'е');
 if(/upscal|апск[еэ]йл|апскал|нейро|\b(?:ai[ ._-]*(?:enhanced|remaster|up)|topaz)\b/i.test(text))return false;
 if(tv && /\b(?:movie|film|gekijouban|gekijōban|live[ .-]?action)\b|полнометраж|фильм(?:\s|$|[.,:])/i.test(text))return false;
 const normalize=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u3040-\u30ff\u3400-\u9fff]+/g,' ').trim();
 let matched=false;
 for(const part of text.split(/[\/|]/)){
  const normalized=' '+normalize(part)+' ';let contains=false,exact=false;
  for(const name of names){
   const needle=' '+normalize(name)+' ',at=normalized.indexOf(needle);if(at<0)continue;
   contains=true;const tail=normalized.slice(at+needle.length).trim();
   if(!tail || /^(?:\d|s\d|season\b|сезон(?:\s|$)|tv\b|bd|blu|web|hd|dvd|uhd|hevc|avc|x26)/.test(tail))exact=true;
  }
  if(contains && !exact)return false;
  if(exact)matched=true;
 }
 if(!matched)return false;
 if(card.source==='minimal_shiki'){
  const year=String(card.first_air_date || card.release_date || '').slice(0,4),years=text.match(/\b(?:19|20)\d{2}\b/g) || [];
  if(!year || !years.includes(year))return false;
  const expected=animeSeasonTitle(card.original_name || card.original_title || card.name || card.title);
  const explicit=animeSeasonTitle(text),short=text.match(/\bs(\d{1,2})(?:\b|e\d)/i),season=explicit || (short?Number(short[1]):0);
  if(expected && season && season!==expected)return false;
 }
 return true;
}
// Lampa's own date-gap grouping is also used by its season API. This is
// presentation metadata only: never replace canonical seasons/history hashes.
export function groupedAnimeRelease(L,card,json,today=new Date().toISOString().slice(0,10)){
 if(!isAnime(card) || Number(card.number_of_seasons)!==1 || !L.Utils || typeof L.Utils.splitEpisodesIntoSeasons!=='function')return null;
 const episodes=json && (json.episodes_original || json.episodes);if(!Array.isArray(episodes))return null;
 const groups=L.Utils.splitEpisodesIntoSeasons(episodes),numbers=Object.keys(groups).map(Number).filter(n=>n>0).sort((a,b)=>a-b);
 if(numbers.length<2)return null;
 for(const season of numbers.reverse()){
  const rows=groups[season],aired=rows.filter(e=>Number(e.episode_number)>0 && e.air_date && String(e.air_date).slice(0,10)<=today);
  if(aired.length)return {season,count:Math.max(...aired.map(e=>Number(e.episode_number))),total:rows.length};
 }
 return null;
}
