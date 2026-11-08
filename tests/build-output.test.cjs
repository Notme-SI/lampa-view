const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
test('published bundles use LF so Git normalization cannot invalidate installation checksums',()=>{
 const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/install-manifest.json')));
 const expected=manifest.files['dist/lampa.js'];
 for(const name of ['dist/lampa.js','lampa.js','docs/lampa.js']){
  const content=fs.readFileSync(path.join(root,name));
  assert.equal(content.includes(13),false,name+' contains CR that Git would remove');
  assert.equal(createHash('sha256').update(content).digest('hex'),expected,name+' must match the public installer manifest');
 }
 assert.equal(fs.readFileSync(path.join(root,'dist/lampa-minimal.boot.js')).includes(13),false);
});
