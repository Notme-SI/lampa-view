import tmdbGet from './tmdb.js';

function translated(value,language){
 if(!value || typeof value!=='object')return value;
 return value[language] || value.ru || Object.values(value)[0] || value;
}

function imageUrls(L,value,language,size){
 value=translated(value,language);
 if(typeof value!=='string')return [];
 const url=value.trim().replace(/^\/\//,'https://');
 const isUrl=/^https?:\/\//i.test(url);
 const path=url.replace(/^https?:\/\/[^/]+\//i,'').replace(/^\/+/, '');
 const tmdb=path.match(/(?:^|\/)t\/p\/(?:w\d+(?:_and_h\d+_face)?|original)\/+([\w-]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i);
 const file=tmdb?.[1] || (!isUrl && /^[\w-]+\.(?:jpe?g|png|webp)$/i.test(path)?path:'');
 if(!file)return isUrl?[url]:[];
 const imagePath='t/p/'+size+'/'+file;
 return [L.TMDB?.image(imagePath,{preserveSize:true}),isUrl?url:null,'https://image.tmdb.org/'+imagePath].filter(Boolean);
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
   },()=>resolve(''),{life:60*24*7})).catch(()=>'');
   pending.set(query.path,request);
   const clear=()=>pending.delete(query.path);
   request.then(clear,clear);
  }
  return pending.get(query.path);
 }

 function loadImage(row,image,choices,loaded,lookup){
  if(!image || (!choices.length && !lookup))return;
  let index=0,source='',waiting=false;
  const placeholder='./img/img_broken.svg';
  function next(){
   if(index<choices.length){source=choices[index++];image.src=source;return;}
   if(lookup){
    const get=lookup;lookup=null;waiting=true;source='';
    get().then(urls=>{
     if(!row.isConnected)return;
     waiting=false;choices.push(...urls.filter(url=>!choices.includes(url)));next();
    });
    return;
   }
   source=placeholder;image.src=source;
  }
  row.addEventListener('error',event=>{
   if(event.target!==image)return;
   event.stopImmediatePropagation();
   if(source!==placeholder && !waiting)next();
  },true);
  image.addEventListener('load',()=>{if(source && source!==placeholder && image.getAttribute('src')===source)loaded();});
  window.jQuery(row).on('visible',()=>{
   if(source){if(image.getAttribute('src')!==source)image.src=source;}
   else if(!waiting)next();
  });
 }

 modal.follow('fullshow',event=>{
  const root=event.html?.[0] || event.html;
  if(!enabled() || !root || (!entries && event.active?.title!==L.Lang.translate('title_notice')))return;
  root.classList.add('pt-notices');
  const rows=root.querySelectorAll('.notice--card');
  if(!entries || rows.length!==entries.length)return;
  rows.forEach((row,index)=>{
   const {choices,query,language,author,kind}=entries[index];
   loadImage(row,row.querySelector('.notice__left img'),choices,()=>{
    row.classList.remove('image--none');
    row.classList.add('image--'+kind,'image--loaded');
   },query?()=>cataloguePoster(query).then(path=>imageUrls(L,path,language,'w342')):null);
   loadImage(row,row.querySelector('.notice__author-img img'),author,()=>{
    row.classList.add('image-author--loaded');
   });
  });
 });
 const open=notice.open;
 notice.open=function(){
  const view=this.classes?.[this.display];
  if(!enabled() || !view?.items)return open.apply(this,arguments);
  const items=view.items,own=Object.prototype.hasOwnProperty.call(view,'items');
  view.items=function(){
   const language=L.Storage.get('tmdb_lang','ru'),authorLanguage=L.Storage.get('language','ru');
   entries=[];
   return items.call(this).map(entry=>{
    const card=entry.card;
    const person=entry.author?.name || entry.author?.img || entry.author?.profile_path?entry.author:translated(entry.author,authorLanguage);
    const kind=entry.poster || card?'poster':entry.icon?'icon':'img';
    const premium=entry.icon && /^extend_premium_/.test(String(entry.id || ''));
    const choices=[...new Set([entry.poster,card?.poster_path,card?.poster,card?.img,entry.icon,entry.img,
      premium?'https://cub.best/img/icons/premium_two.svg':null].flatMap(value=>imageUrls(L,value,language,'w342')))];
    const author=[...new Set([person?.img,person?.profile_path].flatMap(value=>imageUrls(L,value,authorLanguage,'w185')))];
    entries.push({choices,query:card && cataloguePath(card),language,author,kind});
    const rendered={...entry};
    if(choices.length)rendered[kind]=choices[0];
    if(person && typeof person==='object')rendered.author={[authorLanguage]:{...person,img:author[0] || ''}};
    return rendered;
   });
  };
  try{return open.apply(this,arguments);}
  finally{entries=null;if(own)view.items=items;else delete view.items;}
 };
}
