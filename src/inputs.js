// Native input is a singleton. A second edit overwrites its cleanup references.
export default function inputs(L){
 if(!L.Input || !L.Input.edit)return;
 const edit=L.Input.edit;let keyboard;
 L.Input.edit=function(){
  if(keyboard && document.querySelector('.settings-input'))return keyboard;
  keyboard=edit.apply(this,arguments);return keyboard;
 };
}
