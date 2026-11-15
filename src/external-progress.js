import {identity} from './identity.cjs';
import {linkFor,profileScope} from './timeline-meta.cjs';

// One progress receiver for every external adapter. The host supplies the
// actual launch URL, rather than a second hard-coded registry of player names.
const KEY='minimal_external_sessions_v1',RETURN='lampa_view_return',RESULT='lampa_view_result';
const fields=['position','time','currentTime','duration','totalDuration','status','lastPlayedUrl','request-id','errorCode','errorMessage'];
const seconds=value=>value!==null && String(value).trim()!=='' && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=31536000?Number(value):null;
export default function externalProgress(L,enabled){
 const scope=()=>profileScope(L)+'|'+String(L.Storage.get('account',{})?.email || L.Storage.get('account_email','')).toLowerCase();
 const sessions=()=>{const rows=L.Storage.get(KEY,[]);return Array.isArray(rows)?rows.filter(r=>r && Date.now()-r.at<86400000).slice(-12):[];};
 const put=rows=>L.Storage.set(KEY,rows.slice(-12));
 function report(token,value){
  if(!enabled())return false;
  const rows=sessions(),session=rows.find(r=>r.id===token);
  if(!session || session.scope!==scope() || value?.result && value.result!=='success')return false;
  const position=seconds(value?.position ?? value?.time ?? value?.currentTime);
  const duration=seconds(value?.duration ?? value?.totalDuration ?? session.duration);
  if(position===null || position===0 || duration && position>duration+2)return false;
  if(value['lastPlayedUrl'] && L.Utils.hash(String(value.lastPlayedUrl))!==session.url)return false;
  if(value['request-id'] && String(value['request-id'])!==session.id)return false;
  const percent=value.status==='finished'?100:duration?Math.min(100,Math.round(position/duration*100)):0;
  L.Timeline.update({hash:session.hash,time:position,duration:duration || 0,percent,profile:session.profile,...session.meta});
  put(rows.filter(r=>r.id!==token));
  return true;
 }
 function consume(){
  const url=new URL(window.location.href),token=url.searchParams.get(RETURN);if(!token)return;
  const session=sessions().find(r=>r.id===token);if(session && session.scope!==scope())return;
  const value=Object.fromEntries(url.searchParams.entries());value.result=url.searchParams.get(RESULT);
  report(token,value);
  // Error/cancel never invent progress; still retire this one-time request.
  if(session && value.result && value.result!=='success')put(sessions().filter(r=>r.id!==token));
  for(const name of [RETURN,RESULT,...fields])url.searchParams.delete(name);
  window.history.replaceState(window.history.state,'',url.href);
 }
 function build(event){
  if(!enabled() || !event?.data?.timeline?.hash || typeof event.setUrl!=='function')return;
  let url;try{url=new URL(event.url);}catch(error){return;}
  // A URL scheme alone does not imply callbacks. Respect adapters which
  // already own callbacks, and leave other launch contracts untouched.
  if(url.hostname.toLowerCase()!=='x-callback-url' || !/^\/(play|stream)\/?$/i.test(url.pathname) || url.searchParams.has('x-success'))return;
  if(!/^https?:$/.test(location.protocol) || !window.crypto?.getRandomValues)return;
  const video=event.data,card=video.card || L.Activity.active()?.movie || L.Activity.active()?.card;
  const coordinates=identity(card || {},video),meta=linkFor(L,card,coordinates.season,coordinates.episode);
  if(!meta)return;
  const bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);
  const id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),timeline=video.timeline;
  const played=url.searchParams.get('url');if(!played)return;
  const session={id,at:Date.now(),scope:scope(),hash:String(timeline.hash),duration:seconds(timeline.duration),profile:timeline.profile || 0,meta,url:L.Utils.hash(played)};
  const base=new URL(window.location.href);base.hash='';
  for(const name of [RETURN,RESULT,...fields])base.searchParams.delete(name);
  const callback=result=>{const target=new URL(base);target.searchParams.set(RETURN,id);target.searchParams.set(RESULT,result);return target.href;};
  for(const result of ['success','error','cancel'])if(!url.searchParams.has('x-'+result))url.searchParams.set('x-'+result,callback(result));
  if(!url.searchParams.has('position'))url.searchParams.set('position',String(seconds(timeline.time) || 0));
  if(!url.searchParams.has('request-id'))url.searchParams.set('request-id',id);
  if(!url.searchParams.has('x-source'))url.searchParams.set('x-source','Lampa');

  put(sessions().concat(session));
  const localUrl=url.href;
  const keyBytes=new Uint8Array(16);window.crypto.getRandomValues(keyBytes);
  const writeKey=Array.from(keyBytes,b=>b.toString(16).padStart(2,'0')).join('');
  const baseUrl=new URL('/lampa-view-progress/',location.href).href;
  const request=(path,body)=>new Promise(resolve=>{
   const $=window.jQuery;if(!$?.ajax)return resolve(null);
   $.ajax({url:baseUrl+path,type:body?'POST':'GET',contentType:'application/json',data:body?JSON.stringify(body):undefined,dataType:'json',timeout:1500,success:resolve,error:()=>resolve(null)});
  });
  // Without this host capability keep the synchronous URL and native launch.
  if(typeof event.waitUntil!=='function'){event.setUrl(localUrl);return;}
  const pending=request('session',{id,key:writeKey,url:session.url}).then(answer=>{
   if(!answer?.success){event.setUrl(localUrl);return;}
   const rows=sessions(),saved=rows.find(r=>r.id===id);if(saved){saved.relay=baseUrl;put(rows);}
   url.searchParams.set('x-success',baseUrl+'return/'+writeKey);
   // Errors and cancellations carry no measured position; the local receiver
   // retires them without fabricating progress.
   event.setUrl(url.href);
  });
  event.waitUntil(pending);
 }

 let polling=false;
 function refresh(){
  if(polling || !enabled() || document.hidden)return;
  const rows=sessions().filter(r=>r.relay && r.scope===scope());if(!rows.length)return;
  polling=true;let left=rows.length;
  const done=()=>{if(!--left)polling=false;};
  for(const row of rows){
   window.jQuery.ajax({url:row.relay+'session/'+row.id,dataType:'json',timeout:2500,success:value=>{if(value?.result)report(row.id,value.result);done();},error:done});
  }
 }
 L.Player?.listener?.follow('external_url',build);
 window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 const timer=setInterval(refresh,30000);
 window.addEventListener('pageshow',consume);window.addEventListener('focus',consume);
 L.Account?.listener?.follow('profile_select',consume);
 consume();
 refresh();return {report,consume,refresh,stop(){clearInterval(timer);}};
}
