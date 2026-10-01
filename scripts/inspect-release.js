'use strict';
// Read-only remote checks. Existing native GitHub credentials stay inside gh.
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const gh=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8',timeout:30000,maxBuffer:1e6}));
const result={repository:gh(['repo','view','shaevitz/codex-notebook-context','--json','nameWithOwner,isPrivate,url,defaultBranchRef']),account:gh(['api','user','--jq','{login,id}']),actions:{}};
for(const name of ['checkout','setup-node','upload-artifact'])result.actions[name]=gh(['api',`repos/actions/${name}/git/ref/tags/v7`]).object;
let audit;try{audit=execFileSync('npm',['audit','--json'],{encoding:'utf8',timeout:30000,maxBuffer:2e6});}catch(e){audit=e.stdout;if(!audit)throw e;}
const parsed=JSON.parse(audit);if(parsed.error)throw Error('npm audit failed: '+parsed.error.code);
result.dependencyAudit=parsed.metadata;result.advisories=Object.values(parsed.vulnerabilities||{}).map(v=>({name:v.name,severity:v.severity,range:v.range,fixAvailable:v.fixAvailable,via:v.via}));
const dir=path.resolve(__dirname,'../../local-records');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'release-inspection.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
