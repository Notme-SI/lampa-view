const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bridge = require('../plugins/mpvplus-ios.js');

function runBridge(code,context) {
    context.navigator=Object.assign({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)'},context.navigator);
    return vm.runInNewContext(code,context);
}

const url = index => `http://192.168.1.20:8090/stream?link=${'a'.repeat(40)}&index=${index}&play`;

test('Lampa selected episode and all exact TorrServer indexes survive roundtrip', () => {
    const items = [1,2,3].map(i => ({url:url(i),title:`[S1:E${i}] Серия ${i}`,season:1,episode:i}));
    const document = bridge.build({...items[1],timeline:{time:123},voice_name:'TVShows'}, items, {id:95479,name:'Магическая битва',poster_path:'/poster.jpg'});
    assert.equal(document.items.length,3); assert.equal(document.selected,1);
    assert.equal(document.items[1].startPosition,123); assert.equal(document.items[1].voice,'TVShows');
    assert.equal(document.items[0].tmdbID,95479); assert.equal(document.items[2].episode,3);
    const encoded = new URL(bridge.appURL(document)).searchParams.get('data');
    assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')),document);
    assert.equal(document.items[1].url,url(2));
});

test('chosen quality, subtitles, and Unicode query are not dropped', () => {
    const item = {url:'https://video.test/low',quality:{'1080p':'https://video.test/high?token=a%2Bb&file=2'},title:'Пан или пропал',subtitles:[{url:'https://video.test/sub.ass',label:'Русский'}]};
    const doc = bridge.build(item,[item],{title:'Фильм'}, {quality:q=>q['1080p']});
    assert.equal(doc.items[0].url,'https://video.test/high?token=a%2Bb&file=2');
    assert.equal(doc.items[0].subtitles[0].title,'Русский'); assert.equal(doc.selected,0);
});

test('missing selected item is kept without losing other episodes', () => {
    const doc = bridge.build({url:url(7),title:'Серия 7'},[{url:url(1),title:'Серия 1'}],{});
    assert.equal(doc.items.length,2); assert.equal(doc.selected,0); assert.equal(doc.items[0].url,url(7));
});

test('unsafe schemes, duplicate stream entries and separators do not enter playlist', () => {
    assert.throws(()=>bridge.build({url:'javascript:alert(1)'},[],{}));
    const doc = bridge.build({url:url(1)},[{url:url(1)},{url:url(1)},{url:url(2),separator:true},{url:'file:///secret'}],{});
    assert.equal(doc.items.length,1);
    assert.ok(!doc.items[0].season); assert.ok(!doc.items[0].episode);
});

test('playlist is never silently truncated to the former 10 or 40 entries', () => {
    const items = Array.from({length:100},(_,i)=>({url:url(i+1),title:`Серия ${i+1}`}));
    assert.equal(bridge.build(items[99],items,{}).items.length,100);
    assert.equal(bridge.build(items[99],items,{}).selected,99);
    assert.throws(()=>bridge.build({url:url(201)},Array.from({length:201},(_,i)=>({url:url(i+1)})),{}),/200/);
});

test('non-TMDB cards never leak an unrelated source ID as TMDB', () => {
    const doc = bridge.build({url:url(1)},[],{id:38000,source:'shikimori',name:'Аниме'});
    assert.equal(doc.items[0].tmdbID,undefined); assert.equal(doc.items[0].malID,undefined);
});

test('torrent quality labels are metadata, and serial cards with a display title remain series',()=>{
    const document=bridge.build({url:url(1),quality:'1080p'},[],{title:'Гангстерленд',name:'Гангстерленд',first_air_date:'2025-03-30'},{quality(){assert.fail('a resolution label is not a quality URL map');}});
    assert.equal(document.items[0].url,url(1));assert.equal(document.items[0].mediaType,'tv');
});

test('default torrent player migration is silent and runs only once across page reloads',()=>{
    const storage={player:'mpvplus',player_torrent:'inner'},source=fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8');
    function reload(){
        const Lampa={Params:{values:{player:{inner:'Inner'},player_torrent:{inner:'Inner'}},defaults:{},select(k,v){this.values[k]=v}},Player:{play(){},playlist(){}},Storage:{get:(k,d)=>storage[k]??d,field:k=>storage[k],set:(k,v)=>storage[k]=v},Select:{show(){},hide(){}},Listener:{follow(){}},Noty:{show:assert.fail}};
        const context={Lampa,URL,Blob,alert:assert.fail};context.window=context;runBridge(source,context);
    }
    reload();assert.equal(storage.player_torrent,'mpvplus');storage.player_torrent='inner';reload();assert.equal(storage.player_torrent,'inner');
});

test('browser bridge captures playlist before a user-gesture launch and preserves native fallback', () => {
    let timer, dialog, launched, originalCalls=0;
    const values = {};
    const Lampa = {
        Player:{play(){originalCalls++},playlist(){originalCalls++}},
        Storage:{get:(key,fallback)=>key in values?values[key]:fallback,set:(k,v)=>values[k]=v},
        Noty:{show(){}}, Activity:{active:()=>({movie:{name:'Тест',id:12}})},
        Select:{show:d=>dialog=d,hide(){}}, Controller:{toggle(){}}, Listener:{follow(){}},SettingsApi:{addParam(){}}
    };
    const context={Lampa, URL, Blob, btoa:s=>Buffer.from(s,'binary').toString('base64'), setTimeout:fn=>timer=fn,
        location:{assign:u=>launched=u}, alert:assert.fail};
    context.window=context;
    runBridge(fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8'),context);
    context.MPVPlusLampa.enable();
    const items=[{url:url(1),title:'Серия 1'},{url:url(2),title:'Серия 2'}];
    Lampa.Player.play(items[1]);Lampa.Player.playlist(items);
    assert.equal(originalCalls,0);assert.equal(launched,undefined);
    timer();assert.equal(dialog.items[0].title,'Открыть в mpv+');
    dialog.onSelect(dialog.items[0]);assert.match(launched,/^mpvplus:\/\/playlist\?data=/);
    const doc=JSON.parse(Buffer.from(new URL(launched).searchParams.get('data'),'base64url').toString('utf8'));
    assert.equal(doc.selected,1);assert.equal(doc.items.length,2);
    dialog.onSelect(dialog.items[1]);assert.equal(originalCalls,2);
    values.mpvplus_ios=false;Lampa.Player.play(items[0]);assert.equal(originalCalls,3);
});

test('mpv+ is registered in the native Lampa player lists without removing existing options', () => {
    let nativeCalls=0,timer;
    const storage={player:'infuse',player_torrent:'infuse'};
    const params={values:{player:{inner:'Встроенный',infuse:'Infuse'},player_torrent:{inner:'Встроенный',vlc:'VLC'}},defaults:{player:'inner',player_torrent:'inner'},select(key,values){this.values[key]=values}};
    const Lampa={Params:params,Player:{play(){nativeCalls++},playlist(){}},Storage:{get:(k,d)=>k in storage?storage[k]:d,field:k=>storage[k],set:(k,v)=>storage[k]=v},Select:{show(){},hide(){}},Noty:{show(){}},Listener:{follow(){}}};
    const context={Lampa,URL,Blob,setTimeout:fn=>timer=fn,alert:assert.fail};context.window=context;
    runBridge(fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8'),context);
    assert.equal(params.values.player.infuse,'Infuse');assert.equal(params.values.player.mpvplus,'mpv+');
    assert.equal(params.values.player_torrent.vlc,'VLC');assert.equal(storage.player_torrent,'infuse');
    context.MPVPlusLampa.enable();assert.equal(storage.player_torrent,'mpvplus');
    Lampa.Player.play({url:url(1)});assert.equal(nativeCalls,0);assert.equal(typeof timer,'function');
    storage.player_torrent='vlc';Lampa.Player.play({url:url(2)});assert.equal(nativeCalls,1);
    storage.player='inner';Lampa.Player.play({url:'https://example.test/movie.mp4'});assert.equal(nativeCalls,2);
});

test('PWA plugin waits for ready, preserves player selection and registers only once', () => {
    const handlers={}, storage={player:'infuse',player_torrent:'vlc'};
    let registrations=0;
    const Lampa={
        Player:{play(){},playlist(){}},
        Params:{values:{player:{inner:'Встроенный',infuse:'Infuse'},player_torrent:{vlc:'VLC'}},defaults:{},select(k,v){this.values[k]=v;registrations++}},
        Storage:{get:(k,d)=>storage[k]??d,field:k=>storage[k],set:(k,v)=>storage[k]=v},
        Listener:{follow(k,fn){(handlers[k]??=[]).push(fn)}},Select:{show(){},hide(){}},Noty:{show(){}}
    };
    const context={Lampa,appready:false,navigator:{standalone:true},URL,Blob,alert:assert.fail};context.window=context;
    const source=fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8');
    runBridge(source,context);runBridge(source,context);
    assert.equal(registrations,0);assert.equal(handlers.app.length,1);
    handlers.app[0]({type:'ready'});assert.equal(registrations,2);
    assert.equal(storage.player,'infuse');assert.equal(storage.player_torrent,'vlc');
    handlers.app[0]({type:'ready'});runBridge(source,context);
    assert.equal(registrations,2);assert.equal(handlers.torrent_file.length,1);
});

test('torrent menu transfers one file or the complete playlist from a standalone web app', () => {
    const handlers={};let launched;
    const Lampa={Player:{play(){},playlist(){}},Storage:{get:(_k,d)=>d,set(){}},Select:{show(){},hide(){}},
        Listener:{follow(k,fn){handlers[k]=fn}},Noty:{show(){}},SettingsApi:{addParam(){}}
    };
    const context={Lampa,appready:true,navigator:{standalone:true},URL,Blob,btoa:s=>Buffer.from(s,'binary').toString('base64'),location:{assign:u=>launched=u},alert:assert.fail};context.window=context;
    runBridge(fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8'),context);
    const items=[1,2,3].map(i=>({url:url(i),title:`Серия ${i}`,season:1,episode:i}));
    const event={type:'onlong',element:items[1],items,params:{movie:{name:'Название',id:123}},menu:[{title:'Сведения'}]};
    handlers.torrent_file(event);
    assert.equal(event.menu.length,3);assert.equal(event.menu[0].title,'Сведения');assert.equal(launched,undefined);
    event.menu[1].onSelect();
    let doc=JSON.parse(Buffer.from(new URL(launched).searchParams.get('data'),'base64url').toString('utf8'));
    assert.equal(doc.items.length,1);assert.equal(doc.items[0].url,url(2));
    event.menu[2].onSelect();
    doc=JSON.parse(Buffer.from(new URL(launched).searchParams.get('data'),'base64url').toString('utf8'));
    assert.equal(doc.items.length,3);assert.equal(doc.selected,1);assert.equal(doc.title,'Название');
    handlers.torrent_file(event);assert.equal(event.menu.length,3);
});

test('only mpv+ receives play URLs before native preloading; tokens, indexes and other players survive',()=>{
    const storage={player:'mpvplus',player_torrent:'mpvplus',torrserver_preload:true};
    const url='https://server.test/ts/stream/show.mkv?link='+ 'a'.repeat(40)+'&index=7&preload&token=x%2By';let originalCalls=0;
    const Lampa={Params:{values:{player:{inner:'Inner'},player_torrent:{inner:'Inner'}},defaults:{},select(k,v){this.values[k]=v}},Player:{play(){},playlist(){}},Storage:{get:(k,d)=>storage[k]??d,field:k=>storage[k],set:(k,v)=>storage[k]=v},Torserver:{stream(path,hash,index){assert.equal(index,7);originalCalls++;return url;}},Select:{show(){},hide(){}},Listener:{follow(){}},Noty:{show:assert.fail}};
    const context={Lampa,URL,Blob,alert:assert.fail};context.window=context;runBridge(fs.readFileSync(require.resolve('../plugins/mpvplus-ios.js'),'utf8'),context);
    assert.equal(Lampa.Torserver.stream('show.mkv','a'.repeat(40),7),url.replace('&preload','&play'));
    assert.equal(storage.torrserver_preload,true,'global preload setting is preserved');
    storage.player_torrent='vlc';assert.equal(Lampa.Torserver.stream('show.mkv','a'.repeat(40),7),url);
    storage.player_torrent='inner';assert.equal(Lampa.Torserver.stream('show.mkv','a'.repeat(40),7),url);
    assert.equal(originalCalls,3);
});
