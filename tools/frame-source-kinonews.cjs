const {frameLimit,validFrames}=require('../src/frame-catalogue.cjs');

const base='https://www.kinonews.ru';
const gallery=/^\/shots_[1-9]\d*_all\/$/;

function parseGallery(html,path,tmdb){
 if(!gallery.test(path))return null;
 const label=html.match(/<h1[^>]*>\s*Все кадры из (фильма|сериала|мультфильма|телешоу)\s+&quot;(.+?)&quot;\s*\((\d{4})\)\s*<\/h1>/i);
 if(!label)return null;
 const [,kind,title,year]=label;
 const images=new Set(Array.from(html.matchAll(/<a\b[^>]*href=["']\/shot\d+\/["'][^>]*>\s*<img\b[^>]*\bsrc=["'](\/insimgs\/\d{4}\/shotimg\/thumbs\/shotimg[\d_-]+\.webp)["']/g),match=>match[1]));
 const frames=validFrames([...images].slice(0,frameLimit).map(img=>({url:base+img.replace('/thumbs/','/')})));
 if(!frames.length)return null;
 return {media:/сериала|телешоу/i.test(kind)?'tv':'movie',title:title.replace(/&amp;/g,'&').replace(/&#039;/g,"'"),year:Number(year),
  tmdb,source:'kinonews',priority:35,origin:base+path,frames};
}

async function read(path){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Lampa-View-Frame-Catalogue'}});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return response.text();
}

async function collect(seeds){
 const entries=new Map((seeds.kinonews || []).filter(([path])=>gallery.test(path)));
 const pages=await Promise.allSettled(['/shots/','/shots_p2/','/shots_p3/','/shots_p4/'].map(read));
 for(const result of pages)if(result.status==='fulfilled'){
  for(const [,path] of result.value.matchAll(/href=["'](\/shots_\d+_all\/)["']/g))if(!entries.has(path))entries.set(path,undefined);
 }
 const queue=[...entries],records=[];
 async function worker(){
  for(let next;(next=queue.shift());){
   const [path,tmdb]=next;
   try{const row=parseGallery(await read(path),path,tmdb);if(row)records.push(row);}
   catch(error){console.warn('Kinonews '+path+': '+error.message);}
   await new Promise(resolve=>setTimeout(resolve,180));
  }
 }
 await Promise.all(Array.from({length:3},worker));
 if(!records.length)throw new Error('Incomplete Kinonews catalogue');
 return records.sort((a,b)=>a.origin.localeCompare(b.origin));
}

module.exports={collect,parseGallery};
