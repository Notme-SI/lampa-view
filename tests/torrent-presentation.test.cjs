const test=require('node:test'),assert=require('node:assert/strict'),C=require('../vendor/torrent-catalogue.js'),native=require('./fixtures/native-lampa.cjs');
const movie={id:247718,name:'Гангстерленд',title:'Гангстерленд',original_name:'MobLand',first_air_date:'2025-03-30',source:'tmdb',number_of_seasons:2,seasons:[{season_number:1,episode_count:10,air_date:'2025-03-30'},{season_number:2,episode_count:10,air_date:'2026-08-20'}],genres:[],img:'/poster.jpg'};
function release(){return {Title:'Гангстерленд / MobLand (2026) WEB-DL [H.264/720p] (сезон 2, серии 1-5 из 10) LostFilm, HDRezka, TVShows, Кубик в Кубе, NewComers, Red Head Sound, LE-Production',Tracker:'nnmclub',Size:24728274206,Seeders:185,Peers:39,PublishDate:'2026-09-20T12:00:00Z',MagnetUri:'magnet:?xt=urn:btih:0123456789012345678901234567890123456789',info:{quality:'1280x720',videotype:'H264',types:['HD','1280x720','RUS','ENG','KVK','LF','TVS','HDr','HDr 18+','NC','RHS','LE'],voices:['LostFilm','LF','HDRezka','HDr','TVShows','TVS','KVK','NC','RHS','LE-Production']},ffprobe:[{codec_type:'video',width:1280,height:720,codec_name:'h264'},{codec_type:'audio',codec_name:'eac3',channels:6,tags:{language:'rus',title:'LostFilm'}},{codec_type:'audio',codec_name:'ac3',channels:2,tags:{language:'eng',title:'Original'}},{codec_type:'subtitle',codec_name:'subrip',tags:{language:'jpn'}}]};}

test('release title languages become audio tags without treating subtitle labels as audio',()=>{
 assert.deepEqual(C.technical({Title:'Anime WEB-DL RUS/ENG/JPN Sub UKR'}).languages,['RU','EN','JA']);assert.deepEqual(C.technical({Title:'Anime WEBRip 2xUkr/Eng Sub Jap'}).languages,['UK','EN']);assert.deepEqual(C.technical({Title:'Anime WEB-DL Sub EN'}).languages,[]);assert.deepEqual(C.technical({Title:'Anime [RU/EN]'}).languages,['RU','EN']);
});

test('wrapped dubbing studio credits normalize without repeating the studio name',()=>{
 const row={Title:'Film WEB-DL 1080p DUB [MovieDalen]',info:{voices:['MovieDalen','Dub [MovieDalen]']},ffprobe:[{codec_type:'audio',tags:{title:'Dub [MovieDalen]',language:'rus'}}]};
 const meta=C.describe(row,C.catalogue({title:'Film'}));assert.deepEqual(meta.voices.names,['MovieDalen']);assert.deepEqual(meta.technical.languages,['RU']);
});
test('torrent presentation canonicalizes structured data and excludes source abbreviations from technical tags',()=>{
 const row=release(),before=JSON.stringify(row),m=C.describe(row,C.catalogue(movie));assert.equal(JSON.stringify(row),before);assert.equal(m.technical.quality,'720p');assert.equal(m.technical.dimensions,'1280×720');assert.deepEqual(m.technical.video,['H.264']);assert.deepEqual(m.technical.audio,['E-AC-3','AC-3']);assert.deepEqual(m.technical.languages,['RU','EN']);assert.deepEqual(m.technical.subtitles,['JA']);assert.ok(!m.technical.tags.some(v=>/1280|LF|HDr|KVK|RUS|ENG|^HD$/.test(v)));assert.equal(m.voices.names.filter(v=>v==='LostFilm').length,1);assert.ok(m.voices.names.includes('Кубик в Кубе'));assert.ok(!m.voices.names.some(v=>/^(LF|HDr|KVK|AC3|EAC3|Original|2 ch)$/.test(v)));assert.equal(m.episodeLabel,'Серии 1-5 из 10');assert.equal(m.completeness,'partial');
});

