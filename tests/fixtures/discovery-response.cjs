module.exports=function discoveryResponse(path,page=1){
 if(!/^discover\/|^trending\/|^search\//.test(path))return {logos:[],results:[]};
 const q=new URLSearchParams(path.split('?')[1] || ''),type=/\/(?:movie)(?:\/|\?)/.test(path)?'movie':'tv',country=(q.get('with_origin_country') || 'US').split('|')[0],genres=(q.get('with_genres') || '18').split(/[|,]/).map(Number);
 const seed=Array.from(path).reduce((n,c)=>(n*31+c.charCodeAt(0))%100000,0)+1;
 const results=Array.from({length:20},(_,i)=>({id:seed*1000+page*20+i,[type==='movie'?'title':'name']:'Проект '+i,original_name:'Original '+i,genre_ids:genres,original_language:country==='KR'?'ko':country==='JP'?'ja':'ru',origin_country:[country],poster_path:'/poster.jpg',first_air_date:'2026-01-01',release_date:'2026-01-01',vote_average:8}));
 return {results,page,total_pages:3};
};
