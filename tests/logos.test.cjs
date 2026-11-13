const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild');const {JSDOM}=require('jsdom');
test('Odyssey skips the damaged wide upload and prefers rated readable Russian artwork',()=>{
 const d=new JSDOM('<body>',{runScripts:'outside-only'});try{d.window.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/logos.js')],bundle:true,write:false,format:'iife',globalName:'Logos'}).outputFiles[0].text);
 const images=[{file_path:'/5ekYPqAipzW5uO6t6wtlBxrZbhw.png',iso_639_1:'ru',width:9729,vote_average:.166,vote_count:1},{file_path:'/spdURCbJTWucruFQc8VpJZdzBIm.png',iso_639_1:'ru',width:2252,vote_average:3.334,vote_count:1},{file_path:'/unrated.png',iso_639_1:'ru',width:6000,vote_count:0},{file_path:'/english.png',iso_639_1:'en',width:4000,vote_average:8,vote_count:80}];
 assert.equal(d.window.Logos.pickLogo(images,'ru'),'/spdURCbJTWucruFQc8VpJZdzBIm.png');assert.equal(d.window.Logos.pickLogo([images[0]],'ru'),'');
 }finally{d.window.close();}
});
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
