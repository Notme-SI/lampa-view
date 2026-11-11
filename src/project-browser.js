import tmdbGet from './tmdb.js';
import {text as t,locale} from './i18n.js';
import {gridControls} from './catalogue-browser.js';
import studioContrast from './studio-contrast.js';

export function personProjects(json,type){
 const seen=new Set();return [...(json.cast || []),...(json.crew || [])].filter(card=>{const id=Number(card.id);if(!Number.isSafeInteger(id) || id<=0 || seen.has(id))return false;seen.add(id);return true;}).map(card=>({...card,source:'tmdb',media_type:type})).sort((a,b)=>(Number(b.popularity)||0)-(Number(a.popularity)||0));
}
export default function projectBrowser(L){
 if(!L.Component || !L.Component.get)return;
 const Full=L.Component.get('category_full'),Actor=L.Component.get('actor'),Company=L.Component.get('company'),list=L.Api.list;
 const people=new Map(),profiles=new Map();
 L.Api.list=function(params,ok,fail){
  const project=params.minimal_projects;if(!project)return list.apply(this,arguments);
  const type=params.minimal_project_type==='tv'?'tv':'movie',id=Number(project.id),page=Math.max(1,Number(params.page)||1);if(!Number.isSafeInteger(id) || id<=0)return fail && fail();
  const deliver=json=>{if(params.minimal_projects_cancelled)return;
   if(type==='movie' && page===1 && params.minimal_project_auto && Array.isArray(json.results) && !json.results.length){
    params.minimal_project_auto=false;
    setTimeout(()=>{if(!params.minimal_projects_cancelled)L.Activity.replace({minimal_project_type:'tv',minimal_filter_focus:1,page:1});},0);return;
   }
   ok(json);
  };
  if(project.kind==='person'){
   const key=locale()+':'+id+':'+type;
   function done(rows){const total=Math.max(1,Math.ceil(rows.length/20));deliver({results:rows.slice((page-1)*20,page*20),page,total_pages:total,total_results:rows.length});}
   if(people.has(key))return done(people.get(key));
   return tmdbGet(L,'person/'+id+'/'+type+'_credits',{},json=>{const rows=personProjects(json,type);people.set(key,rows);if(people.size>24)people.delete(people.keys().next().value);done(rows);},fail);
  }
  // A network ID belongs to TV only. Never reinterpret it as a company ID.
  if(project.kind==='network' && type==='movie')return deliver({results:[],page:1,total_pages:1});
  const query=new URLSearchParams({include_adult:'false',sort_by:'popularity.desc',[project.kind==='network'?'with_networks':'with_companies']:String(id)});
  return tmdbGet(L,'discover/'+type+'?'+query,{page},json=>deliver({...json,results:(json.results || []).map(card=>({...card,source:'tmdb',media_type:type}))}),fail);
 };
 function create(object,project){
  const automatic=!['movie','tv'].includes(object.minimal_project_type);
  object.minimal_projects=project;object.minimal_projects_cancelled=false;object.minimal_project_auto=automatic;
  object.minimal_project_type=object.minimal_project_type==='tv' || automatic && project.kind==='network'?'tv':'movie';
  const item=new Full(object);
  const controls=gridControls(L,item,object,[['movie',t('Фильмы')],['tv',t('Сериалы')]].map(([value,title])=>({title,selected:object.minimal_project_type===value,choose:i=>{if(value===object.minimal_project_type)return controls.toggle();L.Activity.replace({minimal_project_type:value,minimal_filter_focus:i,page:1});}})),{className:'minimal-catalogue-controls minimal-project-tabs',focusStart:false});
  item.use({onCreate(){
   const header=document.createElement('header'),identity=document.createElement('div'),heading=document.createElement('div'),image=document.createElement('img'),person=project.kind==='person';
   heading.setAttribute('role','heading');heading.setAttribute('aria-level','1');
   header.className='minimal-project-header';identity.className='minimal-project-identity';heading.className='minimal-project-title';image.className='minimal-project-art'+(person?' minimal-project-art--person':'');image.hidden=true;image.decoding='async';
   heading.textContent=object.minimal_studio && object.minimal_studio.name || object.minimal_project_name || object.title || t('Проекты');identity.appendChild(image);identity.appendChild(heading);controls.bar.before(header);header.appendChild(identity);header.appendChild(controls.bar);
   const update=item.scroll.update;
   item.scroll.update=function(element,center){const target=element && (element.nodeType?element:element[0]),card=target && target.closest('.card'),first=item.items[0] && item.items[0].render(true);if(target===controls.bar || card && first && card.offsetTop===first.offsetTop)return update.call(this,header,false);return update.apply(this,arguments);};
   image.onload=()=>{if(object.minimal_projects_cancelled)return;image.hidden=false;if(!person)studioContrast(image);if(item.last)item.scroll.update(item.last);};
   image.onerror=()=>{image.hidden=true;};
   const show=profile=>{
    if(object.minimal_projects_cancelled)return;
    if(profile.name){heading.textContent=profile.name;object.minimal_project_name=profile.name;}
    const path=person?profile.profile_path:profile.logo_path || profile.path;
    if(!/^\/[^\s?#]+\.(png|webp|svg|jpe?g)$/i.test(path || ''))return;
    image.alt='';image.src=L.TMDB.image('/t/p/w500'+path,{preserveSize:true});
   };
   const key=locale()+':'+project.kind+':'+project.id,known=object.minimal_project_profile || profiles.get(key) || object.minimal_studio || {};
   show(known);
   if(!(person?known.profile_path:known.logo_path || known.path))tmdbGet(L,(person?'person':project.kind==='network'?'network':'company')+'/'+project.id,{},profile=>{profiles.set(key,profile);if(profiles.size>32)profiles.delete(profiles.keys().next().value);object.minimal_project_profile=profile;show(profile);},()=>{});
  },onDestroy(){object.minimal_projects_cancelled=true;}});
  return item;
 }
 L.Component.add('actor',function(object){const id=Number(object.id);return id>0?create(object,{kind:'person',id}):new Actor(object);});
 L.Component.add('company',function(object){const id=Number(object.id);return id>0?create(object,{kind:'company',id}):new Company(object);});
 L.Component.add('category_full',function(object){const id=Number(object.companies || object.networks);return id>0?create(object,{kind:object.networks?'network':'company',id}):new Full(object);});
}
