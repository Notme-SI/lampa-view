const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const native=require('./fixtures/native-lampa.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('suggest integrates native search, selection, cache, settings and close cleanup',async()=>{
 const n=await native(),{w,L}=n;
 try{
  const manifest=L.Manifest.plugins,controllerAdd=L.Controller.add,settings=L.SettingsApi.getParam('minimal_settings_catalogue');
  assert.ok(settings.some(p=>p.param.name==='kino_suggest_status'));assert.ok(settings.some(p=>p.param.name==='kino_suggest_min_chars'));
  assert.ok(!L.SettingsApi.allComponents().kino_suggest_settings);
  const languages=L.SettingsApi.getParam('minimal_settings_languages');assert.equal(languages.find(p=>p.param.name==='alc_auto_langs').param.default,'ru');assert.equal(languages.find(p=>p.param.name==='alc_auto_autosubs').param.default,'forced');
  // Loading the standalone module again keeps a single set of hooks and styles.
  w.eval(fs.readFileSync(path.join(__dirname,'../vendor/suggest.js'),'utf8'));assert.equal(L.Controller.add,controllerAdd);assert.equal(L.Manifest.plugins,manifest);assert.equal(w.document.querySelectorAll('#kino-suggest-styles').length,1);
  const calls=[];w.AbortController=AbortController;w.fetch=(url,options)=>new Promise(resolve=>calls.push({url,options,resolve}));
  let sources;L.Search.listener.follow('sources',e=>sources=e.sources);L.Storage.set('keyboard_type','lampa');w.document.body.appendChild(L.Search.render(true));L.Search.open();
  const query=value=>sources.listener.send('search',{query:value});
  query('па');await wait(240);assert.equal(calls.length,0);
  query('паук');query('пауки');await wait(240);assert.equal(calls.length,1);assert.ok(calls[0].url.includes('q='+encodeURIComponent('пауки')));
  calls[0].resolve({ok:true,json:async()=>({data:[{title_ru:'Человек-паук'},{title_ru:'Человек-паук'},{title_ru:'<img src=x onerror=alert(1)>'},null,{title_ru:5}]})});await wait(30);
  assert.equal(w.document.querySelectorAll('.search-suggest-item').length,2);assert.equal(w.document.querySelectorAll('.search-suggest-item img').length,0);
  let selected;const sourceSearch=sources.search;sources.search=function(value,immediately){selected={value,immediately};return sourceSearch.apply(this,arguments);};
  w.jQuery('.search-suggest-item').first().trigger('hover:enter');assert.deepEqual(selected,{value:'Человек-паук',immediately:true});assert.ok(L.Storage.get('search_history',[]).includes('Человек-паук'));assert.equal(w.document.querySelector('.search__input').textContent,'Человек-паук');
  // A key press releases the short selection guard, just as native input does.
  w.jQuery(w.document).trigger('keydown');query('пауки');await wait(240);assert.equal(calls.length,1);assert.equal(w.document.querySelectorAll('.search-suggest-item').length,2);
  query('другой');await wait(240);assert.equal(calls.length,2);L.Search.close();assert.equal(calls[1].options.signal.aborted,true);
  calls[1].resolve({ok:true,json:async()=>({data:[{title_ru:'Поздний ответ'}]})});await wait(30);assert.equal(w.document.querySelectorAll('.search__suggests').length,0);
  L.Search.open();L.Storage.set('kino_suggest_status',false);query('пауки');await wait(240);assert.equal(calls.length,2);assert.equal(w.document.querySelectorAll('.search-suggest-item').length,0);L.Search.close();assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
