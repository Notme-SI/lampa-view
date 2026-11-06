import {animeEpisodeMap} from './anime-index.js';
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
 if(!model || !model.complete || source.length<2 || source.length>seasons.length || !source.every((n,i)=>n===i+1) || !source.includes(number))return [];
 const story=model.rows.find(row=>row.key==='story'),ids=new Set(story && story.results.map(row=>row.id)),today=new Date().toISOString().slice(0,10);
 const releases=model.nodes.filter(n=>ids.has(n.id) && n.record && Number(n.record.tv)===Number(card.tmdb_id || card.id) && ['tv','ona','special','tv_special'].includes(n.kind) && n.aired && n.aired<=today && n.status!=='anons' && n.episodes>0);
 const local=files.filter(playable).map(row=>Number(row.episode)).sort((a,b)=>a-b);
 if(!local.length || !local.every((n,i)=>n===i+1) || !files.filter(playable).every(row=>Number(row.season)===number))return [];
 const following=releases.filter(n=>Number(n.record.season)===number).sort((a,b)=>Number(a.record.offset || 0)-Number(b.record.offset || 0)),result=[];
 if(following.length<2 || !following.some(n=>n.episodes>=local.length))return [];
 const first=following[0];let offset=0;
 for(const release of following){
  if(Number(release.record.offset || 0)!==offset || !release.original)break;
  let map=animeEpisodeMap(release.record,release.episodes,card);
  const canonical=seasons.find(s=>Number(s.season_number)===number);
  // A TV finale can follow the broadcast season's final episode in the index.
  if(!map && ['special','tv_special'].includes(release.kind) && ['special','tv_special'].includes(release.record.kind) && offset===Number(canonical.episode_count) && release.episodes<=3 && !(release.record.rules || []).length)map=Array.from({length:release.episodes},(_,i)=>({season:number,episode:offset+i+1}));
  if(!map || !map.every((e,i)=>e.season===number && e.episode===offset+i+1))break;
  result.push({name:release.name,original:release.original,year:release.year,season:number,offset,count:release.episodes,part:result.length+1,family:first.original.split(/\s*:\s*|\s+Season\s+\d+/i)[0]});
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
   if(/\b(?:recap|summary|compilation|movie)\b|пересказ|хроника|фильм|драма/i.test(title))return false;
   const aliases=title.split(/\s+[\/|]\s+/);
   if(!aliases.some(name=>names.includes(releaseKey(name))) && !(part.family && /\[ТВ-\d+/i.test(title) && aliases.some(name=>releaseKey(name).startsWith(releaseKey(part.family)))))return false;
   const route=kodikRoute(row.url,base);return route && route.searchParams.get('pick') && !route.searchParams.has('s');
  }),urls=[...new Set(eligible.map(row=>kodikRoute(row.url,base).href))];
  return urls.length===1?[{...part,url:urls[0]}]:[];
 });
}

export function mappedPartFiles(part,rows){
 const files=rows.filter(playable).slice().sort((a,b)=>Number(a.episode)-Number(b.episode));
 if(!files.length || files.length>part.count || !files.every((row,i)=>Number(row.episode)===i+1))return [];
 return files.map(row=>({...row,season:part.season,episode:part.offset+Number(row.episode),lampa_part:part.part}));
}

