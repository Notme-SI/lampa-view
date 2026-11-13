import {text as t} from './i18n.js';

function number(value){
 if(value==null || value==='')return null;
 const parsed=Number(value);
 return Number.isFinite(parsed) && parsed>=0?parsed:null;
}

export default function torrentLoading(L,enabled){
 const loading=L.Loading;
 if(!loading || typeof loading.start!=='function' || typeof loading.setProgress!=='function')return;

 const start=loading.start,progress=loading.setProgress,setText=loading.setText,stop=loading.stop;
 let panel=null,fields=[],messageNode;

 function showMessage(message){
  messageNode.textContent=typeof message==='string'?message:'';
  messageNode.hidden=!messageNode.textContent;
 }

 function paint(percent,detail){
  if(!panel?.isConnected)return;
  const stats=typeof detail==='object' && detail?detail:{};
  const active=number(stats.active_peers),total=number(stats.total_peers),seeds=number(stats.seeders);
  const loaded=number(stats.preloaded),size=number(stats.preload_size),eta=number(stats.eta);
  const values=[
   percent==null?'':Math.round(Math.min(100,Math.max(0,Number(percent)||0)))+'%',
   stats.speed && parseFloat(stats.speed)>0?stats.speed:'',
   active===null?'':active+' / '+(total===null?'—':total),
   seeds===null?'':String(seeds),
   size>0?L.Utils.bytesToSize(loaded || 0)+' / '+L.Utils.bytesToSize(size):'',
   eta>0?t('≈ {0} с',[Math.ceil(eta)]):''
  ];
  fields.forEach((field,index)=>{
   field.textContent=values[index];
   field.parentElement.hidden=!values[index];
  });
  showMessage(detail);
 }

 loading.start=function(onCancel,message,options){
  panel=null;
  const result=start.apply(this,arguments);
  const media=options?.media;
  if(!enabled() || !media || !(media.torrent_hash || /[?&]preload(?:[=&]|$)/i.test(String(media.url || ''))))return result;
  const host=document.querySelector('.media-loading--standalone:not(.hide)');
  const status=host?.querySelector('.media-loading__status');
  if(!status)return result;
  panel=document.createElement('section');
  panel.className='loading-layer__box pt-torrent-loading';
  const title=document.createElement('div');title.className='pt-torrent-loading__heading';title.textContent=L.Lang.translate('loading');panel.appendChild(title);
  const stats=document.createElement('dl');stats.className='pt-torrent-loading__stats';panel.appendChild(stats);
  fields=[];
  for(const name of [t('Прогресс'),t('Скорость'),t('Пиры'),L.Lang.translate('torrent_item_seeds'),t('Буфер'),t('Осталось')]){
   const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');
   label.textContent=name;row.appendChild(label);row.appendChild(value);stats.appendChild(row);fields.push(value);
  }
  messageNode=document.createElement('div');messageNode.className='pt-torrent-loading__message';panel.appendChild(messageNode);
  status.hidden=true;
  status.after(panel);
  paint(options.progress || 0,message);
  return result;
 };
 loading.setProgress=function(percent,detail){
  const result=progress.apply(this,arguments);
  paint(percent,detail);
  return result;
 };
 if(typeof setText==='function')loading.setText=function(message){
  const result=setText.apply(this,arguments);
  if(panel?.isConnected)showMessage(message);
  return result;
 };
 if(typeof stop==='function')loading.stop=function(){
  panel=null;fields=[];messageNode=null;
  return stop.apply(this,arguments);
 };
}
