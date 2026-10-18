const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/identity.cjs');
const card={id:1396,name:'Во все тяжкие',original_name:'Breaking Bad',first_air_date:'2008-01-20',source:'tmdb',external_ids:{imdb_id:'tt0903747'}};
test('card title and IDs beat a technical filename',()=>{
  const i=C.identity(card,{url:'http://localhost/stream',title:'abc.m3u8',season:2,episode:3});
  assert.equal(i.title,'Во все тяжкие');assert.equal(i.original_title,'Breaking Bad');
  assert.equal(i.tmdb_id,1396);assert.equal(i.imdb_id,'tt0903747');assert.equal(i.season,2);assert.equal(i.episode,3);
});
test('unknown TV coordinates are never defaulted to season 1 / episode 1',()=>{
  const i=C.identity(card,{title:'stream'});assert.equal(i.kind,'tv');assert.equal(i.season,undefined);assert.equal(i.episode,undefined);
});
test('specials season zero and numeric strings survive',()=>{
  const i=C.identity(card,{season:'0',episode:'2'});assert.equal(i.season,0);assert.equal(i.episode,2);
});
test('episode object and explicit fields outrank a parsed label',()=>{
  const i=C.identity(card,{title:'S01E01',episode:{episode_number:8,season_number:4,name:'Финал'}});
  assert.equal(i.season,4);assert.equal(i.episode,8);assert.equal(i.episode_title,'Финал');
});
test('another catalogue ID is never interpreted as TMDB',()=>{
  const i=C.identity({...card,source:'kinopoisk'},{season:2,episode:3});assert.equal(i.tmdb_id,undefined);
});
test('movie title with episode words stays a movie',()=>{
  const i=C.identity({id:11,title:'Звёздные войны: Эпизод 4',original_title:'Star Wars',release_date:'1977-05-25'},{title:'Episode 4'});
  assert.equal(i.kind,'movie');assert.equal(i.episode,undefined);
});
test('a movie provider using a season-zero placeholder cannot change the card media type',()=>{
  const i=C.identity({id:11,title:'Star Wars',media_type:'movie'},{season:0,episode:1});
  assert.equal(i.kind,'movie');assert.equal(i.season,undefined);assert.equal(i.episode,undefined);
});
test('Russian episode labels are supported without parsing release years as episodes',()=>{
  assert.deepEqual(C.episodeFromTitle('Сезон 2, серия 11'),{season:2,episode:11});
  assert.equal(C.episodeFromTitle('Release.2025.1080p').episode,null);
});
test('playlist metadata follows the item, not the initial episode',()=>{
  const a={url:'http://host/one',season:2,episode:7};const b={url:'http://host/two',season:2,episode:8};
  const ctx=C.context(card,a,[a,b]);assert.equal(ctx.entries.length,2);assert.equal(ctx.entries[1].identity.episode,8);
});
test('only HTTP media URLs cross the bridge and environment size is bounded',()=>{
  const ctx=C.context(card,{url:'--script=bad'},Array.from({length:100},(_,i)=>({url:'http://host/'+i+'?key='+'x'.repeat(1000),episode:i+1})));
  assert.ok(JSON.stringify(ctx).length<26000);assert.ok(ctx.entries.length<40);assert.ok(ctx.entries.every(e=>e.url.startsWith('http')));
});
