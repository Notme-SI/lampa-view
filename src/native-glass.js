import SURFACES from './native-glass.css';

// Reapply the host's own glass declarations above our shared layout CSS.
// Read once, from accessible native stylesheets; never measure or sample artwork.
export default function nativeGlass(){
 let style;
 // Interface.size() reapplies native body classes from saved preferences. Use
 // our TV marker to keep the selected theme active without rewriting them.
 const scope=selector=>selector.replace(/^body\.glass--style-opacity--(easy|medium|blacked)/,'body.lampa_view.pt-tv.pt-native-glass[data-pt-native-opacity="$1"]').replace(/^body\.glass--style/,'body.lampa_view.pt-tv.pt-native-glass');
 function rules(list){
  let result='';
  for(const rule of Array.from(list || [])){
   if(rule.selectorText && rule.style){
    const selectors=rule.selectorText.split(',').map(s=>s.trim()).filter(s=>/^body\.glass--style/.test(s) && !/lampa_view|pt-theme/.test(s));
    if(!selectors.length)continue;
    const declarations=[];
    for(const name of Array.from(rule.style))declarations.push(name+':'+rule.style.getPropertyValue(name)+'!important');
    // A native background color must also replace our background-image layers.
    const background=rule.style.getPropertyValue('background-color');
    if(background)declarations.push('background:'+background+'!important');
    result+=selectors.map(scope).join(',')+'{'+declarations.join(';')+'}';
    const panel=selectors.find(s=>s.endsWith(' .settings__content'));
    if(panel && background){
     const body=scope(panel.slice(0,-' .settings__content'.length));
     const blur=rule.style.getPropertyValue('backdrop-filter') || rule.style.getPropertyValue('-webkit-backdrop-filter');
     result+=body+'{--pt-native-glass-background:'+background+(blur?';--pt-native-glass-filter:'+blur:'')+'}';
    }
   }else if(rule.cssRules && rule.conditionText){
    const nested=rules(rule.cssRules);if(nested)result+=rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+nested+'}';
   }
  }
  return result;
 }
 return {update(active){
  if(active && !style){
   let css='';
   for(const sheet of Array.from(document.styleSheets)){
    try{css+=rules(sheet.cssRules);}catch(_){/* Cross-origin plugin sheets do not own native glass. */}
   }
   style=document.createElement('style');style.id='lampa-view-native-glass';style.textContent=css+SURFACES;
   (document.head || document.documentElement).appendChild(style);
  }
  if(style)style.media=active?'all':'not all';
 }};
}
