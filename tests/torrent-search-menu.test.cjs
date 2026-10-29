const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('CUB search resolves verified TMDB metadata and keeps the Japanese alternative despite a Romaji original name',async()=>{
 const n=await native({built:true,prepare(w,L){L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[{Title:'Cyberpunk: Edgerunners S02E01 RUS/JPN',Tracker:'kinozal',Seeders:12,Size:1e9}]}),0);}}),{w,L}=n;
 try{
  const requests=[];L.Api.sources.tmdb.get=(path,p,ok)=>{requests.push(path);w.setTimeout(()=>ok({results:[{id:105248,name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13'}]}),0);};
  w.testNetwork=(url,ok)=>w.setTimeout(()=>ok({id:105248,name:url.includes('ru-RU')?'Киберпанк: Бегущие по краю':'Cyberpunk: Edgerunners',original_name:'Saibāpanku Edjirannāzu',first_air_date:'2022-09-13',genres:[{id:16}],seasons:[{season_number:1,episode_count:10}],alternative_titles:{results:[{iso_3166_1:'JP',title:'サイバーパンク エッジランナーズ',type:'Japanese title'}]}}),0);
  const movie={id:987654,source:'cub',name:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13',number_of_seasons:1,genres:[{id:16}]};
  L.Activity.push({component:'torrents',movie,search:'Cyberpunk: Edgerunners',url:''});await wait(250);const root=L.Activity.active().activity.render(true);root.querySelector('.filter--search').dispatchEvent(new w.Event('hover:enter',{bubbles:true}));assert.ok(L.Select.render().text().includes('サイバーパンク エッジランナーズ'));assert.ok(requests.some(path=>path.startsWith('search/tv?')));assert.equal(L.Activity.active().movie.id,987654);
  L.Controller.back();assert.deepEqual(Array.from(root.querySelectorAll('.tc-tag--language'),node=>node.textContent),['RU / JA']);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('torrent clarification restores Russian and Japanese names from metadata, deduplicates English and keeps native query selection',async()=>{
 const n=await native({built:true,prepare(w,L){L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[{Title:'Киберпанк / Cyberpunk: Edgerunners S01E01',Tracker:'test',Seeders:10,Size:1e9}]}),0);}}),{w,L}=n;
 try{
  w.testNetwork=(url,ok)=>w.setTimeout(()=>ok({id:105248,name:url.includes('ru-RU')?'Киберпанк: Бегущие по краю':'Cyberpunk: Edgerunners',original_name:'サイバーパンク エッジランナーズ',first_air_date:'2022-09-13',genres:[{id:16,name:'Мультфильм'}]}),0);
  const movie={id:105248,name:'Cyberpunk: Edgerunners',title:'Cyberpunk: Edgerunners',original_name:'Cyberpunk: Edgerunners',original_title:'Cyberpunk: Edgerunners',original_language:'ja',first_air_date:'2022-09-13',number_of_seasons:1,genres:[{id:16,name:'Мультфильм'}],source:'tmdb'};
  L.Activity.push({component:'torrents',movie,search:movie.title,search_one:movie.title,search_two:movie.title,url:''});await wait(180);
  const root=L.Activity.active().activity.render(true);
  assert.deepEqual(Array.from(root.querySelectorAll('.minimal-toolbar-label'),node=>node.textContent),['Поиск','Сортировка','Фильтры']);
  root.querySelector('.filter--search').dispatchEvent(new w.Event('hover:enter',{bubbles:true}));
  const titles=Array.from(w.document.querySelectorAll('.selectbox-item__title'),node=>node.textContent);
  assert.ok(titles.includes('Киберпанк: Бегущие по краю'));
  assert.ok(titles.includes('サイバーパンク エッジランナーズ'));
  assert.equal(titles.filter(title=>title==='Cyberpunk: Edgerunners').length,1);
  assert.ok(!titles.some(title=>title.includes('Edgerunners Cyberpunk')));
  const item=Array.from(w.document.querySelectorAll('.selectbox-item__title')).find(node=>node.textContent==='サイバーパンク エッジランナーズ').closest('.selectbox-item');
  item.dispatchEvent(new w.Event('hover:enter',{bubbles:true}));await wait(60);
  assert.equal(L.Activity.active().search,'サイバーパンク エッジランナーズ');
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
