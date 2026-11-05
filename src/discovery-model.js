import DATA from './discovery-data.json';
import {text as t,locale} from './i18n.js';
import {isAnime} from './metadata.js';
export const DISCOVERY_KINDS=['movie','tv','dorama','tvshow','cartoon'];
export const ASIAN=['KR','JP','CN','TW','TH'];
const day=date=>[date.getFullYear(),('0'+(date.getMonth()+1)).slice(-2),('0'+date.getDate()).slice(-2)].join('-');
const COUNTRIES=[['RU','Россия'],['SU','СССР'],['UA','Украина'],['TR','Турция'],['KR','Южная Корея'],['JP','Япония'],['CN','Китай'],['TW','Тайвань'],['TH','Таиланд'],['GB','Великобритания'],['US','США']];
export const SECTIONS=[['overview','Обзор'],['trending','В тренде за неделю'],['new','Новинки'],['rated','С высоким рейтингом'],['votes','Много оценок'],['genres','По жанрам'],['countries','По странам'],['platforms','Платформы и телеканалы'],['periods','По годам'],['studios','Студии'],['heroes','Герои и коллекции'],['family','Семейные']];
function genreDescriptor(type,id,kind){const mapped=kind==='cartoon' && type==='tv'?({'14':'k293198','878':'k281358'}[id] || id):id;return DATA.genres[type].find(g=>g.id===String(mapped));}
export function countryTitle(code){try{if(typeof Intl.DisplayNames==='function')return new Intl.DisplayNames([locale()],{type:'region'}).of(code);}catch(error){}return t((COUNTRIES.find(v=>v[0]===code)||[])[1] || code);}
export function discoveryOptions(kind,date=new Date()){
 const types=kind==='movie'?['movie']:kind==='cartoon'?['movie','tv']:['tv'];
 const genres=types.length===1?DATA.genres[types[0]]:Array.from(new Map(DATA.genres.movie.concat(DATA.genres.tv).map(g=>[g.id,g])).values());
 const allowedGenres=kind==='dorama'?genres.filter(g=>g.keyword || ![16,99,10762,10763,10764,10767].includes(g.genre)):kind==='tvshow'?genres.filter(g=>[10764,10767].includes(g.genre)):kind==='cartoon'?genres.filter(g=>[28,35,10762,12,878,10751,14,10759,10765].includes(g.genre) || [281358,293198].includes(g.keyword)):genres;
 const periods=DATA.periods.concat(date.getFullYear()>2025?[{start:2026,end:date.getFullYear()}]:[]);
 return {sections:SECTIONS.filter(([key])=>!['studios','heroes','family'].includes(key) || kind==='cartoon').filter(([key])=>key!=='platforms' || kind!=='movie'),
  countries:COUNTRIES.filter(([code])=>kind!=='dorama' || ASIAN.includes(code)),genres:allowedGenres.map(g=>({...g,formats:['movie','tv'].filter(type=>!!genreDescriptor(type,g.id,kind))})),
  networks:DATA.networks,studios:DATA.studios,heroes:DATA.heroes,periods,
  sorts:[['popular','Популярность'],['new','Дата выхода'],['rated','Рейтинг'],['votes','Много оценок'],...(['movie','cartoon'].includes(kind)?[['revenue','Кассовые сборы']]:[])]};
}
export function discoveryState(kind,value={},date=new Date()){
 const options=discoveryOptions(kind,date),state={section:'overview',country:'',genre:'',network:0,company:0,period:'',sort:'',hero:'',format:'all'};
 if(!value || typeof value!=='object')return state;
 if(options.sections.some(v=>v[0]===value.section))state.section=value.section;
 if(options.countries.some(v=>v[0]===value.country) || kind==='tvshow' && value.country==='foreign')state.country=value.country;
 if(options.genres.some(v=>v.id===String(value.genre)))state.genre=String(value.genre);
 if(kind!=='movie' && options.networks.some(v=>v.id===Number(value.network)))state.network=Number(value.network);
 if(kind==='cartoon' && options.studios.some(v=>v.id===Number(value.company)))state.company=Number(value.company);
 if(options.periods.some(v=>v.start+'-'+v.end===value.period))state.period=value.period;
 if(options.sorts.some(v=>v[0]===value.sort))state.sort=value.sort;
 if(kind==='cartoon' && options.heroes.some(v=>v.id===String(value.hero)))state.hero=String(value.hero);
 if(kind==='cartoon' && ['movie','tv'].includes(value.format))state.format=value.format;
 if(kind==='cartoon' && state.genre){const g=options.genres.find(v=>v.id===state.genre);if(g.formats.length===1)state.format=g.formats[0];}
 if(state.company)state.network=0;if(state.network && kind==='cartoon'){state.format='tv';if(state.genre && !options.genres.find(g=>g.id===state.genre).formats.includes('tv'))state.genre='';}
 if(kind==='cartoon' && state.format==='tv' && state.sort==='revenue')state.sort='';
 if(state.section==='heroes' || state.hero)return {...state,section:'heroes',country:'',genre:'',network:0,company:0,period:'',sort:''};
 if(state.section==='trending')return {...state,country:'',genre:'',network:0,company:0,period:'',sort:'',hero:''};
 return state;
}
export function discoveryScope(state){return ['section','country','genre','network','company','period','sort','hero','format'].map(k=>String(state[k] || '')).join(':');}
export function discoverySelected(state){return state.section!=='overview' || !!(state.country || state.genre || state.network || state.company || state.period || state.sort || state.hero || state.format!=='all');}
export function discoveryQuery(spec,date=new Date()){
 const type=spec.type==='movie'?'movie':'tv',p=new URLSearchParams({include_adult:'false'}),field=type==='movie'?'primary_release_date':'first_air_date',today=day(date);
 if(spec.feed==='trending')return 'trending/'+type+'/week';
 if(spec.hero){const hero=DATA.heroes.find(v=>v.id===String(spec.hero));return hero?'search/'+type+'?query='+encodeURIComponent(hero.queries[0])+'&include_adult=false':'';}
 const sort=spec.sort || 'popular',sorts={popular:'popularity.desc',rated:'vote_average.desc',votes:'vote_count.desc',new:field+'.desc',revenue:'revenue.desc'};
 p.set('sort_by',sorts[sort] || sorts.popular);p.set(field+'.lte',today);
 const descriptor=genreDescriptor(type,spec.genre,spec.kind);
 if(spec.genre && !descriptor)return '';
 let genres=descriptor && descriptor.genre?String(descriptor.genre):'';
 if(spec.kind==='tvshow')genres=descriptor && [10764,10767].includes(descriptor.genre)?String(descriptor.genre):'10764|10767';
 if(spec.kind==='cartoon')genres=genres && genres!=='16'?'16,'+genres:'16';
 if(spec.kind==='cartoon' && !spec.hero && !spec.company && !spec.network)p.set('without_keywords','210024');
 if(spec.family)genres=type==='movie'?'16,10751':'16,10762';
 if(genres)p.set('with_genres',genres);
 if(descriptor && descriptor.keyword)p.set('with_keywords',String(descriptor.keyword));
 if(spec.kind==='dorama'){
  p.set('without_genres','16,99,10762,10763,10764,10767');p.set('with_origin_country',spec.country && ASIAN.includes(spec.country)?spec.country:ASIAN.join('|'));
 }else if(spec.country && spec.country!=='foreign')p.set('with_origin_country',spec.country);
 if(spec.kind==='tvshow')p.set('without_genres','16,99,18,80,10766');
 if(['tv','dorama'].includes(spec.kind)){p.set('with_type','2|4');p.set('without_genres','16,99,10762,10763,10764,10767');if(!spec.period)p.set('first_air_date.gte',(date.getFullYear()-4)+'-01-01');}
 if(['movie','tv'].includes(spec.kind) && !(descriptor && descriptor.genre===16))p.set('without_genres',spec.kind==='tv'?'16,99,10762,10763,10764,10767':'16');
 if(spec.network && type==='tv')p.set('with_networks',String(spec.network));
 if(spec.company){const studio=DATA.studios.find(v=>v.id===Number(spec.company));if(type==='tv' && studio && studio.tv_network)p.set('with_networks',String(studio.tv_network));else p.set('with_companies',String(spec.company));}
 if(spec.period){const [from,to]=spec.period.split('-').map(Number);p.set(field+'.gte',from+'-01-01');p.set(field+'.lte',Math.min(to,date.getFullYear())===date.getFullYear()?today:to+'-12-31');}
 else if(sort==='new'){p.set(field+'.gte',(date.getFullYear()-3)+'-01-01');}
 if(['airing','current'].includes(spec.feed) && type==='tv'){const start=new Date(date);start.setDate(start.getDate()-(spec.feed==='current'?365:7));p.set('air_date.gte',day(start));p.set('air_date.lte',today);p.set('sort_by','popularity.desc');}
 if(spec.kind==='dorama' && !spec.period)p.set('first_air_date.gte',(date.getFullYear()-3)+'-01-01');
 if(spec.kind==='tvshow' && !spec.period){const floor=(date.getFullYear()-8)+'-01-01';if(!p.get('first_air_date.gte') || p.get('first_air_date.gte')<floor)p.set('first_air_date.gte',floor);}
 if(spec.feed==='recent' && type==='movie'){const start=new Date(date);start.setDate(start.getDate()-90);p.set(field+'.gte',day(start));p.set('sort_by','popularity.desc');}
 const local=spec.country==='RU' || spec.country==='UA' || DATA.networks.some(v=>v.id===spec.network && v.country==='RU');
 p.set('vote_count.gte',String(spec.kind==='tvshow'?(sort==='rated'?2:0):sort==='rated'?(local?10:type==='movie'?500:100):sort==='new'?2:sort==='votes'?10:spec.kind==='dorama'?10:0));
 if(sort==='votes')p.set('vote_average.gte','5');
 if(spec.feed==='upcoming'){
  const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);
  p.set(field+'.gte',day(tomorrow));p.delete(field+'.lte');p.set('sort_by','popularity.desc');p.set('vote_count.gte','0');
 }
 return 'discover/'+type+'?'+p.toString();
}
export function discoverySpecs(spec,date=new Date()){
 if(!DISCOVERY_KINDS.includes(spec && spec.kind))return [];
 if(spec.kind==='cartoon' && !spec.type && !spec.hero)return ['movie','tv'].map(type=>({type,path:discoveryQuery({...spec,type},date)})).filter(s=>s.path);
 if(spec.hero){const hero=DATA.heroes.find(v=>v.id===String(spec.hero));if(!hero || spec.kind!=='cartoon')return [];
  return hero.queries.flatMap(query=>['movie','tv'].filter(type=>!spec.type || type===spec.type).map(type=>({type,path:'search/'+type+'?include_adult=false&query='+encodeURIComponent(query)})));
 }
 const path=discoveryQuery(spec,date);return path?[{type:spec.type==='movie'?'movie':'tv',path}]:[];
}
export function discoveryAccepts(card,spec){
 const genres=[...(card.genre_ids || []),...(card.genres || [])].map(g=>Number(g.id || g)),origin=card.origin_country || [],descriptor=genreDescriptor(spec.type==='movie'?'movie':'tv',spec.genre,spec.kind);
 if(spec.feed==='upcoming'){
  const release=String(card[spec.type==='movie'?'release_date':'first_air_date'] || '').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(release) || release<=day(new Date()))return false;
 }
 if(spec.kind==='tv'){const year=Number(String(card.first_air_date || '').slice(0,4));if(!spec.period && year>0 && year<new Date().getFullYear()-4)return false;if(card.type && !['Scripted','Miniseries',2,4].includes(card.type))return false;if(genres.some(g=>[99,10762,10763,10764,10767].includes(g)))return false;}
 const year=Number(String(card.first_air_date || '').slice(0,4));if(!spec.period && year>0 && ['dorama','tvshow'].includes(spec.kind) && year<new Date().getFullYear()-(spec.kind==='dorama'?3:8))return false;
 if(descriptor && descriptor.genre && genres.length && !genres.includes(descriptor.genre))return false;
 if(spec.family && (spec.type==='movie'?!genres.includes(16) || !genres.includes(10751):!genres.includes(10762)))return false;
 if(spec.country && spec.country!=='foreign' && origin.length && !origin.includes(spec.country))return false;
 if(spec.kind==='dorama')return !genres.some(g=>[16,99,10762,10763,10764,10767].includes(g)) && origin.some(c=>(spec.country?[spec.country]:ASIAN).includes(c));
 if(spec.kind==='tvshow')return genres.some(g=>[10764,10767].includes(g)) && !genres.some(g=>[16,99,18,80,10766].includes(g)) && (spec.country==='foreign'?origin.length>0 && !origin.includes('RU'):!spec.country || origin.includes(spec.country));
 if(spec.kind==='cartoon')return (!isAnime(card) || !!spec.hero || !!spec.company || !!spec.network) && (genres.some(g=>[16,10762].includes(g)) || !!spec.hero && genres.includes(10751));
 return !!(descriptor && descriptor.genre===16) || !genres.includes(16) && !isAnime(card) && (spec.kind!=='tv' || !genres.some(g=>[10764,10767].includes(g)));
}
export function discoveryPlan(kind,value={},date=new Date()){
 const state=discoveryState(kind,value,date),options=discoveryOptions(kind,date),scope=discoveryScope(state),rows=[],types=kind==='movie'?['movie']:kind==='cartoon'?(state.format==='all'?['movie','tv']:[state.format]):['tv'];
 const add=(key,title,extra={},type=types[0])=>{const spec={kind,type,country:state.country,genre:state.genre,network:state.network,company:state.company,period:state.period,sort:state.sort || 'popular',...extra};
  const path=discoveryQuery(spec,date);if(!path || rows.some(row=>JSON.stringify(row.discovery)===JSON.stringify(spec)))return;
  rows.push({key,title:t(title),tmdb:path,media_type:!spec.type?undefined:type,discovery:spec,minimal_row_id:'minimal:discover:'+kind+':'+scope+':'+key,...(kind==='cartoon' && !type?{minimal_row_aliases:['movie','tv'].map(type=>'minimal:discover:'+kind+':'+scope+':'+(key.startsWith('mixed-')?type+'-'+key.slice(6):key+'-'+type))}:{})});};
 const sortRows=extra=>types.forEach(type=>{const choices=state.sort?options.sorts.filter(v=>v[0]===state.sort):options.sorts;
  choices.filter(([sort])=>sort!=='revenue' || type==='movie').forEach(([sort,title])=>add(type+'-'+sort,title,{...extra,sort},type));});
 if(state.section==='trending'){types.forEach(type=>add(type+'-trending',types.length>1?(type==='movie'?'Фильмы · в тренде':'Сериалы · в тренде'):'В тренде за неделю',{feed:'trending'},type));return rows;}
 if(state.section==='family'){types.forEach(type=>add('family-'+type,'Семейные',{family:true},type));return rows;}
 if(state.section==='heroes' || state.hero){const heroes=state.hero?options.heroes.filter(v=>v.id===state.hero):options.heroes.slice(0,8);heroes.forEach(h=>add('hero-'+h.id,h.name,{hero:h.id,type:state.format==='all'?'':state.format}));return rows;}
 if(state.section==='studios' && !state.company){options.studios.forEach(s=>types.forEach(type=>add('studio-'+s.id+'-'+type,s.name+' · '+t(type==='movie'?'Мультфильмы':'Мультсериалы'),{company:s.id,sort:'rated'},type)));return rows;}
 if(state.section==='platforms' && !state.network){const networks=kind==='tvshow'?options.networks.filter(n=>n.country==='RU').concat(options.networks.filter(n=>n.country!=='RU')):options.networks;
  networks.slice(0,12).forEach(n=>add('network-'+n.id,n.name,{network:n.id,type:'tv'}));return rows;}
 if(state.section==='genres' && !state.genre){options.genres.forEach(g=>types.filter(type=>DATA.genres[type].some(v=>v.id===g.id)).forEach(type=>add('genre-'+g.id+'-'+type,g.name+(types.length>1?' · '+t(type==='movie'?'Мультфильмы':'Мультсериалы'):''),{genre:g.id},type)));return rows;}
 if(state.section==='countries' && !state.country){options.countries.filter(([code])=>code!=='UA' || !['movie','tv'].includes(kind)).forEach(([code])=>add('country-'+code,countryTitle(code),{country:code}));if(kind==='tvshow')add('foreign','Зарубежные ТВ-шоу',{country:'foreign'});return rows;}
 if(state.section==='periods' && !state.period){options.periods.forEach(p=>add('period-'+p.start,p.start+'–'+p.end,{period:p.start+'-'+p.end,sort:'rated'}));return rows;}
 if(['new','rated','votes'].includes(state.section)){types.forEach(type=>add(type+'-'+state.section,options.sorts.find(v=>v[0]===state.section)[1],{sort:state.section},type));return rows;}
 if(state.country || state.genre || state.network || state.company || state.period || state.sort || state.format!=='all'){sortRows({});return rows;}
 if(kind==='tvshow'){
  add('now-watching','Сейчас смотрят',{country:'RU',feed:'current'});
  add('watch','Популярное',{country:'RU'});add('new','Премьеры '+date.getFullYear(),{country:'RU',sort:'popular',period:date.getFullYear()+'-'+date.getFullYear()});add('russian-reality','Реалити и соревнования',{country:'RU',genre:'10764'});add('russian-talk','Разговорные и развлекательные шоу',{country:'RU',genre:'10767'});add('rated','Высокий рейтинг',{country:'RU',sort:'rated'});
  return rows;
 }
 if(kind==='dorama'){
  add('watch','Сейчас выходит',{feed:'airing'});add('new','Новинки',{sort:'new'});add('popular','Популярное');add('rated','С высоким рейтингом',{sort:'rated'});
  const titles={KR:'Корейские дорамы',JP:'Японские дорамы',CN:'Китайские дорамы',TW:'Тайвань',TH:'Тайские дорамы'};ASIAN.forEach(code=>add('country-'+code,titles[code],{country:code}));
  ['k9840','k316362','k192772','35','9648','10765'].forEach(id=>{const g=options.genres.find(v=>v.id===id);if(g)add('genre-'+id,g.name,{genre:id});});return rows;
 }
 add('now-watching','Сейчас смотрят',{feed:'trending'},kind==='cartoon'?'':types[0]);
 const lead=[['new','Новинки'],['rated','Высокий рейтинг'],['popular','Популярные'],['votes','Много голосов']];
 const premierePeriod=date.getFullYear()+'-'+date.getFullYear();
 lead.forEach(([sort,title])=>{
  const extra={sort};
  if(sort==='new' && kind!=='cartoon')extra.period=premierePeriod;
  add((kind==='cartoon'?'mixed-':'')+sort,title,extra,kind==='cartoon'?'':types[0]);
 });
 if(kind==='cartoon'){
  [['RU','Россия'],['US','США']].forEach(([country,title])=>add('country-'+country,title,{country},''));
  options.genres.filter(g=>[35,12,878,14].includes(g.genre)).forEach(g=>add('genre-'+g.id,g.name,{genre:g.id},g.formats.length>1?'':g.formats[0]));
  return rows;
 }
 add('upcoming','Ожидаемые',{feed:'upcoming'});
 if(kind==='tv'){
  add('country-RU','Российские сериалы',{country:'RU'});
  add('country-KR','Корейские дорамы',{kind:'dorama',country:'KR'});
  add('country-TR','Турецкие сериалы',{country:'TR'});
  add('country-CN','Китайские дорамы',{kind:'dorama',country:'CN'});
  add('watch','Сейчас выходят',{feed:'airing'});
  [['80','Детективы и криминал'],['10765','Фантастика и фэнтези'],['35','Комедии'],['18','Драмы']].forEach(([genre,title])=>add('genre-'+genre,title,{genre}));
  return rows;
 }
 add('country-RU','Российские фильмы',{country:'RU'});
 ['28','35','18','53','878','27','9648'].forEach(id=>{const genre=options.genres.find(g=>g.id===id);add('genre-'+id,genre.name,{genre:id});});
 return rows;
}
