import {text as lampaViewText} from './i18n.js';
// Label the native comment composer.
export default function comments(node){
 if(!node || node.dataset.minimalComments)return;
 node.dataset.minimalComments='1';node.classList.add('minimal-comments-native');
 const add=node.querySelector('.full-review-add');if(add){add.setAttribute('aria-label',lampaViewText("Написать комментарий"));add.title=lampaViewText("Написать комментарий");}
}
