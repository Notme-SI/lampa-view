import {text as t} from './i18n.js';
// Decorate the existing native loader. Never replace preload transport or data.
export default function loadingStatus(L){
 let root;
 function decorate(){
  if(!root?.isConnected)root=document.querySelector('.media-loading--standalone');
  if(!root)return;
  const peers=root.querySelector('.media-loading__peers');
  if(peers && !peers.dataset.ptStats){
   peers.dataset.ptStats='true';peers.title=t('Подключения: активные / найденные');
   const path=peers.querySelector('svg path');
   if(path)path.setAttribute('d','M4 7h16m0 0-4-4m4 4-4 4M20 17H4m0 0 4-4m-4 4 4 4');
  }
  const label=root.querySelector('.media-loading__seeds .media-loading__label');
  if(label)label.textContent=t('Раздают');
 }
 for(const key of ['start','setProgress']){
  const native=L.Loading?.[key];if(typeof native!=='function')continue;
  L.Loading[key]=function(){const result=native.apply(this,arguments);decorate();return result;};
 }
}
