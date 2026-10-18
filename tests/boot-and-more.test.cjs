const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
const bundle=()=>esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/plugin.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;
test('early bootstrap applies title, original monochrome vector favicon and loader without Lampa or jQuery',()=>{
 const dom=new JSDOM('<html lang="en"><head><title>Original</title><link rel="icon" type="image/png" sizes="32x32" href="old.png"></head><body><div class="welcome"></div><div class="no-network">Ошибка сети</div></body></html>',{runScripts:'outside-only'}),w=dom.window,code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/boot.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;
 w.eval(code);w.eval(code);assert.equal(w.document.title,'L A M P A');assert.equal(w.document.documentElement.lang,'ru');assert.equal(w.document.querySelectorAll('#lampa-minimal-boot').length,1);assert.equal(w.document.querySelectorAll('link[rel="icon"]').length,1);const icon=w.document.querySelector('link[rel="icon"]');assert.equal(icon.type,'image/svg+xml');assert.equal(decodeURIComponent(icon.href).split(',').slice(1).join(','),require('../src/favicon.cjs'));assert.equal(w.document.querySelector('.no-network').textContent,'Ошибка сети');assert.ok(w.document.querySelector('.welcome'));dom.window.close();
});
test('boot theme loads before appready and does not replace native loading or error nodes',()=>{
 const dom=new JSDOM('<head></head><body><div class="welcome"></div><div class="no-network">Ошибка сети</div></body>',{runScripts:'outside-only'}),w=dom.window;
 w.Lampa={Listener:{follow(){}}};w.eval(bundle());assert.ok(w.document.querySelector('#lampa-minimal-boot'));assert.ok(w.document.querySelector('.welcome'));assert.equal(w.document.querySelector('.no-network').textContent,'Ошибка сети');
 w.eval(bundle());assert.equal(w.document.querySelectorAll('#lampa-minimal-boot').length,1);dom.window.close();
});
test('More on discover rows uses TMDB explicitly and normalizes legacy lang parameter',()=>{
 const dom=new JSDOM('<head></head><body><div class="head__title"></div></body>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));const events={},pushes=[];w.appready=true;
 w.Lampa={Storage:{get:(k,d)=>d,set(){}},SettingsApi:{addComponent(){},addParam(){}},Activity:{active:()=>({component:'other',source:'cub'}),push:v=>pushes.push(v),replace(){}},Player:{listener:{follow(){}},playlist(){}},Listener:{follow:(key,fn)=>(events[key] ||= []).push(fn)}};
 w.eval(bundle());let hook;const line={use:v=>hook=v};events.line.forEach(fn=>fn({type:'create',line,data:{title:'Новые сериалы',url:'discover/tv?lang=ru&sort_by=popularity.desc'}}));hook.onlyMore();
 assert.equal(pushes.length,1);assert.equal(pushes[0].component,'category_full');assert.equal(pushes[0].source,'tmdb');assert.equal(pushes[0].url,'discover/tv?language=ru&sort_by=popularity.desc');assert.equal(pushes[0].page,1);dom.window.close();
});
