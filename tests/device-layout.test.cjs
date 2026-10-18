const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');

test('native desktop TV screen mode keeps original badges; actual TVs and manual choice retain compact sizes',async()=>{
 const r=await native({built:true}),{w,L}=r;
 const refresh=async()=>{w.dispatchEvent(new w.Event('resize'));await new Promise(resolve=>setTimeout(resolve,210));};
 try{
  assert.equal(L.Platform.screen('tv'),true,'Reproduce the broad native TV screen classification');
  assert.equal(L.Platform.tv(),false);assert.equal(w.LampaView.layout,'desktop');
  const card=w.document.createElement('div');card.className='card';card.innerHTML='<span class="pt-quality">4K</span><span class="pt-kind">Сериал</span><span class="card__vote">8.5</span><div class="card-watched"></div>';w.document.body.appendChild(card);
  const sizes=()=>['.pt-quality','.pt-kind','.card__vote'].map(selector=>Number((parseFloat(w.getComputedStyle(card.querySelector(selector)).fontSize)/parseFloat(w.getComputedStyle(card).fontSize)).toFixed(3)));
  assert.deepEqual(sizes(),[.65,.6,.65]);
  L.Platform.tv=()=>true;await refresh();assert.equal(w.LampaView.layout,'tv');assert.deepEqual(sizes(),[.44,.4,.44]);
  L.Platform.tv=()=>false;await refresh();assert.equal(w.LampaView.layout,'desktop');assert.deepEqual(sizes(),[.65,.6,.65]);
  L.Storage.set('lampa_view_layout','tv');await refresh();assert.equal(w.LampaView.layout,'tv');
  assert.equal(w.getComputedStyle(card.querySelector('.card-watched')).transform,'scale(.7)');assert.deepEqual(r.errors,[]);
 }finally{r.close();}
});
