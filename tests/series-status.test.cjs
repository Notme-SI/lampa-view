const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/series-status.js')],bundle:true,write:false,format:'iife',globalName:'SeriesStatus'}).outputFiles[0].text;
test('release counts belong to the latest aired season and do not count future episodes or specials',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'});try{d.window.eval(code);const api=d.window.SeriesStatus,episodes=[{season_number:0,episode_number:99,air_date:'2020-01-01'},{season_number:1,episode_number:10,air_date:'2020-01-01'},{season_number:2,episode_number:6,air_date:'2026-10-29'},{season_number:2,episode_number:7,air_date:'2026-11-05'}];
 assert.deepEqual({...api.releaseStatus({seasons:[{season_number:2,episode_count:10}]},episodes,'2026-10-30')},{season:2,count:6,total:10});assert.equal(api.releaseStatus({},[]),null);assert.equal(api.episodeLabel('6 - Эпизод 6'),'Серия 6');assert.equal(api.episodeLabel('Эпизод 8'),'Серия 8');
 }finally{d.window.close();}
});
test('focused series gets readable watch and release status, preserves native progress and shares metadata across duplicate cards',()=>{
 const d=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=d.window;try{w.eval(code);let requests=0;const table=[{season_number:2,episode_number:8,air_date:'2020-01-01'}],L={Utils:{hash:x=>x},Storage:{get:()=>({Original:{season:1,episode:6}})},TimeTable:{get:()=>table},Timeline:{view:()=>({time:969,percent:40})},Api:{sources:{tmdb:{get(path,p,ok){requests++;ok({id:7,seasons:[{season_number:2,episode_count:10}],last_episode_to_air:table[0]});}}}}};
 const api=w.SeriesStatus.default(L,node=>api.paint(node)),card=()=>{const n=w.document.createElement('div');n.className='card focus';n.innerHTML='<div class="card__view"><div class="card-watched"><div class="card-watched__item"><span>6 - Эпизод 6</span><div class="time-line"><div style="width:40%"></div></div></div></div></div>';w.document.body.appendChild(n);api.track(n,{id:7,name:'Сериал',original_title:'Original',media_type:'tv'});return n;};
 const one=card();api.paint(one);api.paint(one);const two=card();api.paint(two);
 assert.equal(one.querySelector('.pt-series-status').textContent,'Сезон 2 • Серия 8/10');assert.equal(one.querySelector('.card-watched .time-line>div').style.width,'40%');assert.equal(one.querySelector('.pt-series-status .time-line'),null);assert.equal(requests,1);assert.equal(one.querySelectorAll('.pt-series-status').length,1);assert.equal(one.querySelector('.card-watched__item > span').textContent,'6 - Эпизод 6','Native history is preserved');
 assert.equal(one.querySelector('.card__view .card-watched'),null,'Watch history cannot cover poster titles');assert.ok(one.querySelector('.pt-card-watch>.card-watched'));
 assert.equal(one.querySelector('.pt-card-watch__label').textContent,'Продолжить: Серия 6 • Сезон 1');assert.equal(one.querySelector('.pt-card-watch__time').textContent,'16:09');
 const timeline=one.querySelector('.time-line');api.paint(one);assert.equal(one.querySelector('.time-line'),timeline,'Move, never replace the native progress node');

 }finally{w.close();}
});

test('movie footer preserves native progress, has no release pill and ignores future timetable rows',()=>{
 const d=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=d.window;try{
  w.eval(code);let movieTime={time:969,percent:40};const api=w.SeriesStatus.default({Timeline:{watched:()=>movieTime}},()=>{}),node=w.document.createElement('div');
  node.className='card focus';node.innerHTML='<div class="card__view"><div class="card-watched"><div class="card-watched__item"><span>Просмотрено 16 м.</span><div class="time-line"><div style="width:40%"></div></div></div><div class="card-watched__item"><span>Осталось дней: 2</span></div></div></div>';w.document.body.appendChild(node);
  api.track(node,{media_type:'movie',title:'Фильм'});api.paint(node);api.paint(node);
  assert.equal(node.querySelector('.pt-series-status'),null);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Просмотрено');assert.equal(node.querySelector('.pt-card-watch__time').textContent,'16:09');assert.equal(node.querySelectorAll('.pt-card-watch__row').length,1);
  assert.equal(node.querySelectorAll('.pt-card-watch__current').length,1);assert.equal(node.querySelector('.pt-card-watch__current').textContent.includes('Осталось дней'),false);
  movieTime={time:2400,percent:100};api.paint(node);assert.ok(node.querySelector('.pt-card-watch--complete'));assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Фильм просмотрен');
  const empty=w.document.createElement('div');empty.className='card focus';empty.innerHTML='<div class="card__view"></div>';api.track(empty,{media_type:'movie',title:'Не смотрели'});api.paint(empty);assert.ok(empty.querySelector('.pt-card-watch'));assert.equal(empty.querySelector('.card-watched'),null,'No invented watch history');
 }finally{w.close();}
});

test('cleared storage hides cached native watch history even if native memory and episode labels remain stale',()=>{
 const d=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=d.window;try{
  w.eval(code);const saved={file_view:{'16Original':{time:900,percent:50}},online_watched_last:{Original:{season:1,episode:6}}};
  const L={Utils:{hash:x=>x},Storage:{get:key=>saved[key]},Timeline:{filename:()=> 'file_view',view:()=>({time:900,percent:50})}},api=w.SeriesStatus.default(L,()=>{}),node=w.document.createElement('div');
  node.className='card focus';node.innerHTML='<div class="card__view"><div class="card-watched"><div class="card-watched__item"><span>6 - Эпизод 6</span><div class="time-line" data-hash="16Original"><div style="width:50%"></div></div></div></div></div>';w.document.body.appendChild(node);api.track(node,{original_title:'Original',media_type:'tv'});api.paint(node);
  const wrap=node.querySelector('.card-watched');assert.equal(wrap.classList.contains('pt-card-watch--empty'),false);assert.equal(node.querySelector('.pt-card-watch__label').textContent,'Продолжить: Серия 6 • Сезон 1');
  saved.file_view['16Original']={percent:0,time:0};api.paint(node);assert.equal(wrap.classList.contains('pt-card-watch--empty'),true,'An old episode number is not proof of progress');
  saved.file_view['16Original']={percent:30,time:450};api.paint(node);assert.equal(wrap.classList.contains('pt-card-watch--empty'),false,'A new playback restores the caption');
  saved.file_view={};api.paint(node);assert.equal(wrap.classList.contains('pt-card-watch--empty'),true,'Global timecode reset overrides stale native timeline memory');
 }finally{w.close();}
});
