'use strict';
// One scoped local verification run: no user-profile install, trust mutation or publication.
const {execFileSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');
const run=(file,args,env=process.env)=>execFileSync(file,args,{stdio:'inherit',env});
run('npm',['run','package']);
run(process.execPath,['scripts/integration.js']);
run(process.execPath,['scripts/integration.js'],{...process.env,NOTEBOOK_VSIX:path.resolve('dist/codex-notebook-context-0.2.0.vsix')});
const file='dist/codex-notebook-context-0.2.0.vsix';const sha=createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(file+'.sha256',sha+'  '+path.basename(file)+'\n');console.log('Verified release SHA256: '+sha);
