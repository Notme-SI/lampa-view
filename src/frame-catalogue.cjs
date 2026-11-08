const version=1;
const shardCount=64;
const frameLimit=15;

// Rank by identity rather than input order or Math.random(): the same card and
// candidate pool produce the same selection after reopening or a cache refresh.
function stableSample(rows,seed,count=frameLimit,key=row=>row.url || row.minimal_still_url || row.still_path){
 const rank=value=>{
  let hash=2166136261;
  for(const char of String(seed)+'|'+value){hash^=char.charCodeAt(0);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}
  return hash>>>0;
 };
 return rows.map(row=>{const id=String(key(row));return {row,id,rank:rank(id)};})
  .sort((a,b)=>a.rank-b.rank || (a.id<b.id?-1:a.id>b.id?1:0)).slice(0,count).map(item=>item.row);
}

function titleKey(value){
 return String(value || '').normalize('NFKD').toLowerCase()
  .replace(/&amp;|&#0?38;/g,'&').replace(/&/g,'and')
  .replace(/[^a-z0-9\u0400-\u04ff\u3040-\u30ff\u3400-\u9fff]/g,'');
}

function titleKeys(media,title,year){
 if(!['movie','tv'].includes(media) || !/^\d{4}$/.test(String(year)))return [];
 return [...new Set(String(title || '').split(/\s+\/\s+/)
  .map(name=>titleKey(name.replace(/^(.+),\s*(the|a|an)$/i,'$2 $1'))).filter(Boolean))]
  .map(name=>media+':title:'+name+':'+year);
}

function shardFor(key){
 let hash=5381;
 for(let i=0;i<key.length;i++)hash=(hash*33^key.charCodeAt(i))>>>0;
 return (hash%shardCount).toString(16).padStart(2,'0');
}

function validUrl(value){
 if(typeof value!=='string' || value.length>2000 || !value.startsWith('https://'))return false;
 try{const url=new URL(value);return !url.username && !url.password && !url.hash;}catch(error){return false;}
}

function validFrames(rows,limit=frameLimit){
 if(!Array.isArray(rows))return [];
 const unique=new Map();
 for(const row of rows){
  if(!validUrl(row?.url) || !validUrl(row.img || row.url) || unique.has(row.url))continue;
  unique.set(row.url,{img:row.img || row.url,url:row.url,...(row.width>0?{width:Number(row.width)}:{})});
 }
 return [...unique.values()].slice(0,limit);
}

function sampleFrames(rows,seed){
 const frames=validFrames(rows,Infinity);
 return frames.length>frameLimit?stableSample(frames,seed):frames;
}

module.exports={version,shardCount,frameLimit,titleKey,titleKeys,shardFor,validUrl,validFrames,stableSample,sampleFrames};
