const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('native cast returns all the way left despite failed spatial navigation, and mouse buttons use the same row',async()=>{
 const n=await native(),{w,L}=n;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
  L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id:1201,title:'Фильм',source:'tmdb',release_date:'2026-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[]},persons:{cast:Array.from({length:64},(_,i)=>({id:100+i,name:'Актёр '+i,profile_path:'/person.jpg',character:'Роль '+i,popularity:10})),crew:[]},discuss:{result:[]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}}),0);
  L.Activity.push({component:'full',id:1201,method:'movie',source:'tmdb',card:{id:1201,title:'Фильм',source:'tmdb'}});await wait(150);
  const full=L.Activity.active().activity.component,row=full.items.find(i=>i.render(true).classList.contains('minimal-cast-native')),root=row.render(true),viewport=row.scroll.render(true),body=row.scroll.body(true);
  Object.defineProperty(viewport,'offsetWidth',{value:900,configurable:true});Object.defineProperty(body,'offsetWidth',{get:()=>body.children.length*100,configurable:true});Object.defineProperty(body,'scrollWidth',{get:()=>body.children.length*100,configurable:true});viewport.getBoundingClientRect=()=>({left:0,right:900,top:0,bottom:200,width:900,height:200});body.getBoundingClientRect=()=>({left:row.scroll.position(),right:body.children.length*100+row.scroll.position(),top:0,bottom:200,width:body.children.length*100,height:200});
  const geometry=()=>row.items.forEach((item,index)=>{const el=item.render(true);el.getBoundingClientRect=()=>({left:index*100+row.scroll.position(),right:index*100+90+row.scroll.position(),top:0,bottom:180,width:90,height:180});});row.use({onAppend:geometry});geometry();
  row.toggle();w.Navigator.canmove=()=>false;w.Navigator.move=()=>false;
  for(let i=1;i<20;i++){L.Controller.enabled().controller.right();assert.equal(row.active,i);}
  assert.equal(row.items.length,20);assert.equal(row.data.results.length,20,'Only the main cast belongs in the finite row');for(let i=18;i>=0;i--){L.Controller.enabled().controller.left();assert.equal(row.active,i);}
  assert.equal(row.last,row.items[0].render(true));assert.equal(root.querySelectorAll('.minimal-row-nav').length,1);
  const [left,right]=root.querySelectorAll('.minimal-row-arrow');assert.equal(left.disabled,false);right.click();assert.equal(row.active,8);await wait(400);left.click();assert.equal(row.active,0);await wait(400);row.scroll.shift(1000);assert.equal(row.scroll.position(),-1000);right.click();assert.equal(row.active,12,'mouse arrow must continue from the scrolled viewport');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('movie release names merge as unknown voices without dropping stream variants, known studios infer language and filters apply',async()=>{
 const n=await native(),{w,L}=n;
 try{
  assert.ok(!L.SettingsApi.getParam('minimal_settings_appearance').some(p=>p.param.name==='lampa_view_motion'));
  const poster=w.document.createElement('div');poster.className='card focus';poster.innerHTML='<div class="card__view"></div>';w.document.body.appendChild(poster);const style=w.getComputedStyle(poster.firstChild);assert.ok(style.transform.includes('scale(1.045)'));assert.ok(style.boxShadow.includes('rgba'));poster.remove();
  const A=w.alc_auto_debug,movie={id:1202,title:'Человек-паук: Новый день',original_title:'Spider-Man: Brand New Day',genres:[{id:28,name:'боевик'},{id:878,name:'фантастика'}]},s=new A.Session(movie);
  const stream=(name,id)=>({method:'play',name,url:'https://example.test/'+id});
  const originals=[stream('Человек-паук: Новый день 2026 4K',1),stream('Spider-Man.Brand.New.Day.2026.2160p.WEB-DL.HDR.',2),stream('4K) Фантастика',3),stream('TVShows',4),stream('TVShows 1080p',5),stream('Украинская озвучка',6)];
  s.roots={one:{data:originals},two:{voice_lang:'rus',data:[stream('LostFilm',7)]}};
  let voices=s.voices(0);const unnamed=voices.find(v=>v.unnamed);assert.equal(voices.filter(v=>v.unnamed).length,1);assert.equal(unnamed.cands.length,3);const tv=voices.find(v=>v.label==='TVShows');assert.equal(tv.lang,'ru');assert.equal(tv.cands.length,2);assert.equal(voices.find(v=>v.label==='LostFilm').lang,'ru');assert.equal(voices.reduce((sum,v)=>sum+v.cands.length,0),7);
  const languages=L.SettingsApi.getParam('minimal_settings_languages'),definition=languages.find(p=>p.param.name==='alc_auto_visible_languages');assert.ok(definition);let menu;const show=L.Select.show;L.Select.show=o=>(menu=o,show.call(L.Select,o));definition.onChange();const uk=menu.items.find(i=>i.lang==='uk');assert.ok(uk);uk.checked=false;menu.onCheck(uk);assert.ok(L.Storage.get('alc_auto_lang_off',[]).includes('uk'));voices=s.voices(0);assert.ok(voices.every(v=>v.lang!=='uk'));assert.ok(voices.some(v=>v.lang==='ru'));L.Select.close();assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('first results finish the initial source wait earlier while late results keep arriving',async()=>{
 const n=await native(),{w}=n;
 try{
  const s=new w.alc_auto_debug.Session({id:1203,title:'Film'}),pending={};s.get=(url,ok)=>pending[url]=ok;let timer,completed=0,results=[];const interval=w.setInterval,clear=w.clearInterval,now=w.Date.now;let clock=0;w.Date.now=()=>clock;w.setInterval=fn=>(timer=fn,900001);w.clearInterval=()=>{};
  s.fanout({fast:'fast',slow:'slow'},(src,json)=>(results.push(src),true),()=>completed++);clock=100;pending.fast({type:'movie',data:[]});clock=1250;timer();assert.equal(completed,1);assert.deepEqual(results,['fast']);clock=19000;pending.slow({type:'movie',data:[]});assert.equal(completed,1);assert.deepEqual(results,['fast','slow']);w.setInterval=interval;w.clearInterval=clear;w.Date.now=now;
 }finally{n.close();}
});

test('a future episode receives its date when season metadata arrives after the online screen was drawn',async()=>{
 const n=await native(),{w,L}=n;
 try{
  const fs=require('fs'),path=require('path'),source=fs.readFileSync(path.join(__dirname,'../vendor/alc-auto.js'),'utf8');let expression=source.slice(source.indexOf('var PACK = ')+11,source.indexOf('/*cfg-end*/')).trim().replace(/;$/,'');const pack=w.eval(expression);
  const original=w.alc_auto_debug.Session.prototype.loadRoots;w.alc_auto_debug.Session.prototype.loadRoots=function(cb){this.rootsDone=true;this.rootsLeft=0;this.seasons={1:[{src:'one',url:null}]};this.seasonData={1:{one:{type:'episode',voice_lang:'ru',data:[{method:'play',s:1,e:1,name:'Серия 1',voice_name:'LostFilm',url:'https://example.test/one'}]}}};cb();};
  const pending=[];L.Api.sources.tmdb.get=(route,params,ok)=>{if(route.includes('/season/'))pending.push(ok);else ok({images:{logos:[]}});};
  const movie={id:1204,source:'tmdb',name:'Сериал',original_name:'Show',first_air_date:'2026-01-01',number_of_seasons:1,number_of_episodes:2,seasons:[{season_number:1,episode_count:2,air_date:'2026-01-01'}]};L.Activity.push({component:pack.c,movie});await wait(180);
  const root=L.Activity.active().activity.render(true);assert.equal(root.querySelectorAll('.alc-ep').length,2);const second=root.querySelectorAll('.alc-ep')[1];assert.equal(second.querySelector('.alc-ep__time').textContent,'');assert.ok(pending.length);
  pending[0]({episodes:[{episode_number:1,season_number:1,name:'Первая',air_date:'2026-01-01'},{episode_number:2,season_number:1,name:'Будущая',air_date:'2099-10-23'}]});await wait(180);
  assert.equal(second.querySelector('.alc-ep__name').textContent,'Будущая');assert.ok(/23/.test(second.querySelector('.alc-ep__time').textContent));assert.ok(/2099/.test(second.querySelector('.alc-ep__time').textContent));assert.ok(second.classList.contains('alc-ep--soon'));assert.ok(/23/.test(second.querySelector('.alc-ep__tag').textContent));w.alc_auto_debug.Session.prototype.loadRoots=original;assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
