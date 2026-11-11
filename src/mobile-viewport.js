// Install before appready; Home Screen Safari reads chrome settings early.
export default function mobileViewport(){
 const head=document.head || document.documentElement;
 function meta(name,content){const nodes=Array.from(document.querySelectorAll('meta[name="'+name+'"]')),node=nodes.shift() || document.createElement('meta');node.name=name;node.content=content;if(!node.isConnected)head.appendChild(node);nodes.forEach(n=>n.remove());return node;}
 const viewport=document.querySelector('meta[name="viewport"]'),content=viewport && viewport.content || 'width=device-width, initial-scale=1';
 meta('viewport',content.split(',').map(s=>s.trim()).filter(s=>s && !/^viewport-fit\s*=/i.test(s)).concat('viewport-fit=cover').join(', '));
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
 meta('apple-mobile-web-app-capable','yes');
 meta('apple-mobile-web-app-status-bar-style',ios?'black-translucent':'default');
 if(ios && !document.querySelector('meta[name="theme-color"]'))meta('theme-color','#101113');
 document.documentElement.classList.toggle('pt-ios-standalone',ios &&
  (navigator.standalone===true || !!window.matchMedia?.('(display-mode: standalone)').matches));
}
