const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('home studio is decorative while the film details action stays available',async()=>{
 const n=await native({built:true}),{w,L}=n,$=w.jQuery,images=[],requests=[];
 try{
  Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected && !this.classList.contains('pt-hidden')?w.document.body:null;},configurable:true});
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));
  w.Image=class{constructor(){images.push(this);}set src(url){this.url=url;}get src(){return this.url;}decode(){return Promise.resolve();}};
  const get=L.Api.sources.tmdb.get;L.Api.sources.tmdb.get=(url,p,ok,fail)=>url.includes('append_to_response=images')?requests.push({url,ok}):get.call(L.Api.sources.tmdb,url,p,ok,fail);
  const root=$('<main><div class="items-line"></div></main>').appendTo(w.document.body),activity={render:()=>root};let enter;
  const line={use:api=>enter=api.onlyUp,toggle(){}};
  const card={id:812,title:'Фильм',source:'tmdb',overview:'Описание',release_date:'2026-01-01',backdrop_path:'/cover.jpg'};
  L.Listener.send('line',{type:'append',line,params:{object:{component:'main',activity}},data:{results:[card]}});await wait(30);
  requests[0].ok({images:{logos:[]},production_companies:[{id:33,name:'Studio',logo_path:'/studio.png'}]});images.filter(i=>/studio.png/.test(i.url)).forEach(i=>i.onload());await wait(30);root.find('.pt-hero__studio').trigger('load');
  const studio=root.find('.pt-hero__studio');assert.equal(studio.attr('role'),undefined);assert.equal(studio.attr('aria-label'),undefined);assert.equal(studio.hasClass('selector'),false);assert.equal(studio.attr('alt'),'Studio');let target;const push=L.Activity.push;L.Activity.push=p=>target=p;
  studio[0].click();studio.trigger('hover:enter');assert.equal(target,undefined,'Decorative studio cannot navigate');
  enter();assert.ok(root.find('.pt-hero__action').hasClass('focus'));L.Controller.enter();assert.equal(target.component,'full');assert.equal(target.id,812);L.Activity.push=push;assert.deepEqual(n.errors,[]);

 }finally{n.close();}
});
