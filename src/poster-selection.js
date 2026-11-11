// One decorative layer: the native card retains its click/OK action and hit box.
// Lampa's own year, rating and watch badges remain in their existing positions.
export default function posterSelection(node){
 const view=node.querySelector('.card__view');if(!view)return;
 node.classList.add('pt-poster-ready');
 let overlay=view.querySelector('.pt-poster-selection');
 if(!overlay){
  overlay=node.ownerDocument.createElement('div');
  overlay.className='pt-poster-selection';overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML='<span class="pt-poster-selection__play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg></span>';
  view.appendChild(overlay);
 }
}
