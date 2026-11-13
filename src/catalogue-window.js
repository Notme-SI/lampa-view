// Keep card instances/data for Back and native indices, but only attach a
// bounded row window. Spacers retain the full scroll range without empty cards.
import {desktopPosterWidth,desktopPosterColumns} from './poster-size.js';
export default function catalogueWindow(item,viewport,grid,{attach,detach}){
 let cards=[],known=0,start=0,end=0,columns=0,pitch=0,width=0,key='',renderKey='',disposed=false,compatible=true,needsMeasure=true;
 const indices=new WeakMap();
 const top=document.createElement('div'),bottom=document.createElement('div');
 for(const spacer of [top,bottom]){spacer.className='pt-catalogue-spacer';spacer.setAttribute('aria-hidden','true');}
 const element=card=>{const node=card?.render(true);return node?.nodeType?node:node?.[0];};
 function sync(){
  // Native append is monotonic within this component. Reset is a new instance.
  while(known<item.items.length){const node=element(item.items[known++]);if(node?.matches('.card:not(.card--wide):not(.card--collection)')){indices.set(node,cards.length);cards.push(node);}else compatible=false;}
 }
 function measure(){
  if(!needsMeasure && columns && pitch)return true;
  const first=cards[start]?.parentElement===grid?cards[start]:cards.find(card=>card.parentElement===grid);if(!first)return false;
  if(!grid.isConnected || !grid.clientWidth || !first.offsetWidth)return false;
  const profile=getComputedStyle(document.body),fixed=desktopPosterWidth(profile),signature=[grid.clientWidth,innerWidth,innerHeight,profile.fontSize,profile.getPropertyValue('--pt-interface-scale'),fixed,document.body.classList.contains('pt-tv')].join('|');
  needsMeasure=false;
  if(key===signature && columns && pitch)return true;
  // Measure responsive columns in a single offscreen probe. Never collapse
  // live spacers: a layout read in that state can clamp a deep scrollTop.
  const probe=grid.cloneNode(false),sample=first.cloneNode(false);
  probe.removeAttribute('id');probe.classList.remove('pt-windowed-grid');
  probe.style.cssText='position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;max-width:none;width:'+grid.clientWidth+'px';
  sample.removeAttribute('id');probe.appendChild(sample);grid.parentElement.appendChild(probe);
  const natural=getComputedStyle(probe),cardWidth=sample.offsetWidth;
  const tracks=natural.display==='grid'?natural.gridTemplateColumns.split(/\s+/).filter(Boolean):[];
  columns=Math.max(1,tracks.length || Math.round((probe.clientWidth-(parseFloat(natural.paddingLeft)||0)-(parseFloat(natural.paddingRight)||0))/cardWidth));
  probe.remove();renderKey='';
  grid.style.setProperty('--pt-window-cols',columns);
  grid.classList.add('pt-windowed-grid');
  const actual=getComputedStyle(grid),gap=parseFloat(actual.columnGap)||0;
  const available=grid.clientWidth-(parseFloat(actual.paddingLeft)||0)-(parseFloat(actual.paddingRight)||0);
  if(fixed){columns=desktopPosterColumns(available,gap,profile);grid.style.setProperty('--pt-window-cols',columns);}
  width=(available-gap*(columns-1))/columns;
  grid.style.setProperty('--pt-window-width',width+'px');
  // Every slot reserves two title lines, year and the existing progress area.
  // Title/year flow naturally inside it; an extra title line cannot shift rows.
  pitch=first.getBoundingClientRect().height;
  if(!pitch)return false;
  grid.style.setProperty('--pt-window-row',pitch+'px');key=signature;
  return true;
 }
 function mount(from,to){
  const nextKey=[from,to,columns,pitch,cards.length].join(':');if(renderKey===nextKey)return;
  const wanted=new Set(cards.slice(from,to));
  // New native appends may be outside the old [start,end) range.
  for(const card of Array.from(grid.children))if(card.matches('.card') && !wanted.has(card)){
   detach(card);card.remove();
  }
  if(top.parentElement!==grid)grid.prepend(top);
  if(bottom.parentElement!==grid)grid.appendChild(bottom);
  // Keep the overlap connected and untouched. Only insert the entering edge;
  // moving every surviving card through a fragment restarts image visibility.
  let cursor=bottom;
  for(let index=to-1;index>=from;index--){
   const card=cards[index];
   if(card.parentElement!==grid || card.nextSibling!==cursor){grid.insertBefore(card,cursor);attach(card);}
   cursor=card;
  }
  start=from;end=to;
  renderKey=nextKey;
  const before=from/columns,after=Math.ceil((cards.length-to)/columns);
  for(const [spacer,rows] of [[top,before],[bottom,after]]){
   const height=rows*pitch+'px';if(spacer.style.height!==height)spacer.style.height=height;
   spacer.style.gridRow=rows?'span '+rows:'auto';
   spacer.hidden=rows===0;
  }
 }
 function update(target){
  if(disposed)return;sync();
  if(!compatible){if(grid.classList.contains('pt-windowed-grid'))restore();return;}
  const oldColumns=columns,oldPitch=pitch,oldKey=key;
  const oldOrigin=grid.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  const oldRow=oldPitch?Math.max(0,Math.floor((viewport.scrollTop-oldOrigin)/oldPitch)):0;
  const anchor=oldRow*oldColumns,fraction=oldPitch?(viewport.scrollTop-oldOrigin-oldRow*oldPitch)/oldPitch:0;
  if(!cards.length || !measure())return;
  const origin=oldKey===key?oldOrigin:grid.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  if(oldPitch && oldKey!==key && (oldColumns!==columns || Math.abs(oldPitch-pitch)>.5))viewport.scrollTop=origin+(Math.floor(anchor/columns)+fraction)*pitch;
  const row=Math.max(0,Math.floor((viewport.scrollTop-origin)/pitch));
  const screen=Math.max(1,Math.ceil(viewport.clientHeight/pitch));
  // Two viewports of overscan per side, at least the native ±36 collection.
  const overscan=Math.max(screen*2,Math.ceil(40/columns));
  let first=Math.max(0,row-overscan),last=Math.min(Math.ceil(cards.length/columns),row+screen+overscan+1);
  const selected=target?(indices.get(target)??-1):-1;
  if(selected>=0){const focusedRow=Math.floor(selected/columns);first=Math.min(first,Math.max(0,focusedRow-1));last=Math.max(last,Math.min(Math.ceil(cards.length/columns),focusedRow+2));}
  mount(first*columns,Math.min(cards.length,last*columns));
 }
 function restore(){
  const fragment=document.createDocumentFragment();for(const itemCard of item.items){const card=element(itemCard);if(card)fragment.appendChild(card);}grid.appendChild(fragment);
  top.remove();bottom.remove();grid.classList.remove('pt-windowed-grid');
  for(const property of ['--pt-window-cols','--pt-window-width','--pt-window-row'])grid.style.removeProperty(property);
  start=0;end=cards.length;key=renderKey='';needsMeasure=true;
 }
 return {update,restore,invalidate(){needsMeasure=true;},contains:node=>indices.has(node),ensure(node){update(node);},destroy(){disposed=true;cards=[];top.remove();bottom.remove();}};
}
