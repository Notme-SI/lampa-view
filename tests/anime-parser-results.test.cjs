const test=require('node:test');
const assert=require('node:assert/strict');
const native=require('./fixtures/native-lampa.cjs');

test('native anime search retains dubbed releases classified as series, even when anime results are nonempty',async()=>{
 const n=await native({built:true,requestPipeline:true}),{w,L}=n;
 try{
  L.Storage.set('parser_torrent_type','jackett');L.Storage.set('jackett_url','http://parser.test');
  const requests=[];
  const anime={Title:'Киберпанк / Cyberpunk: Edgerunners (Сезон 2) Ukr/Jpn',Tracker:'toloka',Size:1e9};
  const series={Title:'Киберпанк: Бегущие по краю / Cyberpunk: Edgerunners S02E01 LostFilm',Tracker:'lostfilm',Size:1e9};
  w.testNetwork=(url,ok)=>{
   requests.push(new URL(url));
   const type=new URL(url).searchParams.get('is_serial');
   w.setTimeout(()=>ok({Results:type==='5'?[anime]:[anime,series]}),0);
  };
  const movie={id:105248,name:'Киберпанк: Бегущие по краю',title:'Киберпанк: Бегущие по краю',original_name:'Cyberpunk: Edgerunners',original_title:'Cyberpunk: Edgerunners',first_air_date:'2022-09-13',number_of_seasons:2,genres:[{id:16,name:'Мультфильм'}],original_language:'ja',production_countries:[{iso_3166_1:'JP'}]};
  const result=await new Promise((ok,fail)=>L.Parser.get({movie,search:movie.original_name},ok,fail));
  assert.equal(requests.length,1,'Do not double parser requests to compensate for a client-side restriction');
  assert.equal(requests[0].searchParams.get('is_serial'),'2');
  assert.match(requests[0].searchParams.get('Category[]'),/5070/);
  assert.deepEqual(Array.from(result.Results,row=>row.Tracker),['toloka','lostfilm']);
  assert.equal(result.Results[1].Title,series.Title);
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});

test('anime helper preserves explicit parser filters and independent manual searches',async()=>{
 const n=await native({built:true}),{w}=n;
 try{
  for(const query of ['is_serial=2&Category[]=5000,5070','is_serial=1&Category[]=2000','is_serial=5&Category[]=5070','Query=Cyberpunk']){
   const params={url:'http://parser.test/api/v2.0/indexers/all/results?'+query};
   w.mpv_plus_companion.prepareRequest({params});
   assert.equal(params.url,'http://parser.test/api/v2.0/indexers/all/results?'+query);
  }
  assert.deepEqual(n.errors,[]);
 }finally{n.close();}
});
