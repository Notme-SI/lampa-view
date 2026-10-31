const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/home-stage.js')],bundle:true,write:false,format:'iife',globalName:'HomeStage'}).outputFiles[0].text;
test('first-screen height uses actual scrolling, not an unfinished TV focus animation target',()=>{
 const d=new JSDOM('<div class="scroll"><div class="scroll__body"><div class="pt-hero"></div><div id="row"></div></div></div>',{runScripts:'outside-only'}),w=d.window;try{
  w.eval(code);const outer=w.document.querySelector('.scroll'),body=w.document.querySelector('.scroll__body'),hero=w.document.querySelector('.pt-hero'),row=w.document.querySelector('#row');
  w.innerHeight=1080;Object.defineProperty(row,'offsetHeight',{value:400});let actual=0;hero.getBoundingClientRect=()=>({top:80+actual});outer.Scroll={position:()=>-600,body:()=>body};
  w.HomeStage.default(hero,row);const initial=hero.style.height;
  actual=-300;body.style.transform='matrix(1, 0, 0, 1, 0, -300)';w.HomeStage.default(hero,row);assert.equal(hero.style.height,initial);
  actual=-260;body.style.transform='none';outer.scrollTop=260;w.HomeStage.default(hero,row);assert.equal(hero.style.height,initial,'Desktop native scrolling uses the same layout origin');
 }finally{w.close();}
});
