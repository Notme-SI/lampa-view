import {locale,text as t,pluralSource} from './i18n.js';
import {animeRecords,animeTargets} from './anime-index.js';
const positive=n=>Number.isSafeInteger(Number(n)) && Number(n)>0;
const kindNames={'TV Сериал':'tv','Фильм':'movie','Спецвыпуск':'special','TV Спецвыпуск':'tv_special','Музыка':'music','Клип':'music','OVA':'ova','ONA':'ona'};
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))?String(value):'';
export function franchiseModel(graph,seed,metadata=[]){
 if(!graph || Number(graph.current_id)!==Number(seed) || !Array.isArray(graph.nodes) || !Array.isArray(graph.links) || graph.nodes.length<2 || graph.nodes.length>240 || graph.links.length>1800)return null;
 const details=new Map(metadata.filter(v=>v && positive(v.id)).map(v=>[Number(v.id),v])),nodes=new Map(),edges=[],seen=new Set();
 for(const node of graph.nodes){const id=Number(node.id);if(!positive(id) || nodes.has(id) || typeof node.name!=='string' || !node.name.trim())return null;
  const meta=details.get(id)||{},records=animeRecords({source:'minimal_shiki',id}),record=records.length===1?records[0]:null,kind=meta.kind || record && record.kind || kindNames[node.kind] || String(node.kind || '').toLowerCase(),aired=date(meta.aired_on),year=aired.slice(0,4) || (Number(node.year)>=1900 && Number(node.year)<=2200?String(node.year):'');
  nodes.set(id,{id,url:node.url || '',name:locale()==='ru'?(meta.russian || node.name || meta.name):(meta.name || node.name),original:meta.name || '',kind,aired,released:date(meta.released_on),year,status:meta.status || '',episodes:Number(meta.episodes)||0,airedCount:Number(meta.episodes_aired)||0,poster:meta.image && meta.image.original || node.image_url || '',record});
 }
 if(!nodes.has(Number(seed)))return null;
 for(const link of graph.links){const from=Number(link.source_id),to=Number(link.target_id),relation=String(link.relation || '').toLowerCase();if(!nodes.has(from) || !nodes.has(to) || from===to)return null;const key=from+':'+to+':'+relation;if(!seen.has(key)){seen.add(key);edges.push({from,to,relation});}}
 const connected=(ids,relations)=>{let change=true;while(change){change=false;for(const edge of edges)if(relations.includes(edge.relation) && (ids.has(edge.from)||ids.has(edge.to)))for(const id of [edge.from,edge.to])if(!ids.has(id)){ids.add(id);change=true;}}return ids;};
 const story=connected(new Set([Number(seed)]),['prequel','sequel']),relevant=connected(new Set(story),['alternative_version','summary','full_story']);
 const parents=new Map([...nodes.keys()].map(id=>[id,id])),root=id=>{while(parents.get(id)!==id)id=parents.get(id);return id;};
 for(const edge of edges)if(edge.relation==='alternative_version' && relevant.has(edge.from) && relevant.has(edge.to))parents.set(root(edge.to),root(edge.from));
 const variants=new Map();for(const id of relevant){const r=root(id),group=variants.get(r)||[];group.push(id);variants.set(r,group);}
 const compare=(a,b)=>{const x=nodes.get(a),y=nodes.get(b);return (!!y.year-!!x.year) || (x.aired || x.year || '9999').localeCompare(y.aired || y.year || '9999') || a-b;};
 const representative=new Map(),alternatives=new Set();
 for(const group of variants.values()){group.sort(compare);const television=group.filter(id=>['tv','ona'].includes(nodes.get(id).kind)),choices=television.length && group.some(id=>['ova','special','tv_special'].includes(nodes.get(id).kind))?television:group;const selected=choices.includes(Number(seed))?Number(seed):choices[0];for(const id of group){representative.set(id,selected);if(id!==selected)alternatives.add(id);}}
 const recaps=new Set(edges.filter(e=>e.relation==='summary').map(e=>e.to));for(const id of recaps)alternatives.add(id);
 const main=new Set([...story].map(id=>representative.get(id)||id).filter(id=>!recaps.has(id))),directed=new Map([...main].map(id=>[id,new Set()]));
 for(const edge of edges)if(['prequel','sequel'].includes(edge.relation)){let from=edge.relation==='sequel'?edge.from:edge.to,to=edge.relation==='sequel'?edge.to:edge.from;from=representative.get(from)||from;to=representative.get(to)||to;if(main.has(from) && main.has(to) && from!==to)directed.get(from).add(to);}
 const degrees=new Map([...main].map(id=>[id,0]));for(const values of directed.values())for(const id of values)degrees.set(id,degrees.get(id)+1);
 const ready=[...main].filter(id=>degrees.get(id)===0).sort(compare),ordered=[];while(ready.length){const id=ready.shift();ordered.push(id);for(const next of directed.get(id)){degrees.set(next,degrees.get(next)-1);if(!degrees.get(next)){ready.push(next);ready.sort(compare);}}}
 const complete=ordered.length===main.size;if(!complete)ordered.splice(0,ordered.length,...[...main].sort(compare));
 const summary=new Set(edges.filter(e=>e.relation==='summary' && (story.has(e.from)||story.has(e.to))).flatMap(e=>[e.from,e.to]).filter(id=>!story.has(id)));
 summary.forEach(id=>alternatives.add(id));
 const related=connected(new Set(relevant),['prequel','sequel','side_story','parent_story','spin_off','alternative_version','summary','full_story']);
 // "other" and character crossovers can connect two unrelated franchises.
 // Keep direct extras; do not traverse through them into a second catalogue.
 for(const edge of edges)if(edge.relation==='other' && (related.has(edge.from)||related.has(edge.to))){if(relevant.has(edge.from))related.add(edge.to);if(relevant.has(edge.to))related.add(edge.from);}
 const rest=[...related].filter(id=>!main.has(id) && !alternatives.has(id) && !['music','pv','cm'].includes(nodes.get(id).kind));
 const today=new Date().toISOString().slice(0,10),future=n=>n.status==='anons' || !!n.aired && n.aired>today;
 function card(id){const node=nodes.get(id),movie=node.kind==='movie',image=/^https:\/\/shikimori\.(?:io|one)\//.test(node.poster)?node.poster:node.poster.startsWith('/')?'https://shikimori.io'+node.poster:'';
  return {id,shikimori_id:id,mal_id:id,source:'minimal_shiki',media_type:movie?'movie':'tv',minimal_anime:true,title:node.name,original_title:node.original,...(movie?{release_date:node.aired || node.year}:{name:node.name,original_name:node.original,first_air_date:node.aired || node.year}),img:image,episodes:node.episodes,episodes_aired:node.airedCount,status:node.status,minimal_anime_kind:node.kind,minimal_anime_targets:animeTargets(node.record)};
 }
 const announced=new Set([...main,...alternatives,...rest].filter(id=>future(nodes.get(id))));
 const rows=[{key:'story',title:t(complete?'Основная история':'Связанные релизы'),ids:ordered},{key:'alternatives',title:t('Другие версии и пересказы'),ids:[...alternatives].sort(compare)},{key:'related',title:t('Ответвления и спецвыпуски'),ids:rest.sort(compare)},{key:'announced',title:t('Продолжения и анонсы'),ids:[...announced].sort(compare)}].map(row=>({...row,results:row.ids.filter(id=>row.key==='announced' || !announced.has(id)).map(card)})).filter(row=>row.results.length);
 return {seed:Number(seed),complete,rows,nodes:[...nodes.values()],edges};
}

