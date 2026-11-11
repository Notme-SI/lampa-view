// Clear the former decorative Play layer when a card is hydrated again.
// Selection is painted on the poster; native history and click/OK actions stay intact.
export default function posterSelection(node){
 const view=node.querySelector('.card__view');if(!view)return;
 node.classList.add('pt-poster-ready');
 view.querySelector('.pt-poster-selection')?.remove();
}
