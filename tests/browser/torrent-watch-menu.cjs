const assert=require('node:assert/strict'),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),{setup}=require('../fixtures/native-browser.cjs');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{for(const mode of ['desktop','tv']){
 const r=await setup(browser,{viewport:mode==='tv'?{width:960,height:540}:{width:1440,height:900},deviceScaleFactor:mode==='tv'?2:1,mode}),{page}=r;
 await page.evaluate(()=>{
  const L=Lampa;L.DeviceInput.init();L.Controller.observe();Navigator.follow('focus',e=>L.Controller.focus(e.elem));
  const movie={id:400100,name:'Меню торрентов',original_name:'Torrent menu',original_title:'Torrent menu',first_air_date:'2020-01-01',number_of_seasons:2,seasons:[{season_number:1,episode_count:3},{season_number:2,episode_count:3}],source:'tmdb',genres:[]};
  const row={Title:'Меню торрентов / Torrent menu (2020) S02 WEB-DL 1080p',Tracker:'test',Size:1000000000,Seeders:50,Peers:10,MagnetUri:'magnet:?xt=urn:btih:0123456789012345678901234567890123456789'};
  L.Parser.get=(p,ok)=>setTimeout(()=>ok({Results:[row]}),0);L.Activity.push({component:'torrents',movie,search:'Torrent menu',url:''});
  L.Torserver.url=()=>true;L.Torserver.connected=ok=>ok();L.Torserver.hash=(p,ok)=>ok({hash:'0123456789012345678901234567890123456789'});L.Torserver.files=(hash,ok)=>ok({file_stats:Array.from({length:3},(_,i)=>({id:i+1,path:'Torrent.menu.S02E0'+(i+1)+'.mkv',length:1000000}))});L.Torserver.viewed=(hash,ok)=>ok([]);L.Torserver.stream=()=> 'http://localhost/stream';
  L.Api.seasons=(card,seasons,ok)=>ok({2:{episodes:[1,2,3].map(n=>({season_number:2,episode_number:n,name:'Серия '+n,air_date:'2020-01-01',runtime:45}))}});
  window.qaPlayed=0;L.Player.play=()=>qaPlayed++;window.qaMovie=movie;window.qaStartFiles=()=>L.Torrent.start(row,movie);
  L.Timeline.update({hash:L.Utils.hash('22Torrent menu'),time:600,duration:2700,percent:22});
 });
 await page.waitForSelector('.torrent-item.tc-item');await page.evaluate(()=>qaStartFiles());await page.waitForSelector('.torrent-files .torrent-serial');
 async function open(){await page.evaluate(()=>jQuery('.torrent-serial').eq(1).trigger('hover:long'));await page.getByText('Отметить серии 1–2 просмотренными',{exact:true}).waitFor();await page.waitForTimeout(240);}
 await open();await page.getByText('Отметить серии 1–2 просмотренными',{exact:true}).click();await page.waitForTimeout(240);
 const status=await page.evaluate(()=>({one:LampaView.online.reader(qaMovie)(2,1),two:LampaView.online.reader(qaMovie)(2,2),other:LampaView.online.reader(qaMovie)(1,1),played:qaPlayed}));assert.equal(status.one.percent,100);assert.equal(status.one.time,0);assert.equal(status.two.percent,100);assert.equal(status.two.time,600);assert.equal(status.other.percent,0);assert.equal(status.played,0);
 await open();assert.equal(await page.getByText('Снять отметку просмотра',{exact:true}).isVisible(),true);await page.getByText('Сезон и сериал…',{exact:true}).click();await page.waitForTimeout(240);await page.getByText('Очистить таймкоды текущего сезона',{exact:true}).click();await page.waitForTimeout(240);await page.getByText('Отмена',{exact:true}).click();await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>LampaView.online.reader(qaMovie)(2,2).time),600);
 await page.evaluate(()=>Lampa.Controller.back());await page.waitForTimeout(240);await page.getByText('Действия с видео…',{exact:true}).click();await page.waitForTimeout(240);const labels=await page.locator('.selectbox-item__title').allTextContents();assert.ok(labels.some(s=>s.includes('Запустить плеер')));assert.ok(!labels.some(s=>/Сбросить|Просмотрено/.test(s)));
 assert.deepEqual(r.errors,[]);await r.context.close();console.log(engine.name()+' '+mode+': torrent range, real time preservation, reset cancel and native playback actions passed');
 }}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
