import {text} from './i18n.js';
const statuses=new Set(['look','viewed','scheduled','continued','thrown']);
const descriptions={book:'Сохранённые фильмы и сериалы',like:'То, что вам понравилось',wath:'То, что хотите посмотреть позже'};

// Decorate native card menus; native callbacks, independent lists and CUB
// permissions remain owned by Lampa. Unavailable Premium actions stay hidden.
export default function favoriteMenu(L,enabled=()=>true){
 if(!L.Select?.show)return;
 const show=L.Select.show;
 L.Select.show=function(options,...args){
  const items=options?.items;
  if(!enabled() || !Array.isArray(items) || !['book','like','wath','history'].every(key=>items.some(item=>item.where===key)))return show.call(this,options,...args);
  const premium=L.Account?.hasPremium?.();
  const decorated=[];
  for(let i=0;i<items.length;i++){
   const item=items[i];
   if(statuses.has(item.where) && (item.noenter || premium===false))continue;
   // Drop only a separator whose entire native status group is unavailable.
   if(item.separator && statuses.has(items[i+1]?.where)){
    let end=i+1;while(end<items.length && statuses.has(items[end].where))end++;
    if(items.slice(i+1,end).every(row=>row.noenter || premium===false))continue;
   }
   decorated.push(descriptions[item.where]?{...item,subtitle:text(descriptions[item.where])}:item);
  }
  return show.call(this,{...options,items:decorated},...args);
 };
}