test('torrent banner replaces only the native sidebar, follows the online layout and keeps controls out of the artwork',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[release()]}),0);
  L.Activity.push({component:'torrents',movie:{...movie,backdrop_path:'/backdrop.jpg',production_countries:[{iso_3166_1:'US',name:'United States of America'}],overview:'Не дублировать описание'},search:'MobLand',url:''});await new Promise(r=>setTimeout(r,200));
  const root=L.Activity.active().activity.render(true).querySelector('.explorer'),banner=root.querySelector('.minimal-torrent-banner');assert.ok(banner);assert.ok(root.classList.contains('minimal-torrent-view'));assert.ok(!root.classList.contains('minimal-torrent-view--classic'));assert.ok(banner.textContent.includes('Гангстерленд'));assert.ok(banner.textContent.includes('2025'));assert.doesNotMatch(banner.textContent,/Не дублировать|Источник|Смотреть|Озвуч/);assert.equal(banner.querySelector('.selector,button,.nova-badge'),null);assert.equal(w.getComputedStyle(root.querySelector('.explorer__card')).display,'none');assert.ok(root.querySelector('.torrent-filter'));assert.ok(root.querySelector('.torrent-item .tc-info'));
  assert.match(banner.textContent,/2025, США/);L.Storage.set('nova_plus_mode','skin');L.Listener.send('activity',{type:'start'});await new Promise(r=>setTimeout(r,25));assert.ok(!root.classList.contains('minimal-torrent-view--classic'));assert.equal(root.querySelectorAll('.minimal-torrent-banner').length,1);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('remote opens torrent details with Right and OK and moves between releases without spatial navigation',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  w.Navigator.follow('focus',event=>L.Controller.focus(event.elem));L.Platform.screen=type=>type==='tv';Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{get(){return this.isConnected?w.document.body:null;},configurable:true});
  const one=release(),two=release();two.Title=two.Title.replace('720p','1080p');two.Seeders=55;
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[one,two]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:''});await new Promise(r=>setTimeout(r,200));
  const root=L.Activity.active().activity.render(true),rows=[...root.querySelectorAll('.torrent-item')];for(const row of rows)for(const node of [row,row.querySelector('.tc-info')]){Object.defineProperty(node,'offsetWidth',{value:150,configurable:true});Object.defineProperty(node,'offsetHeight',{value:50,configurable:true});}
  let starts=0;L.Torrent.start=()=>starts++;L.Controller.toggle('content');L.Controller.collectionFocus(rows[0],root);w.Navigator.canmove=()=>false;w.Navigator.move=()=>false;
  assert.equal(L.Controller.enabled().controller._tcInfoKeys,true,'torrent navigation wrapper');assert.ok(w.Navigator._collection.includes(rows[0].querySelector('.tc-info')),'details in collection');L.Controller.move('right');assert.equal(w.Navigator.getFocusedElement()===rows[0].querySelector('.tc-info'),true,'right focuses details');L.Controller.enter();assert.ok(w.document.querySelector('.tc-full-details'));assert.equal(starts,0);L.Controller.back();assert.equal(L.Controller.enabled().name,'content');assert.equal(w.Navigator.getFocusedElement()===rows[0].querySelector('.tc-info'),true,'back restores details');
  L.Controller.move('left');assert.equal(w.Navigator.getFocusedElement(),rows[0]);L.Controller.move('down');assert.equal(w.Navigator.getFocusedElement(),rows[1]);L.Controller.move('right');assert.equal(w.Navigator.getFocusedElement()===rows[1].querySelector('.tc-info'),true,'second details');L.Controller.move('up');assert.equal(w.Navigator.getFocusedElement(),rows[0]);assert.equal(starts,0);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('resolution, codec aliases and HDR keep distinct meanings and absent metadata stays absent',()=>{
 const m=C.technical({Title:'Movie WEB-DL 2160p HEVC HDR10+ Dolby Vision E-AC-3 5.1',info:{types:['4K','H265','HDr','RUS','noise']}});assert.equal(m.quality,'2160p');assert.deepEqual(m.video,['H.265']);assert.deepEqual(m.hdr,['HDR10+','Dolby Vision']);assert.deepEqual(m.audio,['E-AC-3']);assert.deepEqual(m.languages,[]);assert.ok(!m.tags.includes('noise'));assert.equal(C.technical({Title:'Movie',ffprobe:[{codec_type:'video',width:2560,height:1440,codec_name:'av1'}]}).quality,'1440p');assert.equal(C.technical({Title:'Movie',info:{quality:'720x304'}}).quality,'SD');assert.deepEqual(C.technical({Title:'Unknown'}).tags,[]);assert.deepEqual(C.describe({Title:'Кубик (2025) WEB-DL 1080p',info:{voices:['Кубик']}},C.catalogue({title:'Кубик',release_date:'2025-01-01'})).voices.names,[]);
});
test('rip names never invent a resolution; real frame sizes and parser resolution fields determine it',()=>{
 for(const source of ['TSRip','WEB-DLRip']){
  assert.equal(C.technical({Title:'Надежда (2026) '+source}).quality,'');
  assert.equal(C.technical({Title:'Надежда (2026) '+source}).source,source);
  for(const [width,height,expected] of [[720,304,'SD'],[1280,544,'720p'],[1920,800,'1080p']]){
   assert.equal(C.technical({Title:'Надежда (2026) '+source,info:{width,height}}).quality,expected);
  }
 }
 assert.equal(C.technical({Title:'Film WEB-DLRip',general:{resolution:'1920x800'}}).quality,'1080p');
 assert.equal(C.technical({Title:'Film TSRip',Resolution:'720p'}).quality,'720p');
 assert.equal(C.technical({Title:'Film WEB-DLRip',ffprobe:{streams:[{codec_type:'video',width:3000,height:4000,disposition:{attached_pic:1}},{codec_type:'video',width:1280,height:720}]}}).quality,'720p');
});

