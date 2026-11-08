import {text as lampaViewText} from './i18n.js';
// Keep native search actions and callbacks, but present the catalogue's actual
// names instead of repeated combinations of the same English title.
export default function torrentSearch(L){
 if(!L.Select || !L.Select.show || !L.Activity)return;
 const show=L.Select.show;let timer;
 function active(){const value=L.Activity.active() || {};return value.component==='torrents'?value:null;}
 const normal=value=>String(value || '').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
 L.Select.show=function(options){
  const page=active();
  if(!page || !document.body.classList.contains('lampa_view') || options.title!==L.Lang.translate('filter_clarify'))return show.apply(this,arguments);
  const aliases=window.TorrentCatalogue && window.TorrentCatalogue.searchAliases?window.TorrentCatalogue.searchAliases(page):[];
  const movie=page.movie || {},release=movie.minimal_anime_release || {},names=[release.title,release.original,movie.name,movie.title,movie.original_name,movie.original_title,...aliases];
  const items=[],seen=new Set();let combinations=false;
  function add(item){
   const key=item.query && normal(item.query);if(key && seen.has(key))return;
   if(key)seen.add(key);items.push(item);
  }
  (options.items || []).forEach(item=>{
   if(item.separator && item.title===L.Lang.translate('filter_combinations'))combinations=true;
   if(!combinations)add(item);
  });
  names.filter(value=>typeof value==='string' && value.trim()).forEach(query=>add({title:query,query,selected:normal(query)===normal(page.search)}));
  if(page.search && !seen.has(normal(page.search)))add({title:page.search,query:page.search,selected:true});
  return show.call(this,{...options,items});
 };
 function decorate(){
  timer=null;if(!active() || !document.body.classList.contains('lampa_view'))return;
  const root=document.querySelector('.activity--active .minimal-torrent-view');if(!root)return;
  const bar=root.querySelector('.torrent-filter');if(!bar)return;
  bar.classList.add('minimal-torrent-toolbar');
  [['search',lampaViewText("Поиск")],['sort',lampaViewText("Сортировка")],['filter',lampaViewText("Фильтры")]].forEach(([key,label])=>{
   const button=bar.querySelector('.filter--'+key);if(!button)return;
   let text=button.querySelector('.minimal-toolbar-label');
   if(!text){text=document.createElement('span');text.className='minimal-toolbar-label';text.textContent=label;button.appendChild(text);}
   button.setAttribute('aria-label',label);
   if(!button.querySelector('.pt-toolbar-icon')){
    Array.from(button.children).filter(node=>node.tagName.toLowerCase()==='svg').forEach(node=>node.remove());
    const glyph={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',sort:'<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',filter:'<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6m8 0v6m-8 0v6"/>'}[key];
    button.insertAdjacentHTML('afterbegin','<svg class="pt-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyph+'</svg>');
   }
   const value=button.querySelector('div:not(.hide)');button.title=value?label+': '+value.textContent:label;
  });
 }
 function schedule(){if(!timer && active())timer=setTimeout(decorate,0);}
 L.Listener.follow('activity',event=>{if(event.type==='start')schedule();});
 L.Listener.follow('torrent',schedule);
 schedule();
}
