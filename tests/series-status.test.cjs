const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/series-status.js')],bundle:true,write:false,format:'iife',globalName:'SeriesStatus'}).outputFiles[0].text;
test('release counts belong to the latest aired season and do not count future episodes or specials',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'});try{d.window.eval(code);const api=d.window.SeriesStatus,episodes=[{season_number:0,episode_number:99,air_date:'2020-01-01'},{season_number:1,episode_number:10,air_date:'2020-01-01'},{season_number:2,episode_number:6,air_date:'2026-10-29'},{season_number:2,episode_number:7,air_date:'2026-11-05'}];
 assert.deepEqual({...api.releaseStatus({seasons:[{season_number:2,episode_count:10}]},episodes,'2026-10-30')},{season:2,count:6,total:10});assert.equal(api.releaseStatus({},[]),null);assert.equal(api.episodeLabel('6 - Эпизод 6'),'Серия 6');assert.equal(api.episodeLabel('Эпизод 8'),'Серия 8');
 }finally{d.window.close();}
});
test('focused series gets readable watch and release status, preserves native progress and shares metadata across duplicate cards',()=>{
 const d=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=d.window;try{w.eval(code);let requests=0;const table=[{season_number:2,episode_number:8,air_date:'2020-01-01'}],L={Utils:{hash:x=>x},Storage:{get:()=>({Original:{season:2,episode:6}})},TimeTable:{get:()=>table},Api:{sources:{tmdb:{get(path,p,ok){requests++;ok({id:7,seasons:[{season_number:2,episode_count:10}],last_episode_to_air:table[0]});}}}}};
 const api=w.SeriesStatus.default(L,node=>api.paint(node)),card=()=>{const n=w.document.createElement('div');n.className='card focus';n.innerHTML='<div class="card__view"><div class="card-watched"><div class="card-watched__item"><span>6 - Эпизод 6</span><div class="time-line"><div style="width:40%"></div></div></div></div></div>';w.document.body.appendChild(n);api.track(n,{id:7,name:'Сериал',original_title:'Original',media_type:'tv'});return n;};
 const one=card();api.paint(one);api.paint(one);const two=card();api.paint(two);
 assert.equal(one.querySelector('.pt-series-status__episode').textContent,'Сезон 2 · Серия 6');assert.match(one.querySelector('.pt-series-status__released').textContent,/Вышло 8 из 10/);assert.equal(one.querySelector('.pt-series-status .time-line>div').style.width,'40%');assert.equal(requests,1);assert.equal(one.querySelectorAll('.pt-series-status').length,1);assert.equal(one.querySelector('.card-watched span').textContent,'6 - Эпизод 6','Native history is preserved');
 }finally{w.close();}
});
