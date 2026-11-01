// Compressed source files outlive decoded image eviction and screen mounts.
// Keep original bytes: no canvas resizing, re-encoding or quality substitution.
const pools=new WeakMap();
export function createImageFiles(w,limits={}){
 const memory=limits.memory || 24*1048576,disk=limits.disk || 64*1048576,max=limits.entries || 240,life=7*86400000;
 const files=new Map();let database,saveTimer;
 const saves=new Map();
 const usable=typeof w.fetch==='function' && w.URL && typeof w.URL.createObjectURL==='function';
 function db(){
  if(database)return database;
  database=new Promise(resolve=>{
   if(!w.indexedDB)return resolve(null);
   let settled=false;const finish=value=>{if(!settled){settled=true;resolve(value);}};
   const timer=w.setTimeout(()=>finish(null),500);
   try{
    const request=w.indexedDB.open('lampa-view-artwork',1);
    request.onupgradeneeded=()=>{for(const store of ['files','sizes'])if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store,{keyPath:'url'});};
    request.onsuccess=()=>{w.clearTimeout(timer);const value=request.result;value.onversionchange=()=>{value.close();database=null;};database=Promise.resolve(value);finish(value);};
    request.onerror=request.onblocked=()=>{w.clearTimeout(timer);finish(null);};
   }catch(_){w.clearTimeout(timer);finish(null);}
  });return database;
 }
 async function read(url){
  const database=await db();if(!database)return null;
  return new Promise(resolve=>{
   let settled=false;const done=value=>{if(!settled){settled=true;resolve(value);}};
   const timer=w.setTimeout(()=>done(null),500);
   try{const request=database.transaction('files').objectStore('files').get(url);request.onsuccess=()=>{w.clearTimeout(timer);const row=request.result;done(row && Date.now()-row.at<life?(row.bytes?new w.Blob([row.bytes],{type:row.type}):row.blob):null);};request.onerror=()=>{w.clearTimeout(timer);done(null);};}catch(_){w.clearTimeout(timer);done(null);}
  });
 }
 async function flush(){
  saveTimer=null;const database=await db();if(!database){saves.clear();return;}
  const pending=[...saves.values()];saves.clear();if(!pending.length)return;
  try{
   // ArrayBuffer avoids WebKit's platform-dependent IndexedDB Blob support.
   const rows=await Promise.all(pending.map(async row=>({url:row.url,at:row.at,type:row.blob.type,bytes:await row.blob.arrayBuffer()})));
   const tx=database.transaction(['files','sizes'],'readwrite'),store=tx.objectStore('files'),sizes=tx.objectStore('sizes');
   tx.onerror=event=>event.preventDefault();
   for(const row of rows){store.put(row);sizes.put({url:row.url,size:row.bytes.byteLength,at:row.at});}
   const request=sizes.getAll();request.onsuccess=()=>{
    const values=request.result.sort((a,b)=>b.at-a.at);let total=0,count=0;
    for(const row of values){total+=row.size;count++;if(total>disk || count>max || Date.now()-row.at>=life){store.delete(row.url);sizes.delete(row.url);}}
   };
  }catch(_){} // Storage denial/quota never prevents displaying an image.
 }
 function save(url,blob){saves.set(url,{url,blob,at:Date.now()});if(!saveTimer)saveTimer=w.setTimeout(flush,500);}
 function trim(){
  let bytes=0;files.forEach(row=>bytes+=row.bytes || 0);
  for(const [url,row] of files){
   if(bytes<=memory && files.size<=120)break;
   if(row.done && !row.users.size){files.delete(url);bytes-=row.bytes || 0;if(row.object)w.URL.revokeObjectURL(row.src);}
  }
 }
 function load(url,notify){
  if(!usable || !/(?:\/t\/p\/|%2ft%2fp%2f)(?:w\d+|original)(?:\/|%2f)/i.test(url)){notify(url);return ()=>{};}
  let row=files.get(url);const user={notify};
  if(row){files.delete(url);files.set(url,row);row.users.add(user);if(row.done)notify(row.src);}
  else{
   row={users:new Set([user]),done:false,bytes:0,controller:typeof w.AbortController==='function'?new w.AbortController():null};files.set(url,row);
   const timer=w.setTimeout(()=>{if(row.controller)row.controller.abort();},10000);
   (async()=>{
    let blob=await read(url);
    if(files.get(url)!==row)return;
    if(!blob){try{const response=await w.fetch(url,{signal:row.controller && row.controller.signal,cache:'default'});if(response.ok){const candidate=await response.blob();if(candidate.size>0 && candidate.size<=8*1048576 && /^image\//i.test(candidate.type)){blob=candidate;save(url,blob);}}}catch(_){} }
    if(files.get(url)!==row)return;
    row.src=blob?w.URL.createObjectURL(blob):url;row.object=!!blob;row.bytes=blob?blob.size:0;row.done=true;
    if(!blob)files.delete(url); // A failed fetch/CORS denial remains a native image fallback, never a cached failure.
    for(const token of row.users)token.notify(row.src);
    trim();
   })().finally(()=>w.clearTimeout(timer));
  }
  return ()=>{row.users.delete(user);if(!row.users.size && row.invalid && row.object){w.URL.revokeObjectURL(row.src);row.object=false;}if(!row.users.size && !row.done){if(row.controller)row.controller.abort();if(files.get(url)===row)files.delete(url);}trim();};
 }
 function invalidate(url){
  const row=files.get(url);if(row){files.delete(url);row.invalid=true;if(!row.users.size && row.object){w.URL.revokeObjectURL(row.src);row.object=false;}}
  saves.delete(url);db().then(database=>{if(database)try{const tx=database.transaction(['files','sizes'],'readwrite');for(const store of ['files','sizes'])tx.objectStore(store).delete(url);tx.onerror=event=>event.preventDefault();}catch(_){} });
 }
 return {load,invalidate,has:url=>Boolean(files.get(url)?.object),size:()=>({entries:files.size,bytes:[...files.values()].reduce((n,row)=>n+row.bytes,0)})};
}
export default function imageFiles(L){let pool=pools.get(L);if(!pool){pool=createImageFiles(window);pools.set(L,pool);}return pool;}