test('camera rip labels are recognized without inventing resolution and fallback film headings are not repeated as tags',async()=>{
 for(const [raw,expected]of [['TSRip','TSRip'],['TS-Rip','TSRip'],['HDTS','HDTS'],['HDCAM','HDCAM'],['CAMRip','CAMRip'],['TeleSync','TS'],['TCRip','TCRip'],['DVDScr','DVDScr'],['WEB-DL-Rip','WEB-DLRip']]){const tech=C.technical({Title:'Film (2026) '+raw+' [H.264]'});assert.equal(tech.source,expected);assert.equal(tech.quality,'');}
 const n=await native({built:true}),{w,L}=n;try{
  const releases=['TSRip','WEB-DLRip','WEB-DLRip 1080p'].map((rip,i)=>({Title:'Film (2026) '+rip+' [H.264]',Tracker:'test',Size:(i+1)*1000000000,Seeders:20-i}));
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:releases}),0);L.Activity.push({component:'torrents',movie:{id:998,title:'Film',original_title:'Film',release_date:'2026-01-01',source:'tmdb'},search:'Film',url:''});await new Promise(r=>setTimeout(r,200));
  const rows=[...L.Activity.active().activity.render(true).querySelectorAll('.tc-row')];assert.equal(rows.length,3);
  for(const [i,heading]of ['TSRip','WEB-DLRip','1080p'].entries()){assert.equal(rows[i].querySelector('.tc-season').textContent,heading);const tags=rows[i].querySelector('.tc-tags').textContent;assert.ok(tags.includes('H.264'));assert.equal(tags.includes(i?'WEB-DLRip':'TSRip'),i===2);}
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('film translation credits expose MovieDalen and dubbing without treating the rip author as an audio studio',()=>{
 const film={title:'Человек-паук: Новый день',original_title:'Spider-Man: Brand New Day',release_date:'2026-07-29'},cat=C.catalogue(film);
 for(const author of ['селезень','ELEKTRI4KA']){const row={Title:'Человек-паук: Новый день / Spider-Man: Brand New Day (2026) WEB-DLRip от '+author+' | D | MovieDalen',info:{voices:[author]}};const m=C.describe(row,cat);assert.deepEqual(m.voices.names,['MovieDalen']);assert.deepEqual(m.voices.types,['Дубляж']);assert.equal(m.voices.author,author);assert.equal(m.technical.quality,'');assert.equal(m.technical.source,'WEB-DLRip');}
 assert.deepEqual(C.describe({Title:'D (2026) WEB-DL 1080p'},C.catalogue({title:'D',release_date:'2026-01-01'})).voices.types,[]);
});

test('resolution also comes from MediaInfo, serialized ffprobe and exact duplicate metadata',()=>{
 assert.equal(C.technical({Title:'Film WEB-DLRip',MediaInfo:{media:{track:[{'@type':'General',Width:'4000',Height:'4000'},{'@type':'Video',Width:'1 920 pixels',Height:'800 pixels'}]}}}).quality,'1080p');
 assert.equal(C.technical({Title:'Film WEB-DLRip',ffprobe:JSON.stringify({streams:[{codec_type:'video',width:1280,height:544}]})}).quality,'720p');
 const uri='magnet:?xt=urn:btih:0123456789012345678901234567890123456789',one={Title:'Film WEB-DLRip',MagnetUri:uri,Tracker:'a'},two={Title:'Film WEB-DLRip',MagnetUri:uri,Tracker:'b',info:{width:1920,height:800}},merged=C.merge([[one],[two]]);assert.equal(merged.length,1);assert.equal(C.technical(merged[0]).quality,'1080p');assert.equal(C.technical(one).quality,'');
 const separate=C.merge([[one],[{...two,MagnetUri:'magnet:?xt=urn:btih:9999999999999999999999999999999999999999'}]]);assert.equal(separate.length,2);assert.equal(C.technical(separate[0]).quality,'');
});

