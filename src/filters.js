import tmdbGet from './tmdb.js';
function entries(pairs){return pairs.reduce((out,pair)=>{out[pair[0]]=pair[1];return out;},{});}
export function yearBounds(f){
 const from=String(f.year_from || f.year || '').trim(),to=String(f.year_to || f.year || '').trim();
 for(const value of [from,to])if(value && (!/^\d{4}$/.test(value) || Number(value)<1870 || Number(value)>2100))throw Error('Укажите год от 1870 до 2100');
 if(from && to && Number(from)>Number(to))throw Error('Начальный год не может быть больше конечного');
 return {from,to};
}
export function minimumVotes(f){
 if(f.votes!==undefined && f.votes!=='')return Math.max(0,Number(f.votes) || 0);
 if(f.query)return 0;
 if(f.sort==='vote_average.desc')return f.kind==='tv'?200:500;
 return f.score?(f.kind==='tv'?100:200):0;
}
export function discoverUrl(f){
 const kind=f.kind==='tv'?'tv':'movie',p=['language=ru','include_adult=false','sort_by='+encodeURIComponent(kind==='tv' && f.sort==='primary_release_date.desc'?'first_air_date.desc':f.sort || 'popularity.desc')],{from,to}=yearBounds(f);
 const field=kind==='tv'?'first_air_date':'primary_release_date';
 if(from)p.push(field+'.gte='+from+'-01-01');if(to)p.push(field+'.lte='+to+'-12-31');
 if(f.genre)p.push('with_genres='+encodeURIComponent(f.genre));
 if(f.score)p.push('vote_average.gte='+encodeURIComponent(f.score));
 const votes=minimumVotes(f);if(votes)p.push('vote_count.gte='+votes);
 if(f.language)p.push('with_original_language='+encodeURIComponent(f.language));
 return 'discover/'+kind+'?'+p.join('&');
}
export default function filters(L,shiki){
 const state=L.Storage.get('minimal_filters',{kind:'movie'}) || {kind:'movie'};
 if(state.year){state.year_from=state.year;state.year_to=state.year;delete state.year;}
 const selectShow=L.Select.show;
 L.Select.show=function(options){
  const result=selectShow.apply(this,arguments),render=L.Select.render && L.Select.render(true),root=render && (render.nodeType?render:render[0]);
  if(root)root.classList.toggle('minimal-filter-panel',!!options.minimalFilters);
  return result;
 };
 const kinds={movie:'Фильмы',tv:'Сериалы',anime:'Аниме · Shikimori'};
 const values={status:{'':'Любой статус',ongoing:'Выходит',released:'Вышло',anons:'Анонс'},format:{'':'Любой формат',tv:'Сериал',movie:'Фильм',ova:'OVA',ona:'ONA',special:'Спешл'},sort:{'popularity.desc':'Популярность','vote_average.desc':'Рейтинг','primary_release_date.desc':'Дата выхода'},animeSort:{popularity:'Популярность',ranked:'Рейтинг',aired_on:'Дата выхода',name:'Название'},language:{'':'Любой язык',ja:'Японский',en:'Английский',ru:'Русский',ko:'Корейский'}};
 function show(title,items,fn,back=menu){L.Select.show({title,items,onSelect:fn,onBack:back,minimalFilters:title==='Поиск и фильтры'});}
 function choose(name,title,options){show(title,Object.keys(options).map(id=>({id,title:options[id],selected:String(state[name] || '')===id})),r=>{state[name]=r.id;if(name==='genre')state.genre_label=r.title;menu();});}
 function input(name,title){L.Input.edit({title,value:state[name] || '',free:true,nosave:true},value=>{state[name]=String(value || '').trim();menu();});}
 function genres(){
  if(state.kind==='anime'){
   const ok=json=>choose('genre','Жанр',entries([['','Любой жанр']].concat(json.filter(g=>g.entry_type==='Anime').map(g=>[g.id,g.russian || g.name])))),fail=()=>{L.Noty.show('Не удалось загрузить жанры Shikimori');menu();};
   if(shiki && shiki.genres)shiki.genres(ok,fail);else{const r=new L.Reguest();r.timeout(10000);r.silent('https://shikimori.io/api/genres',ok,fail);}
  }else tmdbGet(L,'genre/'+state.kind+'/list?language=ru',{},json=>choose('genre','Жанр',entries([['','Любой жанр']].concat((json.genres || []).map(g=>[g.id,g.name])))),()=>{L.Noty.show('Не удалось загрузить жанры');menu();});
 }
 function run(){
  let range;try{range=yearBounds(state);}catch(e){L.Noty.show(e.message);return menu();}
  L.Storage.set('minimal_filters',state);if(L.Select.hide)L.Select.hide();else L.Select.close();
  if(state.kind==='anime'){
   const parts=['order='+encodeURIComponent(state.animeSort || 'popularity')];
   [['genre','genre'],['status','status'],['format','kind'],['score','score'],['query','search']].forEach(([key,param])=>{if(state[key])parts.push(param+'='+encodeURIComponent(state[key]));});
   if(range.from || range.to)parts.push('season='+encodeURIComponent((range.from || '1870')+'_'+(range.to || String(new Date().getFullYear()+5))));
   L.Activity.push({component:'category_full',source:'minimal_shiki',url:parts.join('&'),title:'Аниме · Shikimori',page:1});
  }else if(state.query){
   L.Activity.push({component:'category_full',source:'minimal_search',url:JSON.stringify(state),title:kinds[state.kind]+' · '+state.query,page:1});
  }else L.Activity.push({component:'category_full',source:'tmdb',url:discoverUrl(state),title:kinds[state.kind]+' · фильтры',page:1});
 }
 // Search endpoints do not support discover filters. Scan pages until a display
 // page is filled or the search ends, keeping cursors separate for each query.
 const searches=new Map();
 L.Api.sources.minimal_search={clear(){searches.forEach(c=>c.cancelled=true);searches.clear();},full:(p,ok,fail)=>L.Api.sources.tmdb.full({...p,source:'tmdb',method:p.card && p.card.media_type || 'movie'},ok,fail),list(p,ok,fail){
  let f,range;try{f=JSON.parse(p.url);range=yearBounds(f);}catch(e){L.Noty.show('Некорректные параметры поиска');return fail();}
  const kind=f.kind==='tv'?'tv':'movie',page=Math.max(1,Number(p.page)||1);
  let cursor=searches.get(p.url);
  if(!cursor || page===1){if(cursor)cursor.cancelled=true;cursor={next:1,total:1,results:[],finished:false};searches.set(p.url,cursor);if(searches.size>8)searches.delete(searches.keys().next().value);}
  const end=page*20;
  function finish(){ok({results:cursor.results.slice((page-1)*20,end),page,total_pages:cursor.finished?Math.ceil(cursor.results.length/20):page+1});}
  function fetchNext(){
   if(cursor.cancelled)return;
   if(cursor.finished || cursor.results.length>=end)return finish();
   const url='search/'+kind+'?language=ru&query='+encodeURIComponent(f.query)+'&page='+cursor.next;
   tmdbGet(L,url,{},json=>{
    if(cursor.cancelled)return;
    const matches=(json.results || []).filter(c=>{
     const year=String(c.first_air_date || c.release_date || '').slice(0,4);
     return (!range.from || year>=range.from) && (!range.to || !!year && year<=range.to) && (!f.genre || (c.genre_ids || []).includes(Number(f.genre))) && (!f.score || c.vote_average>=Number(f.score)) && (!f.votes || c.vote_count>=Number(f.votes)) && (!f.language || c.original_language===f.language);
    }).map(c=>({...c,source:'tmdb',media_type:kind}));
    cursor.results.push(...matches);cursor.total=Math.min(500,json.total_pages || 1);cursor.next++;cursor.finished=cursor.next>cursor.total;
    fetchNext();
   },fail);
  }
  fetchNext();
 }};
 function menu(){
  const anime=state.kind==='anime';
  const range=state.year_from || state.year_to?(state.year_from || '…')+' - '+(state.year_to || '…'):'Любые годы';
  const items=[{id:'kind',title:'Каталог',subtitle:kinds[state.kind]},{id:'query',title:'Название',subtitle:state.query || 'Любое название'},{id:'genre',title:'Жанр',subtitle:state.genre_label || 'Любой жанр'},{id:'years',title:'Годы выпуска',subtitle:range},{id:'score',title:'Рейтинг',subtitle:state.score?'От '+state.score:'Любой'}];
  if(anime)items.push({id:'status',title:'Статус',subtitle:values.status[state.status || '']},{id:'format',title:'Формат',subtitle:values.format[state.format || '']});
  else items.push({id:'votes',title:'Число оценок',subtitle:minimumVotes(state)?'От '+minimumVotes(state):'Любое'},{id:'language',title:'Язык оригинала',subtitle:values.language[state.language || '']});
  items.push({id:anime?'animeSort':'sort',noenter:!anime && !!state.query,title:'Сортировка',subtitle:!anime && state.query?'По совпадению названия':(anime?values.animeSort[state.animeSort || 'popularity']:values.sort[state.sort || 'popularity.desc'])},{id:'run',title:'Показать результаты'},{id:'reset',title:'Сбросить фильтры'});
  show('Поиск и фильтры',items,r=>{
   if(r.id==='run')return run();
   if(r.id==='reset'){Object.keys(state).forEach(k=>{if(k!=='kind')delete state[k];});return menu();}
   if(r.id==='kind')return show('Каталог',Object.keys(kinds).map(id=>({id,title:kinds[id]})),r=>{Object.keys(state).forEach(k=>delete state[k]);state.kind=r.id;menu();});
   if(r.id==='genre')return genres();
   if(r.id==='years')return show('Годы выпуска',[{id:'year_from',title:'Год от',subtitle:state.year_from || 'Без ограничения'},{id:'year_to',title:'Год до',subtitle:state.year_to || 'Без ограничения'},{id:'clear',title:'Любые годы'}],field=>{if(field.id==='clear'){delete state.year_from;delete state.year_to;return menu();}input(field.id,field.title);});
   if(r.id==='votes')return choose('votes','Минимальное число оценок',{'0':'Любое',100:'100+',200:'200+',500:'500+',1000:'1000+'});
   if(r.id==='score')return choose('score','Минимальный рейтинг',{'':'Любой',6:'6+',7:'7+',8:'8+',9:'9+'});
   if(values[r.id])return choose(r.id,r.title,values[r.id]);
   input(r.id,r.id==='query'?'Название':r.id==='year_from'?'Год от':'Год до');
  },()=>L.Controller.toggle('menu'));
 }
 function addMenu(){
  if(document.querySelector('[data-action="minimal_filters"]'))return;
  const li=document.createElement('li');li.className='menu__item selector';li.dataset.action='minimal_filters';li.innerHTML='<div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h5m4 0h7M4 12h9m4 0h3M4 18h2m4 0h10"/><circle cx="11" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg></div><div class="menu__text">Поиск по фильтрам</div>';
  window.jQuery(li).on('hover:enter',e=>{e.stopImmediatePropagation();menu();});const list=document.querySelector('.menu__list');if(list)list.appendChild(li);
 }
 addMenu();
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'minimal_search_filters',type:'button'},field:{name:'Поиск по фильтрам',description:'Фильмы, сериалы и аниме: жанр, диапазон годов, рейтинг и другие параметры.'},onChange:menu});
 return {menu,addMenu};
}
