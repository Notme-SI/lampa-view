const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
function bundle(w,name,global){w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'iife',globalName:global}).outputFiles[0].text);}
test('title and studio share a verified CUB resolution and a single details request',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;bundle(w,'logos','Logos');const requests=[],values=[];
 const L={Storage:{get:()=> 'ru'},TMDB:{},Api:{sources:{tmdb:{get:(url,p,ok)=>requests.push({url,p,ok})}}}},load=w.Logos.default(L),card={id:999,source:'cub',title:'Животные',original_title:'Animals',release_date:'2026-10-09'};
 load(card,(path,studio)=>values.push({path,studio}));load(card,(path,studio)=>values.push({path,studio}));assert.equal(requests.length,1);
 requests[0].ok({results:[{id:1236045,title:'Животные',original_title:'Animals',release_date:'2026-10-09'},{id:1713368,title:'Animals.',release_date:'2026-01-15'}]});assert.equal(requests.length,2);assert.ok(requests[1].url.startsWith('movie/1236045?append_to_response=images'));
 requests[1].ok({images:{logos:[{file_path:'/ru.png',iso_639_1:'ru'}]},production_companies:[{name:'No logo'},{name:'Artists Equity',logo_path:'/studio.png'}]});
 assert.equal(values.length,2);assert.equal(values[0].path,'/ru.png');assert.equal(values[0].studio.name,'Artists Equity');assert.equal(values[0].studio.path,'/studio.png');load(card,(path,studio)=>values.push({path,studio}));assert.equal(requests.length,2);
 assert.equal(w.Logos.pickStudio({networks:[{name:'TV Network',logo_path:'/tv.png'}],production_companies:[{name:'Studio',logo_path:'/film.png'}]},'tv').name,'TV Network');assert.equal(w.Logos.pickStudio({production_companies:[{logo_path:'javascript:bad.svg'}]},'movie'),null);dom.window.close();
});
test('identical catalogue titles use artwork first, full date second, and reject unresolved ambiguity',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;bundle(w,'logos','Logos');const match=w.Logos.matchCatalogue,results=[{id:1,title:'Animals',release_date:'2026-10-09',backdrop_path:'/match.jpg'},{id:2,title:'Animals.',release_date:'2026-01-15'}];
 assert.equal(match({title:'Animals',release_date:'2026-01-15',backdrop_path:'/match.jpg'},results),1);assert.equal(match({title:'Animals',release_date:'2026-10-09'},results),1);assert.equal(match({title:'Animals',release_date:'2026'},results),null);dom.window.close();
});
test('prefetched studio images accept late subscribers and stay cached; missing or failed logos stay absent',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window,images=[],tick=()=>new Promise(r=>setTimeout(r,0));w.Image=class{constructor(){images.push(this);}set src(v){this.url=v;}get src(){return this.url;}decode(){return Promise.resolve();}};
 bundle(w,'hero-assets','Assets');let requests=0;const cards=Array.from({length:3},(_,i)=>({id:i,backdrop_path:'/cover'+i+'.jpg'})),assets=w.Assets.default({TMDB:{image:p=>'http://images.test'+p}},cards,(card,ok)=>{requests++;ok('/title'+card.id+'.png',card.id===2?null:{path:'/studio'+card.id+'.png',name:'Studio '+card.id});});
 assets.warm(0);await new Promise(r=>setTimeout(r,1250));let selected;assets.studio(1,value=>selected=value);const studio=images.find(i=>i.url.includes('/w300/studio1.png'));studio.onload();await tick();assert.equal(selected.name,'Studio 1');assert.ok(selected.url.endsWith('/studio1.png'));const count=images.length;assets.studio(1,value=>selected=value);assert.equal(images.length,count);assert.equal(requests,2);
 let absent='pending';assets.studio(2,value=>absent=value);assert.equal(absent,null);assets.studio(0,value=>absent=value);images.find(i=>i.url.includes('/w300/studio0.png')).onerror();assert.equal(absent,null);assets.dispose();dom.window.close();
});
