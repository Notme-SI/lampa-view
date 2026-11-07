import bluscreens from './bluscreens-frames.json';

export const galleryFramesKey='minimal_poiskkino_frames_key';
export const frameLimit=14;

const cache=new Map();
const https=url=>typeof url==='string' && /^https:\/\//i.test(url);
const galleryRows=urls=>[...new Set(urls)].slice(0,frameLimit).map(url=>({img:url,minimal_still_url:url}));
const filmGrab='https://film-grab.com/wp-json/wp/v2/';
// Each archive is tied to an exact TMDB movie, including films with similar titles.
const wikiMovies=new Map([
 [315635,['marvelcinematicuniverse','Spider-Man: Homecoming']],
 [429617,['marvelcinematicuniverse','Spider-Man: Far From Home']],
 [634649,['marvelcinematicuniverse','Spider-Man: No Way Home']],
 [969681,['marvelcinematicuniverse','Spider-Man: Brand New Day']]
]);
// Movie Screencaps publishes frame sequences separate from its promotional images.
const screencapMovies=new Map([
 [559,'/200/7-spider-man-3/full/spiderman-3-movie-screencaps.com-'],
 [1930,'/201/4k-2-amazingspiderman/full/amazingspiderman-movie-screencaps.com-'],
 [102382,'/201/4k-4-amazingspiderman2/full/amazingspider2-4k-movie-screencaps.com-']
]);
const screencapNumbers=[916,1004,1051,2716,2804,2851,4516,4604,4651,6316,6404,6451,8116,8251];
// Full-resolution captures from the second episode of the third season.
const jungleScenes=[
 ['/3d/c1/93/3dc1936a4c0c30826dbb0b1557e2ff9c/1920x1080_0x1aQRnm3W_2325295043365059235.png',
  '/3d/c1/93/3dc1936a4c0c30826dbb0b1557e2ff9c/728x410_1_de5830b410c15a0b12ae88d1325a9a74@1920x1080_0x1aQRnm3W_2325295043365059235.png.webp'],
 ['/ee/a1/ae/eea1aeab9d1a480198f390dd9aa7c108/1920x1080_0xWMpitVNw_7523994956590477889.png',
  '/ee/a1/ae/eea1aeab9d1a480198f390dd9aa7c108/728x410_1_612c4316cde1bc79d66271253e77b2ee@1920x1080_0xWMpitVNw_7523994956590477889.png.webp'],
 ['/93/79/d9/9379d93de7b4a5dbb8bb72e79235ec4b/1920x1080_0x5pmBiuzg_6324481662758287471.png',
  '/93/79/d9/9379d93de7b4a5dbb8bb72e79235ec4b/728x410_1_25c8e5335807c19bc09ac55099353212@1920x1080_0x5pmBiuzg_6324481662758287471.png.webp'],
 ['/ff/60/eb/ff60eb3d7d1cc40c154b5f8a2777615b/1920x1080_0xgMr1OS6i_1498472414494773255.png',
  '/ff/60/eb/ff60eb3d7d1cc40c154b5f8a2777615b/728x410_1_b85e8208cd07deef22dbe9c67da9ae42@1920x1080_0xgMr1OS6i_1498472414494773255.png.webp'],
 ['/16/bb/fa/16bbfa75552df0fbf6d0c419bcc45f3e/1920x1080_0x7bR7jPVF_1300791387016793887.png',
  '/16/bb/fa/16bbfa75552df0fbf6d0c419bcc45f3e/728x410_1_670550b4cc5a91806c959cdaf3c66978@1920x1080_0x7bR7jPVF_1300791387016793887.png.webp'],
 ['/21/d0/1b/21d01b64f0e58c8be0cde82243e0514a/1920x1080_0x3NJlaK4t_4332559862162516302.png',
  '/21/d0/1b/21d01b64f0e58c8be0cde82243e0514a/728x410_1_6741c9256d0490fac57c3518131d7f0d@1920x1080_0x3NJlaK4t_4332559862162516302.png.webp'],
 ['/32/9f/e9/329fe958f114aa67283e34f5d316af76/1920x1080_0x09ez31Tr_3751993824713442832.png',
  '/32/9f/e9/329fe958f114aa67283e34f5d316af76/728x410_1_039fd338f10878c41026522c9974e1f1@1920x1080_0x09ez31Tr_3751993824713442832.png.webp'],
 ['/df/d0/9e/dfd09e1d227326a90a6d3b75e27c7fe7/1920x1080_0xDcC5nswX_1610521395588012005.png',
  '/df/d0/9e/dfd09e1d227326a90a6d3b75e27c7fe7/728x410_1_b73715fee6d9c5bf416647fc995855ea@1920x1080_0xDcC5nswX_1610521395588012005.png.webp'],
].map(([full,thumbnail])=>({minimal_still_url:'https://n1s1.hsmedia.ru'+full,img:'https://n1s1.hsmedia.ru'+thumbnail}));

