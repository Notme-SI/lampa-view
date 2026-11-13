import MESSAGES from './i18n-messages.json';
export const languages=['ru','en','uk','be','zh','pt','bg','he','cs','ro','fr','pl','es'];
let host;
export function locale(value){
 if(value===undefined){try{const L=host || (typeof window!=='undefined' && window.Lampa);value=L && L.Storage.get('language','ru');}catch(error){}}
 const code=String(value || 'ru').toLowerCase().replace('_','-').split('-')[0];
 return ({ua:'uk',iw:'he',cn:'zh'})[code] || (languages.includes(code)?code:'en');
}
const reverse=new Map();
Object.keys(MESSAGES).forEach(source=>{reverse.set(source,source);Object.values(MESSAGES[source]).forEach(value=>{if(typeof value==='string' && !reverse.has(value))reverse.set(value,source);});});
export function text(source,values,language){
 if(typeof source!=='string')return source;
 const code=locale(language),canonical=MESSAGES[source]?source:reverse.get(source),row=canonical && MESSAGES[canonical];
 const output=row?(code==='ru'?canonical:row[code] || row.en || canonical):source;
 return values?output.replace(/\{(\d+)\}/g,(_,i)=>values[i]===undefined?'{'+i+'}':String(values[i])):output;
}
export function pluralSource(forms,n){
 const code=locale();let category='other';
 try{category=new Intl.PluralRules(code).select(Number(n));}catch(error){const v=Math.abs(Number(n)),m=v%10,h=v%100;category=['ru','uk','be'].includes(code)?(m===1 && h!==11?'one':m>=2 && m<=4 && (h<12 || h>14)?'few':'other'):v===1?'one':code==='cs' && v>=2 && v<=4?'few':'other';}
 // Legacy source arrays are Russian one/few/many; translate the selected
 // whole message, never individual words or title metadata.
 const index=category==='one'?0:category==='few'?1:forms.length-1;
 return text(forms[index] || forms[forms.length-1] || '%s').replace(/%s/g,String(n));
}
export default function installI18n(L,P){
 L.Lang?.add?.({account_export_fail_413:{ru:'Бэкап превышает допустимый размер сервера. История и настройки сохранены на устройстве.',en:'The backup exceeds the server size limit. Your history and settings remain on this device.'}});
 host=L;P.text=text;P.sourceText=source=>reverse.get(source) || source;P.locale=locale;P.pluralSource=pluralSource;
 if(L.Lang && L.Lang.add){const add=L.Lang.add;L.Lang.add=function(messages){
  const translated={};Object.keys(messages || {}).forEach(key=>{const row=messages[key];
   if(!row || typeof row!=='object' || Array.isArray(row)){translated[key]=row;return;}
   const source=row.ru || reverse.get(row.en),entry={...row};
   if(source && MESSAGES[source])languages.forEach(code=>{if(!entry[code])entry[code]=text(source,undefined,code);});
   translated[key]=entry;
  });return add.call(this,translated);
 };}
 function update(){
  const code=locale();document.documentElement.lang=code;
  if(L.Storage.get('tmdb_lang','')!==code)L.Storage.set('tmdb_lang',code);
  document.body.classList.toggle('pt-rtl',code==='he');
  document.querySelectorAll('.head__action.open--search').forEach(node=>node.setAttribute('data-pt-placeholder',text('Поиск…')));
  document.querySelectorAll('.head__action.open--home').forEach(node=>{
   node.title=text('Главная');node.setAttribute('aria-label',node.title);
  });
 }
 update();if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(event.name==='language')update();});
 return {update};
}
