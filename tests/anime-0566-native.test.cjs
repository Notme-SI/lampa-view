const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function scene(n,movie,labels,values,comp={}){
 const {w,L}=n,$=w.jQuery,root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});
 root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:labels.map((n,i)=>({title:'Сезон '+n,selected:i===0}))}]);let played;
 for(const num of values){const row=$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+(num || 1)+'</div><div class="online-prestige__episode-number">'+(num || 1)+'</div><div class="time-line" data-hash="physical-'+num+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=num).appendTo(root.find('.scroll__body'));row.data('nova-native-actions',{element:{episode:num,season:labels[0]},html:row});}
 L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:comp}});L.Listener.send('activity',{type:'start'});await wait(500);return {root,filter,played:()=>played};
}
test('native episode zero stays an extra instead of becoming a second episode one',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  w.LampaView.episodeMetadata.groups=(c,f,done)=>done(null);L.Api.sources.tmdb.get=(url,p,ok)=>ok({season_number:3,episodes:[{season_number:3,episode_number:1,name:'Actual first episode',still_path:'/first.jpg'}]});
  const view=await scene(n,{id:63926,name:'One Punch Man',minimal_anime:true,source:'tmdb',number_of_seasons:3,seasons:[{season_number:3,episode_count:1}]},[3],[0,1]);
  const cards=view.root.find('.nova-card');assert.equal(cards.length,2);assert.equal(cards.eq(0).find('.nova-card__title').text(),'Дополнительный выпуск');assert.equal(cards.eq(0).find('.nova-card__num').text(),'Дополнительный выпуск');assert.equal(cards.eq(1).find('.nova-card__title').text(),'Actual first episode');cards.eq(0).trigger('hover:enter');assert.equal(view.played(),0);assert.ok(view.root.find('[data-hash="physical-0"]').length);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('native UI displays the canonical season and metadata while retaining a provider folder numbered two',async()=>{
 const n=await native({built:true}),{w}=n;try{
  w.LampaView.episodeMetadata.groups=(c,f,done)=>done(null);w.LampaView.animeBase.providerBook=(c,s,n,f,done)=>done({1:{season_number:1,episode_number:1,name:'Real first episode',overview:'Actual synopsis',still_path:'/frame.jpg'}});
  const view=await scene(n,{id:31911,name:'Brotherhood',minimal_anime:true,source:'tmdb',number_of_seasons:1,seasons:[{season_number:1,episode_count:1}]},[2],[1],{lampaViewProviderSeasons:{2:{number:1,mal:5114}}});
  assert.equal(view.root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(view.root.find('.nova-card__title').text(),'Real first episode');assert.equal(view.root.find('.nova-card__overview').text(),'Actual synopsis');assert.equal(view.root.find('[data-nova-focus="season:0"] .nova-chip__label').text(),'Сезон 1');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
