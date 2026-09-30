'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');const os=require('node:os');const {serve,request}=require('../src/transport');
function hook(env,event){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,'../scripts/hook.js')],{env:{...process.env,...env}});let out='';p.stdout.on('data',b=>out+=b);p.on('error',reject);p.on('close',()=>resolve(out));p.stdin.end(JSON.stringify(event));});}
test('fresh IPC responses; hook ancestry and origin isolation',async()=>{
 let cell=1;const server=await serve(cwd=>cwd==='/work'?{cell,source:'sentinel'}:null);
 try{
 assert.equal((await request(process.pid,'/work')).cell,1);cell=2;assert.equal((await request(process.pid,'/work')).cell,2);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notebook-transcript-'));const transcript=path.join(dir,'test.jsonl');
 fs.writeFileSync(transcript,JSON.stringify({type:'session_meta',payload:{source:'vscode',originator:'codex_vscode'}})+'\n');
 const event={hook_event_name:'UserPromptSubmit',cwd:'/work',transcript_path:transcript};
 assert.match(await hook({CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'},event),/sentinel/);
 assert.equal(await hook({CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_cli_rs'},event),'');
 assert.equal(await hook({CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'},{...event,cwd:'/other'}),'');
 assert.equal(await hook({CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'},{...event,hook_event_name:'Stop'}),'');
 fs.writeFileSync(transcript,JSON.stringify({type:'session_meta',payload:{source:'cli',originator:'codex_vscode'}})+'\n');
 assert.equal(await hook({CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'},event),'');
 fs.rmSync(dir,{recursive:true});
 }finally{server.dispose();}
 assert.equal(await request(process.pid,'/work'),null);
});
