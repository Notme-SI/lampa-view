const test=require('node:test'),assert=require('node:assert/strict'),C=require('../vendor/torrent-catalogue.js');
test('x-style season/episode ranges retain totals and cross-season bundles never become one-season episode ranges',()=>{
 for(const mark of ['x','х','×']){
  const p=C.parseTitle('Гангстерленд / MobLand [01'+mark+'01-07 из 10] (2025) UHD WEB-DL-HEVC 2160p');assert.deepEqual(p.seasons,[1]);assert.deepEqual(p.episodes,[1,2,3,4,5,6,7]);assert.equal(p.total,10);
 }
 const p=C.parseTitle('Show [1x01-2x07] 1080p');assert.deepEqual(p.seasons,[1,2]);assert.equal(p.bundle,true);assert.deepEqual(p.episodes,[]);
 for(const title of ['Film 1920x1080 16x9','Film 1280×720','Film 720x480'])assert.deepEqual(C.parseTitle(title).seasons,[],title);
 const model=C.describe({Title:'Гангстерленд / MobLand [01x01-07 из 10] (2025) UHD WEB-DL-HEVC 2160p'},C.catalogue({id:1,name:'Гангстерленд',original_name:'MobLand',seasons:[{season_number:1,episode_count:10,air_date:'2025-03-30'}]}));
 assert.equal(model.episodeLabel,'Серии 1-7 из 10');assert.equal(model.completeness,'partial');assert.ok(JSON.stringify(model).includes('Сезон 1'));
});
