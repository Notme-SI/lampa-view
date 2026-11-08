const {sampleFrames}=require('../src/frame-catalogue.cjs');

const base='https://www.kinoafisha.info';
const year=new Date().getUTCFullYear();
const lists=['/rating/movies/ru/','/rating/series/ru/','/movies/','/series/',
 '/online/movies/','/online/series/','/rating/movies/'+year+'/','/rating/movies/'+(year-1)+'/'];
const galleryPath=/^\/(movies|series)\/([1-9]\d*|[a-z][a-z\d-]*)\/shots\/$/;
const preview=url=>url.replace('/1920x1080/','/1280x720/');

function decode(text){
 const names={amp:'&',quot:'"',apos:"'",nbsp:' ',laquo:'«',raquo:'»'};
 return text.replace(/&(amp|quot|apos|nbsp|laquo|raquo|#\d+);/g,(entity,key)=>{
  if(key in names)return names[key];
  const code=Number(key.slice(1));
  return code>0 && code<=0x10ffff?String.fromCodePoint(code):entity;
 }).trim();
}

function parseGallery(html,path,tmdb){
 const match=path.match(galleryPath);
 if(!match || !html.includes('<link rel="canonical" href="'+base+path+'">'))return null;
 const [,type,slug]=match;
 const title=decode(html.match(/<h1[^>]*class="universalHat_title"[^>]*>\s*Кадры из (?:фильма|сериала|телешоу) «([^<]+)»\s*<\/h1>/i)?.[1] || '');
 const year=Number(html.match(/<meta property="og:image:alt" content="[^"]*\((\d{4})\)"/)?.[1] ||
  html.match(/<title>[^<]*,\s*(\d{4})\s+на портале Киноафиша/i)?.[1]);
 if(!title || year<1890 || year>new Date().getFullYear()+1 || !year)return null;

 const imagePath=type==='movies'?'movie_shots/1920x1080/upload/movie_shots':'series_shots/1920x1080/upload/series/frames';
 const images=new Set(),galleryIds=new Set();
 for(const [tag] of html.matchAll(/<a\b[^>]*class="stillsList_item"[^>]*>/g)){
  const url=tag.match(/\bhref="([^"]+)"/)?.[1];
  const id=url?.match(/\/([1-9]\d*)\/[\w-]+\.(?:jpe?g|png|webp)$/i)?.[1];
  if(!url?.startsWith('https://static.kinoafisha.info/k/'+imagePath+'/') || !id || (/^\d+$/.test(slug) && slug!==id))continue;
  images.add(url);galleryIds.add(id);
 }
 if(galleryIds.size!==1)return null;
 const frames=sampleFrames([...images].map(url=>({img:preview(url),url})),base+path);
 if(!frames.length)return null;
 return {media:type==='movies'?'movie':'tv',title,year,tmdb,source:'kinoafisha',priority:25,origin:base+path,frames};
}

function discover(html){
 return [...new Set(Array.from(html.matchAll(/href="(?:https:\/\/www\.kinoafisha\.info)?(\/(?:movies|series)\/[1-9]\d*\/)(?:(?:music|seasons)\/[^"]*)?"/g),
  ([,path])=>path+'shots/'))].slice(0,1000);
}

function discoverPages(html,path){
 const root=path.replace(/page-\d+\/$/,'');
 if(!lists.includes(root))return [];
 return [...new Set(Array.from(html.matchAll(/href="(?:https:\/\/www\.kinoafisha\.info)?([^"?#]+\/page-([1-9]\d*)\/)"/g),
  ([,link,page])=>Number(page)<=12 && link.startsWith(root+'page-')?link:'').filter(Boolean))];
}

async function load(path){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Lampa-View-Frame-Catalogue'}});
 if(response.status===404 || response.status===410)return '';
 if(!response.ok)throw new Error('HTTP '+response.status);
 return {html:await response.text(),path:new URL(response.url).pathname};
}

async function collect(seeds){
 const entries=new Map((seeds.kinoafisha || []).filter(([path])=>galleryPath.test(path)));
 const pages=[...lists],seenPages=new Set(pages);
 async function discoverWorker(){
  for(let path;(path=pages.shift());){
   try{const page=await load(path);if(!page)continue;
    for(const gallery of discover(page.html))if(!entries.has(gallery))entries.set(gallery,undefined);
    for(const next of discoverPages(page.html,path))if(!seenPages.has(next)){seenPages.add(next);pages.push(next);}
   }catch(error){console.warn('Kinoafisha list: '+path+' '+error.message);}
  }
 }
 await Promise.all(Array.from({length:3},discoverWorker));
 const records=new Map(),pending=[...entries];
 let errors=0;
 async function worker(){
  for(let next; (next=pending.shift());){
   const [path,reference]=next;
   const id=reference && typeof reference==='object'?reference.tmdb:reference;
   try{
    const page=await load(path);
    const row=page && parseGallery(page.html,page.path,id);
    if(row && reference && typeof reference==='object'){row.imdb=reference.imdb;row.aliases=reference.aliases;}
    if(row && (!records.has(row.origin) || reference))records.set(row.origin,row);
   }catch(error){errors++;}
   await new Promise(resolve=>setTimeout(resolve,350));
  }
 }
 await Promise.all(Array.from({length:3},worker));
 if(errors)console.warn('Kinoafisha: '+errors+' gallery requests failed');
 if(records.size<5)throw new Error('Incomplete Kinoafisha catalogue');
 return [...records.values()].sort((a,b)=>a.origin.localeCompare(b.origin));
}

module.exports={collect,parseGallery,discover,discoverPages,preview};
