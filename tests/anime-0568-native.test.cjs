const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function scene(n,movie,labels,values,comp={}){
 const {w,L}=n,$=w.jQuery,root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});
 root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:labels.map((n,i)=>({title:'Сезон '+n,selected:i===0}))}]);let played;
 for(const num of values){const row=$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+(num || 1)+'</div><div class="online-prestige__episode-number">'+(num || 1)+'</div><div class="time-line" data-hash="physical-'+num+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=num).appendTo(root.find('.scroll__body'));row.data('nova-native-actions',{element:{episode:num,season:labels[0]},html:row});}
 L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:comp}});L.Listener.send('activity',{type:'start'});await wait(500);return {root,filter,played:()=>played};
}

test('joined parts bypass single-release rejection and keep both overlay tags in one flow container',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  w.LampaView.episodeMetadata.groups=(c,f,done)=>done(null);
  w.LampaView.animeBase.providerBook=(c,s,n,f,done)=>done(null);
  const parts=[{season:4,offset:0,count:12,available:12,part:1},{season:4,offset:12,count:11,available:11,part:2}];
  L.Api.sources.tmdb.get=(url,p,ok)=>ok({season_number:4,episodes:Array.from({length:23},(_,i)=>({season_number:4,episode_number:i+1,name:'Название '+(i+1),overview:'Описание '+(i+1),still_path:'/frame'+i+'.jpg',air_date:'2020-01-01'}))});
  const movie={id:45782,name:'Мастера меча онлайн',minimal_anime:true,source:'tmdb',number_of_seasons:4,seasons:[{season_number:4,episode_count:23}]};
  const view=await scene(n,movie,[4],[1,13],{lampaViewProviderSeasons:{4:{number:4,mal:39597}},lampaViewJoinedParts:{season:4,parts}});
  const cards=view.root.find('.nova-card');assert.equal(cards.eq(0).find('.nova-card__title').text(),'Название 1');assert.equal(cards.eq(1).find('.nova-card__title').text(),'Название 13');assert.equal(cards.eq(1).find('.nova-card__overview').text(),'Описание 13');
  assert.equal(cards.eq(0).find('.nova-card__labels .nova-card__tag,.nova-card__labels .nova-card__num').length,1);assert.equal(cards.eq(1).find('.nova-card__labels .nova-card__part').text(),'Часть 2');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
