import {locale,text as t} from './i18n.js';
import {animeRecords,animeTargets} from './anime-index.js';
const positive=n=>Number.isSafeInteger(Number(n)) && Number(n)>0;
const kindNames={'TV Сериал':'tv','Фильм':'movie','Спецвыпуск':'special','TV Спецвыпуск':'tv_special','Музыка':'music','Клип':'music','OVA':'ova','ONA':'ona'};
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))?String(value):'';
export function franchiseModel(graph,seed,metadata=[]){
 if(!graph || Number(graph.current_id)!==Number(seed) || !Array.isArray(graph.nodes) || !Array.isArray(graph.links) || graph.nodes.length<2 || graph.nodes.length>240 || graph.links.length>1800)return null;
 const details=new Map(metadata.filter(v=>v && positive(v.id)).map(v=>[Number(v.id),v])),nodes=new Map(),edges=[],seen=new Set();
 for(const node of graph.nodes){const id=Number(node.id);if(!positive(id) || nodes.has(id) || typeof node.name!=='string' || !node.name.trim())return null;
  const meta=details.get(id)||{},records=animeRecords({source:'minimal_shiki',id}),record=records.length===1?records[0]:null,kind=meta.kind || record && record.kind || kindNames[node.kind] || String(node.kind || '').toLowerCase(),aired=date(meta.aired_on),year=aired.slice(0,4) || (Number(node.year)>=1900 && Number(node.year)<=2200?String(node.year):'');
  nodes.set(id,{id,name:locale()==='ru'?(meta.russian || node.name || meta.name):(meta.name || node.name),original:meta.name || '',kind,aired,released:date(meta.released_on),year,status:meta.status || '',episodes:Number(meta.episodes)||0,airedCount:Number(meta.episodes_aired)||0,poster:meta.image && meta.image.original || node.image_url || '',record});
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
 for(const group of variants.values()){group.sort(compare);const selected=group.includes(Number(seed))?Number(seed):group[0];for(const id of group){representative.set(id,selected);if(id!==selected)alternatives.add(id);}}
 const main=new Set([...story].map(id=>representative.get(id)||id)),directed=new Map([...main].map(id=>[id,new Set()]));
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
