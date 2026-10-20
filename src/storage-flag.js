export default function flag(L,key,fallback=true){
 if(!L || !L.Storage)return fallback;
 const value=L.Storage.value?L.Storage.value(key,''):L.Storage.get(key,fallback);
 return value==='' || value==null?fallback:![false,'false',0,'0','no'].includes(value);
}
