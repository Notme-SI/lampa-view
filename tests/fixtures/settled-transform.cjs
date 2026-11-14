const assert=require('node:assert/strict');

module.exports=async function settledTransform(page,selector,offset){
 await page.waitForFunction(({selector,offset})=>{
  const node=document.querySelector(selector);
  if(!node || node.getAnimations().some(animation=>animation.playState==='running'))return false;
  const matrix=new DOMMatrix(getComputedStyle(node).transform);
  return [matrix.a-1,matrix.b,matrix.c,matrix.d-1,matrix.e,matrix.f-offset].every(value=>Math.abs(value)<.01);
 },{selector,offset},{timeout:5000});
 const value=await page.locator(selector).first().evaluate(node=>{
  const matrix=new DOMMatrix(getComputedStyle(node).transform);
  return [matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f];
 });
 assert.ok(value.every((number,index)=>Math.abs(number-[1,0,0,1,0,offset][index])<.01),'Settled poster transform: '+JSON.stringify(value));
};
