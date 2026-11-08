const assert=require('node:assert/strict');
// Let nested host callbacks and rendering finish even on a busy CI runner.
module.exports=async function until(predicate,label,timeout=5000){
 const deadline=Date.now()+timeout;
 while(!predicate()){
  assert.ok(Date.now()<deadline,'Timed out waiting for '+label);
  await new Promise(resolve=>setTimeout(resolve,20));
 }
};
