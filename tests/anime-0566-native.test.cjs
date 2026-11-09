const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));

test('non-Kodik release folders retain all six episodes and dub options with local season one',async()=>{
 for(const source of ['animedia','animelib']){
  const n=await native({built:true}),{w}=n;
  try{
   const base='http://lampa.example.invalid/lite/'+source,rendered=[],tag=(data,attrs='',cls='videos__item')=>'<div class="'+cls+'" '+attrs+' data-json=\''+JSON.stringify(data)+'\'></div>';
   const comp={changeBalanser(){},reset(){},request(){},parseJsonDate(body,selector){return Array.from(w.jQuery('<div>').html(body).find(selector),node=>{const row=JSON.parse(node.getAttribute('data-json'));if(node.hasAttribute('s'))row.season=Number(node.getAttribute('s'));if(node.hasAttribute('e'))row.episode=Number(node.getAttribute('e'));return row;});},parse(body){rendered.push({files:this.parseJsonDate(body,'.videos__item'),voices:this.parseJsonDate(body,'.videos__button')});}};
   const movie={id:220542,name:'Монолог фармацевта',original_name:'Kusuriya no Hitorigoto',first_air_date:'2023-10-22',minimal_anime:true,source:'tmdb',number_of_seasons:3};
   const key=source==='animedia'?'news':'uri',release=base+'?'+key+'=release-3';
   await scene(n,movie,[1,2,3],[1],comp);
   comp.request(base+'?title=test');
   comp.parse([1,2,3].map(s=>tag({title:'Монолог фармацевта '+s,method:'link',similar:true,url:base+'?'+key+'=release-'+s})).join(''));
   comp.request(release+'&t=dub');
   const files=Array.from({length:6},(_,i)=>({method:'call',url:base+'/video?id='+i,stream:base+'/video?id='+i+'&play=true'}));
   const body=files.map((row,i)=>tag(row,'s="1" e="'+(i+1)+'"')).join('')+tag({method:'link',name:'Dub A',url:release+'&t=a'},'','videos__button')+tag({method:'link',name:'Dub B',url:release+'&t=b'},'','videos__button');
   comp.parse(body);await wait(30);
   const result=rendered.at(-1);
   assert.deepEqual(Array.from(result.files,r=>[r.season,r.episode,r.url]),files.map((r,i)=>[3,i+1,r.url]),source+' uses the selected release season without dropping episode six');
   assert.equal(result.voices.length,2,'Dub navigation survives the release mapping');
   assert.deepEqual(n.errors,[]);
  }finally{n.close();}
 }
});
async function scene(n,movie,labels,values,comp={}){
 const {w,L}=n,$=w.jQuery,root=$('<div class="explorer"><div class="explorer__files"><div class="explorer__files-head"></div><div class="explorer__files-body"><div class="scroll"><div class="scroll__body"></div></div></div></div>').appendTo(w.document.body),filter=new L.Filter({search:false,sort:true,filter:true});
 root.find('.explorer__files-head').append(filter.render());filter.set('sort',[{title:'Kodik',source:'kodik',selected:true}]);filter.set('filter',[{stype:'season',title:'Сезон',items:labels.map((n,i)=>({title:'Сезон '+n,selected:i===0}))}]);let played;
 for(const num of values){const row=$('<div class="online-prestige online-prestige--full selector"><div class="online-prestige__title">Серия '+(num || 1)+'</div><div class="online-prestige__episode-number">'+(num || 1)+'</div><div class="time-line" data-hash="physical-'+num+'"><div style="width:0%"></div></div></div>').on('hover:enter',()=>played=num).appendTo(root.find('.scroll__body'));row.data('nova-native-actions',{element:{episode:num,season:labels[0]},html:row});}
 L.Activity.active=()=>({component:'online_test',movie,activity:{render:()=>root,component:comp}});L.Listener.send('activity',{type:'start'});await wait(500);return {root,filter,played:()=>played};
}
test('native episode zero stays an extra instead of becoming a second episode one',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  w.LampaView.episodeMetadata.groups=(c,f,done)=>done(null);L.Api.sources.tmdb.get=(url,p,ok)=>ok({season_number:3,episodes:[{season_number:3,episode_number:1,name:'Первая серия: начало',still_path:'/first.jpg'}]});
  const view=await scene(n,{id:63926,name:'One Punch Man',minimal_anime:true,source:'tmdb',number_of_seasons:3,seasons:[{season_number:3,episode_count:1}]},[3],[0,1]);
  const cards=view.root.find('.nova-card');assert.equal(cards.length,2);assert.equal(cards.eq(0).find('.nova-card__title').text(),'Дополнительный выпуск');assert.equal(cards.eq(0).find('.nova-card__num').text(),'Дополнительный выпуск');assert.equal(cards.eq(1).find('.nova-card__title').text(),'Первая серия: начало');cards.eq(0).trigger('hover:enter');assert.equal(view.played(),0);assert.ok(view.root.find('[data-hash="physical-0"]').length);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('native UI displays the canonical season and metadata while retaining a provider folder numbered two',async()=>{
 const n=await native({built:true}),{w}=n;try{
  w.LampaView.episodeMetadata.groups=(c,f,done)=>done(null);w.LampaView.animeBase.providerBook=(c,s,n,f,done)=>done({1:{season_number:1,episode_number:1,name:'Первая серия: начало',overview:'Описание первой серии',still_path:'/frame.jpg'}});
  const view=await scene(n,{id:31911,name:'Brotherhood',minimal_anime:true,source:'tmdb',number_of_seasons:1,seasons:[{season_number:1,episode_count:1}]},[2],[1],{lampaViewProviderSeasons:{2:{number:1,mal:5114}}});
  assert.equal(view.root.find('.nova-hero__season-label').text(),'Сезон 1');assert.equal(view.root.find('.nova-card__title').text(),'Первая серия: начало');assert.equal(view.root.find('.nova-card__overview').text(),'Описание первой серии');assert.equal(view.root.find('[data-nova-focus="season:0"] .nova-chip__label').text(),'Сезон 1');assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('native Kodik picker keeps separate TV release coordinates through nested season and dub lists',async()=>{
 const n=await native({built:true}),{w,L}=n,base='http://lampa.example.invalid/lite/kodik';try{
  const requested=[],rendered=[],tag=(data,cls='videos__item')=>'<div class="'+cls+'" data-json=\''+JSON.stringify(data)+'\'></div>';
  const comp={changeBalanser(){},reset(){},request:url=>requested.push(url),parseJsonDate(body,selector){return Array.from(w.jQuery('<div>').html(body).find(selector),node=>JSON.parse(node.getAttribute('data-json')));},parse(body){rendered.push(this.parseJsonDate(body,'.videos__item'));}};
  const movie={id:67075,name:'Моб Психо 100',original_name:'Mob Psycho 100',first_air_date:'2016-07-12',minimal_anime:true,source:'tmdb',number_of_seasons:3};
  w.LampaView.animeProviderParts=(card,url,body,number,numbers,done)=>done(body,[]);
  w.LampaView.animeProviderParts.folders=(card,url,body,done)=>done(body,null);
  await scene(n,movie,[1,2,3],[1],comp);
  comp.request(base+'?title=Mob');
  comp.parse([1,2,3].map((s,i)=>tag({title:'Моб Психо 100 [ТВ-'+s+']',year:[2016,2019,2022][i],method:'link',similar:true,url:base+'?pick='+s})).join(''));
  assert.deepEqual(Array.from(rendered.at(-1),r=>r.season),[1,2,3]);
  comp.request(base+'?pick=2');
  comp.parse(tag({title:'1 сезон',method:'link',season:1,url:base+'?pick=2&s=1'},'videos__item videos__season'));
  assert.equal(requested.at(-1),base+'?pick=2&s=1');
  comp.request(base+'?pick=2&s=1&t=voice');
  comp.parse(tag({method:'call',season:1,episode:1,url:base+'?play=one'})+tag({method:'call',title:'Dub option',url:base+'?dub=two'})+tag({method:'link',title:'Dub option',url:base+'?dub=two'},'videos__button'));
  assert.deepEqual(Array.from(rendered.at(-1),r=>[r.season,r.episode,r.url]),[[2,1,base+'?play=one']]);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