// The studio publishes these numbered galleries for the original films.
const ghibliGalleries=new Map([
 ['風の谷のナウシカ','nausicaa'],['天空の城ラピュタ','laputa'],['となりのトトロ','totoro'],
 ['魔女の宅急便','majo'],['おもひでぽろぽろ','omoide'],['紅の豚','porco'],['海がきこえる','umi'],
 ['平成狸合戦ぽんぽこ','tanuki'],['耳をすませば','mimi'],['On Your Mark','onyourmark'],
 ['もののけ姫','mononoke'],['ホーホケキョ となりの山田くん','yamada'],['千と千尋の神隠し','chihiro'],
 ['猫の恩返し','baron'],['ギブリーズ episode2','ghiblies'],['ハウルの動く城','howl'],['ゲド戦記','ged'],
 ['崖の上のポニョ','ponyo'],['借りぐらしのアリエッティ','karigurashi'],['コクリコ坂から','kokurikozaka'],
 ['風立ちぬ','kazetachinu'],['かぐや姫の物語','kaguyahime'],['思い出のマーニー','marnie'],
 ['レッドタートル ある島の物語','redturtle'],['アーヤと魔女','aya'],['君たちはどう生きるか','kimitachi']
]);
function ghibliFrames(card){
 if(!card.production_companies?.some(company=>Number(company.id)===10342 || company.name==='Studio Ghibli'))return [];
 const slug=ghibliGalleries.get(String(card.original_title || '').normalize('NFKC').trim());
 if(!slug)return [];
 const numbers=slug==='kimitachi'?[1,2,27,3,28,4,5,29,20,16,6,7,30,21]:
  Array.from({length:frameLimit},(_,index)=>index+1);
 return galleryRows(numbers.map(number=>'https://www.ghibli.jp/gallery/'+slug+String(number).padStart(3,'0')+'.jpg'));
}

const titleKey=title=>String(title || '').normalize('NFKD').toLowerCase().replace(/&amp;|&#0?38;/g,'&').replace(/&[a-z]+;|&#\d+;/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const tmdbPath=value=>String(value || '').match(/(?:^|\/t\/p\/(?:original|w\d+))(\/[\w.-]+\.(?:jpg|jpeg|png|webp))$/i)?.[1] || '';
const seriesCard=card=>card.media_type==='tv' || card.media_type!=='movie' && !!(card.name || card.first_air_date);
const tmdbId=card=>Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));
const bluArchive=new Map();
for(const [title,year,images] of bluscreens){
 for(const alias of new Set(title.split(/\s+\/\s+/).map(name=>titleKey(name.replace(/^(.+),\s*(the|a|an)$/i,'$2 $1'))).filter(Boolean))){
  const key=alias+':'+year;
  bluArchive.set(key,bluArchive.has(key)?null:images);
 }
}

function bluFrames(titles,year){
 const matches=[...new Set(titles.map(title=>bluArchive.get(titleKey(title)+':'+year)).filter(Boolean))];
 if(matches.length!==1)return [];
 const base='https://www.bluscreens.net/uploads/1/4/8/9/14897402/';
 return matches[0].slice(0,frameLimit).map(file=>{
  const [thumbnail,full]=Array.isArray(file)?file:[file,file];
  return {img:base+thumbnail,minimal_still_url:base+full};
 });
}

