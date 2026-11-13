const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const status=require('../src/playback-status.cjs');
test('playback feedback replaces stale messages, clears, and expires without host notifications',()=>{
 const dom=new JSDOM('<html><head></head><body></body></html>');const w=dom.window,timers=new Map();let id=0;
 w.setTimeout=fn=>{timers.set(++id,fn);return id;};w.clearTimeout=id=>timers.delete(id);
 try{
  const s=status(w);s.show('Loading');assert.equal(w.document.querySelector('.lv-playback-status').dataset.state,'loading');
  s.show('Error','error');assert.equal(w.document.querySelectorAll('.lv-playback-status').length,1);assert.equal(timers.size,1);
  assert.equal(w.document.querySelector('[role=alert]').textContent,'Error');
  [...timers.values()][0]();assert.equal(w.document.querySelector('.lv-playback-status'),null);
  s.show('Again');s.clear();assert.equal(timers.size,0);assert.equal(w.document.querySelector('.lv-playback-status'),null);
 }finally{w.close();}
});