// Catalogue tiles represent destinations, while the model retains every release
// for episode/provider mapping. A merged TV card must appear only once.
export function franchiseCatalogueRows(model){
 const seen=new Set(),nodes=new Map(model.nodes.map(n=>[Number(n.id),n])),first=model.rows.find(r=>r.key==='story')?.results[0],prefix=String(first?.title || first?.name || '').trim();
 return model.rows.map(row=>({...row,results:row.results.filter(card=>{
  const node=nodes.get(Number(card.id)),name=String(node?.original || '')+' '+String(card.title || '')+' '+String(node?.url || '');
  if(['music','pv','cm'].includes(node?.kind) || row.key==='related' && /manner[- _]eizou|урок хороших манер|(?:\s+x\s+|×)/i.test(name))return false;
  const type=card.media_type,targets=(card.minimal_anime_targets || []).filter(t=>t.type===type),key=targets.length===1?type+':'+targets[0].id:'mal:'+card.id;
  if(seen.has(key))return false;seen.add(key);return true;
 }).map(card=>{
  const name=String(card.title || card.name || ''),short=prefix && name.toLowerCase().startsWith(prefix.toLowerCase()+':')?name.slice(prefix.length+1).trim():name;
  return short!==name?{...card,title:short,...(card.name?{name:short}:{}),minimal_franchise_full_title:name}:card;
 })})).filter(row=>row.results.length);
}

