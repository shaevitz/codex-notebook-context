'use strict';
// Read-only compatibility probe: no model turn, no trust mutation.
const {spawn}=require('node:child_process');const readline=require('node:readline');
const binary=process.argv[2];if(!binary)throw Error('Pass the installed Codex executable path');
const p=spawn(binary,['app-server'],{stdio:['pipe','pipe','pipe']});p.stderr.on('data',()=>{});let id=0;const pending=new Map();
const timer=setTimeout(()=>{p.kill();console.error("Codex hook probe timed out");process.exit(1);},60000);
readline.createInterface({input:p.stdout}).on('line',line=>{try{const m=JSON.parse(line);if(m.id!==undefined){const r=pending.get(m.id);if(r){pending.delete(m.id);m.error?r.reject(m.error):r.resolve(m.result);}}}catch{}});
function rpc(method,params){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});p.stdin.write(JSON.stringify({id:key,method,params})+'\n');});}
(async()=>{try{await rpc('initialize',{clientInfo:{name:'notebook-context-probe',version:'0.1.0'},capabilities:{experimentalApi:true}});p.stdin.write(JSON.stringify({method:'initialized'})+'\n');const r=await rpc('hooks/list',{cwds:[process.cwd()]});for(const e of r.data)for(const h of e.hooks)if(h.statusMessage==='Codex Notebook Context')console.log(JSON.stringify({eventName:h.eventName,enabled:h.enabled,trustStatus:h.trustStatus,source:h.source,handlerType:h.handlerType}));}catch(e){console.error(e);process.exitCode=1;}finally{clearTimeout(timer);p.kill();process.exit(process.exitCode || 0);}})();
