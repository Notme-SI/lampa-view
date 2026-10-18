// Apply the launch route once; normal navigation and the back stack stay native.
export default function startup(L,root=window){
 const home={component:'main',url:'',title:L.Lang && L.Lang.translate?L.Lang.translate('title_main'):'Главная',source:L.Storage.get('source','cub') || 'cub',page:1};
 L.Storage.set('start_page','main');root.start_deep_link={...home};
 const active=L.Activity.active();if(active && active.component && active.component!=='main')L.Activity.replace(home,true);
}
