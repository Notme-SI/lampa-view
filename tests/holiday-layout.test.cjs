const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');

test('late seasonal decorations survive theme refresh and use scoped rules without replacing their native actions',async()=>{
 let apply;
 const n=await native({built:true,prepare(w,L){const add=L.SettingsApi.addParam;L.SettingsApi.addParam=function(option){if(option.param.name==='lampa_view_enabled')apply=option.onChange;return add.apply(this,arguments);};}}),{w,L}=n,$=w.jQuery;
 try{
  const head=L.Head.render();if(!head[0].isConnected)head.appendTo(w.document.body);
  head.find('.head__logo-icon').replaceWith('<div class="head__logo-icon head__logo-halloween"><div class="head__logo-halloween-fire"></div><div class="head__logo-halloween-svg"><svg viewBox="0 0 512 494"><path d="M0 0h20v20z"/></svg></div></div>');
  let opens=0;head.find('.head__logo-halloween').on('mousedown',()=>opens++);
  apply();assert.equal(head.find('.head__logo-halloween-svg svg').length,1);head.find('.head__logo-halloween').trigger('mousedown');assert.equal(opens,1);
  head.find('.head__logo-icon').replaceWith('<div class="head__logo-icon"><span class="pt-brand">LAMPA</span><div class="head__logo-cap"><svg viewBox="0 0 24 24"></svg></div></div>');
  apply();apply();assert.equal(head.find('.head__logo-cap').length,1);assert.equal(head.find('.pt-brand').text(),'LAMPA');
  L.Storage.set('lampa_view_enabled',false);apply();assert.equal(head.find('.head__logo-cap').length,1);L.Storage.set('lampa_view_enabled',true);apply();assert.equal(head.find('.head__logo-cap').length,1);
  for(const name of ['halloween','black-friday','new-year','womens_day']){
   const button=$('<div class="head__action head__settings selector '+name+'__button"><svg viewBox="0 0 24 24"></svg></div>').appendTo(head.find('.head__actions'));
   button.on('hover:enter',()=>opens++);assert.equal(w.getComputedStyle(button[0]).display,'flex');button.trigger('hover:enter');
  }
  assert.equal(opens,5);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