async function filmGrabFrames(title,year,signal){
 const key=titleKey(title);
 if(!key || !/^\d{4}$/.test(year) || !/^[\x20-\x7e\u00a0-\u024f\u2000-\u206f]+$/.test(title))return [];
 const identity='film-grab:'+key+':'+year,saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 async function get(path){
  const response=await fetch(filmGrab+path,{signal,credentials:'omit'});
  if(!response.ok)throw new Error('Frame archive unavailable');
  return response.json();
 }
 try{
  const hits=await get('search?'+new URLSearchParams({search:title,subtype:'post',per_page:'15',_fields:'id,title'}));
  const matches=Array.isArray(hits)?hits.filter(row=>Number.isSafeInteger(row?.id) && row.id>0 &&
   titleKey(String(row.title || '').replace(new RegExp('\\s*\\('+year+'\\)$'),''))===key):[];
  if(!matches.length || matches.length>3)return [];
  const posts=await Promise.all(matches.map(row=>get('posts/'+row.id+'?_fields=content')));
  const verified=posts.map(post=>post.content?.rendered || '').filter(html=>Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),match=>
   match[1].replace(/<[^>]+>/g,'').replace(/&nbsp;|\u00a0/g,' ').trim()
  ).some(line=>line.replace(/\s+/g,' ').toLowerCase()==='year: '+year));
  if(verified.length!==1)return [];
  const pattern=/href="(https:\/\/film-grab\.com\/wp-content\/uploads\/photo-gallery\/[\w.%()' -]+\.(?:jpg|jpeg|png|webp)(?:\?bwg=\d+)?)"/gi;
  const frames=galleryRows(Array.from(verified[0].matchAll(pattern),match=>new URL(match[1]).href));
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}
}

async function movieArchive(card,id,readTmdb){
 const captures=screencapMovies.get(id);
 if(captures)return screencapNumbers.map(number=>{
  const url='https://i0.wp.com/imgs.screencaps.us'+captures+number+'.jpg?ssl=1';
  return {img:url+'&w=780',minimal_still_url:url};
 });
 const studio=ghibliFrames(card);
 if(studio.length || typeof fetch!=='function' || typeof AbortController!=='function')return studio;
 const year=String(card.release_date || '').slice(0,4),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4000);
 try{
  const title=card.original_title || card.title;
  const english=card.original_language && card.original_language!=='en' && id>0?
   await readGalleryData(readTmdb,'movie/'+id+'?language=en-US',1000):null;
  const titles=[...new Set([title,Number(english?.id)===id && english.title].filter(Boolean))];
  const film=Promise.all(titles.map(name=>filmGrabFrames(name,year,controller.signal)))
   .then(results=>results.find(rows=>rows.length) || bluFrames(titles,year));
  const wiki=wikiMovies.get(id);
  if(!wiki)return await film;
  const sources=[film,wikiFrames(wiki,controller.signal)];
  return await new Promise(resolve=>{
   for(const source of sources)source.then(frames=>{if(frames.length===frameLimit)resolve(frames);});
   Promise.all(sources).then(([filmRows,wikiRows])=>resolve(filmRows.length>=wikiRows.length?filmRows:wikiRows));
  });
 }finally{clearTimeout(timer);controller.abort();}
}

async function wikiFrames([site,title],signal){
 const identity='wiki:'+site+':'+title,saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 async function get(params){
  const query=new URLSearchParams({...params,format:'json',formatversion:'2',origin:'*'});
  const response=await fetch('https://'+site+'.fandom.com/api.php?'+query,{signal,credentials:'omit'});
  if(!response.ok)throw new Error('Frame archive unavailable');
  return response.json();
 }
 const imageUrl=url=>typeof url==='string' && url.startsWith('https://static.wikia.nocookie.net/'+site+'/images/');
 const filename=name=>name.replace(/^(?:file|image):\s*/i,'').replace(/_/g,' ').normalize('NFC').trim();
 try{
  const page=title+'/Gallery';
  const data=await get({action:'parse',page,prop:'wikitext',redirects:'1'});
  if(data.parse?.title!==page || typeof data.parse.wikitext!=='string')return [];
  const sections=data.parse.wikitext.split(/^==[ \t]*([^=\r\n]+?)[ \t]*==[ \t]*$/m);
  const heading=sections.findIndex((section,i)=>i%2===1 && section.toLowerCase()==='screenshots');
  if(heading<0)return [];
  const excluded=/(?:trailer|teaser|tv[ _-]*spot|featurette|promo(?:tional)?|deleted[ _-]*scene|behind[ _-]*the[ _-]*scenes|credits?|title[ _-]*card|studio(?:s)?[ _-]*logo)/i;
  const names=new Set();
  for(const [,block] of sections[heading+1].matchAll(/<gallery\b[^>]*>([\s\S]*?)<\/gallery>/gi)){
   for(const line of block.split(/\r?\n/)){
    const name=filename(line.split('|')[0]);
    if(/\.(?:png|jpe?g|webp)$/i.test(name) && !excluded.test(line))names.add(name);
   }
  }
  if(!names.size)return [];
  const files=[...names];
  // Space out the selections so adjacent captures of one shot do not dominate the row.
  const sampleCount=Math.min(40,files.length);
  const sample=Array.from({length:sampleCount},(_,i)=>files[Math.floor(i*files.length/sampleCount)]);
  const images=await get({action:'query',titles:sample.map(name=>'File:'+name).join('|'),prop:'imageinfo',iiprop:'url|size',iiurlwidth:'780'});
  const indexed=new Map();
  for(const row of images.query?.pages || []){
   const item=row.imageinfo?.[0];
   if(row.imagerepository!=='local' || !item || !(item.width>=1280 && item.height>=540 && item.width/item.height>=1.35) || !imageUrl(item.url))continue;
   indexed.set(filename(row.title),{img:imageUrl(item.thumburl)?item.thumburl:item.url,minimal_still_url:item.url});
  }
  const frames=sample.map(name=>indexed.get(name)).filter(Boolean).slice(0,frameLimit);
  if(frames.length){
   if(cache.size>=80)cache.delete(cache.keys().next().value);
   cache.set(identity,{frames,until:Date.now()+1800000});
  }
  return frames;
 }catch(error){return [];}
}

