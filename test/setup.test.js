'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {setup}=require('../scripts/setup');
test('setup preserves existing hooks/config and is reversible and idempotent',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'notebook-test-'));const original={description:'mine',hooks:{Stop:[{hooks:[{type:'command',command:'echo stop'}]}],UserPromptSubmit:[{matcher:'abc',hooks:[{type:'command',command:'echo keep'}]}]}};
 fs.writeFileSync(path.join(home,'hooks.json'),JSON.stringify(original));fs.writeFileSync(path.join(home,'config.toml'),'# untouched\n');
 setup({home});const first=fs.readFileSync(path.join(home,'hooks.json'),'utf8');setup({home});assert.equal(fs.readFileSync(path.join(home,'hooks.json'),'utf8'),first);
 setup({home,remove:true});assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home,'hooks.json'))),original);assert.equal(fs.readFileSync(path.join(home,'config.toml'),'utf8'),'# untouched\n');
 fs.rmSync(home,{recursive:true});
});
test('malformed configuration is preserved',()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'notebook-test-'));const file=path.join(home,'hooks.json');fs.writeFileSync(file,'bad JSON');assert.throws(()=>setup({home}));assert.equal(fs.readFileSync(file,'utf8'),'bad JSON');fs.rmSync(home,{recursive:true});});
test('empty unrelated groups and same-label unrelated commands survive removal',()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'notebook-test-'));const value={hooks:{UserPromptSubmit:[{matcher:'x',hooks:[]},{hooks:[{type:'command',command:'echo unrelated',statusMessage:'Codex Notebook Context'}]}]}};const file=path.join(home,'hooks.json');fs.writeFileSync(file,JSON.stringify(value));setup({home});setup({home,remove:true});assert.deepEqual(JSON.parse(fs.readFileSync(file)),value);fs.rmSync(home,{recursive:true});});
