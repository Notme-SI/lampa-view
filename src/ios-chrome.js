// Match Safari's system color to the page canvas, without changing its viewport.
export default function iosChrome(L){
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
 if(!ios)return {update(){},palette(){}};
 const root=document.documentElement,properties=['background-color','--pt-chrome-edge'],saved=properties.map(name=>[name,root.style.getPropertyValue(name),root.style.getPropertyPriority(name)]);
 const existing=document.querySelector('meta[name="theme-color"]'),initial=existing && existing.content;
 const background=L.Background,original=background && background.theme;
 let enabled=false,suspended=false,shade='rgb(30,28,28)',native=initial || '#000000',created,edge;
 function normalize(color){return color==='black'?'#000000':color==='reset'?'#1d1f20':color;}
 function paint(color){
  // WebKit samples fixed container edges and can reuse an old sample for
  // gradient/transparent layers. A real opaque background-color avoids that
  // cached sample. Its 12px height exceeds WebKit's thin-border threshold.
  if(!edge){edge=document.createElement('div');edge.className='pt-ios-chrome-edge';edge.setAttribute('aria-hidden','true');edge.style.cssText='position:fixed;top:0;left:0;right:0;height:12px;z-index:2147483646;pointer-events:none;';document.body.appendChild(edge);}
  edge.style.backgroundColor=color;
  root.style.setProperty('background-color',color,'important');
  root.style.setProperty('--pt-chrome-edge','linear-gradient(180deg,'+color+',transparent 5em),linear-gradient(180deg,#080808b3,#080808a8 55%,#080808d9)' );
  const node=existing || created || (created=document.createElement('meta'));
  node.name='theme-color';node.content=color;if(!node.isConnected)(document.head || root).appendChild(node);
 }
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
  if(edge){edge.remove();edge=null;}
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
