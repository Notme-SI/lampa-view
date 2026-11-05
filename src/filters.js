import {text as lampaViewText} from './i18n.js';
import {locale} from './i18n.js';
import tmdbGet from './tmdb.js';
import {qualityLabel} from './online-quality.js';
import {qualityCacheKey} from './anime-release.js';
import {isAnime} from './metadata.js';
import DISCOVERY_DATA from './discovery-data.json';
const animeTmdb=f=>['anime_tv','anime_movie','anime_tmdb'].includes(f.kind);
export const filterKind=f=>f.mediaType==='tv' || ['tv','tvshow','anime_tv'].includes(f.kind)?'tv':'movie';
export const filterTypes=f=>['cartoon','anime_tmdb'].includes(f.kind)?['movie','tv']:[filterKind(f)];
function entries(pairs){return pairs.reduce((out,pair)=>{out[pair[0]]=pair[1];return out;},{});}
export function yearBounds(f){
 const from=String(f.year_from || f.year || '').trim(),to=String(f.year_to || f.year || '').trim();
 for(const value of [from,to])if(value && (!/^\d{4}$/.test(value) || Number(value)<1870 || Number(value)>2100))throw Error(lampaViewText("Укажите год от 1870 до 2100"));
 if(from && to && Number(from)>Number(to))throw Error(lampaViewText("Начальный год не может быть больше конечного"));
 return {from,to};
}
export function minimumVotes(f){
 if(f.votes!==undefined && f.votes!=='')return Math.max(0,Number(f.votes) || 0);
 if(f.query)return 0;
 if(f.sort==='vote_average.desc')return filterKind(f)==='tv'?200:500;
 return f.score?(filterKind(f)==='tv'?100:200):0;
}
export function discoverUrl(f,language=locale()){
 const kind=filterKind(f),p=['language='+encodeURIComponent(language),'include_adult=false','sort_by='+encodeURIComponent(kind==='tv' && f.sort==='primary_release_date.desc'?'first_air_date.desc':f.sort || 'popularity.desc')],{from,to}=yearBounds(f);
 const field=kind==='tv'?'first_air_date':'primary_release_date';
 if(from)p.push(field+'.gte='+from+'-01-01');if(to)p.push(field+'.lte='+to+'-12-31');
 if(animeTmdb(f) || f.kind==='cartoon')p.push('with_genres='+encodeURIComponent(f.genre && String(f.genre)!=='16'?'16,'+f.genre:'16'));
 else if(f.kind==='tvshow')p.push('with_genres='+encodeURIComponent(f.genre || '10764|10767'));
 else if(f.genre)p.push('with_genres='+encodeURIComponent(f.genre));
 if(['movie','tv'].includes(f.kind))p.push('without_genres='+encodeURIComponent(f.kind==='tv'?'16,10764,10767':'16'));
 if(f.kind==='cartoon')p.push('without_keywords=210024');
 if(f.country && /^[A-Z]{2}$/.test(f.country))p.push('with_origin_country='+f.country);
 if(f.score)p.push('vote_average.gte='+encodeURIComponent(f.score));
 const votes=minimumVotes(f);if(votes)p.push('vote_count.gte='+votes);
 if(animeTmdb(f) || f.language)p.push('with_original_language='+encodeURIComponent(animeTmdb(f)?'ja':f.language));
 return 'discover/'+kind+'?'+p.join('&');
}
export function cachedQuality(L,card){
 const direct=qualityLabel(card.quality || card.release_quality);if(direct)return direct;
 const tv=card.media_type==='movie'?false:card.media_type==='tv' || card.name || card.first_air_date;
 const rows=L.Storage.get('minimal_quality_v2',[]),key=qualityCacheKey(card,tv);
 const pair=Array.isArray(rows)?rows.find(row=>Array.isArray(row) && row[0]===key):null,entry=pair && pair[1];
 return entry && Date.now()-entry.time<21600000?qualityLabel(entry.q):'';
}
const qualityRank={'CAM':1,'TS':2,'SD':3,'WEBRip':4,'BDRip':5,'WEB-DL':6,'720p':7,'1080p':8,'4K':9};
export function sortQuality(L,cards){
 const quality=card=>cachedQuality(L,card);
 return cards.map((card,index)=>({card,index,rank:qualityRank[quality(card)] || 0})).sort((a,b)=>b.rank-a.rank || a.index-b.index).map(value=>value.card);
}
export default function filters(L,shiki){
 const state=L.Storage.get('minimal_filters',{kind:'movie'}) || {kind:'movie'};
 if(['anime_tv','anime_movie'].includes(state.kind))state.kind='anime_tmdb';
 if(state.year){state.year_from=state.year;state.year_to=state.year;delete state.year;}
 const selectShow=L.Select.show;
 L.Select.show=function(options){
  const result=selectShow.apply(this,arguments),render=L.Select.render && L.Select.render(true),root=render && (render.nodeType?render:render[0]);
  if(root){root.classList.toggle('minimal-filter-panel',!!options.minimalFilters);if(options.minimalFilters)root.querySelectorAll('.selectbox-item').forEach((node,index)=>{const item=options.items[index] || {};node.classList.toggle('minimal-filter-run',item.id==='run');node.classList.toggle('minimal-filter-reset',item.id==='reset');node.classList.toggle('minimal-filter-choice',options.items.some(value=>Object.prototype.hasOwnProperty.call(value,'selected')));});}
  return result;
 };
 const kinds={movie:lampaViewText('Фильмы'),tv:lampaViewText('Сериалы'),cartoon:lampaViewText('Мультфильмы'),tvshow:lampaViewText('ТВ-шоу'),anime_tmdb:lampaViewText('Аниме'),anime:lampaViewText('Аниме')+' Shikimori'};
 const countries={'':lampaViewText('Все страны'),RU:lampaViewText('Россия'),SU:'СССР',US:lampaViewText('США'),GB:lampaViewText('Великобритания'),FR:lampaViewText('Франция'),DE:lampaViewText('Германия'),IT:'Италия',ES:'Испания',CA:lampaViewText('Канада'),AU:'Австралия',JP:lampaViewText('Япония'),KR:lampaViewText('Южная Корея'),CN:lampaViewText('Китай'),TW:lampaViewText('Тайвань'),TH:lampaViewText('Таиланд'),TR:lampaViewText('Турция'),IN:'Индия',UA:lampaViewText('Украина')};
 if(locale()!=='ru')for(const code of Object.keys(countries).filter(Boolean)){try{countries[code]=new Intl.DisplayNames([locale()],{type:'region'}).of(code);}catch(error){countries[code]=({SU:'USSR',IT:'Italy',ES:'Spain',AU:'Australia',IN:'India'})[code] || countries[code];}}
 const values={status:{'':lampaViewText("Любой статус"),ongoing:lampaViewText("Выходит"),released:lampaViewText("Вышло"),anons:lampaViewText("Анонс")},format:{'':lampaViewText("Любой формат"),tv:lampaViewText("Сериал"),movie:lampaViewText("Фильм"),ova:'OVA',ona:'ONA',special:lampaViewText("Спешл")},sort:{'popularity.desc':lampaViewText("Популярность"),'vote_average.desc':lampaViewText("Рейтинг"),'primary_release_date.desc':lampaViewText("Дата выхода"),'quality.desc':lampaViewText("Качество на странице")},animeSort:{popularity:lampaViewText("Популярность"),ranked:lampaViewText("Рейтинг"),aired_on:lampaViewText("Дата выхода"),name:lampaViewText("Название")},language:{'':lampaViewText("Любой язык"),ja:lampaViewText("Японский"),en:lampaViewText('Английский'),ru:lampaViewText('Русский'),ko:lampaViewText("Корейский")}};
 if(!kinds[state.kind])state.kind='movie';
 function show(title,items,fn,back=menu){L.Select.show({title,items,onSelect:fn,onBack:back,minimalFilters:true});}
 function choose(name,title,options){
  const value=name==='votes'?String(minimumVotes(state)):String(state[name] || (name==='sort'?'popularity.desc':name==='animeSort'?'popularity':''));
  const pairs=Object.entries(options).sort((a,b)=>a[0]===''?-1:b[0]===''?1:0);
  show(title,pairs.map(([id,title])=>({id,title,selected:value===id,subtitle:id==='quality.desc'?lampaViewText('Известное качество на текущей странице; неизвестное — в конце'):undefined})),r=>{state[name]=r.id;if(name==='genre')state.genre_label=r.title;menu();});
 }
 function input(name,title){L.Input.edit({title,value:state[name] || '',free:true,nosave:true},value=>{state[name]=String(value || '').trim();menu();});}
 function genres(){
  if(state.kind==='anime'){
   const ok=json=>choose('genre',lampaViewText("Жанр"),entries([['',lampaViewText("Любой жанр")]].concat(json.filter(g=>g.entry_type==='Anime').map(g=>[g.id,locale()==='ru'?(g.russian || g.name):(g.name || g.russian)])))),fail=()=>{L.Noty.show(lampaViewText("Не удалось загрузить жанры Shikimori"));menu();};
   if(shiki && shiki.genres)shiki.genres(ok,fail);else{const r=new L.Reguest();r.timeout(10000);r.silent('https://shikimori.io/api/genres',ok,fail);}
  }else{const types=filterTypes(state),lists=[];let left=types.length,failed=false;types.forEach(type=>tmdbGet(L,'genre/'+type+'/list?language='+encodeURIComponent(locale()),{},json=>{lists.push(json.genres || []);if(--left || failed)return;let genres=lists[0].filter(g=>lists.every(list=>list.some(v=>v.id===g.id)));if(state.kind==='tvshow')genres=genres.filter(g=>[10764,10767].includes(g.id));if(['movie','tv'].includes(state.kind))genres=genres.filter(g=>![16,10764,10767].includes(g.id));choose('genre',lampaViewText('Жанр'),entries([['',lampaViewText('Любой жанр')]].concat(genres.map(g=>[g.id,g.name]))));},()=>{if(!failed){failed=true;L.Noty.show(lampaViewText('Не удалось загрузить жанры'));menu();}}));}
 }
 function run(){
  let range;try{range=yearBounds(state);}catch(e){L.Noty.show(e.message);return menu();}
  L.Storage.set('minimal_filters',state);if(L.Select.hide)L.Select.hide();else L.Select.close();
  if(state.kind==='anime'){
   const parts=['order='+encodeURIComponent(state.animeSort || 'popularity')];
   [['genre','genre'],['status','status'],['format','kind'],['score','score'],['query','search']].forEach(([key,param])=>{if(state[key])parts.push(param+'='+encodeURIComponent(state[key]));});
   if(range.from || range.to)parts.push('season='+encodeURIComponent((range.from || '1870')+'_'+(range.to || String(new Date().getFullYear()+5))));
   L.Activity.push({component:'category_full',source:'minimal_shiki',url:parts.join('&'),title:kinds.anime,page:1});
  }else if(state.query || state.sort==='quality.desc' || filterTypes(state).length>1 || ['cartoon','tvshow'].includes(state.kind) || state.country){
   L.Activity.push({component:'category_full',source:'minimal_search',url:JSON.stringify(state),title:kinds[state.kind]+' · '+(state.query || lampaViewText('Качество на странице')),page:1});
  }else L.Activity.push({component:'category_full',source:'tmdb',url:discoverUrl(state),title:lampaViewText("{0} · фильтры", [kinds[state.kind]]),page:1});
 }
 // Search endpoints do not support discover filters. Scan pages until a display
 // page is filled or the search ends, keeping cursors separate for each query.
 const searches=new Map();
 L.Api.sources.minimal_search={clear(){searches.forEach(c=>c.cancelled=true);searches.clear();},full:(p,ok,fail)=>L.Api.sources.tmdb.full({...p,source:'tmdb',method:p.card && p.card.media_type || 'movie'},ok,fail),list(p,ok,fail){
  let f,range;try{f=JSON.parse(p.url);range=yearBounds(f);}catch(e){L.Noty.show(lampaViewText("Некорректные параметры поиска"));return fail();}
  const kind=filterKind(f),page=Math.max(1,Number(p.page)||1);
  let cursor=searches.get(p.url);
  if(!cursor || page===1){if(cursor)cursor.cancelled=true;cursor={streams:filterTypes(f).map(type=>({type,next:1,total:1,finished:false})),turn:0,results:[],pages:[],delivered:0,seen:new Set(),finished:false};searches.set(p.url,cursor);if(searches.size>8){const key=searches.keys().next().value;searches.get(key).cancelled=true;searches.delete(key);}}
  if(cursor.pages[page-1])return ok(cursor.pages[page-1]);if(page!==cursor.pages.length+1)return fail();
  const end=cursor.delivered+20;
  function finish(){const cards=cursor.results.slice(cursor.delivered,end).map(card=>{const q=cachedQuality(L,card);return q?{...card,quality:q}:card;});cursor.delivered+=cards.length;const json={results:f.sort==='quality.desc'?sortQuality(L,cards):cards,page,total_pages:cursor.finished && cursor.delivered===cursor.results.length?page:page+1};cursor.pages.push(json);ok(json);}
  let rounds=0;const fetched=new Set();
  function fetchNext(){
   if(cursor.cancelled)return;
   if(cursor.finished || cursor.results.length>=end && (!fetched.size || cursor.streams.every(s=>s.finished || fetched.has(s.type))) || rounds++>=8)return finish();
   const streams=cursor.streams.filter(s=>!s.finished),stream=streams[cursor.turn++%streams.length],kind=stream.type;
   const url=f.query?'search/'+kind+'?language='+encodeURIComponent(locale())+'&query='+encodeURIComponent(f.query)+'&page='+stream.next:discoverUrl({...f,mediaType:kind,sort:f.sort==='quality.desc'?'popularity.desc':f.sort || 'popularity.desc'})+'&page='+stream.next;
   tmdbGet(L,url,{},json=>{
    if(cursor.cancelled)return;
    const matches=(json.results || []).filter(c=>{
     const year=String(c.first_air_date || c.release_date || '').slice(0,4);
     if(animeTmdb(f) && (!(c.genre_ids || []).includes(16) || c.original_language!=='ja'))return false;
     if(f.kind==='cartoon' && (!(c.genre_ids || []).includes(16) || isAnime(c)))return false;
     if(f.kind==='tvshow' && !(c.genre_ids || []).some(g=>[10764,10767].includes(g)))return false;
     if(['movie','tv'].includes(f.kind) && ((c.genre_ids || []).includes(16) || isAnime(c) || f.kind==='tv' && (c.genre_ids || []).some(g=>[10764,10767].includes(g))))return false;
     return (!range.from || year>=range.from) && (!range.to || !!year && year<=range.to) && (!f.genre || (c.genre_ids || []).includes(Number(f.genre))) && (!f.score || c.vote_average>=Number(f.score)) && (!f.votes || c.vote_count>=Number(f.votes)) && (!f.language || c.original_language===f.language);
    }).map(c=>({...c,source:'tmdb',media_type:kind}));
    let accepted=false;
    function accept(cards){if(cursor.cancelled || accepted)return;accepted=true;fetched.add(kind);cursor.results.push(...cards.filter(card=>{if(!card.id)return true;const key=kind+':'+card.id;if(cursor.seen.has(key))return false;cursor.seen.add(key);return true;}));if(cursor.streams.length>1){const queued=cursor.results.splice(cursor.delivered),streams=cursor.streams.map(s=>queued.filter(c=>c.media_type===s.type)),length=Math.max(...streams.map(s=>s.length));for(let i=0;i<length;i++)for(const rows of streams)if(rows[i])cursor.results.push(rows[i]);}stream.total=Math.min(500,json.total_pages || 1);stream.next++;stream.finished=stream.next>stream.total;cursor.finished=cursor.streams.every(s=>s.finished);fetchNext();}
    if(!f.country || !f.query)return accept(matches);
    const results=new Array(matches.length);let at=0,running=0,done=0;
    function pump(){if(cursor.cancelled)return;if(done===matches.length)return accept(results.filter(Boolean));while(running<3 && at<matches.length){const index=at++,card=matches[index],known=card.origin_country;if(Array.isArray(known) && known.length){if(known.includes(f.country))results[index]=card;done++;continue;}running++;tmdbGet(L,kind+'/'+card.id,{},data=>{running--;done++;if(Number(data.id)===Number(card.id) && (data.origin_country && data.origin_country.length?data.origin_country:(data.production_countries || []).map(c=>c.iso_3166_1)).includes(f.country))results[index]=card;pump();},()=>{running--;done++;pump();});}if(done===matches.length)accept(results.filter(Boolean));}pump();
   },fail);
  }
  fetchNext();
 }};
 function menu(){
  const anime=state.kind==='anime';
  const range=state.year_from || state.year_to?(state.year_from || '…')+' - '+(state.year_to || '…'):lampaViewText("Любые годы");
  const items=[{id:'kind',title:lampaViewText("Каталог"),subtitle:kinds[state.kind]},{id:'query',title:lampaViewText("Название"),subtitle:state.query || lampaViewText("Любое название")},{id:'genre',title:lampaViewText("Жанр"),subtitle:state.genre_label || lampaViewText("Любой жанр")},{id:'years',title:lampaViewText("Годы выпуска"),subtitle:range},{id:'score',title:lampaViewText("Рейтинг"),subtitle:state.score?lampaViewText("От {0}", [state.score]):lampaViewText("Любой")}];
  if(anime)items.push({id:'status',title:lampaViewText("Статус"),subtitle:values.status[state.status || '']},{id:'format',title:lampaViewText("Формат"),subtitle:values.format[state.format || '']});
  else items.push({id:'country',title:lampaViewText('Страна'),subtitle:countries[state.country || ''] || state.country},{id:'votes',title:lampaViewText("Число оценок"),subtitle:minimumVotes(state)?lampaViewText("От {0}", [minimumVotes(state)]):lampaViewText("Любое")},{id:'language',title:lampaViewText("Язык оригинала"),subtitle:values.language[state.language || '']});
  if(animeTmdb(state)){const index=items.findIndex(item=>item.id==='language');if(index>=0)items.splice(index,1);}
  items.push({id:anime?'animeSort':'sort',noenter:false,title:lampaViewText("Сортировка"),subtitle:!anime && state.query && state.sort!=='quality.desc'?lampaViewText("По совпадению названия"):(anime?values.animeSort[state.animeSort || 'popularity']:values.sort[state.sort || 'popularity.desc'])},{id:'run',title:lampaViewText("Показать результаты")},{id:'reset',title:lampaViewText("Сбросить фильтры")});
  show(lampaViewText("Поиск и фильтры"),items,r=>{
   if(r.id==='run')return run();
   if(r.id==='reset'){Object.keys(state).forEach(k=>{if(k!=='kind')delete state[k];});return menu();}
   if(r.id==='kind')return show(lampaViewText("Каталог"),Object.keys(kinds).map(id=>({id,title:kinds[id],selected:state.kind===id})),r=>{Object.keys(state).forEach(k=>delete state[k]);state.kind=r.id;menu();});
   if(r.id==='genre')return genres();
   if(r.id==='country')return choose('country',lampaViewText('Страна'),countries);
   if(r.id==='years'){const year=new Date().getFullYear(),periods=DISCOVERY_DATA.periods.concat(year>2025?[{start:2026,end:year}]:[]).slice().reverse();return show(lampaViewText("Годы выпуска"),[{id:'year_from',title:lampaViewText("Год от"),subtitle:state.year_from || lampaViewText("Без ограничения")},{id:'year_to',title:lampaViewText("Год до"),subtitle:state.year_to || lampaViewText("Без ограничения")},{id:'clear',title:lampaViewText("Любые годы")},...periods.map(p=>({id:'period:'+p.start+':'+p.end,title:p.start+'–'+p.end,selected:String(state.year_from)===String(p.start) && String(state.year_to)===String(p.end)}))],field=>{if(field.id==='clear'){delete state.year_from;delete state.year_to;return menu();}if(field.id.startsWith('period:')){const [,from,to]=field.id.split(':');state.year_from=from;state.year_to=to;return menu();}input(field.id,field.title);});}
   if(r.id==='votes')return choose('votes',lampaViewText("Минимальное число оценок"),{'0':lampaViewText("Любое"),100:'100+',200:'200+',500:'500+',1000:'1000+'});
   if(r.id==='score')return choose('score',lampaViewText("Минимальный рейтинг"),{'':lampaViewText("Любой"),6:'6+',7:'7+',8:'8+',9:'9+'});
   if(r.id==='sort' && state.query)return choose('sort',r.title,{'popularity.desc':lampaViewText('По совпадению названия'),'quality.desc':lampaViewText('Качество на странице')});
   if(values[r.id])return choose(r.id,r.title,values[r.id]);
   input(r.id,r.id==='query'?lampaViewText("Название"):r.id==='year_from'?lampaViewText("Год от"):lampaViewText("Год до"));
  },()=>L.Controller.toggle('menu'));
 }
 function addMenu(){
  if(document.querySelector('[data-action="minimal_filters"]'))return;
  const li=document.createElement('li');li.className='menu__item selector';li.dataset.action='minimal_filters';li.innerHTML=lampaViewText("<div class=\"menu__ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M4 6h5m4 0h7M4 12h9m4 0h3M4 18h2m4 0h10\"/><circle cx=\"11\" cy=\"6\" r=\"2\"/><circle cx=\"15\" cy=\"12\" r=\"2\"/><circle cx=\"8\" cy=\"18\" r=\"2\"/></svg></div><div class=\"menu__text\">Поиск по фильтрам</div>");
  window.jQuery(li).on('hover:enter',e=>{e.stopImmediatePropagation();menu();});const list=document.querySelector('.menu__list');if(list)list.appendChild(li);
 }
 addMenu();
 return {menu,addMenu};
}