function readGalleryData(read,path,timeout){
 return new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(null),timeout);
  const complete=value=>{clearTimeout(timer);resolve(value);};
  try{read(path,complete,()=>complete(null));}catch(error){complete(null);}
 });
}

async function episodeGallery(data,id,readTmdb){
 const episodes=[data.episodes?.episodes_original,data.episodes?.episodes].filter(Array.isArray).flat();
 if(data.movie.last_episode_to_air)episodes.push(data.movie.last_episode_to_air);
 const known=new Map(),today=new Date().toISOString().slice(0,10);
 const aired=date=>/^\d{4}-\d{2}-\d{2}$/.test(date || '') && date<=today;
 const thumbs=new Set(episodes.concat(data.movie,data.images?.backdrops || []).map(row=>tmdbPath(row?.still_path || row?.backdrop_path || row?.file_path || row?.img)).filter(Boolean));
 function addEpisodes(rows){
  for(const row of rows){
   const preview=tmdbPath(row?.still_path);
   if(preview)thumbs.add(preview);
   const season=Number(row?.season_number),episode=Number(row?.episode_number);
   if(Number.isSafeInteger(season) && season>0 && Number.isSafeInteger(episode) && episode>0 &&
      aired(row.air_date) && !row.comeing)known.set(season+':'+episode,{season,episode});
  }
 }
 addEpisodes(episodes);
 const ordered=[...known.values()].sort((a,b)=>b.season-a.season || b.episode-a.episode);
 const first=ordered.at(-1),recent=ordered.slice(0,8).filter(row=>row!==first);
 const candidates=recent.slice(0,2).concat(first || [],recent.slice(2));
 const paths=new Map(),started=Date.now();
 const remaining=()=>3000-(Date.now()-started);
 async function readFrames(batch){
  const time=remaining();
  if(time<=0)return;
  await Promise.all(batch.map(async ({season,episode})=>{
   const result=await readGalleryData(readTmdb,'tv/'+id+'/season/'+season+'/episode/'+episode+'/images?include_image_language=null',Math.min(time,1000));
   for(const row of Array.isArray(result?.stills)?result.stills:[]){
    const path=tmdbPath(row?.file_path),width=Number(row?.width)||0;
    if(path && !thumbs.has(path) && (!width || width>=480))paths.set(path,Math.max(width,paths.get(path) || 0));
   }
  }));
 }
 await readFrames(candidates.slice(0,3));
 if(paths.size<frameLimit && remaining()>0){
  // The detail card can contain only a handful of recent episodes.
  const sampledSeasons=new Set(candidates.map(row=>row.season));
  const otherSeasons=(data.movie.seasons || []).filter(row=>Number.isSafeInteger(row?.season_number) &&
   row.season_number>0 && aired(row.air_date) && !sampledSeasons.has(row.season_number))
   .sort((a,b)=>a.season_number-b.season_number);
  const extra=await Promise.all(otherSeasons.slice(0,2).map(row=>readGalleryData(readTmdb,'tv/'+id+'/season/'+row.season_number,Math.min(remaining(),850))));
  const previouslyKnown=new Set(known.keys());
  for(const book of extra)if(Array.isArray(book?.episodes))addEpisodes(book.episodes);
  const other=[...known].filter(([key])=>!previouslyKnown.has(key)).map(([,row])=>row);
  const sample=[...new Set([other[0],other[Math.floor(other.length/2)],other.at(-1)])].filter(Boolean);
  candidates.splice(3,0,...sample);
 }
 for(let i=3;i<candidates.length && paths.size<frameLimit && remaining()>0;i+=3)await readFrames(candidates.slice(i,i+3));
 for(const preview of thumbs)paths.delete(preview);
 return [...paths].sort((a,b)=>b[1]-a[1]).slice(0,frameLimit).map(([still_path,width])=>({still_path,width}));
}

