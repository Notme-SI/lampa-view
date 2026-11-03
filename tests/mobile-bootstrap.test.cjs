const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('server bootstrap restores original mobile metadata and inserts standalone settings before scripts',()=>{
 const result=spawnSync(process.env.PYTHON || (process.platform==='win32'?'python':'python3'),[path.join(__dirname,'bootstrap_mobile_test.py')],{encoding:'utf8'});
 assert.equal(result.status,0,(result.stdout||'')+(result.stderr||'')+(result.error?.message||''));
});
