// Share the host's real Timeline through the already configured Lampac TimeCode.
// The native CUB bookmark transport remains responsible for title-level marks.
const namespace='lampa_view_timeline_v1';
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const stamp=value=>typeof value==='string' && !/^\d+$/.test(value)?Date.parse(value) || 0:number(value);
const validHash=value=>/^[a-zA-Z0-9_.:-]{1,128}$/.test(String(value)) && !['__proto__','constructor','prototype'].includes(String(value));
const road=value=>typeof value==='number'?{percent:Math.min(100,number(value)),time:0,duration:0,updated:0}:{percent:Math.min(100,number(value && value.percent)),time:number(value && value.time),duration:number(value && value.duration),updated:stamp(value && value.updated)};
const fingerprint=value=>[value.percent,value.time,value.duration,value.updated].join('|');
export default function sharedTimeline(L,enabled){
 const $=window.jQuery,remote=new Map(),pending=new Map(),requests=new Set();
 let context=null,generation=0,cursor=0,loaded=false,pulling=false,pushing=false,timer=null,retryAt=0,failures=0,receiving=0,applying=false;
 const health={state:'idle',lastSuccess:0,pending:0,received:0};
 function available(){
  if(!enabled() || document.hidden || document.body.matches('.pt-tv-busy,.pt-wheel-active'))return false;
  const controller=L.Controller && L.Controller.enabled && L.Controller.enabled();
  return !/player/.test(controller && controller.name || '');
 }
 function resolve(){
  const permit=L.Account && L.Account.Permit;if(!permit || !permit.sync || !L.Storage || !L.Timeline)return null;
  const account=L.Storage.get('account',{}) || {},profile=permit.account && permit.account.profile;
  const email=String(account.email || L.Storage.get('account_email','') || '').trim().toLowerCase();
  if(!email || !profile || profile.id===undefined || profile.id===null)return null;
  const plugins=L.Plugins && L.Plugins.get?L.Plugins.get() || []:[];
  const scripts=Array.from(document.querySelectorAll('script[src]')).map(el=>({url:el.src}));
  let endpoint=null;
  for(const item of plugins.concat(scripts)){
   if(item && (item.status===0 || item.status==='0' || item.status===false))continue;
   const value=typeof item==='string'?item:item && item.url;if(!value)continue;
   try{
    const url=new URL(value,window.location.href),match=url.pathname.match(/^(.*)\/(?:timecode|sync)(?:\.js|\/js\/([^/]+))$/i);
    if(!match || !/^https?:$/.test(url.protocol))continue;
    endpoint={base:url.origin+match[1],token:match[2]?decodeURIComponent(match[2]):url.searchParams.get('token') || ''};break;
   }catch(error){}
  }
  if(!endpoint || !$ || typeof $.ajax!=='function')return null;
  const id=String(profile.id),file=L.Timeline.filename?L.Timeline.filename():'file_view';
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return null;
  return {...endpoint,email,id,file,key:[endpoint.base,endpoint.token,email,id,file].join('|')};
 }
 function current(ctx){const next=resolve();return !!next && next.key===ctx.key;}
 function reset(ctx){
  generation++;for(const xhr of requests)if(xhr && xhr.abort)xhr.abort();requests.clear();
  clearTimeout(timer);timer=null;context=ctx;cursor=0;loaded=false;pulling=false;pushing=false;retryAt=0;failures=0;remote.clear();pending.clear();
  health.state=ctx?'idle':'unavailable';health.pending=0;health.received=0;
  // Capture genuine local writes before an asynchronous native CUB dump can
  // replace storage. Importing the dump must not erase a newer offline write.
  if(ctx)for(const [hash,value] of Object.entries(L.Storage.get(ctx.file,{}) || {}).slice(-10000)){
   if(validHash(hash) && road(value).updated>0)queue(hash,value);
  }
 }
 function ensure(){const ctx=resolve();if(!ctx){if(context)reset(null);return null;}if(!context || context.key!==ctx.key)reset(ctx);return context;}
 function url(ctx,method){
  const result=new URL(ctx.base+'/timecode/'+method);
  // CUB's explicit account and profile identify the same area on every device.
  // Never use the device-random lampac_unic_id or infer a main profile from .main.
  result.searchParams.set('account_email',ctx.email);result.searchParams.set('profile_id',ctx.id);
  if(ctx.token)result.searchParams.set('token',ctx.token);
  const connection=window.lwsEvent && window.lwsEvent.connectionId;if(connection)result.searchParams.set('connectionId',connection);
  return result.toString();
 }
 function request(ctx,method,body,done,fail){
  const version=generation;let xhr,finished=false;
  const finish=(callback,value)=>{finished=true;if(xhr)requests.delete(xhr);if(version===generation && current(ctx))callback(value);};
  try{
   xhr=$.ajax({url:url(ctx,method),type:body?'POST':'GET',data:body?JSON.stringify(body):undefined,contentType:body?'application/json':undefined,dataType:'json',timeout:10000,cache:false,
    success:value=>finish(done,value),error:()=>finish(fail)});
   if(!finished)requests.add(xhr);
  }catch(error){finish(fail);}
 }
 function failed(){failures++;retryAt=Date.now()+Math.min(120000,3000*Math.pow(2,Math.min(failures,5)));health.state='offline';later(retryAt-Date.now());}
 function queue(hash,value){
  hash=String(hash);if(!validHash(hash) || !value || pending.size>=10000 && !pending.has(hash))return;
  pending.set(hash,road(value));health.pending=pending.size;later(300);
 }
 function later(delay=0){if(timer!==null)return;timer=setTimeout(()=>{timer=null;pump();},Math.max(0,delay));}
 function store(ctx,records){
  if(!current(ctx))return;
  applying=true;
  try{L.Storage.set(ctx.file,records,true);if(L.Timeline.read)L.Timeline.read();}finally{applying=false;}
 }
 function merge(ctx,rows){
  const records={...(L.Storage.get(ctx.file,{}) || {})};let changed=false;
  for(const [hash,value] of pending){
   if(value.updated>road(records[hash]).updated){records[hash]={...value,profile:number(ctx.id)};changed=true;}
  }
  for(const row of rows){
   if(!row || !validHash(row.hash))continue;
   const hash=String(row.hash),value=road({percent:row.deleted?0:row.percent,time:row.deleted?0:row.position,duration:row.duration,updated:row.watched_at});
   const old=remote.get(hash),server=number(row.updated_at);
   if(old && (old.value.updated>value.updated || old.value.updated===value.updated && old.server>server))continue;
   remote.set(hash,{value,server});
   if(remote.size>10000)remote.delete(remote.keys().next().value);
  }
  for(const [hash,entry] of remote){
   const local=road(records[hash]);
   if(records[hash] && local.updated>entry.value.updated){queue(hash,local);continue;}
   if(!records[hash] || fingerprint(local)!==fingerprint(entry.value)){
    records[hash]={...entry.value,profile:number(ctx.id)};changed=true;health.received++;
   }
   const waiting=pending.get(hash);if(waiting && waiting.updated<=entry.value.updated)pending.delete(hash);
  }
  for(const hash of Object.keys(records).slice(-10000)){
   if(!validHash(hash))continue;
   const value=road(records[hash]),known=remote.get(hash);
   if(!known && (value.percent || value.time || value.updated) || known && value.updated>known.value.updated)queue(hash,value);
  }
  health.pending=pending.size;if(changed)store(ctx,records);
 }
 function refresh(){
  const ctx=ensure();if(!ctx || !available() || pulling || Date.now()<retryAt)return;
  pulling=true;health.state='pulling';
  const method=loaded?'changelog?since='+cursor+'&limit=1000':'dump';
  request(ctx,method,null,value=>{
   pulling=false;
   if(!value || !Array.isArray(value.rows) || !Number.isFinite(Number(value.version))){failed();return;}
   merge(ctx,value.rows);cursor=Math.max(cursor,number(value.version));loaded=true;failures=0;retryAt=0;health.lastSuccess=Date.now();health.state='ready';
   if(value.truncated)setTimeout(refresh,0);else later();
  },()=>{pulling=false;failed();});
 }
 function pump(){
  const ctx=ensure();if(!ctx || !available() || pulling || pushing || Date.now()<retryAt)return;
  if(!loaded)return refresh();
  const batch=Array.from(pending.entries()).slice(0,100);if(!batch.length){health.state='ready';return;}
  pushing=true;health.state='syncing';
  request(ctx,'set',{rows:batch.map(([hash,value])=>({hash,card:namespace,position:value.time,duration:value.duration,percent:value.percent,watched_at:value.updated,profile:number(ctx.id),deleted:!value.percent && !value.time}))},value=>{
   pushing=false;
   if(!value || !value.success){failed();return;}
   for(const [hash,sent] of batch){
    const waiting=pending.get(hash);if(waiting && fingerprint(waiting)===fingerprint(sent))pending.delete(hash);
    const known=remote.get(hash);if(!value.skipped && (!known || known.value.updated<=sent.updated))remote.set(hash,{value:sent,server:0});
   }
   // A POST cursor can include unseen concurrent writes: only GET advances ours.
   failures=0;retryAt=0;health.lastSuccess=Date.now();health.pending=pending.size;health.state='ready';later(1000);
   if(value.skipped)setTimeout(refresh,0);
  },()=>{pushing=false;failed();});
 }
 function capture(event){
  if(applying || !enabled() || !event || !event.data || !validHash(event.data.hash))return;
  const ctx=ensure();if(!ctx)return;
  const hash=String(event.data.hash),value=road(event.data.road),known=remote.get(hash);
  if(receiving && known && known.value.updated>=value.updated)return;
  if(!receiving && !value.updated){
   value.updated=Date.now();
   const records={...(L.Storage.get(ctx.file,{}) || {})};records[hash]={...value,profile:number(ctx.id)};store(ctx,records);
  }
  if(!known || fingerprint(known.value)!==fingerprint(value))queue(hash,value);
 }
 if(L.Timeline && L.Timeline.listener)L.Timeline.listener.follow('update',capture);
 // Native CUB dumps and Lampac's legacy per-card import bypass update(). Restore
 // the freshest shared/local record after those imports, without echoing them.
 if(L.Timeline && L.Timeline.listener)L.Timeline.listener.follow('read',()=>{
  if(applying)return;
  const ctx=ensure();if(!ctx || !enabled())return;
  merge(ctx,[]);
 });
 if(L.Timeline && L.Timeline.update){
  const update=L.Timeline.update;
  L.Timeline.update=function(params){
   const ctx=ensure(),hash=params && String(params.hash);let known=params && ctx && remote.get(hash);
   const waiting=pending.get(hash);if(waiting && (!known || waiting.updated>known.value.updated))known={value:waiting};
   if(params && params.received && known && known.value.updated>stamp(params.updated))params={...params,...known.value};
   if(params && params.received)receiving++;
   try{return update.apply(this,[params,...Array.prototype.slice.call(arguments,1)]);}finally{if(params && params.received)receiving--;}
  };
 }
 document.addEventListener('lwsEvent',event=>{if(event.detail && (event.detail.name==='timecode' || event.detail.name==='system' && event.detail.data==='reconnected'))refresh();});
 return {refresh,status:()=>({...health,pending:pending.size}),stop:()=>reset(null)};
}
