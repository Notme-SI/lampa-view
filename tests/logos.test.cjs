const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
test('hero logos prefer chosen language, reuse requests, and never treat a foreign catalogue ID as TMDB',()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/logos.js')],bundle:true,write:false,format:'iife',globalName:'Logos'}).outputFiles[0].text;w.eval(bundle);
 const requests=[],values=[];const L={Storage:{get:()=> 'ru'},TMDB:{get:(url,params,success,error)=>requests.push({url,success,error})}};
 const load=w.Logos.default(L);load({id:10,title:'Фильм'},v=>values.push(v));load({id:10,title:'Фильм'},v=>values.push(v));assert.equal(requests.length,1);
 requests[0].success({logos:[{file_path:'/en.png',iso_639_1:'en',vote_count:100},{file_path:'/ru.png',iso_639_1:'ru',vote_count:1},{file_path:'javascript:bad.svg',iso_639_1:'ru'}]});
 assert.deepEqual(values,['/ru.png','/ru.png']);load({id:10,title:'Фильм'},v=>values.push(v));assert.equal(requests.length,1);
 load({id:999,source:'shikimori'},v=>values.push(v));assert.equal(requests.length,1);assert.equal(values.at(-1),'');
 load({id:11,name:'TV',source:'tmdb'},v=>values.push(v));assert.ok(requests[1].url.startsWith('tv/11?append_to_response=images'));requests[1].error();assert.equal(values.at(-1),'');
 dom.window.close();
});
