import {text as t} from './i18n.js';
const TEXT='.menu__text,.settings-folder__name,.settings-param__name,.settings-param__value,.settings-param__descr,.settings__title,.selectbox__title,.selectbox-item__title,.selectbox-item__subtitle,.card__title,.card__age,.items-line__title,.minimal-detail-heading,.minimal-detail-overview,.full-start-new__description,.full-person__name,.full-person__role,.pt-hero__title,.pt-hero__overview,.navigation-bar__label,.full-start__button>span,.pt-hero__action>span,.nova-chip__label,.nova-toolbar__label,.nova-card__title,.nova-card__overview,.nova-card__meta,.nova-card__num,.nova-hero__season-label,.nova-hero__season-name,.torrent-item__title,.torrent-item__details,.tc-title,.tc-release-name,.tc-tag,.tc-size,.tc-seeds,.tc-foot,.alc-ap-vgroup__title,.alc-ap-season__head,.alc-ep__time';
const ACTIONS='.full-start__button,.full-start-new__buttons>.selector';
const CONTROLS='.menu__item,.settings-folder,.settings-param,.selectbox-item,.full-start__button,.full-start-new__buttons>.selector,.head__action,.head__menu-icon,.pt-hero__action,.navigation-bar__item,.nova-chip,.nova-btn,.nova-source-option,.torrent-item,.alc-chip,.alc-ap-voice,.alc-ap__play,.alc-ep';
const ICONS='.head__action svg,.head__menu-icon svg,.full-start-new__buttons>.selector svg,.full-start-new__buttons>.selector img,.menu__ico,.settings-folder__icon,.navigation-bar__icon,.full-start__button>svg,.full-start__button>img,.nova-chip>svg,.nova-btn>svg,.alc-chip>svg';
export default function personalScale(L){
 const values={};for(let n=80;n<=200;n+=10)values[n]=n+'%';
 for(const [name,label,description]of [
  ['lampa_view_text_scale','Размер текста','Названия, описания и подписи. 100% — обычный размер.'],
  ['lampa_view_cards_scale','Размер карточек','Постеры в подборках и превью серий. От 80 до 200%.'],
  ['lampa_view_controls_scale','Размер кнопок','Размер значков и отступы элементов управления. Размер текста настраивается отдельно.']
 ])L.SettingsApi.addParam({component:'lampa_view',param:{name,type:'select',values,default:'100'},field:{name:t(label),description:t(description)}});
 L.SettingsApi.addParam({component:'lampa_view',param:{name:'lampa_view_scale_reset',type:'button'},field:{name:t('Сброс масштаба'),description:t('Вернуть текст, кнопки и карточки к 100%.')},onChange:()=>{for(const key of ['text','controls','cards'])L.Storage.set('lampa_view_'+key+'_scale','100');update();document.dispatchEvent(new Event('minimal:interface-size'));document.dispatchEvent(new Event('minimal:hero-layout'));}});
 let timer,applied=[],pendingFull=false;const inserted=new Set();
 const factor=key=>{const n=Number(L.Storage.get(key,'100'));return Number.isFinite(n)?Math.max(.8,Math.min(2,n/100)):1;};
 function restore(){for(const {el,prop,old,priority,value}of applied)if(el.style.getPropertyValue(prop)===value){if(old)el.style.setProperty(prop,old,priority);else el.style.removeProperty(prop);}applied=[];}
 function update(full=true){
  clearTimeout(timer);pendingFull=false;
  const roots=Array.from(inserted);inserted.clear();
  if(full)restore();else applied=applied.filter(change=>change.el.isConnected);
  const select=selector=>Array.from(document.querySelectorAll(selector)).filter(el=>full || !applied.some(change=>change.el===el) && roots.some(root=>root===el || root.contains(el)));
  if(!document.body.classList.contains('lampa_view'))return;
  const text=factor('lampa_view_text_scale'),controls=factor('lampa_view_controls_scale'),cards=factor('lampa_view_cards_scale');
  document.body.style.setProperty('--pt-card-scale',String(cards));
  document.body.classList.toggle('pt-personal-enlarged',text>1 || controls>1);
  if(text===1 && controls===1 && cards===1)return;
  const changes=[];
  function set(el,prop,value){changes.push({el,prop,value,old:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)});}
  function measure(el,props,scale){const css=getComputedStyle(el);for(const prop of props){const base=css.getPropertyValue(prop);if(!/^\d+(?:\.\d+)?px$/.test(base))continue;const value=(parseFloat(base)*scale).toFixed(2)+'px';changes.push({el,prop,value,old:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)});}}
  if(text!==1)for(const el of select(TEXT))if(!el.querySelector(TEXT))measure(el,['font-size'],text);
  if(controls!==1){
   for(const el of select(CONTROLS))measure(el,['padding-top','padding-bottom','padding-left','padding-right','min-height'],controls);
   for(const el of select(ICONS))measure(el,['width','height','min-width'],controls);
   for(const el of select(ACTIONS+',.head__action,.head__menu-icon,.nova-chip,.nova-btn,.alc-chip,.alc-ap__play')){
    const height=el.getBoundingClientRect().height;
    if(height){const old=changes.findIndex(c=>c.el===el && c.prop==='min-height');if(old>=0)changes.splice(old,1);set(el,'min-height',(height*controls).toFixed(2)+'px');}
   }
   for(const el of select('.head,.head__body'))measure(el,['height'],controls);
   for(const el of select('.head__action:not(.open--search),.head__menu-icon'))measure(el,['width','flex-basis'],controls);
   for(const el of select(ACTIONS)){
    const size=getComputedStyle(el),width=el.getBoundingClientRect().width;
    if(width && width<el.parentElement.clientWidth*.5)set(el,'min-width',(width*controls).toFixed(2)+'px');
    set(el,'height','auto');set(el,'flex-shrink','0');
   }
   if(!document.body.classList.contains('pt-mobile'))for(const el of select('.minimal-detail-identity')){
    const width=Math.min(el.getBoundingClientRect().width*controls,window.innerWidth*.45);
    if(width){set(el,'width',width.toFixed(2)+'px');set(el,'min-width',width.toFixed(2)+'px');}
   }
  }
  if(cards!==1){
   // Fit rails calculate complete slots themselves. Other grids retain native wrapping.
   for(const el of select('.card,.nova__list--grid .nova-card,.nova__list--row .nova-card')){
    if(el.closest('.extensions') || el.closest('.minimal-fit-posters') || el.closest('.pt-hero') || el.classList.contains('card--collection'))continue;
    const width=el.getBoundingClientRect().width,parent=el.parentElement.getBoundingClientRect().width;
    if(width && parent){const size=Math.min(width*cards,parent)+'px';set(el,'width',size);set(el,'max-width',size);set(el,'flex-basis',size);}
   }
   for(const el of select('.nova__list:not(.nova__list--grid):not(.nova__list--row) .nova-card__thumb'))measure(el,['width','height','min-width'],cards);
  }
  for(const change of changes){change.el.style.setProperty(change.prop,change.value,'important');change.value=change.el.style.getPropertyValue(change.prop);}
  if(text>1 || controls>1)for(const hero of select('.pt-hero')){
   const body=hero.querySelector('.pt-hero__body');if(!body)continue;
   const css=getComputedStyle(body),font=parseFloat(css.fontSize)||16;
   const bottom=css.position==='absolute'?(parseFloat(css.bottom)||0):font;
   const value=Math.ceil(body.offsetHeight+bottom+font*2)+'px';
   const change={el:hero,prop:'min-height',old:hero.style.getPropertyValue('min-height'),priority:hero.style.getPropertyPriority('min-height'),value};
   hero.style.setProperty('min-height',value,'important');changes.push(change);
  }
  applied=applied.concat(changes);
  // Do not call Layer.update(): it repositions native scroll controllers.
  // Only the hero needs a geometry pass after an explicit scale change.
  if(full)document.dispatchEvent(new Event('minimal:hero-layout'));
 }
 function schedule(full=true){pendingFull=pendingFull || full;clearTimeout(timer);timer=setTimeout(()=>update(pendingFull),100);}
 if(L.Storage.listener)L.Storage.listener.follow('change',e=>{if(['lampa_view_text_scale','lampa_view_controls_scale','lampa_view_cards_scale','lampa_view_enabled','lampa_view_layout'].includes(e.name)){schedule();if(e.name==='lampa_view_cards_scale'){document.body.style.setProperty('--pt-card-scale',String(factor(e.name)));document.dispatchEvent(new Event('minimal:interface-size'));document.dispatchEvent(new Event('minimal:hero-layout'));}}});
 document.addEventListener('minimal:interface-size',()=>schedule());
 window.addEventListener('resize',()=>schedule());
 // Observe inserted rows only; our style writes cannot trigger a feedback loop.
 const observer=new MutationObserver(records=>{
  if(factor('lampa_view_text_scale')===1 && factor('lampa_view_controls_scale')===1 && factor('lampa_view_cards_scale')===1)return;
  const targets=TEXT+','+CONTROLS+','+ICONS+',.card,.nova-card,.nova-card__thumb,.minimal-detail-identity,.head,.head__body,.pt-hero';
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1 && node.isConnected && (node.matches(targets) || node.querySelector(targets)))inserted.add(node);
  if(inserted.size)schedule(false);
 });
 observer.observe(document.body,{childList:true,subtree:true});update();
 return {update,stop(){clearTimeout(timer);observer.disconnect();restore();document.body.style.removeProperty('--pt-card-scale');document.body.classList.remove('pt-personal-enlarged');}};
}
