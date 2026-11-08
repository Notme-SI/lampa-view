const {frameLimit,validFrames}=require('../src/frame-catalogue.cjs');

const base='https://www.kinoafisha.info';
const lists=['/rating/movies/ru/','/rating/series/ru/','/movies/','/series/'];
const galleryPath=/^\/(movies|series)\/([1-9]\d*)\/shots\/$/;

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
 const [,type,id]=match;
 const title=decode(html.match(/<h1[^>]*class="universalHat_title"[^>]*>\s*Кадры из (?:фильма|сериала) «([^<]+)»\s*<\/h1>/i)?.[1] || '');
 const year=Number(html.match(/<meta property="og:image:alt" content="[^"]*\((\d{4})\)"/)?.[1] ||
  html.match(/<title>[^<]*,\s*(\d{4})\s+на портале Киноафиша/i)?.[1]);
 if(!title || year<1890 || year>new Date().getFullYear()+1 || !year)return null;

 const imagePath=type==='movies'?'movie_shots/1920x1080/upload/movie_shots':'series_shots/1920x1080/upload/series/frames';
 const images=new Set();
 for(const [tag] of html.matchAll(/<a\b[^>]*class="stillsList_item"[^>]*>/g)){
  const url=tag.match(/\bhref="([^"]+)"/)?.[1];
  if(!url?.startsWith('https://static.kinoafisha.info/k/'+imagePath+'/') ||
     !new RegExp('/'+id+'/[\\w-]+\\.(?:jpe?g|png|webp)$','i').test(url))continue;
  images.add(url);
 }
 const all=[...images],count=Math.min(frameLimit,all.length);
 const frames=validFrames(Array.from({length:count},(_,index)=>({url:all[Math.floor(index*all.length/count)]})));
 if(!frames.length)return null;
 return {media:type==='movies'?'movie':'tv',title,year,tmdb,source:'kinoafisha',priority:25,origin:base+path,frames};
}

function discover(html){
 return [...new Set(Array.from(html.matchAll(/href="(?:https:\/\/www\.kinoafisha\.info)?(\/(?:movies|series)\/[1-9]\d*\/)"/g),
  ([,path])=>path+'shots/'))].slice(0,100);
}

async function load(path){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Lampa-View-Frame-Catalogue'}});
 if(response.status===404 || response.status===410)return '';
 if(!response.ok)throw new Error('HTTP '+response.status);
 return response.text();
}

async function collect(seeds){
 const entries=new Map((seeds.kinoafisha || []).filter(([path])=>galleryPath.test(path)));
 const discovery=await Promise.allSettled(lists.map(load));
 for(const result of discovery)if(result.status==='fulfilled'){
  for(const path of discover(result.value))if(!entries.has(path))entries.set(path,undefined);
 }
 const records=[],pending=[...entries];
 let errors=0;
 async function worker(){
  for(let next; (next=pending.shift());){
   const [path,id]=next;
   try{
    const row=parseGallery(await load(path),path,id);
    if(row)records.push(row);
   }catch(error){errors++;}
   await new Promise(resolve=>setTimeout(resolve,180));
  }
 }
 await Promise.all(Array.from({length:4},worker));
 if(errors)console.warn('Kinoafisha: '+errors+' gallery requests failed');
 if(records.length<5)throw new Error('Incomplete Kinoafisha catalogue');
 return records.sort((a,b)=>a.origin.localeCompare(b.origin));
}

module.exports={collect,parseGallery,discover};
