const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('fresh anime entry focuses the saved catalogue button without selecting or scrolling a row on desktop and TV',async()=>{
 for(const screen of ['desktop','tv']){
  const n=await native({built:true,requestPipeline:true}),{w,L}=n;
  try{
   const mode=screen==='tv'?'shikimori':'standard';L.Platform.screen=type=>type===screen;L.Storage.set('minimal_anime_catalogue',mode);
   Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
   const cards=[{id:1,name:'Аниме',first_air_date:'2026-01-01',source:'cub'}];L.Api.sources.cub.list=(p,ok)=>w.setTimeout(()=>ok({results:cards}),0);
   const network=w.testNetwork;w.testNetwork=(url,ok,fail)=>{if(/shikimori\.(io|one)\/api\/animes/.test(url))w.setTimeout(()=>ok([{id:1,kind:'tv',name:'Anime',russian:'Аниме',image:{original:'/poster.jpg'}}]),0);else network(url,ok,fail);};
   L.Activity.push({component:'category',url:'anime',source:'cub',title:'Аниме'});
   const link=L.Activity.active().activity.component,root=link.render(true),body=link.scroll.body(true),viewport=link.scroll.render(true),wrapper=root.querySelector('.minimal-anime-controls');let rowToggles=0;
   Object.defineProperty(body,'offsetHeight',{value:2400,configurable:true});Object.defineProperty(body,'scrollHeight',{value:2400,configurable:true});Object.defineProperty(viewport,'offsetHeight',{value:800,configurable:true});body.getBoundingClientRect=()=>({top:80+link.scroll.position(),left:0,width:1000,height:2400});wrapper.getBoundingClientRect=()=>({top:80+link.scroll.position(),left:0,width:1000,height:60});
   root.querySelectorAll('.minimal-anime-tab').forEach(button=>{Object.defineProperty(button,'offsetWidth',{value:140});Object.defineProperty(button,'offsetHeight',{value:44});});
   link.use({onAppend(row){row.render(true).getBoundingClientRect=()=>({top:330+link.scroll.position(),left:0,width:1000,height:400});row.use({onToggle(){rowToggles++;}});}});
   await wait(mode==='shikimori'?3500:180);
   const selected=root.querySelector('[data-catalogue='+mode+']');assert.equal(L.Controller.enabled().name,'minimal_anime_tabs');assert.equal(w.Navigator.getFocusedElement(),selected);assert.equal(link.scroll.position(),0);assert.equal(rowToggles,0,'entry must not toggle the first row before focusing the buttons');
   w.document.body.classList.add('no--animation');assert.match(w.getComputedStyle(selected).boxShadow,/0 0 0 2px #fff/);assert.match(w.getComputedStyle(selected).boxShadow,/1.1em rgba\(173,\s*217,\s*229,\s*(?:0)?\.55\)/);assert.ok(w.getComputedStyle(selected).transition.includes('.24s'));const other=root.querySelector('[data-catalogue='+(mode==='standard'?'shikimori':'standard')+']');other.classList.add('focus');assert.match(w.getComputedStyle(other).boxShadow,/173,\s*217,\s*229/);other.classList.remove('focus');
   const reference=w.document.createElement('div');reference.className='pt-hero__action';root.appendChild(reference);const expected=w.getComputedStyle(reference);for(const button of root.querySelectorAll('.minimal-anime-tab')){assert.ok(button.classList.contains('pt-hero__action'));const actual=w.getComputedStyle(button);for(const property of ['paddingTop','paddingRight','borderRadius','fontSize','fontWeight','backgroundColor','color'])assert.equal(actual[property],expected[property],property);}reference.remove();
   L.Controller.enabled().controller.down();assert.equal(rowToggles,1);assert.ok(link.scroll.position()<0);L.Controller.enabled().controller.up();assert.equal(L.Controller.enabled().name,'minimal_anime_tabs');assert.equal(w.Navigator.getFocusedElement(),selected);assert.equal(link.scroll.position(),0);assert.deepEqual(n.errors,[]);
  }finally{n.close();}
 }
});
