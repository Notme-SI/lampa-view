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
  metadataResponse={url:'tv/85937/season/4',season_number:4,episodes:[{episode_number:1,season_number:4,name:'Canonical season 4'}]};
  reply();assert.equal(result[0].name,'Canonical season 4');
  seasons(4);const callbacks=[];w.LampaView.episodeMetadata.book=(card,season,numbers,count,done,actual)=>{assert.equal(count,8);assert.deepEqual(Array.from(actual),[1,2,3,4,5,6,7,8]);callbacks.push(done);return true;};
  comp.draw(files);await new Promise(r=>setTimeout(r,20));comp.draw(files);await new Promise(r=>setTimeout(r,20));callbacks[0]({1:{episode_number:41,season_number:5,name:'Stale'}},true);assert.equal(result[0].name,'Canonical season 4');callbacks[1]({1:{episode_number:41,season_number:5,name:'Verified'}},true);assert.equal(result[0].name,'Verified');assert.equal(result[0].episode_number,1,'Only the metadata lookup is rekeyed to the provider number');assert.equal(result[0].season_number,5);assert.equal(nativeReads,0);assert.equal(JSON.stringify(files),before);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
