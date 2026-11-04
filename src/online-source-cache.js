// Cache only a completed native discovery, never an early partial life response.
export default function onlineSourceCache(L){
 const cache=new Map(),ttl=120000;
 return function install(comp,object){
  if(!comp || comp.lampaViewSourceCache || !object || object.balanser || !['parseJsonDate','display','filter','createSource','startSource','requestParams','render'].every(key=>typeof comp[key]==='function'))return;
  comp.lampaViewSourceCache=true;const native=comp.createSource;
  function key(){return JSON.stringify([L.Timeline && L.Timeline.filename?L.Timeline.filename():'default',L.Storage.get('account_email',''),L.Storage.get('language','ru'),comp.requestParams(''),L.Storage.get('alc_auto_src_off',[])]);}
  function copy(rows){return rows.map(row=>({...row}));}
  comp.createSource=function(){
   const scope=key(),entry=cache.get(scope);
   if(entry && Date.now()-entry.at<ttl){
    const explicit=object.lampac_custom_select;
    if(!explicit || entry.rows.some(row=>String(row.balanser || row.name.split(' ')[0]).toLowerCase()===explicit))return comp.startSource(copy(entry.rows));
   }
   cache.delete(scope);
   return native.apply(this,arguments).then(rows=>{
    const root=comp.render(),waiting=root && (root.find?root.find('.lampac-balanser-loader').length:root.querySelector('.lampac-balanser-loader'));
    if(!waiting && Array.isArray(rows) && rows.length && rows.every(row=>row && typeof row.name==='string' && row.name && typeof row.url==='string' && row.url)){
     cache.set(scope,{at:Date.now(),rows:copy(rows)});while(cache.size>32)cache.delete(cache.keys().next().value);
    }
    return rows;
   });
  };
 };
}
