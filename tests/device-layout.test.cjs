const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');

test('native desktop TV screen mode keeps original badges; actual TVs and manual choice retain compact sizes',async()=>{
 const r=await native({built:true}),{w,L}=r;
 const refresh=async()=>{w.dispatchEvent(new w.Event('resize'));await new Promise(resolve=>setTimeout(resolve,210));};
 try{
  assert.equal(L.Platform.screen('tv'),true,'Reproduce the broad native TV screen classification');
  assert.equal(L.Platform.tv(),false);assert.equal(w.LampaView.layout,'desktop');
  const card=w.document.createElement('div');card.className='card';card.innerHTML='<span class="pt-quality">4K</span><span class="pt-kind">Сериал</span><span class="card__vote">8.5</span><div class="card-watched"></div><div class="card__icons"><div class="card__icons-inner"><div class="card__icon icon--wath"></div></div></div><div class="card__marker card__marker--viewed"><span>Просмотрено</span></div><div class="card__title">Название</div><div class="card__age">2026</div>';w.document.body.appendChild(card);
  const sizes=()=>['.pt-quality','.pt-kind','.card__vote'].map(selector=>Number((parseFloat(w.getComputedStyle(card.querySelector(selector)).fontSize)/parseFloat(w.getComputedStyle(card).fontSize)).toFixed(3)));
  assert.deepEqual(sizes(),[.65,.6,.65]);
  const caption=()=>['.card__title','.card__age','.card__icons','.card__marker','.card-watched'].map(selector=>w.getComputedStyle(card.querySelector(selector)).fontSize);
  const desktop=caption(),cardWidth=w.getComputedStyle(card).width;
  L.Platform.tv=()=>true;await refresh();assert.equal(w.LampaView.layout,'tv');assert.deepEqual(sizes(),[.35,.32,.35]);
  assert.equal(w.getComputedStyle(card).width,cardWidth,'Badge sizing must not resize the poster');
  caption().forEach((size,i)=>assert.ok(parseFloat(size)<parseFloat(desktop[i]),'TV captions and watch indicators must be smaller'));
  card.classList.add('card--wide');assert.equal(w.getComputedStyle(card.querySelector('.card__title')).fontSize,.92*parseFloat(w.getComputedStyle(card).fontSize)+'px');card.classList.remove('card--wide');
  L.Platform.tv=()=>false;await refresh();assert.equal(w.LampaView.layout,'desktop');assert.deepEqual(sizes(),[.65,.6,.65]);
  assert.deepEqual(caption(),desktop,'Desktop captions and native watch indicators must retain their sizes');
  L.Storage.set('lampa_view_layout','tv');await refresh();assert.equal(w.LampaView.layout,'tv');
  assert.equal(w.getComputedStyle(card.querySelector('.card-watched')).transform,'scale(.7)');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
