// Two TV states: compact Now Watching preview beside the hero, normal shared
// poster size when entering collections. Only cards animate; the native page
// scroll takes the hero off screen. No height animation or catalogue rebuild.
export default function tvHomeStage(row,line,activity){
 if(!line || !row || !document.body.classList.contains('pt-tv'))return null;
 let preview;
 function set(compact){
  if(preview===compact || !row.isConnected || !document.body.classList.contains('lampa_view'))return;
  const nodes=Array.from(row.querySelectorAll('.card')).slice(0,12),before=nodes.map(n=>n.getBoundingClientRect());
  nodes.forEach(n=>{if(n._minimalStageAnimation)n._minimalStageAnimation.cancel();});
  preview=compact;row.classList.toggle('minimal-hero-preview',compact);
  if(line.minimalPosterRefresh)line.minimalPosterRefresh();
  document.dispatchEvent(new Event('minimal:hero-layout'));
  if(!window.matchMedia || !window.matchMedia('(prefers-reduced-motion:reduce)').matches){
   nodes.forEach((node,i)=>{const a=before[i],b=node.getBoundingClientRect();if(!a.width || !b.width || !node.animate)return;
    node._minimalStageAnimation=node.animate([{transform:'translate('+(a.left-b.left)+'px,'+(a.top-b.top)+'px) scale('+(a.width/b.width)+','+(a.height/b.height)+')',transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}],{duration:200,easing:'cubic-bezier(.2,.75,.25,1)'});
   });
  }
 }
 const expand=()=>set(false),compact=()=>set(true);
 const $=window.jQuery;
 if($)$(row).on('hover:focus.ptHomeStage hover:hover.ptHomeStage','.card',expand).on('mouseenter.ptHomeStage',expand);
 if(activity.component && activity.component.use)activity.component.use({onDestroy(){if($)$(row).off('.ptHomeStage');nodesCancel();}});
 function nodesCancel(){row.querySelectorAll('.card').forEach(n=>{if(n._minimalStageAnimation)n._minimalStageAnimation.cancel();});}
 compact();return {compact,expand};
}
