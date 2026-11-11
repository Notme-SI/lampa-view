import GLASS from './glass.css';
import MATERIAL from './material.css';
import iosChrome from './ios-chrome.js';
import {text as t} from './i18n.js';
const accentKey='lampa_view_dark_accent',defaultAccent='#d8c39a';
const cardMotionKey='lampa_view_card_motion';
export const cardMotionValue=value=>['on','off','system'].includes(value)?value:'on';
export function cardMotionSetting(L){
 L.SettingsApi.addParam({component:'lampa_view',param:{name:cardMotionKey,type:'select',values:{on:t('Включена'),system:t('По системе'),off:t('Выключена')},default:'on'},field:{name:t('Анимация карточек'),description:t('Плавный подъём и свечение при выборе. «По системе» учитывает уменьшение движения на устройстве.') }});
}

function normalizeAccent(value){
 const hex=String(value ?? '').trim().toLowerCase().replace(/^#/,'');
 if(/^[0-9a-f]{6}$/.test(hex))return '#'+hex;
 if(/^[0-9a-f]{3}$/.test(hex))return '#'+hex.replace(/./g,letter=>letter+letter);
 return '';
}
const darkAccent=L=>normalizeAccent(L.Storage.get(accentKey,defaultAccent)) || defaultAccent;

function applyDarkAccent(L){
 const style=document.body.style,accent=darkAccent(L),custom=accent!==defaultAccent;
 document.body.classList.toggle('pt-custom-accent',custom);
 const rgb=accent.slice(1).match(/../g).map(channel=>parseInt(channel,16));
 const linear=rgb.map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});
 const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 const selection=rgb.map(channel=>Math.round(20+.13*channel)).join(',');
 const focus=rgb.map(channel=>Math.round(channel+.12*(255-channel))).join(',');
 const overrides={
  '--pt-custom-accent':accent,'--pt-custom-accent-rgb':rgb.join(','),
  '--pt-custom-accent-ink':luminance>.179?'#000':'#fff',
  '--pt-custom-accent-focus':'rgb('+focus+')','--pt-custom-selection-rgb':selection,
 };
 for(const [property,value] of Object.entries(overrides)){
  if(custom)style.setProperty(property,value);
  else style.removeProperty(property);
 }
}

export function darkAccentSetting(L){
 const label='Акцент тёмной темы';
 L.SettingsApi.addParam({
  component:'lampa_view',param:{name:accentKey,type:'button',default:defaultAccent},
  field:{name:t(label),description:t('Код HEX. Пустое поле возвращает {0}.',[defaultAccent])},
  onRender:item=>item.find('.settings-param__name').after('<div class="settings-param__value">'+darkAccent(L)+'</div>'),
  onChange:()=>{
   if(themeValue(L.Storage.get('lampa_view_theme','minimal'))!=='minimal')return;
   L.Input.edit({title:t(label),value:darkAccent(L),free:true,nosave:true,nomic:true},value=>{
    const raw=String(value ?? '').trim(),color=normalizeAccent(raw);
    if(raw && !color){L.Noty?.show?.(t('Введите цвет в формате #RRGGBB.'));return;}
    L.Storage.set(accentKey,color || defaultAccent);
    document.querySelectorAll('[data-name="'+accentKey+'"] .settings-param__value').forEach(node=>{node.textContent=darkAccent(L);});
   });
  },
 });
}

export function themeValue(value){return value==='glass' || value==='apple'?'glass':'minimal';}
const yes=value=>![false,'false',0,'0','no'].includes(value);
export default function appearance(L){
 if(!document.getElementById('lampa-view-glass-style')){const style=document.createElement('style');style.id='lampa-view-glass-style';style.textContent=GLASS+'\n'+MATERIAL;(document.head || document.documentElement).appendChild(style);}
 const chrome=iosChrome(L);
 let artworkColor='';
 function updateChrome(){
  const active=yes(L.Storage.get('lampa_view_enabled',true)) && !document.body.classList.contains('pt-tv');
  chrome.palette(artworkColor);
  chrome.update(active && (themeValue(L.Storage.get('lampa_view_theme','minimal'))==='glass' ||
   !!artworkColor && document.body.classList.contains('pt-mobile')));
 }
 function nativeValue(name,fallback){try{return L.Storage.field?L.Storage.field(name):L.Storage.get(name,fallback);}catch(error){return fallback;}}
 function update(){
  const enabled=yes(L.Storage.get('lampa_view_enabled',true));
  if(enabled)document.body.dataset.ptCardMotion=cardMotionValue(L.Storage.get(cardMotionKey,'on'));
  else delete document.body.dataset.ptCardMotion;
  const stored=L.Storage.get('lampa_view_theme','minimal'),value=themeValue(stored),active=value==='glass' && enabled;
  if(stored==='apple')L.Storage.set('lampa_view_theme','glass');
  document.body.classList.remove('pt-theme-apple','pt-native-glass');document.body.classList.toggle('pt-theme-glass',active);document.body.dataset.lampaTheme=value;
  // The selected plugin theme owns the material. Restore the host preference
  // when disabled, without ever overwriting its saved settings.
  const glass=yes(L.Storage.get('lampa_view_enabled',true))?active:yes(nativeValue('glass_style',false)),opacity=nativeValue('glass_opacity','medium') || 'medium';
  delete document.body.dataset.ptNativeOpacity;
  document.body.classList.toggle('glass--style',glass);
  ['easy','medium','blacked'].forEach(mode=>document.body.classList.toggle('glass--style-opacity--'+mode,glass && opacity===mode));
  document.body.style.setProperty('--pt-glass-alpha',String(({easy:.16,medium:.30,blacked:.58})[opacity] || .32));
  // Older Android WebViews cannot reliably evaluate typed calc arithmetic
  // in an rgba alpha channel. Supply the final number instead.
  const opacityAlpha=({easy:.36,medium:.52,blacked:.72})[opacity] || .52;
  document.body.style.setProperty('--pt-matte-alpha',String(opacityAlpha));
  for(const name of ['--pt-glass-scene','--pt-glass-tone-a','--pt-glass-tone-b'])document.body.style.removeProperty(name);
  updateChrome();
  document.dispatchEvent(new Event('minimal:interface-size'));document.dispatchEvent(new Event('minimal:hero-layout'));
 }
 applyDarkAccent(L);update();if(L.Storage.listener)L.Storage.listener.follow('change',event=>{if(event.name===accentKey)applyDarkAccent(L);if(['lampa_view_theme','lampa_view_enabled','glass_style','glass_opacity',cardMotionKey].includes(event.name))update();});
 return {update,chromePalette(color){if(color!==artworkColor){artworkColor=color;updateChrome();}}};
}