test('animated films use film quality while animated series retain season headings',()=>{
 for(const minimal_anime of [false,true]){const film={title:'Название',original_title:'Title',original_name:'Legacy name',media_type:'movie',release_date:'2026-01-01',minimal_anime,genres:[{id:16}]},row={Title:'Название / Title (2026) WEB-DL 1080p'};assert.equal(C.catalogue(film).tv,false);assert.equal(C.describe(row,C.catalogue(film)).seasonLabel,'');assert.equal(C.describe(row,C.catalogue(film)).technical.quality,'1080p');const series={...film,media_type:'tv',number_of_seasons:1,seasons:[{season_number:1,episode_count:8}]};assert.equal(C.catalogue(series).tv,true);assert.match(C.describe({...row,Title:row.Title+' S01E01-08'},C.catalogue(series)).seasonLabel,/Сезон/);}
});
test('native film rows show explicit audio credits, estimated bitrate and the source title after the date',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  const film={id:969681,title:'Человек-паук: Новый день',original_title:'Spider-Man: Brand New Day',release_date:'2026-07-29',source:'tmdb',runtime:145,genres:[],img:'/poster.jpg'},row={Title:'Человек-паук: Новый день / Spider-Man: Brand New Day (2026) WEB-DLRip от ELEKTRI4KA | D | MovieDalen',Tracker:'rutor',PublishDate:'2026-10-05T12:00:00Z',Size:2340757176,Seeders:699,Peers:86,info:{voices:['ELEKTRI4KA']}};
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[row]}),0);L.Activity.push({component:'torrents',movie:film,search:film.original_title,url:''});await new Promise(r=>setTimeout(r,180));const preview=L.Activity.active().activity.render(true).querySelector('.tc-row');assert.ok(preview);assert.equal(preview.querySelector('.tc-voice-names').textContent,'MovieDalen');assert.equal(preview.querySelector('.tc-tag--translation').textContent,'Дубляж');assert.ok(preview.querySelector('.tc-right .tc-bitrate').textContent.includes('Мбит/с'));assert.doesNotMatch(preview.querySelector('.tc-bitrate').textContent,/≈/);assert.ok(!(preview.querySelector('.tc-technical-tags')?.textContent || '').includes('Мбит/с'));assert.equal(preview.querySelector('.tc-season').textContent,'WEB-DLRip');assert.ok(preview.querySelector('.tc-source').textContent.includes('2026-10-05 · '+row.Title));preview.querySelector('.tc-info').click();assert.ok(w.document.querySelector('.tc-full-details').textContent.includes('Релиз от'));assert.ok(w.document.querySelector('.tc-full-details').textContent.includes('ELEKTRI4KA'));L.Controller.back();assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
test('native torrent rows omit the repeated title, details work by mouse and remote menu, and playback keeps its torrent',async()=>{
 const n=await native({built:true}),{w,L}=n;try{
  const row=release(),other=release();other.Title='Гангстерленд / MobLand (1 сезон: 1-10 серии из 10) WEB-DLRip (LostFilm)';other.info={quality:'720x304',videotype:'MPEG4',types:['SD','720x304','LostFilm','2 ch'],voices:['LostFilm']};other.ffprobe=[{codec_type:'video',width:720,height:304,codec_name:'mpeg4'},{codec_type:'audio',codec_name:'ac3',channels:2,tags:{language:'rus',title:'LostFilm'}}];other.Seeders=267;other.MagnetUri=row.MagnetUri+'0';
  L.Parser.get=(p,ok)=>w.setTimeout(()=>ok({Results:[row,other]}),0);L.Activity.push({component:'torrents',movie,search:'MobLand',url:''});await new Promise(r=>setTimeout(r,200));
  const root=L.Activity.active().activity.render(true),items=[...root.querySelectorAll('.torrent-item')];assert.equal(items.length,2);const first=items.find(i=>i.textContent.includes('23.03')),preview=first.querySelector('.tc-row');assert.ok(preview);assert.ok(!preview.querySelector('.tc-head').textContent.includes('Гангстерленд'));assert.ok(!preview.querySelector('.tc-head').textContent.includes('MobLand'));assert.equal(preview.querySelector('.tc-release-name').textContent,' · '+row.Title);assert.ok(preview.querySelector('.tc-source').textContent.indexOf('2026-09-20')<preview.querySelector('.tc-source').textContent.indexOf(row.Title));assert.equal(first.querySelectorAll('.tc-title,.tc-original').length,0);assert.ok(preview.textContent.includes('Сезон 2'));assert.ok(preview.textContent.includes('Серии 1-5 из 10'));assert.equal(preview.querySelectorAll('.tc-tag--quality').length,1);assert.equal(preview.querySelector('.tc-tag--quality').textContent,'720p');assert.ok(!preview.querySelector('.tc-tags').textContent.includes('1280'));const voiceNames=preview.querySelector('.tc-voice-names');for(const studio of ['LostFilm','HDRezka','TVShows','Кубик в Кубе','NewComers','Red Head Sound','LE-Production'])assert.ok(voiceNames.textContent.includes(studio),studio);assert.doesNotMatch(voiceNames.textContent,/\+\d/);assert.equal(preview.querySelector('.tc-label'),null);assert.ok(!preview.querySelector('.tc-voices').textContent.includes('Озвучка'));assert.equal(w.getComputedStyle(voiceNames).whiteSpace,'normal');assert.equal(w.getComputedStyle(voiceNames).overflow,'visible');assert.equal(w.getComputedStyle(first.querySelector('.torrent-item__title')).display,'none');assert.equal(first.querySelectorAll('.tc-row .selector').length,1,'remote can focus the details button');
  const video=preview.querySelector('.tc-tag-group--video'),audio=preview.querySelector('.tc-tag-group--audio'),subs=preview.querySelector('.tc-tag-group--subtitles');
  assert.match(video.textContent,/WEB-DL.*H\.264/);assert.doesNotMatch(video.textContent,/AC-3|LostFilm/);
  assert.match(audio.textContent,/E-AC-3.*AC-3.*5\.1/);assert.doesNotMatch(audio.textContent,/RU|EN|JA/);assert.match(preview.querySelector('.tc-tag-group--dubbing').textContent,/RU \/ EN/);assert.doesNotMatch(audio.textContent,/H\.264|LostFilm/);
  assert.equal(subs.textContent,'СубтитрыJA');assert.ok(preview.querySelector('.tc-language-tags .tc-tag--translation'));assert.ok(!preview.querySelector('.tc-technical-tags .tc-tag--translation'));assert.ok(preview.querySelector('.tc-language-tags').compareDocumentPosition(preview.querySelector('.tc-technical-tags')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  let starts=0,selected;L.Torrent.start=(data)=>{starts++;selected=data;};first.querySelector('.tc-info').click();assert.equal(starts,0);assert.ok(w.document.querySelector('.tc-full-details').textContent.includes(row.Title));assert.ok(w.document.querySelector('.tc-full-details').textContent.includes('1280×720'));assert.ok(w.document.querySelector('.tc-full-details').textContent.includes('Red Head Sound'));assert.ok([...w.document.querySelectorAll('.tc-full-details dt')].some(el=>el.textContent==='Аудио'));assert.ok(![...w.document.querySelectorAll('.tc-full-details dt')].some(el=>el.textContent==='Озвучки'));L.Controller.back();assert.equal(w.document.querySelector('.tc-full-details'),null);
  let menu;const show=L.Select.show;L.Select.show=o=>{menu=o;return show.call(L.Select,o);};first.dispatchEvent(new w.CustomEvent('hover:long',{bubbles:true}));assert.ok(menu.items.some(i=>i.mark));assert.ok(menu.items.some(i=>i.tomy));menu.items.find(i=>i.tcDetails).onSelect();assert.ok(w.document.querySelector('.tc-full-details'));L.Controller.back();assert.equal(L.Controller.enabled().name,'content');
  first.dispatchEvent(new w.CustomEvent('hover:enter',{bubbles:true}));assert.equal(starts,1);assert.equal(selected.MagnetUri,row.MagnetUri);assert.equal(selected.Title,row.Title);assert.equal(selected.Size,row.Size);await new Promise(r=>setTimeout(r,20));assert.equal(first.querySelectorAll('.tc-row').length,1);assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