export default function animeProviderParts(L,anime,online){
 const searches=new Map(),reads=new Map(),pending=new Map(),overrides=new Map();
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
  const title=card.original_name || card.original_title || card.name;
  q.set('title',title);q.set('original_title',title);q.set('clarification','0');q.set('similar','false');
  const cacheKey=scope()+'|'+url.href,hit=searches.get(cacheKey);if(hit && Date.now()-hit.at<120000)return done(matchProviderParts(parts,hit.rows,base));
  request(url.href,body=>{const rows=online.folderRows(body);if(rows.length){searches.set(cacheKey,{at:Date.now(),rows});while(searches.size>16)searches.delete(searches.keys().next().value);}done(matchProviderParts(parts,rows,base));});
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
    const folders=online.folderRows(body).filter(row=>!row.similar && kodikRoute(row.url,base));
    return folders.length===1?follow(folders[0].url,depth+1):done([]);
   });
  }
  follow(part.url,0);
 }
 function join(card,base,body,number,numbers,done){
  if(!isAnime(card) || !kodikRoute(base) || numbers.filter(n=>n>0).length<2)return done(body,[]);
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
   for(const part of parts.sort((a,b)=>a.offset-b.offset)){if(part.offset!==next || !part.files?.length)break;kept.push(part);next+=part.files.length;if(part.files.length!==part.count)break;}
   if(!kept.includes(matches[0]) || next<=files.length)return done(body,[]);
   const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;
   for(const node of box.querySelectorAll('.videos__item[data-json]')){try{if(playable(JSON.parse(node.getAttribute('data-json'))))node.remove();}catch(error){}}
   for(const part of kept)for(const row of part.files){const original=originals.get(videoIdentity(row)),file=original?{...original,season:row.season,episode:row.episode,lampa_part:row.lampa_part}:row;
    const node=document.createElement('div');node.className='videos__item videos__movie selector';node.setAttribute('s',file.season);node.setAttribute('e',file.episode);node.setAttribute('data-json',JSON.stringify(file));node.textContent=file.episode+' серия';line.appendChild(node);
   }
   done(box.innerHTML,kept.map(({files,...part})=>({...part,available:files.length})));
  }
  anime.canonical(card,value=>{if(ended)return;if(!value)return finish([]);anime.collection(value,model=>{
   if(ended)return;const plan=providerPartPlan(value,model,files,number,numbers);if(!plan.length)return finish([]);
   search(card,base,plan,parts=>{if(ended)return;if(!parts.length)return finish([]);let next=0,running=0,left=parts.length;const results=[];
    function pump(){while(!ended && running<2 && next<parts.length){const part=parts[next++];running++;read(part,base,voice,files=>{running--;results.push({...part,files});if(!--left)finish(results);else pump();});}}
    pump();
   });
  });});
 }
 function routeKey(value){const url=kodikRoute(value);return url && url.origin+url.pathname+'|'+url.searchParams.get('pick');}
 join.rewrite=function(url,body){
  const number=overrides.get(routeKey(url));if(!number)return body;
  const box=document.createElement('div');box.innerHTML=body;
  for(const node of box.querySelectorAll('.videos__item[data-json]')){try{const row=JSON.parse(node.getAttribute('data-json'));if(playable(row)){row.season=number;if(row.s!==undefined)row.s=number;node.setAttribute('s',number);node.setAttribute('data-json',JSON.stringify(row));}}catch(error){}}
  return box.innerHTML;
 };
 join.folders=function(card,base,body,done){
  if(!isAnime(card) || !kodikRoute(base))return done(body);
  const folders=online.folderRows(body);if(folders.length<2 || folders.some(row=>row.similar || !kodikRoute(row.url,base)))return done(body);
  const numbers=folders.map(row=>Number(row.season ?? new URL(row.url,base).searchParams.get('s'))).filter(n=>n>0),max=Math.max(...numbers);
  if(!numbers.length || max>30 || numbers.every((n,i)=>n===i+1))return done(body);
  const missing=Array.from({length:max},(_,i)=>i+1).filter(n=>!numbers.includes(n));if(!missing.length || missing.length>3)return done(body);
  let ended=false;const timer=setTimeout(()=>finish([]),6500);
  function finish(parts){if(ended)return;ended=true;clearTimeout(timer);if(!parts.length)return done(body);const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;for(const part of parts){overrides.set(routeKey(part.url),part.sourceNumber);const node=document.createElement('div');node.className='videos__item videos__season selector';node.setAttribute('data-json',JSON.stringify({method:'link',season:part.sourceNumber,title:part.sourceNumber+' сезон',url:part.url}));node.textContent=part.sourceNumber+' сезон';line.appendChild(node);}while(overrides.size>32)overrides.delete(overrides.keys().next().value);done(box.innerHTML);}
  anime.canonical(card,value=>{if(ended)return;if(!value)return finish([]);anime.collection(value,model=>{
   if(ended)return;if(!model?.complete)return finish([]);const story=model.rows.find(row=>row.key==='story'),ids=new Set(story?.results.map(row=>row.id)),today=new Date().toISOString().slice(0,10);
   const releases=model.nodes.filter(n=>ids.has(n.id) && n.record && Number(n.record.tv)===Number(value.id) && ['tv','ona'].includes(n.kind) && n.episodes>0 && n.aired && n.aired<=today && n.status!=='anons').sort((a,b)=>a.aired.localeCompare(b.aired));
   if(releases.length!==max)return finish([]);
   const plan=missing.map(number=>({...releases[number-1],sourceNumber:number,family:releases[0].original?.split(/\s*:\s*|\s+Season\s+\d+/i)[0]}));
   function discover(){search(card,base,plan,parts=>{if(ended)return;if(!parts.length)return finish([]);const ready=[];let left=parts.length;
    parts.forEach(part=>request(part.url,response=>{if(ended)return;const rows=online.folderRows(response),direct=catalogueRows(response).some(playable),only=rows.length===1 && !rows[0].similar && kodikRoute(rows[0].url,base);if(direct)ready.push(part);else if(only)ready.push({...part,url:only.href});if(!--left)finish(ready);}));
   });}
   const anchors=[1,max];let checked=0,valid=true;
   for(const number of anchors){const row=folders.find(row=>Number(row.season ?? new URL(row.url,base).searchParams.get('s'))===number);if(!row)return finish([]);
    request(row.url,response=>{if(ended)return;const files=catalogueRows(response).filter(playable);if(files.length!==releases[number-1].episodes || !files.every((file,i)=>Number(file.season)===number && Number(file.episode)===i+1))valid=false;if(++checked===anchors.length){if(valid)discover();else finish([]);}});
   }
  });});
 };
 return join;
}
