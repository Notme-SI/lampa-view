// Run explicitly to refresh factual ID/episode mappings; normal builds stay offline.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const positive=v=>Number.isSafeInteger(Number(v)) && Number(v)>0 && Number(v)<1000000000;
const integer=v=>v!=='' && v!=null && Number.isSafeInteger(Number(v));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function generate(fribb,xml,provenance={}){
 if(!Array.isArray(fribb) || fribb.length<1000 || /<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Invalid anime sources');
 const dom=new JSDOM(xml,{contentType:'application/xml'}),root=dom.window.document.documentElement,byAni=new Map(),records=[],seen=new Set();
 try{
  if(root.tagName!=='anime-list')throw Error('Invalid Anime-Lists root');
  for(const node of root.children){const ani=Number(node.getAttribute('anidbid'));if(!positive(ani) || byAni.has(ani))throw Error('Invalid/duplicate AniDB ID');
   const tv=Number(node.getAttribute('tmdbtv')),season=node.getAttribute('tmdbseason'),offset=node.getAttribute('tmdboffset'),rules=[];
   for(const rule of node.querySelectorAll('mapping-list > mapping')){
    const source=rule.getAttribute('anidbseason'),target=rule.getAttribute('tmdbseason');if(!['0','1'].includes(source) || !integer(target) || Number(target)<0 || Number(target)>100)continue;
    const start=rule.getAttribute('start'),end=rule.getAttribute('end'),shift=rule.getAttribute('offset');
    if(integer(start) && integer(end) && integer(shift) && Number(start)>0 && Number(end)>=Number(start) && Number(end)<=3000)rules.push({source:Number(source),season:Number(target),start:Number(start),end:Number(end),offset:Number(shift)});
    const text=rule.textContent.trim();if(text){const pairs=[];let valid=true;for(const token of text.split(';').filter(Boolean)){const match=token.trim().match(/^(\d+)-(\d+(?:\+\d+)*)$/);if(!match){valid=false;break;}const from=Number(match[1]),to=match[2].split('+').map(Number);if(from<1 || from>3000 || to.some(n=>n<0 || n>3000)){valid=false;break;}pairs.push([from,to]);}if(valid && pairs.length)rules.push({source:Number(source),season:Number(target),pairs});}
   }
   byAni.set(ani,{tv:positive(tv)?tv:0,season:integer(season) && Number(season)>=0 && Number(season)<=100?Number(season):null,absolute:season==='a',offset:integer(offset)?Number(offset):0,rules});
  }
  for(const row of fribb){
   const ids={mal:Number(row.mal_id)||0,anilist:Number(row.anilist_id)||0,anidb:Number(row.anidb_id)||0};if(!Object.values(ids).some(positive))continue;
   const link=byAni.get(ids.anidb),tmdb=row.themoviedb_id || {},tv=link && link.tv || (positive(tmdb.tv)?Number(tmdb.tv):0),movies=[...new Set((Array.isArray(tmdb.movie)?tmdb.movie:[]).filter(positive).map(Number))],imdb=[...new Set((Array.isArray(row.imdb_id)?row.imdb_id:[]).filter(id=>/^tt\d{5,12}$/.test(id)))],tvdb=positive(row.tvdb_id)?Number(row.tvdb_id):0;
   const key=ids.mal+':'+ids.anilist+':'+ids.anidb;if(seen.has(key))throw Error('Duplicate anime identity');seen.add(key);
   // Only explicit TMDB fields are used. TVDB season numbers are a different scheme.
   const same=link && link.tv===tv,season=same?link.season:null,offset=same?link.offset:0,rules=same?link.rules:[];
   records.push({...ids,kind:String(row.type || '').toLowerCase(),...(tv?{tv}:{}),...(movies.length?{movies}:{}),...(imdb.length?{imdb}:{}),...(tvdb?{tvdb}:{}),...(season!==null?{season}:{}),...(offset?{offset}:{}),...(same && link.absolute?{absolute:true}:{}),...(rules.length?{rules}:{})});
  }
  records.sort((a,b)=>a.mal-b.mal || a.anidb-b.anidb || a.anilist-b.anilist);
  // A packed string keeps the full identity catalogue small in the ES5 bundle.
  // Tuple: MAL, AniList, AniDB, kind, TMDB TV, movies, IMDb, TVDB,
  // TMDB season (null means unknown), offset, absolute, explicit rules.
  const tuples=records.map(r=>[r.mal,r.anilist,r.anidb,r.kind,r.tv||0,r.movies||[],r.imdb||[],r.tvdb||0,r.season==null?null:r.season,r.offset||0,r.absolute?1:0,r.rules||[]]);
  return {schema:2,sources:provenance,count:records.length,mapped:records.filter(r=>r.tv || r.movies).length,packed:JSON.stringify(tuples)};
 }finally{dom.window.close();}
}
async function main(){
 const output=process.argv.includes('--output')?path.resolve(process.argv[process.argv.indexOf('--output')+1]):path.resolve(__dirname,'../src/anime-index-data.json'),sources={},bodies=[];
 for(const [repo,file] of [['Fribb/anime-lists','anime-list-mini.json'],['Anime-Lists/anime-lists','anime-list.xml']]){
  const response=await fetch('https://api.github.com/repos/'+repo+'/commits?path='+file+'&per_page=1',{headers:{'User-Agent':'LampaView-anime-index'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Revision HTTP '+response.status);const commit=(await response.json())[0];if(!/^[a-f0-9]{40}$/.test(commit && commit.sha))throw Error('Invalid source revision');
  const url='https://raw.githubusercontent.com/'+repo+'/'+commit.sha+'/'+file,r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Source HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());sources[repo]={revision:commit.sha,date:commit.commit.committer.date,sha256:hash(bytes),url};bodies.push(bytes.toString('utf8'));
 }
 const data=generate(JSON.parse(bodies[0]),bodies[1],sources);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data)+'\n');console.log(JSON.stringify({records:data.count,mapped:data.mapped,bytes:fs.statSync(output).size,sources}));
}
module.exports={generate};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
