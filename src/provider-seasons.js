import {catalogueRows,folderRows} from './online-state.js';
import {isAnime} from './metadata.js';
const playable=row=>row && ['play','call'].includes(row.method);
export function nativeSeasonPlan(rows,base){
 if(!Array.isArray(rows) || !rows.length || rows.length>30)return [];
 let origin;try{origin=new URL(base);}catch(error){return [];}
 const known=new Set();let template=null,param='';
 for(const row of rows){
  if(row.similar || row.method!=='link')return [];
  let url;try{url=new URL(row.url,base);}catch(error){return [];}
  if(url.origin!==origin.origin || url.pathname!==origin.pathname)return [];
  const field=['s','season'].find(key=>/^\d+$/.test(url.searchParams.get(key) || ''));
  if(!field || param && field!==param)return [];
  const n=Number(url.searchParams.get(field)),label=String(row.name || row.title || row.text || '');
  if(!/(?:сезон|season)/i.test(label) && Number(row.season)!==n)return [];
  if(n>30 || known.has(n))return [];known.add(n);param=field;template=template || url;
 }
 const max=Math.max(...known);if(max<2)return [];
 return Array.from({length:max},(_,i)=>i+1).filter(n=>!known.has(n)).map(number=>{const url=new URL(template);url.searchParams.set(param,String(number));return {number,url:url.href};});
}
// Recover only real holes in this source's own navigation. No TMDB counts,
// another provider's seasons, or another dub's episode count are consulted.
export default function providerSeasons(L){
 const cache=new Map();
 return function restore(card,base,body,done){
  if(!isAnime(card) || typeof body!=='string')return done(body);
  if(catalogueRows(body).some(playable))return done(body);
  const rows=folderRows(body),plan=nativeSeasonPlan(rows,base);if(!plan.length)return done(body);
  const key=JSON.stringify([L.Timeline?.filename?.() || '',L.Storage?.get?.('account_email','') || '',L.Storage?.get?.('language','ru') || 'ru'])+'|'+base+'|'+body,hit=cache.get(key);if(hit && Date.now()-hit.at<120000)return done(hit.body);
  let cursor=0,running=0,left=plan.length,ended=false;const ready=[],seen=new Set();
  const timer=setTimeout(finish,6000);
  function identity(row){try{const u=new URL(row.stream || row.url,base);return u.searchParams.get('link') || u.href;}catch(error){return '';}}
  function finish(){if(ended)return;ended=true;clearTimeout(timer);if(!ready.length)return done(body);
   const box=document.createElement('div');box.innerHTML=body;const line=box.querySelector('.videos__line') || box;
   for(const part of ready.sort((a,b)=>a.number-b.number)){const node=document.createElement('div');node.className='videos__item videos__season selector';node.setAttribute('data-json',JSON.stringify({method:'link',season:part.number,name:part.number+' сезон',url:part.url}));node.textContent=part.number+' сезон';line.appendChild(node);}
   const result=box.innerHTML;cache.set(key,{at:Date.now(),body:result});while(cache.size>16)cache.delete(cache.keys().next().value);done(result);
  }
  function pump(){while(!ended && running<2 && cursor<plan.length){const part=plan[cursor++];running++;const net=new L.Reguest();net.timeout(2500);let settled=false;const deadline=setTimeout(()=>accept(''),2800);
   function accept(value){if(settled)return;settled=true;clearTimeout(deadline);running--;if(ended)return;
    const files=catalogueRows(value).filter(playable),numbers=new Set(files.map(row=>Number(row.episode))),ids=files.map(identity);
    if(files.length && numbers.size===files.length && files.every(row=>Number(row.season)===part.number && Number.isInteger(Number(row.episode)) && Number(row.episode)>=0) && ids.every(Boolean) && !ids.some(id=>seen.has(id))){ready.push(part);ids.forEach(id=>seen.add(id));}
    if(!--left)finish();else pump();
   }
   try{net.native(part.url,accept,()=>accept(''),false,{dataType:'text'});}catch(error){accept('');}
  }}pump();
 };
}