// Display seasons follow adjacent TV releases, independently of metadata numbering.
// A remapped later season must never become a part of a non-adjacent first season.
const releaseStem=node=>String(node.original || node.name || '').toLowerCase().replace(/\s+(?:\d+(?:st|nd|rd|th)?\s+season|season\s+\d+|part\s*\d+|часть\s*\d+)\s*$/i,'').replace(/[^\p{L}\p{N}]/gu,'');
export function franchiseViewingOrder(model){
 if(!model.complete)return [];
 const story=model.rows.find(row=>row.key==='story');if(!story)return [];
 const ids=new Set(story.results.map(c=>Number(c.id))),nodes=model.nodes.filter(n=>ids.has(n.id) && n.status!=='anons' && (!n.aired || n.aired<=new Date().toISOString().slice(0,10))).sort((a,b)=>(a.aired || a.year || '9999').localeCompare(b.aired || b.year || '9999') || story.results.findIndex(c=>c.id===a.id)-story.results.findIndex(c=>c.id===b.id));
 let season=0,previous=null;const steps=[];
 for(const node of nodes){
  let number=0,part=0;
  if(['tv','ona'].includes(node.kind)){
   const split=previous && node.record?.tv && node.record.tv===previous.node.record?.tv && node.record.season===previous.node.record.season && Number(node.record.offset || 0)===Number(previous.node.record.offset || 0)+previous.node.episodes && (/(?:part|часть|cour)\s*[2-9]\d*$/i.test(node.name) || /(?:part|cour)\s*[2-9]\d*$/i.test(node.original) || !!String(node.original || '').match(/\bPart (\d+):/) && String(node.original || '').match(/\bPart (\d+):/)[1]===previous.node.original?.match(/\bPart (\d+):/)?.[1] || Number(node.record.season)>1 && releaseStem(node)===releaseStem(previous.node));
   if(split){part=(previous.step.part || 1)+1;previous.step.part=part-1;}else season++;
   number=season;
  }
  const step={id:node.id,number:steps.length+1,name:node.name,year:node.year,kind:node.kind,season:number,part,episodes:node.episodes,alternatives:model.nodes.filter(n=>(model.edges || []).some(e=>e.relation==='alternative_version' && (e.from===node.id && e.to===n.id || e.to===node.id && e.from===n.id))).map(n=>({id:n.id,kind:n.kind,season:Number(n.record?.season)||0}))};
  steps.push(step);if(number)previous={node,step};
 }
 return steps;
}
export function franchiseMenuGroups(model,canonical={}){
 const order=franchiseViewingOrder(model),steps=new Map(order.map(step=>[step.id,step])),seen=new Set();
 const story=model.rows.find(row=>row.key==='story'),nodes=new Map(model.nodes.map(node=>[node.id,node]));
 const first=nodes.get(story?.results[0]?.id);
 const base=String(story?.results[0]?.title || '').replace(/[\u2013\u2014]/g,'-').trim();
 const sharedSeries=new Map(),seasonLabels=new Map();
 for(const step of order){
  const record=nodes.get(step.id)?.record;
  if(!step.season || !record?.tv || !Number.isInteger(record.season) || record.season<1 || record.absolute)continue;
  const group=sharedSeries.get(record.tv) || [];
  group.push({step,record});sharedSeries.set(record.tv,group);
 }
 for(const group of sharedSeries.values()){
  // An absolute release or an index beginning midway through a series does
  // not prove a one-to-one sequence of seasons.
  if(group.length<2 || group[0].record.season!==1 || group[0].record.offset)continue;
  let season=0;
  for(const {step} of group){
   if(step.part<2 || !season)season++;
   seasonLabels.set(step.id,season);
  }
 }
 return model.rows.map(row=>{
  let source=row.key==='story' && order.length?order.map(step=>row.results.find(card=>card.id===step.id)).filter(Boolean):row.results;
  const television=source.filter(c=>['tv','ona'].includes(c.minimal_anime_kind)),seasons=(canonical.seasons || []).filter(s=>s.season_number>0 && s.episode_count>0 && s.air_date && s.air_date<=new Date().toISOString().slice(0,10));
  if(row.key==='story' && television.length===1 && seasons.length>1 && seasons.reduce((sum,s)=>sum+s.episode_count,0)===television[0].episodes)source=source.flatMap(c=>c===television[0]?seasons.map(s=>({...c,minimal_franchise_season:s.season_number})):c);
  const entries=source.filter(card=>{
   const node=model.nodes.find(n=>n.id===card.id),name=(node?.original || '')+' '+(node?.url || '')+' '+(card.title || '');
   const identity=card.id+':'+(card.minimal_franchise_season || 0);if(seen.has(identity) || ['music','pv','cm'].includes(node?.kind) || row.key==='related' && /manner[- _]eizou|урок хороших манер|(?:\s+x\s+|×)/i.test(name))return false;
   seen.add(identity);return true;
  }).map(card=>{
   const originalStep=steps.get(card.id),step=card.minimal_franchise_season?{...originalStep,season:card.minimal_franchise_season}:originalStep,kind=card.minimal_anime_kind,type=kind==='movie'?t('Фильм'):step?.season?t('Сезон {0}',[step.season]):kind==='ova'?'OVA':['special','tv_special'].includes(kind)?t('Спецвыпуски'):t('Сериал');
      const full=String(card.title || card.name || '').replace(/[\u2013\u2014]/g,'-');
   let short=base && full.toLowerCase().startsWith(base.toLowerCase())?full.slice(base.length).replace(/^[\s:.-]+/,''):full;
   if(step?.part)short=short.replace(/(?:[.\s:-]+)?(?:часть|part|cour)\s*\d+$/i,'').replace(/\s+\d+$/,'').trim();
   if(!short || /^(?:\d+|[ivx]+|(?:часть|part|season|сезон)\s*\d+|\d+\s*(?:сезон|season))$/i.test(short))short='';
   const release=nodes.get(card.id);
   const separateSeries=['tv','ona'].includes(kind) && release?.record?.tv && first?.record?.tv && release.record.tv!==first.record.tv;
   const label=card.minimal_franchise_season?t('Сезон {0}',[card.minimal_franchise_season]):(separateSeries?full:short) || full || type;
   const heading=label+(step?.part?' · '+t('Часть {0}',[step.part]):'');
   const count=card.minimal_franchise_season?canonical.seasons?.find(s=>s.season_number===card.minimal_franchise_season)?.episode_count:card.episodes;
   const format=kind==='movie'?t('Фильм'):kind==='ova'?'OVA':kind==='ona'?'ONA':['special','tv_special'].includes(kind)?t('Спецвыпуски'):t('Сериал');
   const season=card.minimal_franchise_season || seasonLabels.get(card.id);
   const status=card.status==='anons'?t('Анонс'):card.status==='ongoing'?t('Выходит'):card.status==='released'?t('Вышло'):'';
   const node=model.nodes.find(n=>n.id===card.id),parent=canonical.media_type!=='movie' && Number(canonical.tmdb_id || canonical.id)>0 && row.key==='story' && model.complete?{id:Number(canonical.tmdb_id || canonical.id),type:'tv'}:null;
   const destination=parent && !node?.record?.tv?{...card,minimal_franchise_parent:parent,minimal_franchise_release:{aired:node?.aired,released:node?.released,episodes:node?.episodes}}:card;
   return {card:destination,title:heading,subtitle:[String(card.release_date || card.first_air_date || '').slice(0,4),format,season?t('Сезон {0}',[season]):'',count>0?pluralSource(['%s серия','%s серии','%s серий'],count):'',status].filter(Boolean).join(' · '),icon:kind==='movie'?'▷':kind==='ova'?'◇':['special','tv_special'].includes(kind)?'✦':'▤'};
  });
  return {key:row.key,title:row.key==='story'?t('Порядок просмотра'):row.title,entries};
 }).filter(group=>group.entries.length);
}
