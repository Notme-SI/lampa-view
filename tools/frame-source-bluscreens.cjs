const origin='https://www.bluscreens.net';
const uploads='/uploads/1/4/8/9/14897402/';
const directory='/screen-captures-a-z--updates.html';
const {frameLimit:maxFrames}=require('../src/frame-catalogue.cjs');
const decode=value=>value.replace(/&(?:amp|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi,entity=>{
 const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' '};
 if(entity in named)return named[entity];
 const code=entity.startsWith('&#x')?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
 return Number.isInteger(code) && code>0 && code<=0x10ffff?String.fromCodePoint(code):entity;
});
const matches=(html,pattern)=>[...new Set(Array.from(html.matchAll(pattern),match=>match[1]))];

async function page(route){
 const response=await fetch(origin+route,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error(route+' returned '+response.status);
 return response.text();
}

function publishedGallery(html){
 const title=decode(html.match(/<title>([^<>]+)<\/title>/i)?.[1] || '');
 const parsed=title.match(/^(.+?)\s*\((\d{4})\)\s*-\s*bluscreens\s*$/i);
 if(!parsed)return null;
 const caption=html.search(/\b\d+\s+SCREEN\s+CAPTURES\b/i);
 if(caption<0)return null;
 const gallery=html.slice(caption).match(/<div\b[^>]*id=['"]\d+-gallery['"][^>]*>([\s\S]*?)<span[^>]*clear:\s*both/i)?.[1];
 if(!gallery)return null;
 const frames=new Map();
 for(const [,href,thumb] of gallery.matchAll(/<a\b[^>]*href=['"]([^'"]+)['"][^>]*>\s*<img\b[^>]*src=['"]([^'"]+)['"][^>]*class=['"][^'"]*\bgalleryImage\b/gi)){
  const filename=url=>url.startsWith(uploads) && /^[\w.-]+\.(?:jpe?g|png|webp)$/i.test(url.slice(uploads.length))?url.slice(uploads.length):'';
  const img=filename(thumb);
  if(!img || frames.has(img))continue;
  frames.set(img,filename(href) || img);
 }
 if(frames.size<3)return null;
 // Skip the first few captures and sample distinct parts of the published gallery.
 const images=[...frames].slice(Math.floor(frames.size*0.07),Math.ceil(frames.size*0.87));
 const count=Math.min(maxFrames,images.length);
 const sample=Array.from({length:count},(_,i)=>images[Math.floor(i*images.length/count)])
  .map(([img,full])=>img===full?img:[img,full]);
 return [parsed[1],Number(parsed[2]),sample];
}

async function collect(){
 const root=await page(directory);
 const letters=matches(root,/href=['"](\/(?:[a-z]|page)\.html)['"]/gi);
 const found=new Set(matches(root,/href=['"](\/[\w-]{2,}\.html)['"]/gi));
 for(const letter of letters){
  const html=await page(letter);
  for(const route of matches(html,/href=['"](\/[\w-]{2,}\.html)['"]/gi))found.add(route);
 }
 const ignored=new Set([directory,'/coming-soon--stats.html','/requests.html','/actors--directors.html','/cinematographers.html','/links.html','/page.html','/index.html']);
 const routes=[...found].filter(route=>!ignored.has(route));
 const rows=[],failures=[];
 for(let start=0;start<routes.length;start+=4){
  await Promise.all(routes.slice(start,start+4).map(async route=>{
   try{
    const entry=publishedGallery(await page(route));
    if(entry)rows.push(entry);
   }catch(error){failures.push(error.message);}
  }));
  await new Promise(resolve=>setTimeout(resolve,450));
 }
 if(rows.length<100 || failures.length>routes.length/10)throw new Error('Incomplete archive refresh: '+rows.length+' galleries, '+failures.length+' failed requests');
 rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]-b[1]);
 return rows;
}

module.exports={collect,publishedGallery};
