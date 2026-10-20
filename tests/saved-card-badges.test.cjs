const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('native legacy history/filter cards restore anime metadata, saved favorites preserve genres and removed grids are released',async()=>{
 const r=await native({built:true}),{w,L}=r,cards=[],requests=[];
 const details={
  601:{id:601,vote_average:8.9,genres:[{id:16}],original_language:'ja'},
  602:{id:602,vote_average:9.3,genres:[{id:16}],original_language:'ja'},
  603:{id:603,genres:[{id:18}],original_language:'ja'}
 };
 L.Api.sources.tmdb.get=(path,params,ok,fail)=>{requests.push(path);w.setTimeout(()=>{const id=path.match(/^(?:tv|movie)\/(\d+)/);if(id && details[id[1]])ok(details[id[1]]);else fail();},10);};
 function legacy(data,omitRating=false){
  const c=new L.Card(data,{});c.create();const node=c.render(true);if(omitRating)node.querySelectorAll('.card__vote').forEach(b=>b.remove());node.getBoundingClientRect=()=>({width:150,left:0,right:150,top:0,bottom:225});w.document.body.appendChild(node);cards.push(c);return node;
 }
 try{
  const series=legacy({id:601,name:'Anime series',original_name:'Anime Series',first_air_date:'2019-01-01',source:'tmdb',release_quality:'1080p'});
  const film=legacy({id:602,title:'Anime film',original_title:'Anime Film',release_date:'2025-01-01',genre_ids:[],source:'cub',release_quality:'WEB-DL'});
  const live=legacy({id:603,title:'Live action',release_date:'2025-01-01',source:'tmdb'});
  await wait(140);
  assert.equal(series.querySelector('.pt-kind').textContent,'Аниме');assert.equal(film.querySelector('.pt-kind').textContent,'Аниме');assert.equal(live.querySelector('.pt-kind'),null);
  assert.equal(series.querySelector('.pt-quality').textContent,'1080p');assert.equal(film.querySelector('.pt-quality').textContent,'WEB-DL');
  assert.equal(series.querySelector('.card__vote').textContent,'8.9');assert.equal(film.querySelector('.card__vote').textContent,'9.3');assert.equal(live.querySelector('.card__vote'),null);
  const continued=legacy({id:605,name:'Continue series',first_air_date:'2025-01-01',source:'tmdb',genre_ids:[18],vote_average:8.4},true);await wait(40);assert.equal(continued.querySelector('.card__vote').textContent,'8.4','Restore a known score when the continuation template omitted the badge');
  assert.equal(requests.length,3,'One metadata lookup per incomplete visible identity');
  w.document.dispatchEvent(new w.Event('scroll'));await wait(140);assert.equal(continued.querySelectorAll('.card__vote').length,1,'Do not duplicate ratings on visibility updates');assert.equal(requests.length,3,'Completed metadata is reused');
  const saved=L.Utils.clearCard({id:604,title:'Saved film',release_date:'2020-01-01',source:'tmdb',genres:[{id:16,name:'Animation'}],original_language:'ja'});
  assert.deepEqual(Array.from(saved.genre_ids),[16]);L.Favorite.add('book',saved);
  const favorite=legacy(L.Favorite.get({type:'book'}).find(card=>card.id===604));await wait(30);assert.equal(favorite.querySelector('.pt-kind').textContent,'Аниме');
  assert.equal(requests.length,3,'Normalized favorites need no metadata request');
  series.remove();await wait(0);series.getBoundingClientRect=()=>assert.fail('Removed legacy card is still tracked');w.document.dispatchEvent(new w.Event('scroll'));await wait(140);
  assert.deepEqual(r.errors,[]);
 }finally{cards.forEach(c=>c.destroy());r.close();}
});