export function hasGallerySource(L,data){
 const card=data.movie;
 if(card.adult || card.blocked)return false;
 if(L.Storage?.get(galleryFramesKey,''))return true;
 if(seriesCard(card))return tmdbId(card)>0 && (tmdbId(card)===273552 || !!(data.episodes || card.last_episode_to_air || card.seasons?.length));
 return !!((card.original_title || card.title) && card.release_date && typeof fetch==='function' && typeof AbortController==='function');
}

export async function loadDetailGallery(L,data,readTmdb){
 const card=data.movie;
 if(!hasGallerySource(L,data))return [];
 const isSeries=seriesCard(card),id=tmdbId(card);
 if(isSeries && id===273552)return jungleScenes;
 const provider=loadGalleryFrames(L,card);
 const archive=isSeries?id>0?episodeGallery(data,id,readTmdb):[]:movieArchive(card,id,readTmdb);
 const [primary,optional]=await Promise.all([archive,provider]);
 const unique=new Map();
 for(const row of [...primary,...optional])unique.set(row.still_path || row.minimal_still_url,row);
 return [...unique.values()].slice(0,frameLimit);
}

export async function loadGalleryFrames(L,card){
 const key=String(L.Storage?.get(galleryFramesKey,'') || '').trim();
 if(!key || !card || card.adult || card.blocked || typeof fetch!=='function' || typeof AbortController!=='function')return [];
 const isSeries=seriesCard(card);
 const kp=Number(card.kinopoisk_id || card.external_ids?.kinopoisk_id);
 const tmdb=tmdbId(card);
 const imdb=String(card.imdb_id || card.external_ids?.imdb_id || '');
 const hasImdb=/^tt\d{5,12}$/.test(imdb);
 if(!(kp>0 || tmdb>0 || hasImdb))return [];
 const identity=(kp>0?'kp:'+kp:hasImdb?'imdb:'+imdb:'tmdb:'+tmdb)+':'+isSeries;
 const saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
 async function get(path,params){
  const response=await fetch('https://api.poiskkino.dev/v1.5/'+path+'?'+new URLSearchParams(params),{
   headers:{'X-API-KEY':key},signal:controller.signal,redirect:'error'
  });
  if(!response.ok)throw new Error('Frame service unavailable');
  return (await response.json()).docs || [];
 }
 try{
  let id=kp;
  if(!(id>0)){
   const lookup=async field=>{
    const byImdb=field==='imdb',value=byImdb?imdb:tmdb;
    const matches=await get('movie',{['externalId.'+field]:value,isSeries,limit:2});
    if(matches.length!==1 || matches[0].isSeries!==isSeries)return 0;
    const ids=matches[0].externalId || {};
    if(tmdb>0 && ids.tmdb && Number(ids.tmdb)!==tmdb || hasImdb && ids.imdb && ids.imdb!==imdb)return 0;
    return (byImdb?ids.imdb===imdb:Number(ids.tmdb)===tmdb)?Number(matches[0].id):0;
   };
   id=hasImdb?await lookup('imdb'):0;
   if(!(id>0) && tmdb>0)id=await lookup('tmdb');
   if(!(id>0))return [];
  }
  const query=new URLSearchParams({movieId:id,limit:40});
  const frameTypes=['frame','screenshot','still'];
  frameTypes.forEach(type=>query.append('type',type));
  const images=await get('image',query);
  const stills=images.filter(row=>frameTypes.includes(row.type) && Number(row.movieId)===id && https(row.url))
   .sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0));
  const frames=[...new Map(stills.map(row=>[row.url,{img:https(row.previewUrl)?row.previewUrl:row.url,minimal_still_url:row.url}])).values()].slice(0,frameLimit);
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
