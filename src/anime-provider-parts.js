import {animeEpisodeMap} from './anime-index.js';
import {franchiseViewingOrder} from './anime-franchise.js';
import {kodikRoute} from './anime-continuations.js';
import {isAnime} from './metadata.js';
import {catalogueRows} from './online-state.js';

const playable=row=>row && ['play','call'].includes(row.method);
const key=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,'');
const releaseKey=value=>key(String(value || '').replace(/\s*\((?:19|20)\d{2}\)\s*$/,'').replace(/(?:[\s:–—-]+|\s*\()(?:part|часть)\s*\d+\)?\s*$/i,''));

// Some providers expose the first cour as the whole season. Only extend it
// through an explicit, consecutive release map from the main story.
export function providerPartPlan(card,model,files,number,numbers){
 const source=[...new Set(numbers.map(Number))].filter(n=>n>0).sort((a,b)=>a-b),seasons=(card.seasons || []).filter(s=>s.season_number>0 && s.episode_count>0);
 if(!model || !model.complete || !source.includes(number))return [];
 const story=model.rows.find(row=>row.key==='story'),ids=new Set(story && story.results.map(row=>row.id)),today=new Date().toISOString().slice(0,10);
 const releases=model.nodes.filter(n=>ids.has(n.id) && n.record && Number(n.record.tv)===Number(card.tmdb_id || card.id) && ['tv','ona','special','tv_special'].includes(n.kind) && n.aired && n.aired<=today && n.status!=='anons' && n.episodes>0);
 const local=files.filter(playable).map(row=>Number(row.episode)).filter(n=>n>0).sort((a,b)=>a-b);
 if(!local.length || !local.every((n,i)=>n===i+1) || !files.filter(playable).every(row=>Number(row.season)===number))return [];
 const following=releases.filter(n=>Number(n.record.season)===number).sort((a,b)=>Number(a.record.offset || 0)-Number(b.record.offset || 0)),result=[];
 if(following.length<2 || !following.some(n=>n.episodes>=local.length))return [];
 const first=following[0];let offset=0;
 for(const release of following){
  if(Number(release.record.offset || 0)!==offset || !release.original)break;
  let map=animeEpisodeMap(release.record,release.episodes,card);
  // Availability comes from the confirmed release and actual files. A missing or
  // shorter TMDB season must not discard an explicitly mapped cour.
  if(!map && Number.isInteger(release.record.season) && release.record.season>0 && !(release.record.rules || []).length)map=Array.from({length:release.episodes},(_,i)=>({season:release.record.season,episode:offset+i+1}));
  const canonical=seasons.find(s=>Number(s.season_number)===number);
  // A TV finale can follow the broadcast season's final episode in the index.
  if(!map && ['special','tv_special'].includes(release.kind) && ['special','tv_special'].includes(release.record.kind) && offset===Number(canonical?.episode_count) && release.episodes<=3 && !(release.record.rules || []).length)map=Array.from({length:release.episodes},(_,i)=>({season:number,episode:offset+i+1}));
  if(!map || !map.every((e,i)=>e.season===number && e.episode===offset+i+1))break;
  result.push({mal:release.id,name:release.name,original:release.original,year:release.year,season:number,offset,count:release.episodes,aired:release.aired,released:release.released,kind:release.kind,part:result.length+1,family:first.original.split(/\s*:\s*|\s+Season\s+\d+/i)[0]});
  offset+=release.episodes;
 }
 if(result.length<2 || result.reduce((total,p)=>total+p.count,0)<=local.length)return [];
 return result;
}

