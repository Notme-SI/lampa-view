const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-sources.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text,moduleValue={exports:{}};new Function('module','exports',code)(moduleValue,moduleValue.exports);const {default:install,sourceLanguage,filterSources}=moduleValue.exports;
test('source languages use explicit metadata, known language hints and a group for unknown sources',()=>{
 for(const [row,lang] of [[{balanser:'kodik',name:'Kodik'},'ru'],[{name:'MovPI (ENG)',balanser:'movpi'},'en'],[{name:'UAFilm (Украинский)',balanser:'uafilm'},'uk'],[{name:'Unknown',balanser:'new-source'},'other'],[{name:'New',balanser:'new-source',voice_lang:'fr'},'fr']])assert.equal(sourceLanguage(row),lang);
 for(const row of [{name:'New',lang:'en-US'},{name:'New',voice_lang:'eng'},{name:'VidSrc.cc',balanser:'vidsrc.cc'}])assert.equal(sourceLanguage(row),'en');
});
test('disabling discovery removes native pending waits without mutating responses, ready flags, URLs or playback metadata',()=>{
 const a={name:'Filmix',balanser:'filmix',url:'/lite/filmix',show:true},b={name:'Kodik',balanser:'kodik',url:'/lite/kodik'},value={online:[a,b],pending:['filmix','kodik'],ready:false,head:true,memkey:'native'};
 const result=filterSources(value,['filmix']);assert.deepEqual(result,{...value,online:[b],pending:['kodik']});assert.equal(value.online.length,2);assert.equal(result.online[0],b);assert.deepEqual(filterSources([a,b],['filmix']),[b]);assert.deepEqual(filterSources({error:'native'},['filmix']),{error:'native'});
});
test('native request transport, return handles, errors and callback context survive; playback requests are never filtered',()=>{
 const storage=new Map([['alc_auto_src_off',['filmix']]]),requests=[],params=[];let config;
 function Native(){this.timeout=()=>{};this.clear=()=>{};this.silent=function(...args){requests.push({instance:this,args});return 'abort-handle';};this.native=this.silent;}Native.marker='native';
 const L={Reguest:Native,Storage:{get:(k,d)=>storage.has(k)?storage.get(k):d,set:(k,v)=>storage.set(k,v)},SettingsApi:{addParam:p=>params.push(p)},Select:{show:c=>config=c},Controller:{toggle(){}}};const api=install(L),r=new L.Reguest(),error=()=>{},context={native:true};let response;
 assert.equal(L.Reguest.marker,'native');assert.ok(r instanceof Native);assert.equal(r.silent('http://lampac.rest/lifeevents?memkey=native',function(value,x){response={value,x,context:this};},error,false,{headers:{authorization:'untouched'}}),'abort-handle');
 const call=requests[0];assert.equal(call.args[2],error);assert.equal(call.args[4].headers.authorization,'untouched');call.args[1].call(context,{online:[{balanser:'filmix',name:'Filmix',url:'/lite/filmix'},{balanser:'kodik',name:'Kodik',url:'/lite/kodik'}],pending:['filmix'],ready:true},42);assert.equal(response.context,context);assert.equal(response.x,42);assert.equal(response.value.online.length,1);assert.equal(response.value.pending.length,0);
 assert.equal(api.off()[0],'filmix');const play=()=>{};r.silent('http://lampac.rest/lite/filmix?stream=1',play,error);assert.equal(requests[1].args[1],play);
 api.menu();config.onSelect({lang:'ru'});assert.equal(config.items.length,2);assert.equal(config.items[0].checked,false);config.onCheck({src:'filmix',checked:true});assert.deepEqual(api.off(),[]);assert.equal(api.revision(),1);
 api.menu();assert.ok(config.items.some(row=>row.lang==='en'));config.onSelect({lang:'en'});assert.equal(config.items.length,1);assert.equal(config.items[0].noenter,true);
 api.remember([{balanser:'vidsrc.cc',name:'VidSrc.cc',url:'/lite/vidsrc'}]);api.menu();config.onSelect({lang:'en'});assert.equal(config.items[0].src,'vidsrc.cc');config.onCheck({src:'vidsrc.cc',checked:false});assert.ok(api.off().includes('vidsrc.cc'));
 const count=params.length;install(L);assert.equal(L.Reguest.lampaViewSources,true);assert.equal(count,1);
});
