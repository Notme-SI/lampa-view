import {text as lampaViewText} from './i18n.js';
const registries=new WeakMap();
export default function cacheControl(L){
 if(registries.has(L))return registries.get(L);
 const handlers={ratings:new Set(),quality:new Set()};
 const control={register(type,fn){handlers[type].add(fn);},clear(type){handlers[type].forEach(fn=>fn());}};
 registries.set(L,control);return control;
}
export function cacheSettings(L){
 if(!L.SettingsApi)return;
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_quality_fallback',type:'trigger',default:true},field:{name:lampaViewText("Резервная проверка качества"),description:lampaViewText("Если парсер не определил качество, проверить Alloha через ваш сервер онлайн-источников.")},onChange:()=>cacheControl(L).clear('quality')});
 for(const [type,name,description] of [['ratings',lampaViewText("Очистить кеш рейтингов"),lampaViewText("Удалить сохранённые оценки. История и закладки сохранятся.")],['quality',lampaViewText("Очистить кеш качества"),lampaViewText("Удалить сохранённое качество карточек каталога и заново проверить видимые карточки.")]])L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_clear_'+type,type:'button'},field:{name,description},onChange:()=>{cacheControl(L).clear(type);if(L.Noty)L.Noty.show(lampaViewText("Кеш {0} очищен", [type==='ratings'?lampaViewText("рейтингов"):lampaViewText("качества")]));}});
}
