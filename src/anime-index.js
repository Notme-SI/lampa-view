import DATA from './anime-index-data.json';
const positive=n=>Number.isSafeInteger(Number(n)) && Number(n)>0;
let indexes;
function index(){if(indexes)return indexes;indexes={mal:new Map(),anilist:new Map(),anidb:new Map(),tv:new Map(),movie:new Map()};
 for(const row of JSON.parse(DATA.packed)){const record={mal:row[0],anilist:row[1],anidb:row[2],kind:row[3],tv:row[4],movies:row[5],imdb:row[6],tvdb:row[7],...(row[8]===null?{}:{season:row[8]}),offset:row[9],absolute:!!row[10],rules:row[11]};for(const name of ['mal','anilist','anidb','tv'])if(positive(record[name])){const key=Number(record[name]),rows=indexes[name].get(key)||[];rows.push(record);indexes[name].set(key,rows);}for(const id of record.movies || []){const rows=indexes.movie.get(id)||[];rows.push(record);indexes.movie.set(id,rows);}}
 return indexes;
}
export function animeRecords(card={}){
 const db=index(),refs=[];
 const add=(name,value)=>{if(positive(value))refs.push([name,Number(value)]);};
 add('mal',card.mal_id);add('mal',card.shikimori_id);add('anilist',card.anilist_id);add('anidb',card.anidb_id);
 if(card.source==='minimal_shiki')add('mal',card.shikimori_id || card.id);
 if(card.minimal_anime_release)add('mal',card.minimal_anime_release.mal);
 const type=card.media_type || (card.name || card.first_air_date?'tv':'movie');
 if(positive(card.tmdb_id))add(type,card.tmdb_id);else if(!card.source || ['tmdb','cub','trakt'].includes(card.source))add(type,card.id);
 if(!refs.length)return [];
 let rows=null;for(const [kind,id] of refs){const found=db[kind].get(id)||[];rows=rows===null?found:rows.filter(r=>found.includes(r));}
 return (rows || []).slice();
}
export function animeTargets(record){if(!record)return [];return [...(record.movies || []).map(id=>({id,type:'movie'})),...(record.tv?[{id:record.tv,type:'tv'}]:[])];}
export function animeTarget(card){
 const rows=animeRecords(card);if(rows.length!==1)return null;const record=rows[0],targets=animeTargets(record),type=card.media_type || (card.name?'tv':'movie'),matching=targets.filter(t=>t.type===type);
 return matching.length===1?{...matching[0],release:record}:null;
}
export function animeSeed(card){
 const rows=animeRecords(card).filter(r=>positive(r.mal));
 if(!rows.length)return null;
 const main=rows.filter(r=>['tv','ona'].includes(r.kind) && r.season===1 && !r.offset);
 return (main.length?main:rows).slice().sort((a,b)=>a.mal-b.mal)[0];
}
// A mapping describes metadata coordinates, never the provider's numbering.
// Explicit one-to-many, duplicate, absent and out-of-range targets stay unresolved.
export function animeEpisodeMap(record,count,card,books={}){
 count=Number(count);if(!record || Number(record.tv)!==Number(card.tmdb_id || card.id) || !Number.isSafeInteger(count) || count<1 || count>3000)return null;
 const known=new Map((card.seasons || []).map(s=>[Number(s.season_number),Number(s.episode_count)])),mapped=new Map(),explicit=new Map();
 for(const rule of record.rules || []){if(rule.source!==1)continue;
  if(rule.start)for(let n=rule.start;n<=Math.min(rule.end,count);n++){const previous=explicit.get(n),value={season:rule.season,episode:n+rule.offset};if(previous && (previous.season!==value.season || previous.episode!==value.episode))return null;explicit.set(n,value);}
 }
 // Individual mappings override their range, as defined by Anime-Lists.
 for(const rule of record.rules || [])if(rule.source===1 && rule.pairs)for(const [n,targets] of rule.pairs){if(n>count)continue;if(targets.length!==1 || targets[0]<1)return null;const value={season:rule.season,episode:targets[0]},old=mapped.get(n);if(old && (old.season!==value.season || old.episode!==value.episode))return null;mapped.set(n,value);}
 const result=[],seen=new Set();for(let n=1;n<=count;n++){
  let value=mapped.get(n) || explicit.get(n);if(!value && Number.isSafeInteger(record.season))value={season:record.season,episode:n+(record.offset || 0)};
  if(!value || !Number.isSafeInteger(value.episode) || value.episode<1 || !known.has(value.season) || value.episode>known.get(value.season))return null;
  if(value.season===0 && !['special','ova','movie','tv_special'].includes(record.kind))return null;
  const key=value.season+':'+value.episode;if(seen.has(key))return null;seen.add(key);
  const book=books[value.season],episodes=book && (book.episodes_original || book.episodes),episode=episodes && episodes.find(e=>Number(e.episode_number)===value.episode);
  if(book && !episode)return null;
  result.push({number:n,...value,...(episode?{metadata:episode}:{})});
 }
 return result;
}
export const animeIndexInfo={schema:DATA.schema,sources:DATA.sources,records:DATA.count,mapped:DATA.mapped};

// A sequel without a direct ID can be a dated interval inside a shared TV card.
// Require every episode and both boundary dates, never a franchise-name guess.
export function datedReleaseTarget(card,canonical,books){
 const parent=card.minimal_franchise_parent,release=card.minimal_franchise_release;
 if(!parent || Number(parent.id)!==Number(canonical?.id) || parent.type!=='tv' || !release || !/^\d{4}-\d{2}-\d{2}$/.test(release.aired || '') || !/^\d{4}-\d{2}-\d{2}$/.test(release.released || '') || !Number.isInteger(release.episodes) || release.episodes<1)return null;
 const matches=[];
 for(const [number,book] of Object.entries(books)){
  const rows=(book?.episodes_original || book?.episodes || []).filter(e=>e.air_date>=release.aired && e.air_date<=release.released).sort((a,b)=>a.episode_number-b.episode_number);
  if(rows.length!==release.episodes || rows[0]?.air_date!==release.aired || rows.at(-1)?.air_date!==release.released || !rows.every((e,i)=>Number(e.season_number)===Number(number) && Number(e.episode_number)===Number(rows[0].episode_number)+i))continue;
  matches.push({id:Number(parent.id),type:'tv',release:{mal:Number(card.shikimori_id || card.id),kind:card.minimal_anime_kind || 'tv',tv:Number(parent.id),season:Number(number),offset:Number(rows[0].episode_number)-1}});
 }
 return matches.length===1?matches[0]:null;
}
