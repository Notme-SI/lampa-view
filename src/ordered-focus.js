// Lampa uses Navigator.focused when it already knows the selected element.
// Use the same bookkeeping and native focus event for ordered TV controls.
export function canFocusOrdered(L,target,container){
 return document.body.classList.contains('lampa_view') && document.body.classList.contains('pt-tv') &&
  typeof window.Navigator?.focused==='function' && typeof L.Controller.focus==='function' &&
  target?.isConnected && container.contains(target) && target.matches('.selector') &&
  !target.closest('[hidden],.hide,[aria-hidden="true"],.activity:not(.activity--active)') &&
  target.style.visibility!=='hidden' && target.style.display!=='none';
}

export function focusOrdered(L,target){
 window.Navigator.focused(target);
 L.Controller.focus(target);
}
