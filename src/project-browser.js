import tmdbGet from './tmdb.js';
import {text as t,locale} from './i18n.js';
import {gridControls} from './catalogue-browser.js';

export function personProjects(json,type){
 const seen=new Set();return [...(json.cast || []),...(json.crew || [])].filter(card=>{const id=Number(card.id);if(!Number.isSafeInteger(id) || id<=0 || seen.has(id))return false;seen.add(id);return true;}).map(card=>({...card,source:'tmdb',media_type:type})).sort((a,b)=>(Number(b.popularity)||0)-(Number(a.popularity)||0));
}
export default function projectBrowser(L){
 if(!L.Component || !L.Component.get)return;
 const Full=L.Component.get('category_full'),Actor=L.Component.get('actor'),Company=L.Component.get('company'),list=L.Api.list;
 const people=new Map();
 L.Api.list=function(params,ok,fail){
  const project=params.minimal_projects;if(!project)return list.apply(this,arguments);
  const type=params.minimal_project_type==='tv'?'tv':'movie',id=Number(project.id),page=Math.max(1,Number(params.page)||1);if(!Number.isSafeInteger(id) || id<=0)return fail && fail();
  const deliver=json=>{if(!params.minimal_projects_cancelled)ok(json);};
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
  object.minimal_projects=project;object.minimal_projects_cancelled=false;object.minimal_project_type=object.minimal_project_type==='tv'?'tv':'movie';
  const item=new Full(object),isTv=object.minimal_project_type==='tv';
  const controls=gridControls(L,item,object,[['movie',t('Фильмы')],['tv',t('Сериалы')]].map(([value,title])=>({title,selected:object.minimal_project_type===value,choose:i=>{if(value===object.minimal_project_type)return controls.toggle();L.Activity.replace({minimal_project_type:value,minimal_filter_focus:i,page:1});}})),{className:'minimal-catalogue-controls minimal-project-tabs',focusStart:false});
  item.use({onCreate(){const heading=document.createElement('h1');heading.className='minimal-project-title';heading.textContent=object.minimal_studio && object.minimal_studio.name || object.minimal_project_name || object.title || t('Проекты');controls.bar.before(heading);if(!object.minimal_studio && !object.minimal_project_name)tmdbGet(L,(project.kind==='person'?'person':project.kind==='network'?'network':'company')+'/'+project.id,{},json=>{if(!object.minimal_projects_cancelled && json.name){heading.textContent=json.name;object.minimal_project_name=json.name;}},()=>{});if(project.kind==='network' && !isTv){const note=document.createElement('p');note.className='minimal-project-note';note.textContent=t('Телеканал выпускает сериалы. Выберите «Сериалы».');controls.bar.after(note);}},onDestroy(){object.minimal_projects_cancelled=true;}});
  return item;
 }
 L.Component.add('actor',function(object){const id=Number(object.id);return id>0?create(object,{kind:'person',id}):new Actor(object);});
 L.Component.add('company',function(object){const id=Number(object.id);return id>0?create(object,{kind:'company',id}):new Company(object);});
 L.Component.add('category_full',function(object){const id=Number(object.companies || object.networks);return id>0?create(object,{kind:object.networks?'network':'company',id}):new Full(object);});
}
