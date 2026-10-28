const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('Trakt enable prompts for ID, keeps the native main-source selector and hides the ID field when disabled',async()=>{
 const n=await native({built:true}),{L,w}=n;try{
  L.Params.init();
  const params=()=>L.SettingsApi.getParam('minimal_settings_catalogue');
  assert.ok(params().some(row=>row.param.name==='minimal_trakt_enabled'));assert.ok(!params().some(row=>row.param.name==='minimal_trakt_client_id'));assert.equal(L.Params.values.source.trakt,undefined);
  L.Settings.create('minimal_settings_catalogue');let submit;L.Input.edit=(p,done)=>{assert.match(p.title,/Client ID/);submit=done;};
  const toggle=params().find(row=>row.param.name==='minimal_trakt_enabled');L.Storage.set('minimal_trakt_enabled',true);toggle.onChange();submit('public-test-id');assert.ok(params().some(row=>row.param.name==='minimal_trakt_client_id'));assert.equal(L.Storage.get('source'),'cub');
  L.Settings.create('more');const source=L.Settings.render().find('[data-name=source]');assert.equal(source.find('.settings-param__name').text(),'Основной источник');source.trigger('hover:enter');assert.deepEqual(Array.from(L.Select.render().find('.selectbox-item__title'),node=>node.textContent),['TMDB','CUB','Trakt']);
  L.Controller.back();L.Storage.set('source','trakt');L.Storage.set('minimal_trakt_enabled',false);toggle.onChange();assert.equal(L.Storage.get('source'),'cub');assert.equal(L.Params.values.source.trakt,undefined);assert.ok(!params().some(row=>row.param.name==='minimal_trakt_client_id'));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('Trakt category reports ready state to anime tabs and preserves collection customization',async()=>{
 const n=await native({built:true}),{L,w}=n;try{
  w.XMLHttpRequest=class{open(){}setRequestHeader(){}send(){w.setTimeout(()=>{this.status=200;this.responseText=JSON.stringify([{show:{title:'Anime',language:'ja',year:2022,ids:{tmdb:123,trakt:456}}}]);this.onload();},0);}getResponseHeader(){return '2';}abort(){this.onabort();}};
  L.Storage.set('minimal_trakt_enabled',true);L.Storage.set('minimal_trakt_client_id','public-test-id');L.Storage.set('minimal_anime_catalogue','standard');
  const object={source:'trakt',url:'anime'},rows=await new Promise((resolve,reject)=>L.Api.category(object,resolve,reject));assert.equal(object.minimal_catalogue_status.state,'ready');assert.equal(rows.length,2);assert.equal(rows[0].source,'trakt');assert.equal(rows[0].results[0].id,123);assert.ok(L.Storage.get('minimal_collection_rows_v2',{})['category:anime:standard'].some(row=>row.id.includes('shows/trending')));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
