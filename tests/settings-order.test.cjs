const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs');
test('settings separate daily controls from API services and hide automatic MPV integration',async()=>{
 const n=await native({built:true,initialStorage:{lampa_view_metadata:false}});try{const {L}=n;
  const groups=L.SettingsApi.getParam('lampa_view').filter(row=>row.param.type==='button');
  assert.deepEqual(Array.from(groups,row=>row.param.name),['appearance','catalogue','playback','languages','parser','services','server','cache'].map(id=>'minimal_settings_open_'+id));
  const rows=groups.flatMap(row=>L.SettingsApi.getParam(row.param.name.replace('_open_','_')));
  assert.ok(!rows.some(row=>row.param.name==='lampa_view_metadata'));assert.equal(new Set(rows.map(row=>row.param.name)).size,rows.length);
  assert.ok(rows.every(row=>!/[›»]$/.test(row.field.name)));assert.ok(rows.every(row=>String(row.field.description || '').trim().length>0));
  const services=L.SettingsApi.getParam('minimal_settings_services');assert.ok(services.some(row=>row.param.name==='minimal_kinoapi'));assert.ok(services.some(row=>row.param.name==='minimal_trakt_client_id'));assert.ok(!L.SettingsApi.getParam('minimal_settings_catalogue').some(row=>row.param.name==='minimal_kinoapi'));
  const appearance=L.SettingsApi.getParam('minimal_settings_appearance'),tint=appearance.find(row=>row.param.name==='lampa_view_artwork_tint');assert.equal(tint.param.default,'50');assert.deepEqual(Object.keys(tint.param.values),['0','25','50','75','100']);assert.ok(appearance.indexOf(tint)<appearance.findIndex(row=>row.param.name==='lampa_view_hero'));
  assert.ok(L.SettingsApi.getParam('minimal_settings_languages').some(row=>row.param.name==='alc_auto_fav_btn'));assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
