const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const source=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/ios-chrome.js')],bundle:true,format:'iife',globalName:'ChromeColor',write:false}).outputFiles[0].text;
function setup(ua='iPhone',meta=true){const d=new JSDOM('<html style="background-color: red !important"><head>'+(meta?'<meta name="theme-color" content="#123456">':'')+'<meta name="apple-mobile-web-app-status-bar-style" content="default"></head><body><header class="head" style="background-color: blue !important"></header><nav style="position:fixed;bottom:0;height:60px"></nav></body></html>',{runScripts:'outside-only'}),w=d.window;Object.defineProperty(w.navigator,'userAgent',{value:ua});w.eval(source);const calls=[],L={Background:{theme(color){calls.push(color);}}},native=L.Background.theme,chrome=w.ChromeColor.default(L);return {d,w,L,calls,native,chrome};}
test('iPhone matches browser chrome to the artwork palette and restores the previous canvas',()=>{
 const {d,w,L,chrome}=setup();try{const html=w.document.documentElement,nav=w.document.querySelector('nav').style.cssText;chrome.update(true);chrome.palette('144,72,48');const meta=w.document.querySelector('meta[name=theme-color]');assert.equal(meta.content,'rgb(53,30,22)');assert.equal(w.document.querySelector('.head').style.backgroundColor,'blue');assert.equal(html.style.backgroundColor,'rgb(53, 30, 22)');assert.equal(html.style.getPropertyValue('--pt-ios-canvas'),'rgb(53,30,22)');L.Background.theme('reset');assert.equal(meta.content,'rgb(53,30,22)');chrome.update(false);assert.equal(html.style.backgroundColor,'red');assert.equal(html.style.getPropertyPriority('background-color'),'important');assert.equal(meta.content,'#1d1f20');assert.equal(html.style.getPropertyValue('--pt-ios-canvas'),'');assert.equal(w.document.querySelector('.head').style.backgroundColor,'blue');assert.equal(w.document.querySelector('.head').style.getPropertyPriority('background-color'),'important');assert.equal(w.document.querySelector('nav').style.cssText,nav);assert.equal(w.document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]').content,'default');}finally{d.window.close();}
});
test('native playback and preroll colors win until the native reset, even if the palette or settings update',()=>{
 const {d,w,L,chrome}=setup();try{chrome.update(true);for(const color of ['black','#454545']){L.Background.theme(color);chrome.palette('150,24,24');chrome.update(true);assert.equal(w.document.querySelector('meta[name=theme-color]').content,color==='black'?'#000000':color);assert.equal(w.document.querySelector('.head').style.backgroundColor,'blue');}L.Background.theme('reset');assert.equal(w.document.querySelector('meta[name=theme-color]').content,'rgb(55,14,14)');chrome.update(false);}finally{d.window.close();}
});
test('a missing theme meta is temporary and disabled Glass leaves later native calls alone',()=>{
 const {d,w,L,chrome,calls}=setup('iPad',false);try{chrome.update(false);assert.equal(w.document.querySelector('meta[name=theme-color]'),null);chrome.update(true);assert.equal(w.document.querySelectorAll('meta[name=theme-color]').length,1);chrome.update(false);assert.equal(w.document.querySelector('meta[name=theme-color]'),null);L.Background.theme('black');assert.equal(calls.at(-1),'black');assert.equal(w.document.documentElement.style.backgroundColor,'red');}finally{d.window.close();}
});
test('desktop and Android preserve native theme handling, root styles and metadata',()=>{
 for(const ua of ['Macintosh','Android TV','Android Mobile']){const {d,w,L,chrome,native}=setup(ua);try{const before=w.document.documentElement.outerHTML;chrome.update(true);chrome.palette([[150,24,24],[24,150,24]]);chrome.update(false);assert.equal(L.Background.theme,native);assert.equal(w.document.documentElement.outerHTML,before);}finally{d.window.close();}}
});

test('a smaller Home Screen viewport does not force an artificial black status-bar edge',()=>{
 const {d,w,chrome}=setup();try{
  w.document.documentElement.classList.add('pt-ios-standalone');
  Object.defineProperty(w.screen,'height',{value:926});
  w.innerWidth=393;w.innerHeight=852;
  chrome.update(true);chrome.palette('144,72,48');
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(w.document.documentElement.style.getPropertyValue('--pt-ios-top-edge'),'');
  assert.equal(w.document.documentElement.style.backgroundColor,'rgb(53, 30, 22)');
  assert.equal(w.document.querySelector('.head').style.backgroundColor,'blue','The search material belongs to CSS, not an inline full-width strip');
 }finally{d.window.close();}
});
