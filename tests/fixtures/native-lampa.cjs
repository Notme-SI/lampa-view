const fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),esbuild=require('esbuild');
module.exports=async function native(options={}){
 const errors=[],requests=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext/.test(e.message))errors.push(e.message);});
 const dom=new JSDOM('<head></head><body><div class="wrap"><div class="wrap__left"></div><div class="wrap__content"></div></div></body>',{url:options.url || 'http://lampa.example.invalid/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.console={log(...a){if(a[0]==='Activity' && /error/i.test(a[1] || ''))errors.push(a.join(' '));},info(){},warn(){},error(...a){errors.push(a.join(' '));}};
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};
 const root=path.join(__dirname,'lampa-runtime');const css=w.document.createElement('style');css.textContent=fs.readFileSync(path.join(root,'app.css'),'utf8');w.document.head.appendChild(css);
 for(const name of ['jquery/jquery','navigator/navigator','keypad/keypad','notify/notify','scrollbar/jquery.scrollbar'])w.eval(fs.readFileSync(path.join(root,'vender',name+'.js'),'utf8'));
 const nativeAjax=w.jQuery.ajax;
 w.jQuery.ajax=params=>{if(options.liveShikimori && /^https:\/\/shikimori\.(one|io)\/api\//.test(params.url))return nativeAjax.call(w.jQuery,params);const deferred=w.jQuery.Deferred(),xhr={status:0,abort(){}};if(options.requestPipeline)w.testNetwork(params.url,json=>{if(params.success)params.success(json);deferred.resolve(json);},()=>{if(params.error)params.error(xhr,'error');deferred.reject(xhr);});else w.setTimeout(()=>{if(params.error)params.error(xhr);deferred.reject(xhr);},0);return deferred.promise(xhr);};
 const transport=(url,ok)=>{requests.push(url);w.setTimeout(()=>ok({page:1,total_pages:1,cast:[],crew:[],results:/discover\/|search\/movie/.test(url)?[{id:123,title:'Film',original_title:'Original Film',release_date:'2015-01-01',vote_average:8,poster_path:'/poster.jpg'}]:[]}),0);};
 w.testNetwork=transport;
 let app=fs.readFileSync(path.join(root,'app.js'),'utf8').replace('} else loadApp();','} else {/* isolated native test startup */}');
 if(!options.requestPipeline)app=app.replace('this.silent = function (url, complite, error, post_data, params) {','this.silent = function (url, complite, error, post_data, params) {return window.testNetwork(url,complite,error);');w.eval(app);const L=w.Lampa;
 for(const name of ['Storage','Head','Settings','Select','Menu','Favorite','Timeline','Screensaver','Background','TimeTable','ContentRows','Activity']){L[name].init();if(name==='Storage' && options.initialStorage)Object.entries(options.initialStorage).forEach(([key,value])=>L.Storage.set(key,value));}
 await new Promise(r=>setTimeout(r,900));L.Storage.set('language','ru');L.Storage.set('tmdb_lang','ru');L.Storage.set('source','cub');L.TMDB.api=p=>'http://lampa.example.invalid/tmdb/api/3/'+p;
 for(const name of ['Settings','Select','Head','Menu','Activity']){const render=L[name].render(true),el=render && (render.nodeType?render:render[0]);if(el && !el.isConnected)w.document.body.appendChild(el);}
 w.appready=true;w.SimpleKeyboard={default:function(){this.setInput=()=>{};this.getInput=()=>'';this.destroy=()=>{};this.setOptions=()=>{};}};
 if(options.prepare)options.prepare(w,L);
 const code=options.built?fs.readFileSync(path.join(__dirname,'../../dist/lampa.js'),'utf8'):esbuild.buildSync({entryPoints:[path.join(__dirname,'../../src/plugin.js')],bundle:true,write:false,loader:{'.css':'text'}}).outputFiles[0].text;w.eval(code);
 if(!options.built)for(const file of ['torrent-catalogue','pars','torrent-button','alc-auto','suggest'])w.eval(fs.readFileSync(path.join(__dirname,'../../vendor',file+'.js'),'utf8'));
 L.Controller.add('content',{toggle(){}});L.Controller.toggle('content');
 return {w,L,errors,requests,dom,close:()=>dom.window.close()};
};

