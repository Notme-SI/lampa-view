import FAVICON from './favicon.cjs';
export default function branding(){
 document.title='L A M P A';document.documentElement.lang='ru';
 const icons=Array.from(document.querySelectorAll('link[rel~="icon"]'));
 if(!icons.length){const icon=document.createElement('link');icon.rel='icon';(document.head || document.documentElement).appendChild(icon);icons.push(icon);}
 icons.forEach(icon=>{icon.type='image/svg+xml';icon.setAttribute('sizes','any');icon.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(FAVICON);});
}
