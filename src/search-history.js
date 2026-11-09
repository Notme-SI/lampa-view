import {text as t} from './i18n.js';
// Keep explicit local deletions across a late CUB merge, without altering watches.
export default function searchHistory(L){
 const storage=L.Storage,get=storage.get,set=storage.set,remove=storage.remove,key='minimal_search_deleted_v1';
 const scope=()=>String(get.call(storage,'account_email','') || '')+'|'+(L.Timeline && L.Timeline.filename?L.Timeline.filename():'local');
 const journal=()=>get.call(storage,key,{}) || {};
 function deleted(){return journal()[scope()] || [];}
 function remember(values){const all=journal();all[scope()]=Array.from(new Set(deleted().concat(values))).slice(-2000);set.call(storage,key,all,true);}
 function allow(value){const all=journal(),before=all[scope()] || [];if(before.includes(value)){all[scope()]=before.filter(v=>v!==value);set.call(storage,key,all,true);}}
 storage.get=function(name){const value=get.apply(this,arguments);return name==='search_history' && Array.isArray(value)?value.filter(v=>!deleted().includes(v)):value;};
 storage.set=function(name,value,silent){
  if(name==='search_history' && Array.isArray(value)){
   const input=typeof document!=='undefined' && document.querySelector('.search__input.filled'),query=input && input.textContent.trim();
   if(!silent && query && document.body.classList.contains('search--open'))allow(query);
   value=value.filter(v=>!deleted().includes(v));
  }
  return set.call(this,name,value,silent,arguments[3]);
 };
 storage.remove=function(name,value){if(name==='search_history' && typeof value==='string'){
  remember([value]);const current=get.call(storage,name,[]);if(Array.isArray(current))set.call(storage,name,current.filter(v=>v!==value));
 }return remove && remove.apply(this,arguments);};
 function clear(){const current=storage.get('search_history',[]);remember(Array.isArray(current)?current:[]);if(storage.clean)storage.clean('search_history');storage.set('search_history',[]);}
 if(L.SettingsApi)L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_clear_search_history',type:'button'},field:{name:t('Очистить историю поиска'),description:t('Только поисковые запросы. История просмотров, прогресс и закладки сохранятся.')},onChange(){L.Select.show({title:t('Очистить историю поиска?'),items:[{title:t('Очистить'),value:true},{title:t('Отмена'),value:false}],onSelect:row=>{if(row.value){clear();L.Noty.show(t('История поиска очищена'));}L.Controller.toggle('settings_component');},onBack:()=>L.Controller.toggle('settings_component')});}});
 return {allow,clear};
}
