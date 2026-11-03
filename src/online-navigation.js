// Use the host request, reset/abort and error UI; never replace its transport.
export default function onlineNavigation(comp){
 if(!comp || comp.lampaViewSelect || !['parseJsonDate','display','filter','request','reset','getEpisodes','doesNotAnswer'].every(key=>typeof comp[key]==='function'))return;
 let epoch=0,pending=false,closed=false,deadline=null,selection=null,queued=null,lastSent=-Infinity,lastRequest=-Infinity,burst=0,lastUrl='';
 const reset=comp.reset,request=comp.request,getEpisodes=comp.getEpisodes;
 function cancel(){epoch++;pending=false;clearTimeout(deadline);deadline=null;clearTimeout(selection);selection=null;clearTimeout(queued);queued=null;}
 function live(version){return !closed && !comp.destroyed && version===epoch;}
 comp.reset=function(){cancel();return reset.apply(this,arguments);};
 comp.request=function(url){
  // Some providers follow a folder without resetting. Abort the older request
  // through the native reset before delegating, keeping headers/account intact.
  if(pending)comp.reset();
  const version=++epoch;lastUrl=url;pending=true;
  const args=arguments;
  function send(){
   queued=null;if(!live(version))return;
   // Native Online resets its burst counter after four idle seconds, rather
   // than using a sliding window. Leave room for native folder follow-ups.
   if(Date.now()-lastRequest>=4100)burst=0;
   burst++;lastRequest=Date.now();
   const parse=comp.parse,fail=comp.doesNotAnswer;
   const success=function(){if(!live(version))return;pending=false;clearTimeout(deadline);return parse.apply(comp,arguments);};
   const failure=function(){if(!live(version))return;pending=false;clearTimeout(deadline);return fail.apply(comp,arguments);};
   comp.parse=success;comp.doesNotAnswer=failure;
   deadline=setTimeout(()=>{if(!live(version) || !pending)return;pending=false;fail.call(comp,{timeout:true});},15000);
   try{return request.apply(comp,args);}finally{comp.parse=parse;comp.doesNotAnswer=fail;}
  }
  const wait=burst>=8?Math.max(0,4100-(Date.now()-lastRequest)):0;
  if(wait)queued=setTimeout(send,wait);else return send();
 };
 comp.getEpisodes=function(season,done){const version=epoch;return getEpisodes.call(this,season,function(){if(live(version))return done.apply(this,arguments);});};
 comp.lampaViewSelect=function(run){
  comp.lampaViewManualNavigation=true;
  comp.reset();
  const version=epoch,delay=Math.max(160,500-(Date.now()-lastSent));
  selection=setTimeout(()=>{selection=null;if(!live(version))return;lastSent=Date.now();run();},delay);
 };
 comp.lampaViewRetry=function(){if(!lastUrl)return false;comp.reset();comp.request(lastUrl);return true;};
 ['pause','stop','destroy'].forEach(name=>{const native=comp[name];if(typeof native!=='function')return;comp[name]=function(){cancel();if(name==='destroy')closed=true;return native.apply(this,arguments);};});
}
