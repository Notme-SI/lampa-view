import {text as t} from './i18n.js';
import {openSection} from './sections.js';
export default function discoveryControls(L,item,object){
 if(object.minimal_discovery_leaf)return;
 const kind=object.url || object.cat;if(kind==='tvshow')return;const path=kind==='movie'?'films':kind==='cartoon'?'kids':kind==='dorama'?'series/dorama':'series',wrapper=document.createElement('section');wrapper.className='minimal-section-shortcuts';
 const grid=document.createElement('div'),button=document.createElement('button');grid.className='minimal-section-entry';button.type='button';button.className='minimal-section-open pt-hero__action selector';button.textContent=t('Все подборки');button.dataset.sectionId='open';window.jQuery(button).on('hover:enter',()=>openSection(L,{path})).on('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSection(L,{path});});grid.appendChild(button);wrapper.appendChild(grid);let disposed=false,index=0,ready=false,focusStart=true;
 const buttons=Array.from(grid.children);buttons.forEach((b,i)=>window.jQuery(b).on('hover:focus',()=>index=i));
 function focus(){if(disposed)return;item.scroll.update(wrapper,false);L.Controller.collectionSet(grid);L.Controller.collectionFocus(buttons[index],grid);}
 function toggle(){L.Controller.add('minimal_section_shortcuts',{link:wrapper,toggle:focus,left(){if(index){index--;focus();}else L.Controller.toggle('menu');},right(){index=Math.min(buttons.length-1,index+1);focus();},up(){L.Controller.toggle('head');},down(){if(item.items && item.items.length){item.active=0;item.items[0].toggle();}},back(){L.Activity.backward();}});L.Controller.toggle('minimal_section_shortcuts');}
 item.use({onCreate(){item.scroll.prepend(wrapper);},onBuild(){ready=true;},onController(controller){const original=controller.toggle;controller.toggle=function(){if(focusStart){if(ready)focusStart=false;toggle();}else if(original)original.apply(this,arguments);};},onAppend(row){if(item.items[0]===row)row.use({onUp:toggle});},onDestroy(){disposed=true;buttons.forEach(b=>window.jQuery(b).off());wrapper.remove();}});
}
