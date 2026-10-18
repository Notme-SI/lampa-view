const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');
test('anime uses CUB, hero switches its action target, native remote navigation returns to the first row',async()=>{
 const dom=new JSDOM('<html><head></head><body><div class="head__logo-icon"></div><div class="head__menu-icon"></div><div class="head__title"></div><main><div class="items-line"></div></main></body></html>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(path.join(__dirname,'fixtures/jquery.js'),'utf8'));
 const $=w.jQuery,events={},pushes=[],controllers={},params=[],used=[],toggles=[];let backToLine=0;
 const activity={render:()=>$('main')};
 w.appready=true;w.Lampa={Storage:{get:(key,def)=>def,set(){}},Platform:{screen:v=>v==='tv'},SettingsApi:{addComponent:v=>params.push(v),addParam:v=>params.push(v)},
  Listener:{follow:(key,fn)=>events[key]=fn},Activity:{active:()=>({component:'main',activity}),push:v=>pushes.push(v)},
  Player:{listener:{follow(){}},playlist(){}},TMDB:{image:v=>'http://images.test'+v},Favorite:{check:()=>({wath:false}),add(){}},Noty:{show(){}},
  Controller:{add:(key,c)=>controllers[key]=c,toggle:key=>{toggles.push(key);if(controllers[key])controllers[key].toggle();},collectionSet(){},collectionFocus(){}}
 };
 const bundle=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/plugin.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;
 w.eval(bundle);$('.pt-topnav__item[data-section="anime"]').trigger('hover:enter');
 assert.equal(pushes.length,1);assert.equal(pushes[0].source,'cub');assert.equal(pushes[0].url,'anime');
 assert.ok(!/lampa_view/i.test(w.document.body.textContent));assert.ok(!params.some(v=>/lampa_view/i.test(v.name || (v.field || {}).name || '')));
 const cards=[{id:101,title:'Первый',backdrop_path:'/a.jpg',overview:'Описание первого',release_date:'2020-01-01'},{id:102,name:'Второй',backdrop_path:'/b.jpg',overview:'Описание второго',first_air_date:'2021-01-01'}];
 events.line({type:'append',params:{object:{component:'main',activity}},data:{results:cards},line:{use:v=>used.push(v),toggle:()=>backToLine++}});
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal($('.pt-hero').length,1);assert.equal($('.pt-hero__action--secondary').length,0);
 $('.pt-hero__dot').eq(1).trigger('hover:enter');assert.equal($('.pt-hero__title').text(),'Второй');
 $('.pt-hero__dot')[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal($('.pt-hero__title').text(),'Первый');
 $('.pt-hero__dot')[1].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal($('.pt-hero__title').text(),'Второй');
 $('.pt-hero__action').eq(0).trigger('hover:enter');assert.equal(pushes.at(-1).id,102);assert.equal(pushes.at(-1).method,'tv');
 used[0].onlyUp();assert.equal(toggles.at(-1),'lampa_view_hero');
 controllers.lampa_view_hero.down();controllers.lampa_view_hero.down();assert.equal(backToLine,1);
 w.eval(bundle);assert.equal($('.pt-topnav').length,1);assert.equal($('.pt-hero').length,1);
 dom.window.close();
});
