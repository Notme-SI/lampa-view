const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('native full keeps comments outside the cast grid and wheel reaches recommendations and similar without moving remote focus',async()=>{
 const r=await native(),{w,L}=r,tick=()=>new Promise(resolve=>setTimeout(resolve,150));
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);L.Storage.set('animation',false);w.document.body.classList.add('pt-reduce-motion');
  for(const populated of [false,true]){
   const id=populated?1002:1001,cards=Array.from({length:25},(_,i)=>({id:2000+i,title:'Фильм '+i,poster_path:'/poster.jpg',release_date:'2025-01-01',vote_average:8,source:'tmdb'}));
   L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id,name:'Гангстерленд',original_name:'MobLand',first_air_date:'2025-03-30',production_countries:[],production_companies:[],spoken_languages:[],genres:[],number_of_seasons:2,number_of_episodes:20,source:'tmdb'},persons:{crew:[{id:20,name:'Director',profile_path:'/person.jpg',job:'Director'}],cast:[{id:21,name:'Actor',profile_path:'/person.jpg',character:'Role'}]},episodes:{name:'Сезон 2',episodes:[{id:1,season_number:2,episode_number:1,name:'Эпизод 1',air_date:'2025-04-01',still_path:'/episode.jpg'}]},discuss:{result:populated?Array.from({length:12},(_,i)=>({id:100+i,email:'Viewer '+i,comment:'Отзыв о сериале '+i,liked:1})):[]},reactions:{result:[]},images:{logos:[]},videos:{results:[]},recomend:{results:cards.map(c=>({...c}))},simular:{results:cards.map(c=>({...c,id:c.id+100}))}}),0);
   L.Activity.push({component:'full',id,method:'tv',source:'tmdb',card:{id,name:'Гангстерленд',source:'tmdb'}});await tick();
   const link=L.Activity.active().activity.component,root=L.Activity.active().activity.render(true),header=root.querySelector('.minimal-detail-header'),columns=root.querySelector('.minimal-detail-columns'),comments=root.querySelector('.minimal-comments-native');
   assert.equal(columns.contains(comments),false,'comments must not become a grid cell');assert.equal(header.parentElement,comments.parentElement);assert.equal(header.nextElementSibling,comments);assert.equal(columns.children.length,2);assert.equal(w.getComputedStyle(comments).width,'90%');assert.equal(w.getComputedStyle(comments.querySelector('.items-line__body')).maskImage,'none');assert.equal(w.getComputedStyle(comments.querySelector('.scroll--horizontal')).maskImage,'none');
   assert.equal(link.items.length,link.rows.length,'unbuilt rows were unreachable with a stale remote active index');assert.equal(link.view,link.rows.length);assert.equal(link.rows[2][0],'discuss');assert.equal(link.items[2].render(true),comments);assert.equal(link.rows[3][0],'episodes');
   const recommendation=link.items[4],similar=link.items[5];assert.ok(recommendation.data.title.includes('Рекомендации'));assert.ok(similar.data.title.includes('Похожие'));assert.ok(recommendation.items.length>=7 && recommendation.items.length<25,'horizontal cards should keep their native lazy batch');
   const scroll=link.scroll,viewport=scroll.render(true),body=scroll.body(true);assert.equal(header.parentElement,body);viewport.querySelector('.scroll__content').style.padding='0px';
   const height=node=>node===header?900:node===comments?240:380,total=()=>Array.from(body.children).reduce((sum,node)=>sum+height(node),0),top=node=>{let y=0;for(const child of body.children){if(child===node)return y;y+=height(child);}return y;};
   Object.defineProperty(viewport,'offsetHeight',{value:600,configurable:true});Object.defineProperty(body,'offsetHeight',{get:total,configurable:true});Object.defineProperty(body,'scrollHeight',{get:total,configurable:true});viewport.getBoundingClientRect=()=>({top:0,left:0,width:1800,height:600,bottom:600,right:1800});body.getBoundingClientRect=()=>({top:scroll.position(),left:0,width:1800,height:total(),bottom:total()+scroll.position()});
   for(const node of body.children)node.getBoundingClientRect=()=>({top:top(node)+scroll.position(),left:90,width:1620,height:height(node),bottom:top(node)+height(node)+scroll.position(),right:1710});
   const active=link.active,first=comments.querySelector('.full-review,.full-review-add');
   first.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));assert.equal(scroll.position(),-120,'ordinary wheel over comments must move the page');
   for(let i=0;i<30;i++)viewport.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));
   assert.ok(Math.abs(scroll.position())>top(comments)+height(comments),'wheel stopped at comments');assert.equal(scroll.position(),-(total()-600));assert.equal(link.active,active,'pointer scrolling must not depend on or advance remote focus');assert.ok(similar.render(true).getBoundingClientRect().bottom<=600);assert.equal(columns.children.length,2);
   for(let i=0;i<30;i++)viewport.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120}));assert.equal(scroll.position(),0);assert.equal(link.active,active);
   for(let i=0;i<5;i++)link.emit('down');assert.equal(link.active,5);assert.equal(link.items[link.active],similar);link.emit('up');assert.equal(link.active,4);assert.equal(link.items[link.active],recommendation);assert.equal(header.nextElementSibling,comments);assert.equal(link.items.length,link.rows.length);assert.deepEqual(r.errors,[]);
  }
 }finally{r.close();}
});
test('full page rows remain wheel-accessible when discussion is disabled and cast is missing',async()=>{
 const r=await native(),{w,L}=r;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);w.lampa_settings.disable_features.discuss=true;
  L.Api.full=(p,ok)=>w.setTimeout(()=>ok({movie:{id:1003,title:'Фильм',original_title:'Film',release_date:'2025-01-01',production_countries:[],production_companies:[],spoken_languages:[],genres:[],source:'tmdb'},persons:{cast:[],crew:[]},images:{logos:[]},videos:{results:[]},recomend:{results:[{id:20,title:'Recommendation'}]},simular:{results:[{id:21,title:'Similar'}]}}),0);
  L.Activity.push({component:'full',id:1003,method:'movie',source:'tmdb',card:{id:1003,title:'Фильм',source:'tmdb'}});await new Promise(resolve=>setTimeout(resolve,150));const link=L.Activity.active().activity.component;assert.equal(link.items.length,link.rows.length);assert.equal(link.rows.length,3);assert.equal(link.active,0);assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
