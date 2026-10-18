import BOOT from './boot.css';
import branding from './branding.js';
branding();
if(!document.getElementById('lampa-minimal-boot')){
 const style=document.createElement('style');style.id='lampa-minimal-boot';style.textContent=BOOT;
 (document.head || document.documentElement).appendChild(style);
}
