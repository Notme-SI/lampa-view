import {text as t} from './i18n.js';
const TEXT='.menu__text,.settings-folder__name,.settings-param__name,.settings-param__value,.settings-param__descr,.settings__title,.selectbox__title,.selectbox-item__title,.selectbox-item__subtitle,.card__title,.card__age,.items-line__title,.minimal-detail-heading,.minimal-detail-overview,.full-start-new__description,.full-person__name,.full-person__role,.pt-hero__title,.pt-hero__overview,.navigation-bar__label,.full-start__button>span,.pt-hero__action>span,.nova-chip__label,.nova-toolbar__label,.nova-card__title,.nova-card__overview,.nova-card__meta,.nova-card__num,.nova-hero__season-label,.nova-hero__season-name,.torrent-item__title,.torrent-item__details,.tc-title,.tc-release-name,.tc-tag,.tc-size,.tc-seeds,.tc-foot,.alc-ap-vgroup__title,.alc-ap-season__head,.alc-ep__time';
const CONTROLS='.menu__item,.settings-folder,.settings-param,.selectbox-item,.full-start__button,.head__action,.pt-hero__action,.navigation-bar__item,.nova-chip,.nova-btn,.nova-source-option,.torrent-item,.alc-chip,.alc-ap-voice,.alc-ap__play,.alc-ep';
const ICONS='.menu__ico,.settings-folder__icon,.navigation-bar__icon,.full-start__button>svg,.full-start__button>img,.nova-chip>svg,.nova-btn>svg,.alc-chip>svg';
export default function personalScale(L){
 const values={};for(let n=80;n<=200;n+=10)values[n]=n+'%';
 for(const [name,label,description]of [
  ['lampa_view_text_scale','Размер текста','Подписи, описания и названия. Не меняет размер постеров.'],
  ['lampa_view_controls_scale','Размер кнопок и меню','Размер значков и отступы элементов управления. Размер текста настраивается отдельно.']
 ])L.SettingsApi.addParam({component:'lampa_view',param:{name,type:'select',values,default:'100'},field:{name:t(label),description:t(description)}});
 let timer,applied=[];
 const factor=key=>{const n=Number(L.Storage.get(key,'100'));return Number.isFinite(n)?Math.max(.8,Math.min(2,n/100)):1;};
 function restore(){for(const {el,prop,old,priority,value}of applied)if(el.style.getPropertyValue(prop)===value){if(old)el.style.setProperty(prop,old,priority);else el.style.removeProperty(prop);}applied=[];}
 function update(){
  clearTimeout(timer);restore();
  if(!document.body.classList.contains('lampa_view'))return;
  const text=factor('lampa_view_text_scale'),controls=factor('lampa_view_controls_scale');
  if(text===1 && controls===1)return;
  const changes=[];
  function set(el,prop,value){changes.push({el,prop,value,old:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)});}
  function measure(el,props,scale){const css=getComputedStyle(el);for(const prop of props){const base=css.getPropertyValue(prop);if(!/^\d+(?:\.\d+)?px$/.test(base))continue;const value=(parseFloat(base)*scale).toFixed(2)+'px';changes.push({el,prop,value,old:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)});}}
  if(text!==1)for(const el of document.querySelectorAll(TEXT))if(!el.querySelector(TEXT))measure(el,['font-size'],text);
  if(controls!==1){
   for(const el of document.querySelectorAll(CONTROLS))measure(el,['padding-top','padding-bottom','padding-left','padding-right','min-height'],controls);
   for(const el of document.querySelectorAll(ICONS))measure(el,['width','height','min-width'],controls);
   for(const el of document.querySelectorAll('.full-start__button,.nova-chip,.nova-btn,.alc-chip,.alc-ap__play')){
    const height=el.getBoundingClientRect().height;
    if(height){const old=changes.findIndex(c=>c.el===el && c.prop==='min-height');if(old>=0)changes.splice(old,1);set(el,'min-height',(height*controls).toFixed(2)+'px');}
   }
   if(!document.body.classList.contains('pt-mobile'))for(const el of document.querySelectorAll('.minimal-detail-identity')){
    const width=Math.min(el.getBoundingClientRect().width*controls,window.innerWidth*.45);
    if(width){set(el,'width',width.toFixed(2)+'px');set(el,'min-width',width.toFixed(2)+'px');}
   }
  }
  for(const change of changes){change.el.style.setProperty(change.prop,change.value,'important');change.value=change.el.style.getPropertyValue(change.prop);}applied=changes;
  if(L.Layer && L.Layer.update)L.Layer.update();
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(update,100);}
 if(L.Storage.listener)L.Storage.listener.follow('change',e=>{if(['lampa_view_text_scale','lampa_view_controls_scale','lampa_view_enabled','lampa_view_layout'].includes(e.name))schedule();});
 document.addEventListener('minimal:interface-size',schedule);
 window.addEventListener('resize',schedule);
 // Observe inserted rows only; our style writes cannot trigger a feedback loop.
 const observer=new MutationObserver(()=>{if(factor('lampa_view_text_scale')!==1 || factor('lampa_view_controls_scale')!==1)schedule();});
 observer.observe(document.body,{childList:true,subtree:true});update();
 return {update,stop(){clearTimeout(timer);observer.disconnect();restore();}};
}
