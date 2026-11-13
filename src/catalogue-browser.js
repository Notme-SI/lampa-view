import {locale,text as t} from './i18n.js';
import {cataloguePlan} from './catalogue.js';
import {canonicalCountry,countryTitle,discoveryOptions,discoveryPlan} from './discovery-model.js';
import {DISCOVERY_SOURCE} from './discovery-source.js';
import tmdbGet from './tmdb.js';

export const BROWSE_KINDS=['movie','tv','cartoon','tvshow'];
export function browseOptions(kind,date=new Date()){
 const options=discoveryOptions(kind,date);
 const collections=cataloguePlan(kind,'standard',date).filter(row=>!row.key.startsWith('genre-') && (!row.minimal_default_hidden || ['votes','mixed-votes'].includes(row.key)) && row.key!=='popular' && row.key!=='mixed-popular' && !(kind==='tvshow' && row.key==='watch'));
 // Extend only the existing category filter. Home rows and the sidebar stay independent.
 if(['movie','cartoon'].includes(kind)){
  const revenue=discoveryPlan(kind,{sort:'revenue',format:'movie'},date)[0];
  if(revenue)collections.push({...revenue,key:'revenue',title:t('Кассовые сборы')});
 }
 const seen=new Set();
 const networks=['tv','cartoon'].includes(kind)?options.networks:[];
 const studios=options.studios.length?discoveryPlan(kind,{section:'studios'},date).map(row=>({...row,brand:options.studios.find(studio=>studio.id===row.discovery.company)})):[];
 return {collections:collections.filter(row=>{const key=JSON.stringify(row.discovery);if(seen.has(key))return false;seen.add(key);return true;}),networks,studios,countries:options.countries,genres:options.genres.filter(g=>kind==='movie'?g.genre!==16:kind==='tv'?![16,99,10762,10763,10764,10767].includes(g.genre):true)};
}
export const browseSorts=(kind,type)=>discoveryOptions(kind).sorts.filter(([key])=>key!=='revenue' || type!=='tv').map(([key,title])=>[key,key==='popular'?'Популярные':key==='new'?'Новые':title]);
export function yearRange(value,date=new Date()){
 const match=String(value || '').trim().match(/^(\d{4})(?:\s*[-–—:]\s*(\d{4}))?$/);
 if(!match)return '';
 const from=Number(match[1]),to=Number(match[2] || match[1]);
 return from>=1870 && to>=from && to<=date.getFullYear()?from+'-'+to:'';
}
function genresForType(options,type){
 return type?options.genres.filter(genre=>genre.formats.includes(type)):options.genres;
}
export function browseYears(kind,date=new Date(),selected=''){
 const year=date.getFullYear(),archiveEnd=year-8;
 const recent=Array.from({length:8},(_,i)=>({start:year-i,end:year-i}));
 const archives=discoveryOptions(kind,date).periods
  .filter(period=>period.start<=archiveEnd)
  .map(period=>({...period,end:Math.min(period.end,archiveEnd)}))
  .sort((a,b)=>b.end-a.end);
 const values=recent.concat(archives).map(({start,end})=>({title:start===end?String(start):start+'–'+end,value:start+'-'+end}));
 const saved=yearRange(selected,date);
 if(saved && !values.some(row=>row.value===saved))values.unshift({title:saved.replace('-','–'),value:saved});
 return [{title:t('Все годы'),value:''},...values,{title:t('Свой диапазон'),value:'custom'}];
}
export function browseState(kind,value={},date=new Date()){
 const options=browseOptions(kind,date);
 const selectedCountry=canonicalCountry(value.country || /^country-([A-Z]{2})$/.exec(value.collection || '')?.[1]);
 const country=options.countries.some(([code])=>code===selectedCountry)?selectedCountry:'';
 const collection=options.collections.find(r=>r.key===value.collection);
 const networkId=Number(value.network ?? /^network-(\d+)$/.exec(value.collection || '')?.[1]);
 let network=options.networks.find(row=>row.id===networkId)?.id || 0;
 let studio=options.studios.find(row=>row.key===(value.studio ?? value.collection));
 const media=collection?.discovery.type;
 if(media==='movie' || collection?.discovery.sort==='revenue')network=0;
 if(studio && media && studio.discovery.type!==media)studio=undefined;
 if(studio)network=0;
 const scopedType=studio?.discovery.type || (network?'tv':media);
 const sort=browseSorts(kind,scopedType).some(([key])=>key===value.sort)?value.sort:'';
 const type=(sort || collection?.discovery.sort)==='revenue'?'movie':scopedType;
 const genre=kind!=='tvshow' && genresForType(options,type).some(g=>g.id===String(value.genre))?String(value.genre):'';
 return {collection:collection?.key || '',genre,sort,period:yearRange(value.period,date),country,network,studio:studio?.key || ''};
}
export function browseSpec(kind,value={},date=new Date()){
 const state=browseState(kind,value,date),options=browseOptions(kind,date),row=options.collections.find(r=>r.key===state.collection);
 const spec={ordered:true,kind,type:kind==='cartoon'?'':kind==='movie'?'movie':'tv',country:'',genre:'',network:0,company:0,hero:'',...(row && row.discovery || {})};
 const studio=options.studios.find(row=>row.key===state.studio);
 if(studio){spec.company=studio.discovery.company;spec.type=studio.discovery.type;}
 if(state.network){spec.network=state.network;spec.type='tv';}
 spec.sort=state.sort || row?.discovery.sort || studio?.discovery.sort || 'popular';
 // Box office is a film statistic, including animated feature films.
 if(spec.sort==='revenue'){spec.type='movie';spec.network=0;}
 if(state.genre)spec.genre=state.genre;
 if(state.country)spec.country=state.country;
 spec.period=state.period;
 // Trending endpoints cannot filter or sort. Use Discover once parameters change.
 if(spec.feed==='trending' && (state.country || state.genre || state.period || state.sort || state.network || state.studio))delete spec.feed;
 return spec;
}

