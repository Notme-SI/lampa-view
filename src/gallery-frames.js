export const galleryFramesKey='minimal_poiskkino_frames_key';
export const frameLimit=20;

const cache=new Map();
const https=url=>typeof url==='string' && /^https:\/\//i.test(url);
const galleryRows=urls=>[...new Set(urls)].slice(0,frameLimit).map(url=>({img:url,minimal_still_url:url}));
const filmGrab='https://film-grab.com/wp-json/wp/v2/';
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
 const numbers=slug==='kimitachi'?[1,2,27,3,28,4,5,29,20,16,6,7,30,21,8,9,10,31,32,23]:
  Array.from({length:frameLimit},(_,index)=>index+1);
 return galleryRows(numbers.map(number=>'https://www.ghibli.jp/gallery/'+slug+String(number).padStart(3,'0')+'.jpg'));
}

const titleKey=title=>String(title || '').normalize('NFKD').toLowerCase().replace(/&amp;|&#0?38;/g,'&').replace(/&[a-z]+;|&#\d+;/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const tmdbPath=value=>String(value || '').match(/(?:^|\/t\/p\/(?:original|w\d+))(\/[\w.-]+\.(?:jpg|jpeg|png|webp))$/i)?.[1] || '';
const seriesCard=card=>card.media_type==='tv' || card.media_type!=='movie' && !!(card.name || card.first_air_date);
const tmdbId=card=>Number(card.tmdb_id || (['tmdb','cub'].includes(card.source)?card.id:0));

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
 const studio=ghibliFrames(card);
 if(studio.length || typeof fetch!=='function' || typeof AbortController!=='function')return studio;
 const year=String(card.release_date || '').slice(0,4),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),2800);
 try{
  const title=card.original_title || card.title;
  const english=card.original_language && card.original_language!=='en' && id>0?
   await readGalleryData(readTmdb,'movie/'+id+'?language=en-US',1000):null;
  const titles=[...new Set([title,Number(english?.id)===id && english.title].filter(Boolean))];
  const results=await Promise.all(titles.map(name=>filmGrabFrames(name,year,controller.signal)));
  return results.find(rows=>rows.length) || [];
 }finally{clearTimeout(timer);}
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
 const thumbs=new Set(episodes.concat(data.movie,data.images?.backdrops || []).map(row=>tmdbPath(row?.still_path || row?.backdrop_path || row?.file_path || row?.img)).filter(Boolean));
 for(const row of episodes){
  const season=Number(row?.season_number),episode=Number(row?.episode_number),date=row?.air_date;
  if(Number.isSafeInteger(season) && season>0 && Number.isSafeInteger(episode) && episode>0 &&
     /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date<=today && !row.comeing)known.set(season+':'+episode,{season,episode});
 }
 const ordered=[...known.values()].sort((a,b)=>b.season-a.season || b.episode-a.episode);
 const first=ordered.at(-1),recent=ordered.slice(0,5).filter(row=>row!==first);
 const candidates=recent.slice(0,2).concat(first || [],recent.slice(2));
 const paths=new Map(),started=Date.now();
 for(let i=0;i<candidates.length && paths.size<8;i+=3){
  const time=2600-(Date.now()-started);
  if(time<=0)break;
  await Promise.all(candidates.slice(i,i+3).map(async ({season,episode})=>{
   const data=await readGalleryData(readTmdb,'tv/'+id+'/season/'+season+'/episode/'+episode+'/images?include_image_language=null',time);
   for(const row of Array.isArray(data?.stills)?data.stills:[]){
    const path=tmdbPath(row?.file_path),width=Number(row?.width)||0;
    if(path && !thumbs.has(path) && (!width || width>=480))paths.set(path,Math.max(width,paths.get(path) || 0));
   }
  }));
 }
 return [...paths].sort((a,b)=>b[1]-a[1]).slice(0,frameLimit).map(([still_path,width])=>({still_path,width}));
}

export function hasGallerySource(L,data){
 const card=data.movie;
 if(card.adult || card.blocked)return false;
 if(L.Storage?.get(galleryFramesKey,''))return true;
 if(seriesCard(card))return tmdbId(card)>0 && (tmdbId(card)===273552 || !!(data.episodes || card.last_episode_to_air));
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
 if(!(kp>0 || tmdb>0))return [];
 const identity=(kp>0?'kp:'+kp:'tmdb:'+tmdb)+':'+isSeries;
 const saved=cache.get(identity);
 if(saved?.until>Date.now())return saved.frames;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2400);
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
   const matches=await get('movie',{'externalId.tmdb':tmdb,isSeries,limit:2});
   if(matches.length!==1 || Number(matches[0].externalId?.tmdb)!==tmdb || matches[0].isSeries!==isSeries)return [];
   id=Number(matches[0].id);
   if(!(id>0))return [];
  }
  const query=new URLSearchParams({movieId:id,limit:40});
  const frameTypes=['frame','screenshot'];
  frameTypes.forEach(type=>query.append('type',type));
  const images=await get('image',query);
  const urls=images.filter(row=>frameTypes.includes(row.type) && Number(row.movieId)===id && https(row.url))
   .sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0)).map(row=>row.url);
  const frames=galleryRows(urls);
  if(cache.size>=80)cache.delete(cache.keys().next().value);
  cache.set(identity,{frames,until:Date.now()+1800000});
  return frames;
 }catch(error){return [];}finally{clearTimeout(timer);}
}
