const test=require('node:test'),assert=require('node:assert/strict');
const native=require('./fixtures/native-lampa.cjs');
test('native online metadata obeys the complete coordinate guard before constructing episode cards and preserves provider files',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;try{
  w.LampaView.animeBase.providerBook=(c,s,n,f,done)=>done(null);const root=$('<div><div class="filter-host"></div></div>').appendTo(w.document.body),filter=new L.Filter({filter:true});root.find('.filter-host').append(filter.render());
  const movie={id:85937,name:'Anime',minimal_anime:true,number_of_seasons:5,seasons:Array.from({length:5},(_,i)=>({season_number:i+1,episode_count:8}))},files=Array.from({length:8},(_,i)=>({episode:i+1,season:4,url:'original-'+i})),before=JSON.stringify(files);let nativeReads=0,result,metadataResponse,reply;
  L.Api.sources.tmdb.get=(url,p,ok)=>{assert.match(url,/season\/4/);reply=()=>ok(metadataResponse);};
  const comp={render:()=>root,changeBalanser(){},getEpisodes(season,done){nativeReads++;done([{episode_number:1,name:'Wrong canonical season'}]);},draw(rows){this.getEpisodes(rows[0].season,rows=>result=rows);}};
  L.Component.add('anime_metadata_test',function(){return comp;});L.Component.create({component:'anime_metadata_test',movie});
  function seasons(count){filter.set('filter',[{stype:'season',title:'Сезон',items:Array.from({length:count},(_,i)=>({title:'Сезон '+(i+1),selected:i===3}))}]);}
  comp.draw(files);seasons(4);await new Promise(r=>setTimeout(r,20));assert.deepEqual(Array.from(result),[]);assert.equal(nativeReads,0,'The first native draw cannot reintroduce metadata before its season filter is populated');
  seasons(5);comp.draw(files);await new Promise(r=>setTimeout(r,20));
  metadataResponse={url:'tv/85937/season/1',season_number:4,episodes:[{episode_number:1,season_number:4,name:'Synthetic fallback'}]};
  reply();assert.equal(result.length,0,'A season 1 fallback is rejected even if Lampa relabels its rows');
  comp.draw(files);await new Promise(r=>setTimeout(r,20));
  metadataResponse={url:'tv/85937/season/4',season_number:4,episodes:[{episode_number:1,season_number:4,name:'Правильная серия четвёртого сезона'}]};
  reply();assert.equal(result[0].name,'Правильная серия четвёртого сезона');
  seasons(4);const callbacks=[];w.LampaView.episodeMetadata.book=(card,season,numbers,count,done,actual)=>{assert.equal(count,8);assert.deepEqual(Array.from(actual),[1,2,3,4,5,6,7,8]);callbacks.push(done);return true;};
  comp.draw(files);await new Promise(r=>setTimeout(r,20));comp.draw(files);await new Promise(r=>setTimeout(r,20));callbacks[0]({1:{episode_number:41,season_number:5,name:'Stale'}},true);assert.equal(result[0].name,'Правильная серия четвёртого сезона');callbacks[1]({1:{episode_number:41,season_number:5,name:'Подтверждённая серия'}},true);assert.equal(result[0].name,'Подтверждённая серия');assert.equal(result[0].episode_number,1,'Only the metadata lookup is rekeyed to the provider number');assert.equal(result[0].season_number,5);assert.equal(nativeReads,0);assert.equal(JSON.stringify(files),before);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('a named provider release does not inherit future episodes from the combined catalogue season',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery;
 try{
  const root=$('<div>').appendTo(w.document.body),movie={id:220542,name:'Монолог фармацевта',minimal_anime:true,number_of_seasons:3,seasons:[{season_number:1,episode_count:24}]};
  const base='https://lampac.test/lite/ailiberty',first=base+'?uri=first';
  const comp={render:()=>root,changeBalanser(){},request(){},parse(){},parseJsonDate(){return [];},getEpisodes(){throw new Error('Use checked metadata');},draw(rows,done){this.getEpisodes(rows[0].season,done);}};
  L.Component.add('provider_release_metadata_test',function(){return comp;});L.Component.create({component:'provider_release_metadata_test',movie});
  L.Activity.active=()=>({movie,activity:{component:comp,render:()=>root}});
  comp.request(base);comp.parse([first,base+'?uri=second'].map((url,i)=>{
   const folder={method:'link',url,similar:true,title:movie.name+(i?' 2':'')};
   return '<div class="videos__item videos__season" data-json=\''+JSON.stringify(folder)+'\'></div>';
  }).join(''));
  w.LampaView.animeBase.seasonBook=(card,season,done)=>done({season_number:1,episodes:[
   {season_number:1,episode_number:1,name:'Маомао'},
   {season_number:1,episode_number:55,name:'Эпизод 55',air_date:'2099-01-01'}
  ]});
  const files=[{method:'play',season:1,episode:1,url:'/first'}];
  comp.request(first+'&voice=1');const scoped=await new Promise(done=>comp.draw(files,done));
  assert.deepEqual(Array.from(scoped,row=>row.episode_number),[1]);
  comp.changeBalanser('other');comp.request(base.replace('ailiberty','other'));
  const unscoped=await new Promise(done=>comp.draw(files,done));assert.deepEqual(Array.from(unscoped,row=>row.episode_number),[1,55]);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