const platformNetworks=new Set([213,453,1024,2493,2552,2739,2859,3186,3353,3827,3871,3882,3923,4085,4330,5806]);
export function brandGroups(options){
 const networkRows=options.networks.map(brand=>({title:brand.name,brand,network:brand.id,studio:'',endpoint:'network'}));
 return [
  ['Студии',options.studios.map(row=>({title:row.title,brand:row.brand,studio:row.key,network:0,endpoint:'company'}))],
  ['Онлайн-кинотеатры',networkRows.filter(row=>platformNetworks.has(row.network))],
  ['Телеканалы',networkRows.filter(row=>!platformNetworks.has(row.network))]
 ].filter(([,rows])=>rows.length);
}

function brandLogos(L){
 const cache=new Map(),queue=[];
 let pending=0;
 function drain(){
  while(pending<2 && queue.length){
   const {key,resolve}=queue.shift();pending++;
   const finish=(path,failed=false)=>{
    if(failed)cache.delete(key);
    pending--;resolve(path);drain();
   };
   tmdbGet(L,key,{},data=>finish(/^\/[\w.-]+\.(png|svg|webp)$/i.test(data?.logo_path || '')?data.logo_path:''),()=>finish('',true));
  }
 }
 return (endpoint,brand)=>{
  const key=endpoint+'/'+brand.id;
  if(!cache.has(key)){
   cache.set(key,new Promise(resolve=>queue.push({key,resolve})));
   drain();
  }
  return cache.get(key) || Promise.resolve('');
 };
}

// Shared native-grid controls. Their controller also handles the first row on TV.
export function gridControls(L,item,object,buttons,{className='minimal-catalogue-controls',focusStart=true}={}){
 const bar=document.createElement('nav'),$=window.jQuery;bar.className=className;bar.setAttribute('aria-label',t('Параметры каталога'));
 let index=Math.max(0,Math.min(buttons.length-1,Number(object.minimal_filter_focus)||0)),disposed=false;
 const nodes=buttons.map((choice,i)=>{const button=document.createElement('button');button.type='button';button.className='minimal-catalogue-control selector';button.textContent=choice.title;button.setAttribute('aria-label',choice.label || choice.title);if(choice.selected!=null)button.setAttribute('aria-pressed',String(choice.selected));
  const choose=()=>{index=i;choice.choose(i);};$(button).on('keydown',event=>{if(event.key==='Enter' || event.key===' ')event.preventDefault();}).on('hover:focus',()=>{index=i;}).on('hover:enter',choose).on('click',event=>{event.preventDefault();event.stopImmediatePropagation();choose();});bar.appendChild(button);return button;});
 function focus(){if(disposed)return;item.scroll.update(bar,false);L.Controller.collectionSet(bar);L.Controller.collectionFocus(nodes[index],bar);}
 let filtering=focusStart;
 function toggle(){filtering=true;L.Controller.toggle('content');}
 item.use({onEmpty(){filtering=true;},onCreate(){item.scroll.prepend(bar);item.render(true).classList.add('minimal-catalogue-grid');},onController(controller){const original=controller.toggle,up=controller.up,down=controller.down,left=controller.left,right=controller.right;
  controller.toggle=function(){if(filtering)focus();else{original.apply(this,arguments);if(item.last)L.Controller.collectionFocus(item.last,item.scroll.render(true));}};
  controller.down=function(){if(!filtering)return down.apply(this,arguments);if(item.items.length){filtering=false;item.last=item.items[0].render(true);controller.toggle();}};
  controller.up=function(){if(filtering)return L.Controller.toggle('head');const first=item.items[0] && item.items[0].render(true),last=item.last;if(!last || !first || last.offsetTop===first.offsetTop){filtering=true;focus();}else up.apply(this,arguments);};
  controller.left=function(){if(!filtering)return left.apply(this,arguments);index=Math.max(0,index-1);focus();};controller.right=function(){if(!filtering)return right.apply(this,arguments);index=Math.min(nodes.length-1,index+1);focus();};
 },onDestroy(){disposed=true;nodes.forEach(node=>$(node).off());bar.remove();}});
 return {bar,toggle};
}

