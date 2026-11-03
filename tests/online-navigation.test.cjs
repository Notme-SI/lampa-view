const test=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),vm=require('node:vm');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/online-navigation.js')],bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
function fixture(){let now=0,next=0;const timers=new Map(),module={exports:{}};const setTimeout=(fn,delay)=>{timers.set(++next,{fn,at:now+delay});return next;},clearTimeout=id=>timers.delete(id);vm.runInNewContext(code,{module,exports:module.exports,setTimeout,clearTimeout,Date:{now:()=>now}});
 const tick=ms=>{const end=now+ms;for(;;){const first=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();}now=end;};
 const jobs=[],episodes=[],parsed=[],errors=[];let resets=0,stopped=0;const comp={parseJsonDate(){},display(){},filter(){},reset(){resets++;},parse(body){parsed.push(body);},getEpisodes(season,done){episodes.push(done);},doesNotAnswer(error){this.reset();errors.push(error);},request(url){jobs.push({url,at:now,ok:this.parse.bind(this),fail:this.doesNotAnswer.bind(this)});},pause(){stopped++;},destroy(){stopped++;}};
 module.exports.default(comp);return {comp,jobs,episodes,parsed,errors,tick,timers,resets:()=>resets,stopped:()=>stopped};}
test('native abort and request generation reject late season results and metadata without replacing transport',()=>{
 const f=fixture(),{comp}=f;comp.request('/lite/test?s=1');const first=f.jobs[0];comp.getEpisodes(1,()=>assert.fail('stale metadata was accepted'));comp.reset();comp.request('/lite/test?s=2');first.ok('old');first.fail('old failure');f.episodes[0]([]);assert.deepEqual(f.parsed,[]);assert.deepEqual(f.errors,[]);
 f.jobs[1].ok('current');assert.deepEqual(f.parsed,['current']);assert.ok(f.resets()>=1);f.tick(15000);assert.equal(f.errors.length,0);
});
test('fast season choices coalesce and remain below the native ten-request burst guard',()=>{
 const f=fixture();for(let i=0;i<100;i++){const season=i%4+1;f.comp.lampaViewSelect(()=>f.comp.request('/lite/test?s='+season));f.tick(20);}f.tick(600);assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].url,'/lite/test?s=4');
 for(let i=0;i<20;i++){f.comp.lampaViewSelect(()=>f.comp.request('/lite/test?s=2'));f.tick(180);}f.tick(600);assert.ok(f.jobs.length<10,'rapid controls cannot hit the native burst guard');assert.equal(f.comp.lampaViewManualNavigation,true);
});
test('silent provider reaches native timeout UI once, retry keeps the exact URL and destroy cancels queued work',()=>{
 const f=fixture();f.comp.request('/lite/test?s=2&t=voice');f.tick(14999);assert.equal(f.errors.length,0);f.tick(1);assert.equal(f.errors.length,1);assert.equal(f.errors[0].timeout,true);assert.equal(f.comp.lampaViewRetry(),true);assert.equal(f.jobs[1].url,f.jobs[0].url);f.jobs[1].ok('recovered');
 f.comp.lampaViewSelect(()=>assert.fail('selection outlived component'));f.comp.destroy();f.tick(20000);assert.equal(f.errors.length,1);assert.equal(f.stopped(),1);assert.equal(f.timers.size,0);
});

test('sustained season changes respect the native idle-reset burst limit and keep the last choice',()=>{
 const f=fixture();for(let i=0;i<100;i++){const season=i%4+1;f.comp.lampaViewSelect(()=>f.comp.request('/lite/test?s='+season));f.tick(600);}
 f.tick(5000);let burst=0,previous=-Infinity;for(const job of f.jobs){if(job.at-previous>=4000)burst=0;assert.ok(++burst<10,'native burst guard must never be reached');previous=job.at;}
 assert.ok(f.jobs.length>10,'exercise several native burst resets');assert.equal(f.jobs.at(-1).url,'/lite/test?s=4');
});
