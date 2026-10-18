const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('theme defaults, native player events and playlist transport work together',()=>{
  const dom=new JSDOM('<html><head></head><body><div class="head"><div class="head__logo-icon"></div><div class="head__title"></div></div><div class="menu"><div class="menu__case"><ul class="menu__list"><li class="menu__item" data-action="main"><span class="menu__text">Главная</span></li><li class="menu__item" data-action="favorite"><span class="menu__text">Избранное</span></li></ul></div></div></body></html>',{url:'http://lampa.example.invalid/',runScripts:'outside-only'});
  const w=dom.window;w.eval(fs.readFileSync(path.join(__dirname,'./fixtures/jquery.js'),'utf8'));
  const events={},playerEvents={},contexts=[];
  w.appready=true;w.electronAPI={lampa_view:{setContext:v=>{contexts.push(v);return true;}}};
  w.Lampa={
    Storage:{get:(key,def)=>def || '',set(){}},SettingsApi:{addComponent(){},addParam(){}},
    Listener:{follow:(key,fn)=>{events[key]=fn;}},
    Activity:{active:()=>({component:'lampac',movie:{id:1396,name:'Во все тяжкие',original_name:'Breaking Bad',source:'tmdb',first_air_date:'2008-01-20'}}),push(){},replace(){}},
    Player:{listener:{follow:(key,fn)=>{playerEvents[key]=fn;}},playlist(){},getUrlQuality:q=>q['1080p']},
    Torserver:{toPlayUrl:url=>url.replace('&preload','&play')},TMDB:{},
  };
  const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/plugin.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;
  w.eval(bundle);assert.equal(w.LampaView.ready,true);assert.equal(w.LampaView.bridge,true);
  assert.ok(w.document.body.classList.contains('lampa_view'));assert.ok(!w.document.body.classList.contains('pt-compact'));assert.ok(!w.document.body.classList.contains('pt-reduce-motion'));
  const video={url:'http://host/stream?index=2&preload',season:2,episode:3,title:'stream'};
  playerEvents.create({data:video});
  assert.equal(contexts[0].entries[0].url,'http://host/stream?index=2&play');assert.equal(contexts[0].entries[0].identity.title,'Во все тяжкие');assert.equal(contexts[0].entries[0].identity.episode,3);
  w.Lampa.Player.playlist([video,{url:'http://host/stream?index=3&preload',season:2,episode:4}]);
  assert.equal(contexts.at(-1).entries.length,2);assert.equal(contexts.at(-1).entries[1].identity.episode,4);
  w.eval(bundle);assert.equal(w.document.querySelectorAll('#lampa_view-lampa-style').length,1,'duplicate injection duplicated the theme');
  dom.window.close();
});

for(const mode of ['tv','mobile','desktop']) test('standalone '+mode+' leaves native playback intact and respects layout changes',()=>{
  const dom=new JSDOM('<html><head></head><body><div class="head__logo-icon"></div><div class="head__title"></div><div class="menu__case"><ul class="menu__list"><li data-action="main"></li></ul></div></body></html>',{runScripts:'outside-only'});
  const w=dom.window;w.eval(fs.readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));
  let createHooks=0,override='auto';const params={};const original=()=>{};
  w.appready=true;
  w.Lampa={Storage:{get:(key,def)=>key==='lampa_view_layout'?override:def,set(){}},Platform:{screen:value=>value===mode},
    SettingsApi:{addComponent(){},addParam:p=>params[p.param.name]=p},Listener:{follow(){}},Activity:{active:()=>({component:'main'}),push(){}},
    Player:{listener:{follow:()=>createHooks++},playlist:original}};
  const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/plugin.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;
  w.eval(bundle);
  assert.equal(w.LampaView.layout,mode);assert.equal(w.LampaView.bridge,false);
  assert.equal(w.Lampa.Player.playlist,original);assert.equal(createHooks,0);
  assert.ok(w.document.body.classList.contains('pt-'+mode));
  assert.equal(params.lampa_view_metadata,undefined,'desktop-only option leaked to standalone host');
  override='mobile';params.lampa_view_layout.onChange();assert.equal(w.LampaView.layout,'mobile');
  dom.window.close();
});