export default function catalogueBrowser(L,warmPosters){
 if(!L.Component || !L.Component.get)return;
 const Category=L.Component.get('category'),Full=L.Component.get('category_full'),list=L.Api.list;
 const logo=brandLogos(L);
 const warmed=new WeakMap();
 function warmNext(params,json,load){
  const active=L.Activity.active(),page=Number(json?.page || params.page)||1;
  if(!active || active!==params && active.activity?.component?.object!==params ||
     !document.body.matches('.lampa_view.pt-desktop') || document.hidden ||
     !(Number(json?.total_pages)>page) || !json?.results?.length || warmed.get(active)===page)return;
  warmed.set(active,page);
  setTimeout(()=>{
   if(L.Activity.active()!==active || document.hidden || Number(params.page || 1)!==page || params.minimal_browse_cancelled)return;
   load(page+1,next=>{
    if(L.Activity.active()===active && Array.isArray(next?.results))warmPosters?.(next.results,active.activity?.component?.body,()=>L.Activity.active()===active);
   },()=>{if(warmed.get(active)===page)warmed.delete(active);});
  },80);
 }
 L.Api.list=function(params,ok,fail){
  if(!params.minimal_browse_kind && params.source!==DISCOVERY_SOURCE){
   const source=L.Api.sources[params.source],[path,search]=String(params.url || '').split('?'),query=new URLSearchParams(search || '');
   const anime=params.source==='tmdb' && ['discover/tv','discover/movie'].includes(path) &&
    query.get('with_original_language')==='ja' && (query.get('with_genres') || '').split(',').includes('16');
   if(params.component!=='category_full' || !source?.list || !(anime || params.source==='minimal_shiki'))return list.apply(this,arguments);
   return list.call(this,params,json=>{
    ok(json);
    warmNext(params,json,(page,done,error)=>source.list({...params,page},done,error));
   },fail);
  }
  const url=params.minimal_browse_kind?JSON.stringify(browseSpec(params.minimal_browse_kind,params.minimal_browse)):params.url;
  const load=(page,done,error)=>L.Api.sources[DISCOVERY_SOURCE].list({url,page,minimal_cancelled:()=>!!params.minimal_browse_cancelled},done,error);
  return load(params.page,json=>{
   if(params.minimal_browse_cancelled)return;
   const active=L.Activity.active(),grid=active?.activity?.component;
   if(grid?.object===params)grid.total_pages=json.total_pages;
   ok(json);
   warmNext(params,json,load);
  },fail);
 };
 function alphabetical(values){
  const collator=new Intl.Collator(locale(),{sensitivity:'base'});
  return values.sort((a,b)=>collator.compare(a.title,b.title));
 }
 const sortTitles=(kind,type)=>Object.fromEntries(browseSorts(kind,type).map(([key,title])=>[key,t(title)]));
 L.Component.add('category_full',function(object){
  const item=new Full(object);
  if(object.source!==DISCOVERY_SOURCE)return item;
  let spec;try{spec=JSON.parse(object.url);}catch(error){return item;}
  if(spec.kind!=='dorama')return item;
  const sort=sortTitles('dorama');
  const controls=gridControls(L,item,object,[{title:sort[spec.sort] || sort.popular,choose(){
   L.Select.show({title:t('Сортировка'),items:alphabetical(Object.keys(sort).map(value=>({value,title:sort[value],selected:value===spec.sort}))),
    onSelect({value}){L.Activity.replace({url:JSON.stringify({...spec,sort:value}),page:1,minimal_browse_cancelled:false});},
    onBack:()=>controls.toggle()});
  }}],{focusStart:false});
  item.use({onDestroy(){object.minimal_browse_cancelled=true;}});
  return item;
 });
 L.Component.add('category',function(object){
  const kind=object.url || object.cat;if(!BROWSE_KINDS.includes(kind))return new Category(object);
  object.minimal_browse_kind=kind;object.minimal_browse_cancelled=false;object.minimal_browse=browseState(kind,object.minimal_browse || L.Storage.get('minimal_catalogue_filters_'+kind,{}));
  const item=new Full(object),state=object.minimal_browse,options=browseOptions(kind),spec=browseSpec(kind,state);
  function apply(change,index){
   const next=browseState(kind,{...state,...change});
   L.Storage.set('minimal_catalogue_filters_'+kind,next);
   L.Activity.replace({minimal_browse:next,minimal_filter_focus:index,page:1});
  }
  function select(title,values,key,index){
   const reset=values[0]?.value==='' || values[0]?.value===0?values.shift():null;
   alphabetical(values);
   if(reset)values.unshift(reset);
   L.Select.show({title,items:values.map(v=>({...v,selected:v.value===(key==='sort'?spec[key]:state[key])})),
    onSelect:({value})=>apply({[key]:value},index),onBack:()=>controls.toggle()});
  }
  function selectBrand(index){
   const rows=new WeakMap(),started=new WeakSet();
   function showLogo(node){
    const row=rows.get(node);
    if(!row || started.has(node))return;
    started.add(node);observer?.unobserve(node);
    logo(row.endpoint,row.brand).then(path=>{
     if(!path || !node.isConnected)return;
     const image=document.createElement('img');
     image.alt='';image.className='minimal-catalogue-brand-icon';
     image.onerror=()=>image.remove();
     node.prepend(image);
     image.src=L.TMDB.image('/t/p/'+(/\.svg$/i.test(path)?'original':'w92')+path,{preserveSize:true});
    });
   }
   const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)showLogo(entry.target);
   }):null;
   const close=()=>observer?.disconnect();
   const items=[{title:t('Все бренды'),network:0,studio:'',selected:!state.network && !state.studio}];
   for(const [label,entries] of brandGroups(options)){
    items.push({title:t(label),separator:true});
    for(const row of alphabetical(entries))items.push({...row,title:'',selected:row.network===state.network && row.studio===state.studio,onDraw(item){
     const title=item.find('.selectbox-item__title').text(row.title).addClass('minimal-catalogue-brand-title')[0];
     rows.set(title,row);observer?.observe(title);
    }});
   }
   L.Select.show({title:t('Бренды'),items,
    onFocus:(_,node)=>showLogo(node.querySelector('.minimal-catalogue-brand-title')),
    onSelect({network,studio}){
     close();
     const type=network?'tv':options.studios.find(row=>row.key===studio)?.discovery.type;
     apply({network,studio,...(type && collection?.discovery.type && collection.discovery.type!==type?{collection:''}:{})},index);
    },
    onBack(){close();controls.toggle();}
   });
  }
  function years(index){
   const date=new Date(),year=date.getFullYear(),values=browseYears(kind,date,state.period);
   L.Select.show({title:t('Годы'),items:values.map(v=>({...v,selected:v.value===state.period})),onSelect:value=>{if(value.value!=='custom')return apply({period:value.value},index);setTimeout(()=>{if(object.minimal_browse_cancelled)return;L.Input.edit({title:t('Годы: от–до'),value:state.period,nosave:true,free:true},value=>{const period=yearRange(value);if(!period){L.Noty.show(t('Укажите годы от 1870 до {0}: например, 1990–2005',[year]));return years(index);}apply({period},index);});},100);},onBack:()=>controls.toggle()});
  }
  const collection=options.collections.find(row=>row.key===state.collection),genre=options.genres.find(g=>g.id===state.genre);
  const network=options.networks.find(row=>row.id===state.network),studio=options.studios.find(row=>row.key===state.studio);
  const sort=sortTitles(kind,studio?.discovery.type || (network?'tv':collection?.discovery.type));
  const controls=gridControls(L,item,object,[
   {title:collection?collection.title:t('Все подборки'),choose:i=>select(t('Подборки'),[{title:t('Все подборки'),value:''},...options.collections.map(row=>({title:row.title,value:row.key}))],'collection',i)},
   ...(kind==='tvshow'?[]:[{title:genre?t(genre.name):t('Все жанры'),choose:i=>select(t('Жанры'),[{title:t('Все жанры'),value:''},...genresForType(options,spec.type).map(g=>({title:t(g.name),value:g.id}))],'genre',i)}]),
   {title:sort[spec.sort] || sort.popular,choose:i=>select(t('Сортировка'),Object.keys(sort).map(value=>({title:sort[value],value})),'sort',i)},
   {title:state.period?state.period.replace('-','–'):t('Все годы'),choose:years},
   {title:spec.country?countryTitle(spec.country):t('Все страны'),choose:i=>select(t('Страны'),[{title:t('Все страны'),value:''},...options.countries.map(([code])=>({title:countryTitle(code),value:code}))],'country',i)},
   ...(options.networks.length || options.studios.length?[{title:studio?.title || network?.name || t('Все бренды'),choose:selectBrand}]:[])
  ]);
  item.use({onDestroy(){object.minimal_browse_cancelled=true;}});return item;
 });
}
