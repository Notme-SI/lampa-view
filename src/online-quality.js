// Adapted from the metadata-quality fallback in card_overlay.js. The configured
// Lampac performs provider authentication; no third-party API tokens are bundled.
export function qualityLabel(value){
 const text=String(value || '');
 if(/(^|\W)(?:hd)?cam(?:rip)?(\W|$)/i.test(text))return 'CAM';
 if(/(^|\W)(?:hd)?ts(?:rip)?(\W|$)/i.test(text))return 'TS';
 if(/2160|\b4k\b|uhd/i.test(text))return '4K';
 if(/1080|fhd/i.test(text))return '1080p';
 if(/720|\bhd\b/i.test(text))return '720p';
 if(/480|360|\bsd\b/i.test(text))return 'SD';
 if(/web[ .-]?dl/i.test(text))return 'WEB-DL';
 if(/bd[ .-]?rip|blu[ .-]?ray/i.test(text))return 'BDRip';
 if(/web[ .-]?rip/i.test(text))return 'WEBRip';
 return '';
}
const rank={CAM:1,TS:2,SD:3,WEBRip:4,BDRip:5,'WEB-DL':6,'720p':7,'1080p':8,'4K':9};
export function providerQuality(json){
 let best='',visited=0;
 function add(value){const q=qualityLabel(value);if((rank[q] || 0)>(rank[best] || 0))best=q;}
 function walk(value,depth){
  if(!value || typeof value!=='object' || depth>6 || ++visited>250)return;
  if(value.uhd===true || value.uhd===1)add('4K');
  for(const key of ['quality','qualitys','resolution','max_quality']){
   const field=value[key];if(field && typeof field==='object')Object.keys(field).forEach(add);else add(field);
  }
  // The provider's named stream variants can carry quality in their labels.
  if(value.method==='play' || value.method==='call'){add(value.name);if(/^(?:2160p?|1080p?|720p?|480p?|4k|uhd|fhd|hd|sd)$/i.test(String(value.voice_name || '')))add(value.voice_name);}
  if(Array.isArray(value))value.forEach(entry=>walk(entry,depth+1));else for(const key of ['data','results','items','list','playlists'])walk(value[key],depth+1);
 }
 walk(json,0);return best;
}
export default function onlineQuality(card,callback){
 const api=window.alc_auto_api;
 if(!api || typeof api.metadataQuality!=='function' || !/^\d+$/.test(String(card.tmdb_id || card.id)) || !['tmdb','cub',undefined,''].includes(card.source) && !card.tmdb_id){callback('');return ()=>{};}
 try{return api.metadataQuality({...card},json=>callback(providerQuality(json))) || (()=>{});}catch(error){callback('');return ()=>{};}
}
