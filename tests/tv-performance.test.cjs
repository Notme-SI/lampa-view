const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const prepare=(w,L)=>{L.Platform.tv=()=>true;L.Platform.screen=type=>type==='tv';};

test('TV detail builds lower rows gradually, including empty comments, while remote and pointer can reach all rows',async()=>{
 const n=await native({built:true,prepare}),{w,L}=n;
 try{
  L.Storage.set('animation',false);w.document.body.classList.add('pt-reduce-motion');
  for(const populated of [false,true]){
   const id=populated?8002:8001,cards=Array.from({length:50},(_,i)=>({id:9000+i,title:'Film '+i,poster_path:'/poster.jpg',source:'tmdb'}));
   L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id,name:'Series',original_name:'Series',first_air_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{crew:[{id:20,name:'Director',profile_path:'/person.jpg',job:'Director'}],cast:[{id:21,name:'Actor',profile_path:'/person.jpg',character:'Role'}]},episodes:{name:'Season 2',episodes:[{id:1,season_number:2,episode_number:1,name:'Episode',air_date:'2025-04-01'}]},discuss:{result:populated?[{id:100,email:'Viewer',comment:'Review',liked:1}]:[]},reactions:{result:[]},images:{logos:[]},videos:{results:[]},recomend:{results:cards},simular:{results:cards.map(c=>({...c,id:c.id+100}))}}),0);
   L.Activity.push({component:'full',id,method:'tv',source:'tmdb',card:{id,name:'Series',source:'tmdb'}});await wait(160);
   const link=L.Activity.active().activity.component,root=L.Activity.active().activity.render(true),comments=root.querySelector('.minimal-comments-native');
   assert.equal(w.LampaView.layout,'tv');assert.equal(link.view,3);
   assert.equal(link.items.length,4,'Only header, cast, comments and the already built episodes should exist');
   assert.equal(link.rows.length,6);assert.equal(link.rows[2][0],'discuss');
   assert.equal(root.querySelector('.minimal-detail-header').nextElementSibling,comments);
   assert.ok(!root.textContent.includes('Film 0'),'Recommendations must not be built ahead of the remote');
   if(populated){
    const active=link.active;
    comments.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));
    assert.equal(link.items.length,6,'Pointer scrolling must expand rows even with a stale remote index');assert.equal(link.active,active);
   }else{
    link.emit('down');assert.ok(link.items.length<6);link.emit('down');assert.equal(link.items.length,5);
    for(let i=0;i<3;i++)link.emit('down');assert.equal(link.active,5);assert.equal(link.items.length,6);
    assert.ok(link.items[5].data.title.includes('Похожие'));link.emit('up');assert.equal(link.active,4);
   }
   assert.equal(root.querySelector('.minimal-detail-columns').children.length,2);assert.deepEqual(n.errors,[]);
  }
 }finally{n.close();}
});

test('TV poster downloads wait for remote idle, use two slots and paint completed covers without blanking',async()=>{
 const observers=[],loaders=[];
 const n=await native({built:true,prepare(w,L){prepare(w,L);w.IntersectionObserver=class{constructor(callback){this.callback=callback;this.nodes=new Set();observers.push(this);}observe(node){this.nodes.add(node);}unobserve(node){this.nodes.delete(node);}};}}),{w,L}=n;
 try{
  w.Image=class{constructor(){loaders.push(this);}set src(value){this.url=value;}get src(){return this.url;}};
  const Card=L.Maker.get('Card',{}),cards=[];
  for(let i=0;i<3;i++){
   const c=L.Utils.createInstance(Card,{id:100+i,title:'Film',poster_path:'/poster'+i+'.jpg',source:'tmdb'});c.create();const node=c.render(true);w.document.body.appendChild(node);cards.push(c);
   c.onscreen=i!==1;node.getBoundingClientRect=()=>({width:120,left:0,right:120,top:c.onscreen?0:4000,bottom:c.onscreen?180:4180});
   c.visible();c.img.dispatchEvent(new w.Event('load'));
  }
  const move=()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',keyCode:40,bubbles:true}));
  move();assert.ok(w.document.body.classList.contains('pt-tv-busy'));await wait(200);move();await wait(200);move();await wait(250);
  assert.equal(loaders.length,0,'No originals while the remote is moving');await wait(760);
  assert.equal(loaders.length,2);assert.equal(loaders[0].decoding,'async');assert.equal(loaders[0].fetchPriority,'high');
  move();loaders[0].onload();assert.match(cards[0].img.src,/\/w500\//,'A decoded cover can paint immediately during movement');
  await wait(1010);assert.match(cards[0].img.src,/\/w500\//);assert.equal(loaders.length,2);assert.match(loaders[1].url,/poster2/,'Offscreen original must be skipped');
  loaders[1].onload();cards[1].onscreen=true;
  for(const observer of observers)if(observer.nodes.has(cards[1].render(true)))observer.callback([{target:cards[1].render(true),isIntersecting:true}]);
  await wait(650);assert.equal(loaders.length,3,'A skipped card must upgrade when it becomes visible');
  const late=loaders[2].onload;cards[1].destroy();const cleared=cards[1].img.src;late();assert.equal(cards[1].img.src,cleared,'Destroyed cards must ignore late originals');
  cards[0].destroy();cards[2].destroy();assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