export function matchProviderParts(parts,rows,base){
 return parts.flatMap(part=>{
  const names=[part.name,part.original].map(releaseKey),eligible=rows.filter(row=>{
   if(!row.similar || row.method!=='link' || String(row.year || row.start_date || '').slice(0,4)!==part.year)return false;
   const title=String(row.title || row.name || row.text || '');
   const partNumber=title.match(/(?:part|часть)\s*(\d+)/i);if(part.part && partNumber && Number(partNumber[1])!==part.part)return false;
   if(/\b(?:recap|summary|compilation|movie)\b|пересказ|фильм/i.test(title))return false;
   const aliases=title.split(/\s+[\/|]\s+/);
   if(!aliases.some(name=>names.includes(releaseKey(name))) && !(part.family && /\[ТВ-\d+/i.test(title) && aliases.some(name=>releaseKey(name).startsWith(releaseKey(part.family)))))return false;
   const route=kodikRoute(row.url,base);return route && route.searchParams.get('pick') && !route.searchParams.has('s');
  });
  const exact=eligible.filter(row=>String(row.title || row.name || row.text || '').split(/\s+[\/|]\s+/).some(name=>names.includes(releaseKey(name))));
  const urls=[...new Set((exact.length?exact:eligible).map(row=>kodikRoute(row.url,base).href))];
  return urls.length===1?[{...part,url:urls[0]}]:[];
 });
}

export function mappedPartFiles(part,rows){
 const files=rows.filter(playable).slice().sort((a,b)=>Number(a.episode)-Number(b.episode));
 const regular=files.filter(row=>Number(row.episode)>0),zero=files.filter(row=>Number(row.episode)===0);
 if(!regular.length || regular.length>part.count || zero.length>1 || zero.length && part.offset!==0 || !regular.every((row,i)=>Number.isInteger(Number(row.episode)) && Number(row.episode)<=part.count && (!i || Number(row.episode)>Number(regular[i-1].episode))))return [];
 return files.map(row=>({...row,season:part.season,episode:Number(row.episode)===0?0:part.offset+Number(row.episode),lampa_part:part.part}));
}

export default function animeProviderParts(L,anime,online){
 const searches=new Map(),reads=new Map(),pending=new Map(),overrides=new Map(),bundles=new Map();
 const scope=()=>JSON.stringify([L.Storage.get('account_email',''),L.Timeline?.filename?.() || '',L.Storage.get('language','ru')]);
 function request(url,done){
  const cacheKey=scope()+'|'+url,hit=reads.get(cacheKey);if(hit && Date.now()-hit.at<120000)return done(hit.body);
  if(pending.has(cacheKey)){pending.get(cacheKey).push(done);return;}
  pending.set(cacheKey,[done]);let settled=false;
  function finish(body){if(settled)return;settled=true;clearTimeout(timer);if(body){reads.set(cacheKey,{at:Date.now(),body});while(reads.size>32)reads.delete(reads.keys().next().value);}const list=pending.get(cacheKey)||[];pending.delete(cacheKey);list.forEach(fn=>fn(body));}
  const timer=setTimeout(()=>finish(''),4000),network=new L.Reguest();network.timeout(3500);
  try{network.native(url,finish,()=>finish(''),false,{dataType:'text'});}catch(error){finish('');}
 }
 function voices(body){const box=document.createElement('div');box.innerHTML=body;return Array.from(box.querySelectorAll('.videos__button[data-json]')).flatMap(node=>{try{return [{...JSON.parse(node.getAttribute('data-json')),title:node.textContent.trim(),active:node.classList.contains('active')}];}catch(error){return [];}});}
 function search(card,base,parts,done){
  const url=kodikRoute(base),q=url.searchParams;
  for(const name of ['id','imdb_id','kinopoisk_id','tmdb_id','mal_id','shikimori_id','kid','pick','s','t','e','rjson','nojson'])q.delete(name);
  q.set('clarification','0');q.set('similar','false');
  const titles=[...new Set([parts[0]?.family,parts[0]?.original,card.original_name || card.original_title,card.name || card.title].filter(Boolean))].slice(0,3),found=new Map();let cursor=0;
  function next(){if(cursor>=titles.length || found.size===parts.length)return done([...found.values()]);const title=titles[cursor++];q.set('title',title);q.set('original_title',title);
   const cacheKey=scope()+'|'+url.href,hit=searches.get(cacheKey);
   function accept(rows){for(const part of matchProviderParts(parts,rows,base))found.set(part.original+'|'+part.year,part);next();}
   if(hit && Date.now()-hit.at<120000)return accept(hit.rows);
   request(url.href,body=>{const rows=online.folderRows(body);if(rows.length){searches.set(cacheKey,{at:Date.now(),rows});while(searches.size>24)searches.delete(searches.keys().next().value);}accept(rows);});
  }next();
 }
 function read(part,base,voice,done){
  function follow(url,depth){
   const route=kodikRoute(url,base);if(!route || depth>2)return done([]);
   request(route.href,body=>{
    const rows=catalogueRows(body),files=rows.filter(playable);
    if(files.length){
     const options=voices(body),match=options.filter(option=>key(option.title)===key(voice));
     if(options.length && voice && match.length!==1)return done([]);
     if(match.length && !match[0].active)return follow(match[0].url,depth+1);
     return done(mappedPartFiles(part,files));
    }
    const folders=online.folderRows(body).filter(row=>!row.similar && kodikRoute(row.url,base) && Number(kodikRoute(row.url,base).searchParams.get('s'))>0);
    return folders.length===1?follow(folders[0].url,depth+1):done([]);
   });
  }
  follow(part.url,0);
 }
 function join(card,base,body,number,numbers,done){
  const bundle=bundles.get(scope()+'|'+routeKey(base));
  if(bundle)return readBundle(bundle,base,body,done);
  if(!isAnime(card) || !kodikRoute(base) || !numbers.some(n=>n>0))return done(body,[]);
  const files=catalogueRows(body).filter(playable);if(!files.length)return done(body,[]);
  const voice=(voices(body).find(v=>v.active)||{}).title || '';
  let ended=false;const timer=setTimeout(()=>finish([]),6500);
  function finish(parts){
   if(ended)return;ended=true;clearTimeout(timer);
   function videoIdentity(row){try{const u=new URL(row.stream || row.url,base),link=u.searchParams.get('link');if(link)return link;for(const name of ['title','original_title','episode','play'])u.searchParams.delete(name);u.searchParams.sort();return u.href;}catch(error){return '';}}
   const originals=new Map(files.map(file=>[videoIdentity(file),file]));
   const matches=parts.filter(part=>part.files && files.every(file=>part.files.some(row=>videoIdentity(row)===videoIdentity(file))));
   if(matches.length!==1)return done(body,[]);
   const kept=[];let next=0;
   for(const part of parts.sort((a,b)=>a.offset-b.offset)){if(part.offset!==next)break;kept.push(part);next+=part.count;}
   if(!kept.includes(matches[0]) || kept.reduce((sum,part)=>sum+part.files.length,0)<=files.length)return done(body,[]);
   const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;
   for(const node of box.querySelectorAll('.videos__item[data-json]')){try{if(playable(JSON.parse(node.getAttribute('data-json'))))node.remove();}catch(error){}}
   for(const part of kept)for(const row of part.files){const original=originals.get(videoIdentity(row)),file=original?{...original,season:row.season,episode:row.episode,lampa_part:row.lampa_part}:row;
    const node=document.createElement('div');node.className='videos__item videos__movie selector';node.setAttribute('s',file.season);node.setAttribute('e',file.episode);node.setAttribute('data-json',JSON.stringify(file));node.textContent=file.episode+' серия';line.appendChild(node);
   }
   done(box.innerHTML,kept.map(({files,...part})=>({...part,available:files.filter(row=>Number(row.episode)>0).length,episodes:files.map(row=>Number(row.episode))})));
  }
  anime.canonical(card,value=>{if(ended)return;value=value || card;anime.collection({...value,...(card.shikimori_id?{shikimori_id:card.shikimori_id}:{})},model=>{
   if(ended)return;const plan=providerPartPlan(value,model,files,number,numbers);if(!plan.length)return finish([]);
   search(card,base,plan,parts=>{if(ended)return;if(!parts.length)return finish([]);let next=0,running=0,left=parts.length;const results=[];
    function pump(){while(!ended && running<2 && next<parts.length){const part=parts[next++];running++;read(part,base,voice,files=>{running--;results.push({...part,files});if(!--left)finish(results);else pump();});}}
    pump();
   });
  });});
 }

 // Merge only an explicit, complete partition of one canonical season.
 // Keep stream URLs intact; episode coordinates become continuous within it.
 function readBundle(bundle,base,body,done){
  const voice=(voices(body).find(v=>v.active)||{}).title || '',result=[];let left=bundle.parts.length,ended=false;
  const timer=setTimeout(()=>finish(false),6500);
  function finish(valid){if(ended)return;ended=true;clearTimeout(timer);if(!valid)return done(body,[]);
   const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;
   box.querySelectorAll('.videos__item[data-json]').forEach(node=>{try{if(playable(JSON.parse(node.getAttribute('data-json'))))node.remove();}catch(error){}});
   const parts=result.sort((a,b)=>a.offset-b.offset);if(!parts.some(part=>part.files.length))return done(body,[]);const actual=catalogueRows(body).filter(playable);if(!actual.every(file=>parts.some(part=>part.files.some(row=>row.url===file.url))))return done(body,[]);
   for(const part of parts)for(const row of part.files){const file={...row,season:bundle.source,lampa_part:part.part},node=document.createElement('div');node.className='videos__item videos__movie selector';node.setAttribute('s',bundle.source);node.setAttribute('e',file.episode);node.setAttribute('data-json',JSON.stringify(file));node.textContent=file.episode+' серия';line.appendChild(node);}
   done(box.innerHTML,parts.map(({files,...part})=>({...part,available:files.filter(row=>Number(row.episode)>0).length,episodes:files.map(row=>Number(row.episode))})));
  }
  bundle.parts.forEach(part=>read(part,base,voice,files=>{if(ended)return;result.push({...part,files});if(!--left)finish(true);}));
 }
 function collapseFolders(body,layout,card){
  if(!layout)return body;
  const box=document.createElement('div');box.innerHTML=body;const grouped=new Map();let changed=false;
  for(const node of box.querySelectorAll('.videos__item[data-json]')){try{const row=JSON.parse(node.getAttribute('data-json')),source=Number(row.season ?? new URL(row.url,location.href).searchParams.get('s')),mapped=layout[source];if(!mapped || !Number.isInteger(mapped.offset))continue;const entries=grouped.get(mapped.number)||[];entries.push({node,row,mapped,source});grouped.set(mapped.number,entries);}catch(error){}}
  for(const [number,entries] of grouped){
   if(entries.length<2)continue;entries.sort((a,b)=>a.mapped.offset-b.mapped.offset);
   const season=(card.seasons || []).find(s=>Number(s.season_number)===number);let offset=0;
   if(!season || !entries.every(entry=>{const valid=entry.mapped.offset===offset && entry.mapped.count>0;offset+=entry.mapped.count;return valid;}) || offset!==Number(season.episode_count))continue;
   const first=entries[0],parts=entries.map((entry,i)=>({season:number,offset:entry.mapped.offset,count:entry.mapped.count,kind:'tv',part:i+1,url:entry.row.url})),bundle={source:first.source,parts};
   bundles.set(scope()+'|'+routeKey(first.row.url),bundle);while(bundles.size>32)bundles.delete(bundles.keys().next().value);
   first.mapped.count=offset;first.mapped.parts=parts.length;changed=true;
   for(const entry of entries.slice(1)){entry.node.remove();delete layout[entry.source];}
  }
  return changed?box.innerHTML:body;
 }
 function routeKey(value){const url=kodikRoute(value);return url && url.origin+url.pathname+'|'+url.searchParams.get('pick')+'|'+url.searchParams.get('s');}
 join.rewrite=function(url,body){
  const number=overrides.get(routeKey(url));if(!number)return body;
  const box=document.createElement('div');box.innerHTML=body;
  for(const node of box.querySelectorAll('.videos__item[data-json]')){try{const row=JSON.parse(node.getAttribute('data-json'));if(playable(row)){row.season=number;if(row.s!==undefined)row.s=number;node.setAttribute('s',number);node.setAttribute('data-json',JSON.stringify(row));}}catch(error){}}
  return box.innerHTML;
 };
 join.folders=function(card,base,body,done){
  if(!isAnime(card) || !kodikRoute(base))return done(body,null);
  const folders=online.folderRows(body);if(!folders.length || folders.some(row=>row.similar || !kodikRoute(row.url,base)))return done(body,null);
  const number=row=>Number(row.season ?? new URL(row.url,base).searchParams.get('s'));
  const numbers=folders.map(number).filter(n=>n>0),max=Math.max(...numbers);
  if(!numbers.length || max>30)return done(body,null);
  let ended=false,canonical=null;const timer=setTimeout(()=>finish([],null),6500);
  function finish(parts,layout){if(ended)return;ended=true;clearTimeout(timer);if(!parts.length)return done(canonical?collapseFolders(body,layout,canonical):body,layout);const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;for(const part of parts){overrides.set(routeKey(part.url),part.sourceNumber);const node=document.createElement('div');node.className='videos__item videos__season selector';node.setAttribute('data-json',JSON.stringify({method:'link',season:part.sourceNumber,title:part.sourceNumber+' сезон',url:part.url}));node.textContent=part.sourceNumber+' сезон';line.appendChild(node);}while(overrides.size>48)overrides.delete(overrides.keys().next().value);done(canonical?collapseFolders(box.innerHTML,layout,canonical):box.innerHTML,layout);}
  anime.canonical(card,value=>{if(ended)return;if(!value)return finish([],null);canonical=value;anime.collection(value,model=>{
   if(ended)return;if(!model?.complete)return finish([],null);const story=model.rows.find(row=>row.key==='story'),ids=new Set(story?.results.map(row=>row.id)),today=new Date().toISOString().slice(0,10);
   const eligible=n=>n.record && Number(n.record.tv)===Number(value.id) && ['tv','ona'].includes(n.kind) && n.episodes>0 && n.aired && n.aired<=today && n.status!=='anons';
   const main=model.nodes.filter(n=>ids.has(n.id) && eligible(n)).sort((a,b)=>a.aired.localeCompare(b.aired));
   const all=model.nodes.filter(eligible).filter(n=>ids.has(n.id) || model.edges.some(e=>e.relation==='alternative_version' && (e.from===n.id || e.to===n.id))).sort((a,b)=>a.aired.localeCompare(b.aired));
   const candidates=[main,all].filter((rows,i,a)=>(rows.length===max || numbers.length===1 && rows.length===1) && !a.slice(0,i).some(old=>old.map(n=>n.id).join()===rows.map(n=>n.id).join()));
   if(candidates.length!==1){
    // A partial dub in the first native folder does not describe the work's
    // complete release structure. Identify it by its actual video links first.
    if(numbers.length!==1 || numbers[0]!==1 || main.length<2 || main.length>30)return finish([],null);
    const steps=franchiseViewingOrder(model);
    const plans=main.map((release,i)=>{const step=steps.find(s=>s.id===release.id);return {...release,mal:release.id,season:step?.season || i+1,offset:step?.part?Number(release.record.offset || 0):0,part:step?.part || 0,count:release.episodes,sourceNumber:i+1,family:main[0].original?.split(/\s*:\s*|\s+Season\s+\d+/i)[0]};});
    request(folders[0].url,response=>{if(ended)return;const actual=catalogueRows(response).filter(playable),voice=(voices(response).find(v=>v.active)||{}).title || '';if(!actual.length)return finish([],null);
     search(card,base,plans,found=>{if(ended)return;const first=found.find(p=>p.id===main[0].id);if(!first)return finish([],null);
      read(first,base,voice,files=>{if(ended)return;
       const identity=row=>{try{const u=new URL(row.stream || row.url,base);const link=u.searchParams.get('link');if(link)return link;for(const name of ['title','original_title','episode','play'])u.searchParams.delete(name);u.searchParams.sort();return u.href;}catch(error){return '';}};
       const verified=new Set(files.map(identity).filter(Boolean));if(!actual.every(row=>verified.has(identity(row))))return finish([],null);
       const layout={1:{number:1,mal:first.id,offset:0,count:first.count}},ready=[];let left=found.length-1;if(!left)return finish([],null);
       const pending=found.filter(p=>p.id!==first.id);let cursor=0,running=0;function pump(){while(!ended && running<2 && cursor<pending.length){const part=pending[cursor++];running++;request(part.url,body=>{running--;if(ended)return;const rows=online.folderRows(body),direct=catalogueRows(body).some(playable),own=rows.filter(row=>!row.similar && kodikRoute(row.url,base) && Number(kodikRoute(row.url,base).searchParams.get('s'))>0),url=direct?part.url:own.length===1?own[0].url:'';
        if(url){ready.push({...part,url});layout[part.sourceNumber]={number:part.season,mal:part.id,offset:part.offset,count:part.count};}if(!--left)finish(ready,layout);else pump();
       });}}pump();
      });
     });
    });return;
   }const releases=candidates[0],single=numbers.length===1 && releases.length===1;
   const existing=new Map(numbers.map(n=>[n,releases[single?0:n-1]]));if([...existing.values()].some(n=>!n))return finish([],null);
   const layout={},missing=[];for(const [source,release] of existing){const map=animeEpisodeMap(release.record,release.episodes,value);if(!map || !map.every(e=>e.season===map[0].season))return finish([],null);layout[source]={number:map[0].season,mal:release.id,offset:map[0].episode-1,count:map.length};}
   const used=new Set(numbers),represented=new Set([...existing.values()].map(n=>n.id));
   for(let i=0;i<releases.length;i++)if(!represented.has(releases[i].id)){missing.push({...releases[i],sourceNumber:i+1});used.add(i+1);represented.add(releases[i].id);}
   // Alternative TV adaptations are playable seasons too, even when the film
   // is the viewing-order representative. Existing native/history numbers stay intact.
   for(const release of all)if(!represented.has(release.id)){let next=max+1;while(used.has(next))next++;missing.push({...release,sourceNumber:next});used.add(next);}
   if(missing.length>30)return finish([],null);
   function discover(){
    if(!missing.length)return finish([],layout);
    const plan=missing.map(release=>({...release,family:main[0]?.original?.split(/\s*:\s*|\s+Season\s+\d+/i)[0]}));
    search(card,base,plan,parts=>{if(ended)return;if(!parts.length)return finish([],layout);const ready=[];let left=parts.length;
     parts.forEach(part=>request(part.url,response=>{if(ended)return;const rows=online.folderRows(response),direct=catalogueRows(response).some(playable),only=rows.length===1 && !rows[0].similar && kodikRoute(rows[0].url,base);const url=direct?part.url:only?.href,map=animeEpisodeMap(part.record,part.episodes,value);if(url && map && map.every(e=>e.season===map[0].season)){ready.push({...part,url});layout[part.sourceNumber]={number:map[0].season,mal:part.id,offset:map[0].episode-1,count:map.length};}if(!--left)finish(ready,layout);}));
    });
   }
   const anchors=[...new Set([numbers[0],numbers[numbers.length-1],...numbers])];let checked=0,cursor=0;
   const needed=Math.min(2,numbers.length);
   function verify(){if(ended)return;if(checked>=needed)return discover();if(cursor>=anchors.length)return finish([],null);const n=anchors[cursor++],row=folders.find(row=>number(row)===n),release=existing.get(n);if(!row || !release)return finish([],null);
    request(row.url,response=>{if(ended)return;const files=catalogueRows(response).filter(playable);if(!files.length)return verify();if(files.length!==release.episodes || !files.every((file,i)=>Number(file.season)===n && Number(file.episode)===i+1))return finish([],null);checked++;verify();});
   }verify();
  });});
 };

 return join;
}
