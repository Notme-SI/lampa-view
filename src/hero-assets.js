// Decode neighbouring covers before the user selects them. Original-size artwork
// is fetched only for the stable selected slide; caches have fixed memory bounds.
import {artworkSize} from './artwork.js';
export default function heroAssets(L,cards,loadLogo){
 const images=new Map(),logos=new Map(),studios=new Map();let disposed=false,current=0,warmTimer;
 const wrap=i=>(i+cards.length)%cards.length;
 function fetchImage(key,url,callback,limit){
  if(disposed)return;
  const existing=images.get(key);
  if(existing){images.delete(key);images.set(key,existing);if(existing.done)callback(existing.url);else existing.callbacks.push(callback);return;}
  const entry={image:new Image(),callbacks:[callback],url,done:false};images.set(key,entry);
  const prefix=key.split(':')[0];const peers=[...images.keys()].filter(k=>k.startsWith(prefix+':'));
  while(peers.length>limit){const old=peers.shift();const removed=images.get(old);images.delete(old);if(!removed.done){removed.image.onload=removed.image.onerror=null;removed.image.src='';}}
  function finish(value){if(disposed || images.get(key)!==entry)return;entry.done=true;entry.url=value;entry.callbacks.forEach(fn=>fn(value));entry.callbacks=[];}
  entry.image.onload=()=>{if(entry.image.decode)entry.image.decode().catch(()=>{}).then(()=>finish(url));else finish(url);};
  entry.image.onerror=()=>finish('');entry.image.src=url;
 }
 function cover(i,size,callback){i=wrap(i);const card=cards[i];fetchImage(size+':'+i,L.TMDB.image('/t/p/'+size+card.backdrop_path),callback,size==='original'?1:4);}
 function logo(i,callback){
  i=wrap(i);const saved=logos.get(i);if(saved){if(saved.callbacks)saved.callbacks.push(callback);else callback(saved.url,saved.language);return;}
  const pending={callbacks:[callback]};logos.set(i,pending);
  loadLogo(cards[i],(path,studio,language)=>{
   if(disposed)return;
   const waiting=studios.get(i) || {callbacks:[]};studios.set(i,waiting);
   function finishStudio(url){const value=url?{url,name:studio.name}:null;studios.set(i,{value});if(waiting)waiting.callbacks.forEach(fn=>fn(value));}
   if(studio && studio.path)fetchImage('studio:'+i,L.TMDB.image('/t/p/w300'+studio.path),finishStudio,cards.length);else finishStudio('');
   function finish(url){logos.set(i,{url,language});pending.callbacks.forEach(fn=>fn(url,language));}
   if(!path)return finish('');
   fetchImage('logo:'+i,L.TMDB.image('/t/p/original'+path),finish,cards.length);
  });
 }
 function studio(i,callback){
  i=wrap(i);const saved=studios.get(i);
  if(saved){if(saved.callbacks)saved.callbacks.push(callback);else callback(saved.value);return;}
  studios.set(i,{callbacks:[callback]});logo(i,()=>{});
 }
 function warm(i){
  current=wrap(i);clearTimeout(warmTimer);
  warmTimer=setTimeout(()=>{const size=artworkSize(L,'backdrop');[wrap(current+1),wrap(current-1)].forEach(n=>{cover(n,size==='original'?'w780':size,()=>{});logo(n,()=>{});});},1200);
 }
 function ready(i,size){const saved=images.get(size+':'+wrap(i));return saved && saved.done?saved.url:'';}
 function dispose(){disposed=true;clearTimeout(warmTimer);images.forEach(e=>{e.image.onload=e.image.onerror=null;if(!e.done)e.image.src='';});images.clear();logos.clear();studios.clear();}
 return {cover,logo,studio,warm,ready,dispose};
}
