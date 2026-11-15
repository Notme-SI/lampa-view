const test=require('node:test'),assert=require('node:assert/strict'),native=require('./fixtures/native-lampa.cjs'),until=require('./fixtures/until.cjs');
const movie={id:778801,source:'test',name:'Example',title:'Example',original_name:'Example',original_title:'Example',first_air_date:'2025-01-01',number_of_seasons:1,seasons:[{season_number:1,episode_count:3}],genres:[]};
const infohash='a'.repeat(40),canonical='btih:'+infohash;

test('native release marks survive a tracker-title change, late cloud reads and explicit unmarking',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  let row;
  async function open(title){
   row={Title:title,Tracker:'test',Size:1e9,Seeders:50,MagnetUri:'magnet:?xt=urn:btih:'+infohash,hash:L.Utils.hash(title)};
   L.Parser.get=(params,ok)=>w.setTimeout(()=>ok({Results:[row]}),0);
   L.Activity.push({component:'torrents',movie,search:'Example',url:'',page:1});
   await until(()=>L.Activity.active().activity.render(true).querySelector('.torrent-item .tc-info'),'release row');
   return L.Activity.active().activity.render(true).querySelector('.torrent-item');
  }
  const oldTitle='Example S01E01-E03 WEB-DL 1080p',oldHash=L.Utils.hash(oldTitle);
  L.Storage.set('torrents_view',[oldHash]);
  let item=await open(oldTitle);
  await until(()=>L.Storage.get('torrents_view',[]).includes(canonical),'verified infohash migration');
  assert.ok(item.querySelector('.torrent-item__viewed'));
  item=await open('Example (Season 1) Episodes 1-3 1080p');
  await until(()=>item.querySelector('.torrent-item__viewed'),'same distribution with another tracker title');
  L.Activity.active().activity.component.mark(row,w.jQuery(item),false);
  await until(()=>!item.querySelector('.torrent-item__viewed'),'explicit unmark');
  item=await open(oldTitle);await new Promise(r=>w.setTimeout(r,30));
  assert.equal(item.querySelector('.torrent-item__viewed'),null,'An old synced title alias cannot resurrect an explicit removal');
  L.Storage.set('torrents_view',[canonical]);
  await until(()=>item.querySelector('.torrent-item__viewed'),'late native CUB read updates mounted rows');
  L.Activity.active().activity.component.mark(row,w.jQuery(item),true);
  assert.ok(!L.Storage.get('torrents_view',[]).includes(canonical+':unseen'));
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('shared episode progress restores the history summary without inventing a distribution mark',async()=>{
 const n=await native({built:true}),{w,L}=n;
 try{
  const hash=L.Utils.hash('13Example');L.Timeline.update({hash,percent:95,time:0,duration:0});
  const row={Title:'Example S01E01-E03 1080p',Tracker:'test',Size:1e9,Seeders:50,hash:L.Utils.hash('new release'),MagnetUri:'magnet:?xt=urn:btih:'+infohash};
  L.Parser.get=(params,ok)=>w.setTimeout(()=>ok({Results:[row]}),0);
  L.Activity.push({component:'torrents',movie,search:'Example',url:'',page:1});
  await until(()=>/Серия 3/.test(L.Activity.active().activity.render(true).querySelector('.watched-history__body')?.textContent),'shared timeline history summary');
  assert.equal(L.Activity.active().activity.render(true).querySelector('.torrent-item__viewed'),null,'Episode progress alone cannot identify the played release');
  const item=w.jQuery('<div class="torrent-files"><div class="time-line"><div style="width:95%"></div></div></div>').appendTo(w.document.body),line=item.find('.time-line').attr('data-hash',hash)[0];
  L.Listener.send('torrent_file',{type:'render',item,element:{season:1,episode:3,timeline:L.Timeline.view(hash)},items:[],params:{movie}});
  await until(()=>line.classList.contains('pt-torrent-complete'),'native completed episode presentation').catch(e=>{throw new Error(e.message+' '+JSON.stringify({line:line.outerHTML,connected:line.isConnected,timeline:L.Timeline.view(hash),errors:n.errors}));});
  assert.equal(L.Timeline.view(hash).percent,95);assert.equal(L.Timeline.view(hash).time,0,'Showing completion must not fabricate watched seconds');
  L.Timeline.update({hash,percent:40,time:915,duration:2287});
  await until(()=>!line.classList.contains('pt-torrent-complete'),'partial progress stays factual');
  assert.equal(L.Timeline.view(hash).time,915);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
