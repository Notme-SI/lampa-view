const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/detail-gallery.js')],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;
const compiled={exports:{}};
new Function('module','exports',code)(compiled,compiled.exports);
const {nextDetailEpisode}=compiled.exports;

const episode=(n,air_date,season=1)=>({season_number:season,episode_number:n,air_date});
test('the local date wins over later summaries and calendar-only dates include today',()=>{
 const today=new Date(2026,10,25,0,15),tomorrow=episode(5,'2026-11-26'),later=episode(6,'2026-12-02');
 const card={next_episode_to_air:later};
 let next=nextDetailEpisode(card,{episodes:[tomorrow,later]},today,[episode(4,'2026-11-25')]);
 assert.deepEqual([next.iso,next.label,next.season,next.episode],['2026-11-25','Сегодня',1,4]);
 next=nextDetailEpisode(card,{episodes:[tomorrow,later]},today);
 assert.deepEqual([next.iso,next.label,next.episode],['2026-11-26','Завтра',5]);
 const afterMidnight=new Date(2026,10,26,0,1);
 assert.equal(nextDetailEpisode(card,{episodes:[tomorrow]},afterMidnight).label,'Сегодня');
});
test('invalid dates, specials and passed calendar days do not displace a scheduled episode',()=>{
 const now=new Date(2026,11,31,23,50);
 const next=nextDetailEpisode(null,{episodes:[episode(1,'2026-11-31'),episode(2,'2026-12-30'),episode(3,'2026-12-31',0)],
  episodes_original:[episode(4,'2027-01-01'),episode(5,'2027-01-01')]},now);
 assert.deepEqual([next.iso,next.label,next.episode],['2027-01-01','Завтра',4]);
 assert.equal(nextDetailEpisode(null,{episodes:[]},now),null);
});
