const fs=require('node:fs');
const log=fs.readFileSync(process.argv[2],'utf8');
const escape=s=>s.replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
for(const block of log.split(/(?=^not ok )/m).slice(1)){
 const title=block.split('\n')[0];
 const body=block.slice(title.length).split(/^# Subtest:/m)[0].slice(0,2500);
 console.log('::error title='+escape(title)+'::'+escape(body||title));
}
