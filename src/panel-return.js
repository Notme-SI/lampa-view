const openers = {
 search: '.head .open--search',
 settings: '.head .open--settings, .navigation-bar [data-action=settings]',
 menu: '.head__menu-icon, .navigation-bar [data-action=menu]',
};
const menuSettings = '.wrap__left [data-action=settings]';
const clickableOpeners = [...Object.values(openers), menuSettings].join(',');
const panels = '.search--open,.settings--open,.menu--open,.selectbox--open,.modal--open';

export default function preservePanelPosition(L, enabled) {
 const controller = L.Controller;
 const nativeToggle = controller?.toggle;
 if (!nativeToggle || !controller.enabled) return;

 let panel, clicked;
 const wrappedMenus = new WeakSet();

 document.addEventListener('click', event => {
  clicked = event.target.closest?.(clickableOpeners);
 }, true);

 function returnToOpener(state) {
  if (!enabled() || L.Activity.active()?.activity !== state.activity) return;
  if (panel || document.body.matches(panels)) return;
  if (state.parent && state.opener?.isConnected) {
   panel = state.parent;
   controller.toggle('menu');
  }
  if (state.opener?.isConnected && state.opener.getClientRects().length) {
   if (!state.parent && controller.enabled().name !== 'head') controller.toggle('head');
   const collection = document.querySelector(state.parent ? '.wrap__left' : '.head');
   if (!collection?.contains(state.opener)) controller.collectionAppend?.(state.opener);
   controller.collectionFocus?.(state.opener, collection || document.body);
   if (state.opener === state.domFocus) state.opener.focus({preventScroll:true});
  }

  const scroll = state.activity?.component?.scroll;
  if (scroll?.shift && scroll.position && Number.isFinite(state.position)) {
   const delta = scroll.position() - state.position;
   if (delta) scroll.shift(delta);
   if (scroll.minimalBrowserScroll) {const node=scroll.render(true);node.scrollTop=Math.max(0,-state.position);scroll.minimalBrowserScroll.savePosition?.(node.scrollTop);}
  }
 }

 controller.toggle = function (name) {
  if (!enabled()) {
   panel = null;
   return nativeToggle.apply(this, arguments);
  }

  const fromMenu = panel?.name === 'menu' && name === 'settings';
  if (openers[name] && (!panel || fromMenu)) {
   const activity = L.Activity.active()?.activity;
   const domFocus = document.activeElement;
   const candidates = [clicked, domFocus, document.querySelector('.focus')];
   const menuItem = fromMenu && candidates.find(node => node?.matches(menuSettings));
   const selector = openers[name];
   const opener = menuItem || candidates.find(node => node?.matches(selector)) ||
    Array.from(document.querySelectorAll(selector)).find(node => node.getClientRects().length) || document.querySelector(selector);
   const position = activity?.component?.scroll?.position?.();
   panel = {name, activity, opener, domFocus, position, parent:menuItem ? panel : null};
   clicked = null;
  }

  const result = nativeToggle.apply(this, arguments);
  const current = controller.enabled();
  if (name === 'menu' && current.name === 'menu' && current.controller && !wrappedMenus.has(current.controller)) {
   const menu = current.controller;
   const nativeBack = menu.back;
   wrappedMenus.add(menu);
   menu.back = function () {
    if (enabled() && panel?.name === 'menu') return controller.toggle('head');
    if (typeof nativeBack === 'function') return nativeBack.apply(this, arguments);
   };
  }

  if (panel && !document.body.matches(panels) && (name === 'head' || name === 'content')) {
   const state = panel;
   panel = null;
   // Let native actions that actually navigate finish before restoring focus.
   requestAnimationFrame(() => returnToOpener(state));
  }
  return result;
 };

 L.Listener?.follow('activity', event => {
  if (event.type === 'start' && panel?.activity !== L.Activity.active()?.activity) panel = null;
 });
}
