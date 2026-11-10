import {text as t} from './i18n.js';
import {cataloguePlan} from './catalogue.js';
import {discoveryOptions} from './discovery-model.js';
import {DISCOVERY_SOURCE} from './discovery-source.js';

export const BROWSE_KINDS=['movie','tv','cartoon','tvshow'];
export function browseOptions(kind,date=new Date()){
 const options=discoveryOptions(kind,date);
 return {collections:cataloguePlan(kind,'standard',date).filter(row=>!row.key.startsWith('genre-') && !(kind==='tvshow' && row.discovery.genre)),genres:options.genres.filter(g=>kind==='movie'?g.genre!==16:kind==='tv'?![16,99,10762,10763,10764,10767].includes(g.genre):true)};
}
export function yearRange(value,date=new Date()){
 const match=String(value || '').trim().match(/^(\d{4})(?:\s*[-–—:]\s*(\d{4}))?$/);
 if(!match)return '';
 const from=Number(match[1]),to=Number(match[2] || match[1]);
 return from>=1870 && to>=from && to<=date.getFullYear()?from+'-'+to:'';
}
export function browseState(kind,value={},date=new Date()){
 const options=browseOptions(kind,date);
 return {collection:options.collections.some(r=>r.key===value.collection)?value.collection:'',genre:options.genres.some(g=>g.id===String(value.genre))?String(value.genre):'',sort:['popular','rated','new'].includes(value.sort)?value.sort:'',period:yearRange(value.period,date)};
}
export function browseSpec(kind,value={},date=new Date()){
 const state=browseState(kind,value,date),row=browseOptions(kind,date).collections.find(r=>r.key===state.collection);
 const spec={ordered:true,kind,type:kind==='cartoon'?'':kind==='movie'?'movie':'tv',country:kind==='tvshow'?'RU':'',genre:'',network:0,company:0,hero:'',...(row && row.discovery || {})};
 spec.sort=state.sort || spec.sort || 'popular';
 if(state.genre)spec.genre=state.genre;
 // A year filter must include archives, not inherit the old four-year TV feed.
 spec.period=state.period || (!['recent','upcoming','trending'].includes(spec.feed) && spec.sort!=='new'?'1870-'+date.getFullYear():'');
 // Trending endpoints cannot filter or sort. Use Discover once parameters change.
 if(spec.feed==='trending' && (state.genre || state.period || state.sort))delete spec.feed;
 return spec;
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

export default function catalogueBrowser(L){
 if(!L.Component || !L.Component.get)return;
 const Category=L.Component.get('category'),Full=L.Component.get('category_full'),list=L.Api.list;
 L.Api.list=function(params,ok,fail){if(!params.minimal_browse_kind)return list.apply(this,arguments);return L.Api.sources[DISCOVERY_SOURCE].list({url:JSON.stringify(browseSpec(params.minimal_browse_kind,params.minimal_browse)),page:params.page,minimal_cancelled:()=>!!params.minimal_browse_cancelled},json=>{if(params.minimal_browse_cancelled)return;const active=L.Activity.active(),grid=active && active.activity && active.activity.component;if(grid && grid.object===params)grid.total_pages=json.total_pages;ok(json);},fail);};
 L.Component.add('category',function(object){
  const kind=object.url || object.cat;if(!BROWSE_KINDS.includes(kind))return new Category(object);
  object.minimal_browse_kind=kind;object.minimal_browse_cancelled=false;object.minimal_browse=browseState(kind,object.minimal_browse || L.Storage.get('minimal_catalogue_filters_'+kind,{}));
  const item=new Full(object),state=object.minimal_browse,options=browseOptions(kind),spec=browseSpec(kind,state);
  function apply(change,index){const next=browseState(kind,{...state,...change});L.Storage.set('minimal_catalogue_filters_'+kind,next);L.Activity.replace({minimal_browse:next,minimal_filter_focus:index,page:1});}
  function select(title,values,key,index){L.Select.show({title,items:values.map(v=>({...v,selected:v.value===(key==='sort'?spec.sort:state[key])})),onSelect:value=>apply({[key]:value.value},index),onBack:()=>controls.toggle()});}
  function years(index){const year=new Date().getFullYear(),values=[{title:t('Все годы'),value:''},...Array.from({length:8},(_,i)=>({title:String(year-i),value:(year-i)+'-'+(year-i)})),...discoveryOptions(kind).periods.filter(p=>p.start!==p.end).slice().reverse().map(p=>({title:p.start+'–'+p.end,value:p.start+'-'+p.end})),{title:t('Свой диапазон'),value:'custom'}];
   L.Select.show({title:t('Годы'),items:values.map(v=>({...v,selected:v.value===state.period})),onSelect:value=>{if(value.value!=='custom')return apply({period:value.value},index);setTimeout(()=>{if(object.minimal_browse_cancelled)return;L.Input.edit({title:t('Годы: от–до'),value:state.period,nosave:true,free:true},value=>{const period=yearRange(value);if(!period){L.Noty.show(t('Укажите годы от 1870 до {0}: например, 1990–2005',[year]));return years(index);}apply({period},index);});},100);},onBack:()=>controls.toggle()});
  }
  const collection=options.collections.find(row=>row.key===state.collection),genre=options.genres.find(g=>g.id===state.genre),sort={popular:t('Популярные'),rated:t('Рейтинг'),new:t('Новые')};
  const controls=gridControls(L,item,object,[
   {title:collection?collection.title:t('Все подборки'),choose:i=>select(t('Подборки'),[{title:t('Все подборки'),value:''},...options.collections.map(row=>({title:row.title,value:row.key}))],'collection',i)},
   {title:genre?t(genre.name):t('Все жанры'),choose:i=>select(t('Жанры'),[{title:t('Все жанры'),value:''},...options.genres.map(g=>({title:t(g.name),value:g.id}))],'genre',i)},
   {title:sort[spec.sort] || sort.popular,choose:i=>select(t('Сортировка'),Object.keys(sort).map(value=>({title:sort[value],value})),'sort',i)},
   {title:state.period?state.period.replace('-','–'):t('Все годы'),choose:years}
  ]);
  item.use({onDestroy(){object.minimal_browse_cancelled=true;}});return item;
 });
}
