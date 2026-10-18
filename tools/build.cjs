const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const babel = require('@babel/core');
const acorn = require('acorn');
const root = path.resolve(__dirname,'..');
// Match Git's LF policy before embedding raw CSS as JavaScript strings.
for(const name of fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.css'))){
 const file=path.join(root,'src',name),text=fs.readFileSync(file,'utf8');
 if(text.includes('\r\n'))fs.writeFileSync(file,text.replace(/\r\n/g,'\n'));
}
const out = path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
const result = esbuild.buildSync({entryPoints:[path.join(root,'src/plugin.js')],bundle:true,minify:true,target:['es2017'],loader:{'.css':'text'},write:false});
const vendors = ['torrent-catalogue','pars','torrent-button','alc-auto','suggest'].map(name => {
  const file=path.join(root,'vendor',name+'.js');
  return fs.existsSync(file) ? esbuild.transformSync(fs.readFileSync(file,'utf8'),{minify:true,target:'es2017'}).code : '';
}).join('\n');
// Every adapter waits for the host; loading a single .js before appready is supported.
const deferred='(function(){if(window.lampa_viewAdaptersScheduled)return;window.lampa_viewAdaptersScheduled=true;var done=false;function start(){if(done)return;done=true;'+vendors+'}function ready(){if(!window.Lampa)return false;if(window.appready)start();else Lampa.Listener.follow("app",function(e){if(e.type==="ready")start();});return true;}if(!ready()){var count=0,t=setInterval(function(){if(ready()||++count>=150)clearInterval(t);},200);}})();';
const source=result.outputFiles[0].text+'\n'+deferred;
const legacy=babel.transformSync(source,{presets:[[require('@babel/preset-env').default,{targets:{ie:'11'},modules:false}]],babelrc:false,configFile:false,comments:false,compact:true}).code;
acorn.parse(legacy,{ecmaVersion:5});
const banner='/*! Lampa View '+require('../package.json').version+' | MIT (original code); third-party adapters: THIRD-PARTY.md */\n';
fs.writeFileSync(path.join(out,'lampa.js'),banner+legacy);
console.log('dist/lampa.js: '+fs.statSync(path.join(out,'lampa.js')).size+' bytes');
const boot=esbuild.buildSync({entryPoints:[path.join(root,'src/boot.js')],bundle:true,minify:true,target:['es2017'],loader:{'.css':'text'},write:false}).outputFiles[0].text;
const bootLegacy=babel.transformSync(boot,{presets:[[require('@babel/preset-env').default,{targets:{ie:'11'},modules:false}]],babelrc:false,configFile:false,comments:false,compact:true}).code;
acorn.parse(bootLegacy,{ecmaVersion:5});fs.writeFileSync(path.join(out,'lampa-minimal.boot.js'),bootLegacy);
fs.writeFileSync(path.join(out,'lampa-minimal.svg'),require(path.join(root,'src/favicon.cjs')).replace(/\r\n/g,'\n'));
// ICO embeds four PNG resolutions, preserving the original vector mark.
const {Resvg}=require('@resvg/resvg-js');
const sizes=[32,64,128,256],pngs=sizes.map(width=>new Resvg(require(path.join(root,'src/favicon.cjs')),{fitTo:{mode:'width',value:width}}).render().asPng());
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
pngs.forEach((png,i)=>{const at=6+i*16;header[at]=header[at+1]=sizes[i]===256?0:sizes[i];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length;});
fs.writeFileSync(path.join(out,'lampa.ico'),Buffer.concat([header,...pngs]));
const pages=path.join(root,'docs');fs.mkdirSync(pages,{recursive:true});
for(const name of ['lampa-minimal.boot.js','lampa-minimal.svg','lampa.ico'])fs.copyFileSync(path.join(out,name),path.join(pages,name));
fs.copyFileSync(path.join(out,'lampa.js'),path.join(root,'lampa.js'));fs.copyFileSync(path.join(out,'lampa.js'),path.join(pages,'lampa.js'));
fs.copyFileSync(path.join(root,'THIRD-PARTY.md'),path.join(pages,'THIRD-PARTY.md'));fs.copyFileSync(path.join(root,'LICENSE'),path.join(pages,'LICENSE.txt'));
fs.mkdirSync(path.join(pages,'licenses'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'licenses')))fs.copyFileSync(path.join(root,'licenses',name),path.join(pages,'licenses',name));
fs.writeFileSync(path.join(pages,'.nojekyll'),'');
const crypto=require('node:crypto'),manifest={version:require(path.join(root,'package.json')).version,files:{}};
for(const name of ['lampa.js','lampa-minimal.boot.js','lampa-minimal.svg','lampa.ico'])manifest.files['dist/'+name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex');
fs.mkdirSync(path.join(pages,'server'),{recursive:true});
for(const name of ['install.sh','install-bootstrap.py','remove-bootstrap.sh','lampa-minimal-bootstrap.service','lampa-minimal-bootstrap.path']){
 const content=Buffer.from(fs.readFileSync(path.join(root,'server',name),'utf8').replace(/\r\n/g,'\n'));fs.writeFileSync(path.join(pages,'server',name),content);manifest.files['server/'+name]=crypto.createHash('sha256').update(content).digest('hex');
}
fs.writeFileSync(path.join(pages,'install-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(pages,'install.sh'),'#!/bin/sh\nset -eu\ncommand -v python3 >/dev/null 2>&1 || { echo "Install Python 3 first"; exit 1; }\npython3 - <<\'LAMPA_VIEW_INSTALLER_PY\'\n'+fs.readFileSync(path.join(root,'server/install-online.py'),'utf8')+'\nLAMPA_VIEW_INSTALLER_PY\n');
