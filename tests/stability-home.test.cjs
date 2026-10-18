const test=require('node:test'),assert=require('node:assert/strict'),path=require('path'),esbuild=require('esbuild'),native=require('./fixtures/native-lampa.cjs');
function mod(name){const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/'+name+'.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text,module={exports:{}};new Function('module','exports',code)(module,module.exports);return module.exports;}
test('full API guard normalizes missing errors and empty responses while preserving blocked status',()=>{
 for(const outcome of ['missing','empty','blocked','success']){
  const blocked={blocked:true,lgbt:'keyword'},movie={movie:{id:1}};let status,answer;
  const L={Api:{full(p,ok,fail){if(outcome==='missing')fail();else if(outcome==='empty')ok({});else if(outcome==='blocked')fail(blocked);else ok(movie);}}};mod('tmdb').installFullGuard(L);mod('tmdb').installFullGuard(L);L.Api.full({},data=>answer=data,data=>status=data);
  if(outcome==='success')assert.equal(answer,movie);else if(outcome==='blocked')assert.equal(status,blocked);else assert.deepEqual(status,{empty:true});
 }
});
test('native anime mismatch offers recovery while an ordinary failed source still shows Empty',async()=>{
 const r=await native(),{w,L}=r;
 try{
  L.Api.sources.minimal_fail={full:(p,ok,fail)=>w.setTimeout(()=>fail(),0),clear(){}};
  for(const source of ['minimal_fail','minimal_shiki']){
   L.Activity.push({component:'full',id:987654,method:'tv',source,card:{id:987654,name:'Несуществующее аниме',original_name:'No TMDB match',source}});await new Promise(resolve=>setTimeout(resolve,220));
   const root=L.Activity.active().activity.render(true);if(source==='minimal_fail')assert.ok(root.querySelector('.empty'),source);else {assert.ok(L.Select.render(true).textContent.includes('Поиск по другому названию'));assert.ok(L.Select.render(true).textContent.includes('Вернуться к аниме'));L.Select.close();}assert.deepEqual(r.errors,[]);assert.equal(root.querySelectorAll('.minimal-detail-header').length,0);
  }
 }finally{r.close();}
});
test('compact main has at most six rows and twenty cards per row, never asks Shikimori or returns the infinite loader',()=>{
 const data={},writes=[],rows=Array.from({length:30},(_,id)=>({title:'Row '+id,results:Array.from({length:50},(_,i)=>({id:id*100+i}))}));let extra=0;
 const L={Storage:{get:(k,d)=>data[k]===undefined?d:data[k],set:(k,v)=>{data[k]=v;writes.push(k);}},SettingsApi:{addParam(){}},Api:{main:(o,ok)=>{ok(rows);return ()=>extra++;}},Utils:{createInstance(){}},Maker:{get(){}}};
 mod('collections').default(L,{list:()=>assert.fail('compact mode fetched extra anime')});let result;const next=L.Api.main({component:'main'},value=>result=value);assert.equal(next,undefined);assert.equal(result.length,6);assert.ok(result.every(row=>row.results.length===20));assert.equal(rows[0].results.length,50);assert.equal(extra,0);const count=writes.length;L.Api.main({component:'main'},()=>{});assert.equal(writes.length,count,'unchanged known rows must not rewrite storage');
});
test('native compact main remains bounded after repeated scroll and next requests',async()=>{
 const r=await native(),{w,L}=r;
 try{
  let extra=0;const rows=Array.from({length:15},(_,i)=>({title:'Подборка '+i,url:'?sort=test'+i,source:'cub',results:Array.from({length:35},(_,j)=>({id:i*100+j+1,title:'Фильм '+j,release_date:'2025-01-01',poster_path:'/poster.jpg',source:'cub'}))}));
  L.Api.sources.cub.main=(o,ok)=>{w.setTimeout(()=>ok(rows),0);return ()=>extra++;};L.Activity.push({component:'main',source:'cub',url:'',page:1});await new Promise(resolve=>setTimeout(resolve,200));
  const link=L.Activity.active().activity.component,root=L.Activity.active().activity.render(true);assert.ok(link.items.length<=6);assert.ok(root.querySelectorAll('.card').length<=120);for(let i=0;i<20;i++){link.emit('scroll',i*500);link.emit('next',()=>{},()=>{});}await new Promise(resolve=>setTimeout(resolve,100));assert.equal(extra,0);assert.ok(link.items.length<=6);assert.ok(root.querySelectorAll('.card').length<=120);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
test('menu and settings share readable colours, descriptions do not fade twice, separators are hidden',async()=>{
 const r=await native(),{w}=r;
 try{
  const node=w.document.createElement('div');node.innerHTML='<div class="menu__split"></div><div class="menu__item focus"></div><div class="settings-folder focus"></div><div class="settings-param focus"><div class="settings-param__descr">Описание</div></div><div class="selectbox-item focus"></div>';w.document.body.appendChild(node);
  assert.equal(w.getComputedStyle(node.firstChild).display,'none');const items=[...node.querySelectorAll('.menu__item,.settings-folder,.settings-param,.selectbox-item')],styles=items.map(item=>w.getComputedStyle(item));for(const style of styles){assert.equal(style.color,styles[0].color);assert.equal(style.backgroundColor,'rgb(32, 39, 46)');}assert.equal(w.getComputedStyle(node.querySelector('.settings-param__descr')).opacity,'1');
  assert.equal(w.document.title,'L A M P A');assert.equal(w.document.documentElement.lang,'ru');assert.ok(w.document.querySelector('link[rel="icon"]').href.startsWith('data:image/svg+xml'));assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
