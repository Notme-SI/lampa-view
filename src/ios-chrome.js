// Match Safari's system color to the page canvas, without changing its viewport.
export default function iosChrome(L){
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
 if(!ios)return {update(){},palette(){}};
 const root=document.documentElement,properties=['background-color','--pt-chrome-edge'],saved=properties.map(name=>[name,root.style.getPropertyValue(name),root.style.getPropertyPriority(name)]);
 const existing=document.querySelector('meta[name="theme-color"]'),initial=existing && existing.content;
 const background=L.Background,original=background && background.theme;
 let enabled=false,suspended=false,shade='rgb(10,10,10)',native=initial || '#000000',created,header,headerStyle;
 function normalize(color){return color==='black'?'#000000':color==='reset'?'#1d1f20':color;}
 function paint(color){
  // Give the existing full-width fixed header an explicit, almost clear
  // background color. WebKit can blend it against the matching root canvas
  // without reusing a stale gradient sample. No overlay can cover its pill.
  const next=document.querySelector('.head');
  if(next!==header){restoreHeader();header=next;if(header)headerStyle=[header.style.getPropertyValue('background-color'),header.style.getPropertyPriority('background-color')];}
  if(header){
   const rgb=color.indexOf('#')===0?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):color.match(/[\d.]+/g).slice(0,3);
   header.style.setProperty('background-color','rgba('+rgb.join(',')+',0.01)','important');
  }
  root.style.setProperty('background-color',color,'important');
  root.style.setProperty('--pt-chrome-edge','linear-gradient(180deg,'+color+',transparent 5em),linear-gradient(180deg,#080808b3,#080808a8 55%,#080808d9)' );
  const node=existing || created || (created=document.createElement('meta'));
  node.name='theme-color';node.content=color;if(!node.isConnected)(document.head || root).appendChild(node);
 }
 function restoreHeader(){if(header){if(headerStyle[0])header.style.setProperty('background-color',headerStyle[0],headerStyle[1]);else header.style.removeProperty('background-color');header=null;headerStyle=null;}}
 function publish(color){if(original)original.call(background,color);paint(color);}
 if(original)background.theme=function(color){
  native=color;
  if(enabled){
   // Native playback/ad colors take precedence. A reset returns to Glass.
   suspended=color!=='reset' && color!=='#1d1f20';
   const value=suspended?normalize(color):shade;
   const result=original.call(this,value);paint(value);return result;
  }
  return original.apply(this,arguments);
 };
 function update(active){
  if(active){if(!enabled)suspended=false;enabled=true;if(!suspended)publish(shade);return;}
  if(!enabled)return;enabled=false;
  restoreHeader();
  saved.forEach(([name,value,priority])=>{if(value)root.style.setProperty(name,value,priority);else root.style.removeProperty(name);});
  if(original)original.call(background,native);
  if(existing)existing.content=normalize(native);else if(created){created.remove();created=null;}
 }
 function palette(colors){
  if(!colors || colors.length!==2)return;
  // Reuse the cached ambience. The opaque top edge and system color agree;
  // below the header it fades back into the existing artwork background.
  shade='rgb('+colors[0].map((value,index)=>Math.round(8*.7+(value+colors[1][index])*.15)).join(',')+')';
  if(enabled && !suspended)publish(shade);
 }
 return {update,palette};
}
