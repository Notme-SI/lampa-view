function posterUrl(L,value,language){
 if(value && typeof value==='object')value=value[language] || value.ru || value.en;
 if(typeof value!=='string')return '';
 const path=value.trim();
 if(/^https?:\/\//i.test(path))return path;
 if(path.startsWith('//'))return 'https:'+path;
 const tmdb=path.replace(/^\/+/, '');
 if(/^t\/p\/(?:w\d+|original)\/[\w.-]+$/i.test(tmdb))return L.TMDB?.image(tmdb,{preserveSize:true}) || '';
 if(/^[\w-]+\.(?:jpe?g|png|webp)$/i.test(tmdb))return L.TMDB?.image('t/p/w342/'+tmdb,{preserveSize:true}) || '';
 return '';
}

export default function notices(L,enabled){
 const notice=L.Notice,modal=L.Modal?.listener;
 if(!notice?.open || !modal)return;
 let posters;
 modal.follow('fullshow',event=>{
  const root=event.html?.[0] || event.html;
  if(!enabled() || !root || (!posters && event.active?.title!==L.Lang.translate('title_notice')))return;
  root.classList.add('pt-notices');
  const rows=root.querySelectorAll('.notice--card');
  if(!posters || rows.length!==posters.length)return;
  rows.forEach((row,index)=>{
   const image=row.querySelector('.notice__img img');
   const choices=posters[index];
   if(!image || choices.length<2)return;
   let candidate=1;
   row.addEventListener('error',event=>{
    if(event.target!==image || candidate>=choices.length)return;
    event.stopImmediatePropagation();
    image.src=choices[candidate++];
   },true);
  });
 });
 const open=notice.open;
 notice.open=function(){
  const view=this.classes?.[this.display];
  if(!enabled() || !view?.items)return open.apply(this,arguments);
  const items=view.items,own=Object.prototype.hasOwnProperty.call(view,'items');
  view.items=function(){
   const language=L.Storage.get('tmdb_lang','ru');
   posters=[];
   return items.call(this).map(entry=>{
    const card=entry.card;
    const choices=card?[...new Set([entry.poster,card.poster_path,card.poster,card.img]
      .map(value=>posterUrl(L,value,language)).filter(Boolean))]:[];
    posters.push(choices);
    return choices.length?{...entry,poster:choices[0]}:entry;
   });
  };
  try{return open.apply(this,arguments);}
  finally{posters=null;if(own)view.items=items;else delete view.items;}
 };
}
