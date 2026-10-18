const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('native card moves runtime, quality and genres into facts and gives badges the same translucent dark shell',async()=>{
 const r=await native(),{w,L}=r;
 try{
  const screen=L.Platform.screen;L.Platform.screen=type=>type==='tv'?true:screen(type);L.Storage.set('card_interfice_reactions',true);
  for(const kind of ['movie','tv','unknown']){
   const series=kind==='tv',known=kind!=='unknown',id=kind==='movie'?501:series?502:503;
   const movie={id,title:'Фильм',original_title:'Film',production_countries:[],production_companies:[],spoken_languages:[],release_date:'2026-01-01',status:'Released',runtime:known&&!series?145:0,vote_average:8,genres:known?[{id:14,name:'фантастика'},{id:28,name:'боевик'}]:[],content_ratings:{results:[{iso_3166_1:'US',rating:'PG-13'}]},source:'tmdb',...(known?{release_quality:series?'1080p':'WEBDL'}:{}),...(series?{name:'Сериал',original_name:'TV Show',first_air_date:'2026-01-01',number_of_episodes:12,number_of_seasons:2,episode_run_time:[47]}:{})};
   L.Api.full=(p,ok)=>ok({movie,persons:{cast:[],crew:[]},discuss:{result:[]},reactions:{result:[{type:'fire',counter:2}]},images:{logos:[]},videos:{results:[]},simular:{results:[]},recomend:{results:[]}});
   L.Activity.push({component:'full',id,method:series?'tv':'movie',source:'tmdb',card:{id,title:'Фильм',source:'tmdb'}});await new Promise(resolve=>setTimeout(resolve,150));
   const body=L.Activity.active().activity.render(true),facts=Object.fromEntries([...body.querySelectorAll('.minimal-detail-facts>div')].map(row=>[row.children[0].textContent,row.children[1].textContent])),line=body.querySelector('.full-start-new__details');
   assert.ok(!/фантастика|боевик|Качество|02:25|00:47/i.test(line.textContent));
   if(known){assert.equal(facts[series?'Длительность серии':'Длительность'],series?'00:47':'02:25');assert.equal(facts['Тип релиза'],series?'1080P':'WEBDL');assert.equal(facts['Жанры'],'фантастика, боевик');}
   else{assert.equal(facts['Длительность'],undefined);assert.equal(facts['Тип релиза'],undefined);assert.equal(facts['Жанры'],undefined);}
   if(series){assert.equal(line.classList.contains('pt-hidden'),false);assert.ok(line.textContent.includes('12'));assert.equal(line.firstElementChild.classList.contains('full-start-new__split'),false);assert.equal(line.lastElementChild.classList.contains('full-start-new__split'),false);}
   else assert.equal(line.classList.contains('pt-hidden'),true);
   const badges=[...body.querySelectorAll('.rate--tmdb,.full-start__pg,.full-start__status,.full-start-new__reactions .reaction')];assert.equal(badges.length,4);
   const styles=badges.map(badge=>w.getComputedStyle(badge));for(const style of styles){assert.equal(style.backgroundColor,'rgba(0, 0, 0, 0.36)');assert.equal(style.fontSize,styles[0].fontSize);assert.equal(style.minHeight,styles[0].minHeight);assert.equal(style.padding,styles[0].padding);assert.equal(style.borderRadius,styles[0].borderRadius);}
   assert.equal(w.getComputedStyle(body.querySelector('.rate--tmdb>div')).backgroundColor,'rgba(0, 0, 0, 0)');assert.deepEqual(r.errors,[]);
  }
 }finally{r.close();}
});
