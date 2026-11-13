// Rebuildable metadata belongs to the tab, not the account backup.
const keys=new Set(['minimal_catalogue_cache_v1','minimal_card_info_v1','minimal_quality_v2','minimal_series_release_v5','minimal_trakt_metadata_v1']);
const instances=new WeakMap();
function memoryFor(L){if(!instances.has(L))instances.set(L,new Map());return instances.get(L);}
export function readCache(L,key,fallback=[]){
 if(!keys.has(key))throw new Error('Unknown metadata cache');
 let value=memoryFor(L).get(key);
 try{const saved=window.sessionStorage.getItem(key);if(saved)value=JSON.parse(saved);}catch(error){}
 if(value===undefined){try{value=L.Storage?.get(key,fallback);}catch(error){}}
 if(value===undefined)value=fallback;
 writeCache(L,key,value);
 return value;
}
export function writeCache(L,key,value){
 if(!keys.has(key))throw new Error('Unknown metadata cache');
 memoryFor(L).set(key,value);
 try{window.sessionStorage.setItem(key,JSON.stringify(value));}catch(error){}
 // Delete only rebuildable plugin metadata; never account settings or history.
 try{window.localStorage.removeItem(key);}catch(error){}
}
