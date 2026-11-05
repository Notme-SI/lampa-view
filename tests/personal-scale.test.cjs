const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild'),{JSDOM}=require('jsdom');
test('text and controls scale independently, restore and never compound on new rows',()=>{
 const d=new JSDOM('<body class="lampa_view"><style>.menu__item{padding:10px;min-height:30px}.menu__text{font-size:20px}.menu__ico{width:20px;height:20px;min-width:20px}</style><div class="menu__item"><div class="menu__ico"></div><span class="menu__text">Главная</span></div></body>',{runScripts:'outside-only'}),w=d.window;
 try{const saved={},params=[],L={Storage:{get:(k,v)=>saved[k]??v},SettingsApi:{addParam:p=>params.push(p)}};
 w.eval(esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/personal-scale.js')],bundle:true,write:false,format:'iife',globalName:'Scale'}).outputFiles[0].text);
 const api=w.Scale.default(L),text=w.document.querySelector('.menu__text'),item=text.parentNode,ico=item.firstElementChild;
 assert.equal(params.length,2);assert.equal(text.style.fontSize,'');
 saved.lampa_view_text_scale='150';api.update();assert.equal(text.style.fontSize,'30px');assert.equal(item.style.paddingTop,'');
 saved.lampa_view_controls_scale='120';api.update();assert.equal(text.style.fontSize,'30px');assert.equal(item.style.paddingTop,'12px');assert.equal(ico.style.width,'24px');
 api.update();assert.equal(text.style.fontSize,'30px');assert.equal(item.style.paddingTop,'12px');
 const row=w.document.createElement('span');row.className='menu__text';row.textContent='Новый';w.document.body.appendChild(row);api.update();assert.equal(row.style.fontSize,'30px');
 saved.lampa_view_text_scale='100';saved.lampa_view_controls_scale='100';api.update();assert.equal(text.style.fontSize,'');assert.equal(item.style.paddingTop,'');assert.equal(ico.style.width,'');api.stop();
 }finally{w.close();}
});
