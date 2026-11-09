import tmdbGet from './tmdb.js';

function posterUrls(L,value,language){
 if(value && typeof value==='object')value=value[language] || value.ru || value.en;
 if(typeof value!=='string')return [];
 const url=value.trim().replace(/^\/\//,'https://');
 const isUrl=/^https?:\/\//i.test(url);
 const path=url.replace(/^https?:\/\/[^/]+\//i,'').replace(/^\/+/, '');
 const tmdb=path.match(/^t\/p\/(?:w\d+|original)\/([\w-]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i);
 const file=tmdb?.[1] || (!isUrl && /^[\w-]+\.(?:jpe?g|png|webp)$/i.test(path)?path:'');
 if(!file)return isUrl?[url]:[];
 const imagePath='t/p/w342/'+file;
 return [L.TMDB?.image(imagePath,{preserveSize:true}),isUrl?url:'https://image.tmdb.org/'+imagePath].filter(Boolean);
}

function cataloguePath(card){
 const kind=card.media_type==='tv' || card.seasons || card.number_of_seasons || card.first_air_date?'tv':'movie';
 const id=card.tmdb_id || (card.source==='tmdb'?card.id:null);
 if(/^\d+$/.test(String(id)))return {kind,path:kind+'/'+id};
 if(/^tt\d+$/.test(card.imdb_id || ''))return {kind,path:'find/'+card.imdb_id+'?external_source=imdb_id'};
 return null;
}

export default function notices(L,enabled){
 const notice=L.Notice,modal=L.Modal?.listener;
 if(!notice?.open || !modal)return;
 let entries;
 const pending=new Map();
 function cataloguePoster(query){
  if(!pending.has(query.path)){
   const request=new Promise(resolve=>tmdbGet(L,query.path,{},data=>{
    const result=query.path.startsWith('find/')?data?.[query.kind+'_results']?.find(item=>item.poster_path):data;
    resolve(result?.poster_path || '');
   },()=>resolve(''),{life:60*24*7}));
   pending.set(query.path,request);
   const clear=()=>pending.delete(query.path);
   request.then(clear,clear);
  }
  return pending.get(query.path);
 }
 modal.follow('fullshow',event=>{
  const root=event.html?.[0] || event.html;
  if(!enabled() || !root || (!entries && event.active?.title!==L.Lang.translate('title_notice')))return;
  root.classList.add('pt-notices');
  const rows=root.querySelectorAll('.notice--card');
  if(!entries || rows.length!==entries.length)return;
  rows.forEach((row,index)=>{
   const image=row.querySelector('.notice__left img');
   const entry=entries[index];
   if(!image || !entry.card)return;
   const {choices,query,language}=entry;
   let candidate=choices.length?1:0,lookup=query,fallback='';
   function next(){
    if(candidate<choices.length){fallback=choices[candidate++];image.src=fallback;return;}
    if(!lookup)return;
    const request=lookup;
    lookup=null;
    cataloguePoster(request).then(path=>{
     if(!row.isConnected)return;
     choices.push(...posterUrls(L,path,language).filter(url=>!choices.includes(url)));
     if(candidate<choices.length)next();
    },()=>{});
   }
   row.addEventListener('error',event=>{
    if(event.target!==image || (candidate>=choices.length && !lookup))return;
    event.stopImmediatePropagation();
    next();
   },true);
   image.addEventListener('load',()=>{
    if(fallback && image.getAttribute('src')===fallback){row.classList.remove('image--none');row.classList.add('image--poster','image--loaded');}
   });
   window.jQuery(row).on('visible',()=>{
    if(fallback)image.src=fallback;
    else if(!choices.length)next();
   });
  });
 });
 const open=notice.open;
 notice.open=function(){
  const view=this.classes?.[this.display];
  if(!enabled() || !view?.items)return open.apply(this,arguments);
  const items=view.items,own=Object.prototype.hasOwnProperty.call(view,'items');
  view.items=function(){
   const language=L.Storage.get('tmdb_lang','ru');
   entries=[];
   return items.call(this).map(entry=>{
    const card=entry.card;
    const choices=card?[...new Set([entry.poster,card.poster_path,card.poster,card.img]
      .flatMap(value=>posterUrls(L,value,language)))]:[];
    entries.push({card,choices,query:card && cataloguePath(card),language});
    return choices.length?{...entry,poster:choices[0]}:entry;
   });
  };
  try{return open.apply(this,arguments);}
  finally{entries=null;if(own)view.items=items;else delete view.items;}
 };
}
