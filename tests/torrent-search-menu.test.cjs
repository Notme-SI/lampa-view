const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

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
