// Two TV states: compact Now Watching preview beside the hero, normal shared
// poster size when entering collections. Native scrolling and the focused
// poster's short lift are enough; do not animate/re-measure twelve textures.
export default function tvHomeStage(row,line,activity){
 if(!line || !row || !document.body.classList.contains('pt-tv'))return null;
 let preview;
 function set(compact){
  if(preview===compact || !row.isConnected || !document.body.classList.contains('lampa_view'))return;
  preview=compact;row.classList.toggle('minimal-hero-preview',compact);
  if(line.minimalPosterRefresh)line.minimalPosterRefresh();
  document.dispatchEvent(new Event('minimal:hero-layout'));
 }
 const expand=()=>set(false),compact=()=>set(true);
 const $=window.jQuery;
 if($)$(row).on('hover:focus.ptHomeStage hover:hover.ptHomeStage','.card',expand).on('mouseenter.ptHomeStage',expand);
 if(activity.component && activity.component.use)activity.component.use({onDestroy(){if($)$(row).off('.ptHomeStage');}});
 compact();return {compact,expand};
}
