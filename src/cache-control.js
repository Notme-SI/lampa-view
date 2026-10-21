const registries=new WeakMap();
export default function cacheControl(L){
 if(registries.has(L))return registries.get(L);
 const handlers={ratings:new Set(),quality:new Set()};
 const control={register(type,fn){handlers[type].add(fn);},clear(type){handlers[type].forEach(fn=>fn());}};
 registries.set(L,control);return control;
}
export function cacheSettings(L){
 if(!L.SettingsApi)return;
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_quality_fallback',type:'trigger',default:true},field:{name:'Резервная проверка качества',description:'Если парсер не определил качество, проверить Alloha через ваш сервер онлайн-источников.'},onChange:()=>cacheControl(L).clear('quality')});
 for(const [type,name,description] of [['ratings','Очистить кеш рейтингов','Удалить сохранённые оценки. История и закладки сохранятся.'],['quality','Очистить кеш качества','Удалить сохранённое качество карточек каталога и заново проверить видимые карточки.']])L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_clear_'+type,type:'button'},field:{name,description},onChange:()=>{cacheControl(L).clear(type);if(L.Noty)L.Noty.show('Кеш '+(type==='ratings'?'рейтингов':'качества')+' очищен');}});
}
