const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {version,shardCount,titleKeys,shardFor,validFrames,validUrl}=require('../src/frame-catalogue.cjs');
const sources=require('./frame-catalogue-sources.cjs');

const root=path.join(__dirname,'..'),output=path.join(root,'docs','frames','v1');
const sourceNames=['filmGrab','bluscreens','ghibli','wiki'];

function normalize(record){
 if(!['movie','tv'].includes(record?.media) || typeof record.title!=='string' || !validUrl(record.origin))return null;
 const keys=titleKeys(record.media,record.title,record.year),frames=validFrames(record.frames);
 if(!keys.length || !frames.length || !/^[a-z][a-z0-9-]{1,30}$/.test(record.source || ''))return null;
 const tmdb=Number(record.tmdb);
 if(Number.isSafeInteger(tmdb) && tmdb>0)keys.unshift('tmdb:'+record.media+':'+tmdb);
 const titleIdentity=record.media+':'+record.title+':'+record.year;
 const id=crypto.createHash('sha256').update(record.source+'|'+titleIdentity+'|'+(tmdb || '')).digest('hex').slice(0,24);
 return {id,media:record.media,title:record.title,year:Number(record.year),...(tmdb>0?{tmdb}:{}),titleIdentity,
  keys:[...new Set(keys)],source:record.source,origin:record.origin,priority:Number(record.priority)||50,frames};
}

async function previous(){
 const records=new Map();
 for(let number=0;number<shardCount;number++){
  try{
   const data=JSON.parse(await fs.readFile(path.join(output,number.toString(16).padStart(2,'0')+'.json'),'utf8'));
   if(data.version===version)for(const row of Object.values(data.records || {})){
    const record=normalize(row);if(record)records.set(record.id,record);
   }
  }catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return records;
}

async function write(records,updated){
 const shards=Array.from({length:shardCount},()=>({version,entries:{},records:{}}));
 for(const record of [...records.values()].sort((a,b)=>a.id.localeCompare(b.id))){
  for(const key of record.keys){
   const shard=shards[parseInt(shardFor(key),16)];
   (shard.entries[key] ||= []).push(record.id);shard.records[record.id]=record;
  }
 }
 await fs.mkdir(output,{recursive:true});
 const staging=await fs.mkdtemp(path.join(output,'.refresh-'));
 try{
  for(let number=0;number<shardCount;number++){
   const shard=shards[number],sorted={};
   for(const key of Object.keys(shard.entries).sort())sorted[key]=shard.entries[key].sort();
   shard.entries=sorted;
   await fs.writeFile(path.join(staging,number.toString(16).padStart(2,'0')+'.json'),JSON.stringify(shard)+'\n');
  }
  const counts={};
  for(const record of records.values())counts[record.source]=(counts[record.source] || 0)+1;
  const manifest={version,shards:shardCount,records:records.size,sources:counts,updated};
  await fs.writeFile(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const file of await fs.readdir(staging))await fs.rename(path.join(staging,file),path.join(output,file));
  console.log(JSON.stringify(manifest));
 }finally{await fs.rm(staging,{recursive:true,force:true});}
}

async function update(){
 const records=await previous(),seeds=JSON.parse(await fs.readFile(path.join(root,'data','frame-catalogue-seeds.json'),'utf8'));
 for(const row of seeds.records){const record=normalize(row);if(!record)throw new Error('Invalid verified frame seed');records.set(record.id,record);}
 const wanted=sourceNames;
 let successes=0;
 for(const name of wanted){
  try{
   const rows=await sources[name](seeds);
   const normalized=rows.map(normalize);
   if(!rows.length || normalized.some(row=>!row))throw new Error('Invalid '+name+' source output');
   const source=normalized[0].source,old=[...records.values()].filter(row=>row.source===source);
   if(old.length && normalized.length<old.length*0.85)throw new Error(name+' unexpectedly lost more than 15% of its galleries');
   // Retain a last-known gallery when its source page is temporarily absent.
   for(const row of normalized)records.set(row.id,row);
   successes++;
   console.log(name+': '+normalized.length+' galleries');
  }catch(error){console.warn(name+': keeping last verified data. '+error.message);}
 }
 if(wanted.length && !successes)throw new Error('All catalogue sources failed, publication cancelled');
 if(records.size<400)throw new Error('Catalogue is unexpectedly small');
 await write(records,new Date().toISOString());
}

module.exports={normalize,write,previous};
if(require.main===module)update().catch(error=>{console.error(error.message);process.exitCode=1;});
