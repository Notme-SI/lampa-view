const {frameLimit,validFrames}=require('../src/frame-catalogue.cjs');
const {publishedGallery,collect:collectBluscreens}=require('./frame-source-bluscreens.cjs');
const {collect:kinoafisha}=require('./frame-source-kinoafisha.cjs');
const {collect:kinonews}=require('./frame-source-kinonews.cjs');

const strip=html=>String(html || '').replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').trim();
const decode=value=>value.replace(/&#(x[\da-f]+|\d+);|&(amp|quot|apos|nbsp);/gi,(all,code,name)=>{
 if(name)return {amp:'&',quot:'"',apos:"'",nbsp:' '}[name.toLowerCase()];
 const number=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);
 return number>0 && number<=0x10ffff?String.fromCodePoint(number):all;
});
const sample=(rows,count=frameLimit)=>{
 const unique=[...new Set(rows)];
 return Array.from({length:Math.min(unique.length,count)},(_,i)=>unique[Math.floor(i*unique.length/Math.min(unique.length,count))]);
};

async function request(url,json=true){
 let failure;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Lampa-View-Frame-Catalogue'}});
   if(!response.ok)throw new Error('HTTP '+response.status+' at '+new URL(url).hostname);
   return json?response.json():response.text();
  }catch(error){failure=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));}
 }
 throw failure;
}

function parseFilmGrab(post){
 const html=post.content?.rendered;
 if(typeof html!=='string')return null;
 const paragraphs=Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),match=>strip(match[1]));
 const year=Number(paragraphs.find(line=>/^year:\s*\d{4}$/i.test(line))?.match(/\d{4}/)?.[0]);
 if(!(year>=1890 && year<=new Date().getFullYear()+1))return null;
 const title=decode(strip(post.title?.rendered)).replace(new RegExp('\\s*\\('+year+'\\)$'),'').trim();
 if(!title)return null;
 const pattern=/href="(https:\/\/film-grab\.com\/wp-content\/uploads\/photo-gallery\/[^"<>]+\.(?:jpe?g|png|webp)(?:\?bwg=\d+)?)"/gi;
 const frames=validFrames(sample(Array.from(html.matchAll(pattern),match=>new URL(decode(match[1])).href)).map(url=>({url})));
 return frames.length?{media:'movie',title,year,source:'filmgrab',priority:30,origin:post.link || 'https://film-grab.com/',frames}:null;
}

async function filmGrab(){
 const records=[];
 let firstTotal=0;
 for(let page=1;page<=100;page++){
  const url='https://film-grab.com/wp-json/wp/v2/posts?'+new URLSearchParams({per_page:100,page,_fields:'id,title,content,link',orderby:'id',order:'asc'});
  const data=await request(url);
  if(!Array.isArray(data))throw new Error('Invalid FilmGrab page');
  if(page===1)firstTotal=data.length;
  for(const post of data){const row=parseFilmGrab(post);if(row)records.push(row);}
  if(data.length<100)break;
  if(page===100)throw new Error('FilmGrab pagination exceeded safety limit');
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 if(firstTotal<10 || records.length<500)throw new Error('Incomplete FilmGrab catalogue');
 return records;
}

async function bluscreens(){
 const rows=await collectBluscreens();
 const base='https://www.bluscreens.net/uploads/1/4/8/9/14897402/';
 return rows.map(([title,year,images])=>({
  media:'movie',title,year,source:'bluscreens',origin:'https://www.bluscreens.net/screen-captures-a-z--updates.html',priority:40,
  frames:images.map(file=>{const [img,url]=Array.isArray(file)?file:[file,file];return {img:base+img,url:base+url};})
 }));
}

async function ghibli(seeds){
 const records=[];
 for(const [title,slug] of seeds.ghibli){
  try{
  const origin='https://www.ghibli.jp/works/'+slug+'/';
  const html=await request(origin,false);
  const year=Number(html.match(/<[^>]*itemprop=["']datePublished["'][^>]*>\s*(\d{4})/)?.[1] ||
   html.match(/<td[^>]*>\s*(\d{4})年/)?.[1]);
  const urls=Array.from(html.matchAll(/href="(https:\/\/www\.ghibli\.jp\/gallery\/[\w-]+\.jpg)"/g),match=>match[1]);
  if(!year || urls.length<3)throw new Error('Incomplete Ghibli gallery '+slug);
  records.push({media:'movie',title,year,source:'ghibli',origin,priority:10,frames:sample(urls).map(url=>({url}))});
  }catch(error){console.warn('Ghibli '+slug+': '+error.message);}
 }
 if(records.length<20)throw new Error('Incomplete Ghibli archive');
 return records;
}

async function wiki(seeds){
 const records=[];
 for(const release of seeds.wiki){
  const {site,title,year,tmdb}=release;
  const api='https://'+site+'.fandom.com/api.php?';
  const get=params=>request(api+new URLSearchParams({...params,format:'json',formatversion:'2',origin:'*'}));
  const name=title+'/Gallery',data=await get({action:'parse',page:name,prop:'wikitext'});
  if(data.parse?.title!==name || typeof data.parse.wikitext!=='string')throw new Error('Invalid Wiki gallery');
  const sections=data.parse.wikitext.split(/^==[ \t]*([^=\r\n]+?)[ \t]*==[ \t]*$/m);
  const heading=sections.findIndex((section,i)=>i%2===1 && section.toLowerCase()==='screenshots');
  if(heading<0)throw new Error('Missing screenshot section');
  const excluded=/(?:trailer|teaser|tv[ _-]*spot|featurette|promo|deleted[ _-]*scene|behind[ _-]*the[ _-]*scenes|credits?|title[ _-]*card|studio(?:s)?[ _-]*logo)/i;
  const files=[];
  const filename=value=>value.replace(/^(?:file|image):\s*/i,'').replace(/_/g,' ').normalize('NFC').trim();
  for(const [,block] of sections[heading+1].matchAll(/<gallery\b[^>]*>([\s\S]*?)<\/gallery>/gi)){
   for(const line of block.split(/\r?\n/)){
    const file=filename(line.split('|')[0]);
    if(/\.(?:jpe?g|png|webp)$/i.test(file) && !excluded.test(line))files.push(file);
   }
  }
  const names=sample(files,40),images=await get({action:'query',titles:names.map(file=>'File:'+file).join('|'),prop:'imageinfo',iiprop:'url|size',iiurlwidth:780});
  const urls=new Map();
  for(const row of images.query?.pages || []){
   const item=row.imageinfo?.[0],prefix='https://static.wikia.nocookie.net/'+site+'/images/';
   if(row.imagerepository!=='local' || !item?.url?.startsWith(prefix) || item.width<1280 || item.height<540 || item.width/item.height<1.35)continue;
   const alias=url=>url.replace('https://static.wikia.nocookie.net/','https://images.wikia.com/');
   urls.set(filename(row.title),{url:alias(item.url),img:alias(item.thumburl?.startsWith(prefix)?item.thumburl:item.url),width:item.width});
  }
  const frames=names.map(file=>urls.get(file)).filter(Boolean).slice(0,frameLimit);
  if(!frames.length)throw new Error('Empty Wiki gallery');
  records.push({media:'movie',title,year,tmdb,source:'wiki',origin:'https://'+site+'.fandom.com/wiki/'+encodeURIComponent(name),priority:20,frames});
 }
 return records;
}

module.exports={filmGrab,bluscreens,ghibli,wiki,kinoafisha,kinonews,parseFilmGrab,publishedGallery};
