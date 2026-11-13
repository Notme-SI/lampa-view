'use strict';

// Isolated playback feedback; the host's notifications retain their own styles.
module.exports = function playbackStatus(root, text = value => value) {
  const document = root.document;
  let node, timer;
  function clear() {
    if (timer != null) root.clearTimeout?.(timer);
    timer = null;
    node?.remove(); node = null;
  }
  function show(message, state = 'loading') {
    clear();
    if (!document?.body) return;
    if (!document.getElementById('lampa-view-playback-status-style')) {
      const style = document.createElement('style');
      style.id = 'lampa-view-playback-status-style';
      style.textContent = '.lv-playback-status{position:fixed;z-index:100000;left:50%;bottom:3rem;transform:translateX(-50%);display:flex;align-items:center;gap:.7em;max-width:calc(100vw - 3rem);box-sizing:border-box;padding:.8em 1.2em;border:1px solid #ffffff30;border-radius:2em;background:#202020f2;color:#fff;font:inherit;font-size:1rem;pointer-events:none;box-shadow:0 4px 24px #0005}.lv-playback-status[data-state=loading]:before{content:"";flex:none;width:1em;height:1em;border:2px solid #ffffff35;border-top-color:#fff;border-radius:50%;animation:lv-playback-spin .8s linear infinite}.lv-playback-status[data-state=error]:before{content:"!";color:#ffb4ab}@media(max-width:600px){.lv-playback-status{bottom:calc(6rem + env(safe-area-inset-bottom,0px));width:max-content}}@keyframes lv-playback-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.lv-playback-status:before{animation:none!important}}';
      document.head.appendChild(style);
    }
    node = document.createElement('div');
    node.className = 'lv-playback-status'; node.dataset.state = state;
    node.setAttribute('role', state === 'error' ? 'alert' : 'status');
    node.textContent = text(message); document.body.appendChild(node);
    timer = root.setTimeout(clear, state === 'error' ? 5000 : 12000);
  }
  return {show, clear};
};
