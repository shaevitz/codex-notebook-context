'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {spawn, execFileSync} = require('node:child_process');
const {setup} = require('../scripts/setup');
const {owned, quote, validateNode} = require('../scripts/runtime');
const {serve, socketPath, request} = require('../src/transport');
const {isIdeTranscript, safeSocket} = require('../scripts/launcher');
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(),"notebook-release's-"));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  return home;
}
function raw(file, bytes) {
  return new Promise(resolve=>{const socket=net.createConnection(file);let value='';socket.setEncoding('utf8');
    socket.on('connect',()=>socket.write(bytes));socket.on('data',b=>value+=b);socket.on('close',()=>resolve(value));socket.on('error',()=>{});});
}
test('clean install, legacy upgrade, repeated upgrade, standalone removal after deleting extension', t=>{
  const home=fixture(t),file=path.join(home,'hooks.json');
  const unrelated={description:'keep',custom:{deep:[1,2]},hooks:{UserPromptSubmit:[{hooks:[{type:'command',command:'echo keep',statusMessage:'Codex Notebook Context'}]}],Stop:[{hooks:[]}]}};
  fs.writeFileSync(file,JSON.stringify(unrelated));fs.writeFileSync(path.join(home,'config.toml'),'# preserve bytes\n');
  const legacy={type:'command',command:quote(process.execPath)+' '+quote('/old/shaevitz.codex-notebook-context-0.1.0/scripts/hook.js'),statusMessage:'Codex Notebook Context'};
  const old=JSON.parse(JSON.stringify(unrelated));old.hooks.UserPromptSubmit[0].hooks.push(legacy);fs.writeFileSync(file,JSON.stringify(old));
  const result=setup({home});assert(result.changed);
  const registered=JSON.parse(fs.readFileSync(file));assert.equal(registered.hooks.UserPromptSubmit.flatMap(g=>g.hooks).filter(h=>owned(h,home)).length,1);
  assert.equal(registered.hooks.UserPromptSubmit[1].hooks[0].additionalContextLimit,0);
  const first=fs.readFileSync(file,'utf8');assert.equal(setup({home}).changed,false);assert.equal(fs.readFileSync(file,'utf8'),first);
  // Copied maintenance tool has no dependency on the extension's source directory.
  execFileSync(process.execPath,[path.join(home,'notebook-context/setup.js'),'--remove'],{env:{...process.env,CODEX_HOME:home}});
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),unrelated);assert.equal(fs.readFileSync(path.join(home,'config.toml'),'utf8'),'# preserve bytes\n');
  assert.equal(fs.statSync(path.join(home,'notebook-context/launcher.js')).mode&0o777,0o600);
  assert(fs.readdirSync(home).some(n=>n.startsWith('hooks.json.notebook-backup-')));
});
test('removal absent is byte-preserving and does not create hooks.json',t=>{
  const home=fixture(t);setup({home,remove:true});assert(!fs.existsSync(path.join(home,'hooks.json')));
  const text='{ "hooks": { "Stop": [] }, "mine": true }';fs.writeFileSync(path.join(home,'hooks.json'),text);
  assert.equal(setup({home,remove:true}).changed,false);assert.equal(fs.readFileSync(path.join(home,'hooks.json'),'utf8'),text);
});
test('failed install preserves hooks and unrecognized assets; staged assets roll back',t=>{
  const home=fixture(t),dir=path.join(home,'notebook-context'),file=path.join(home,'hooks.json');
  fs.writeFileSync(file,'{"mine":true}');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(path.join(dir,'setup.js'),'user-owned');
  assert.throws(()=>setup({home}),/Unrecognized/);assert.equal(fs.readFileSync(file,'utf8'),'{"mine":true}');
  assert(!fs.existsSync(path.join(dir,'launcher.js')));assert.equal(fs.readFileSync(path.join(dir,'setup.js'),'utf8'),'user-owned');
  assert(!fs.existsSync(path.join(home,'.notebook-context.lock')));
});
test('concurrent setup lock, symlink config and symlink assets fail without overwrite',t=>{
  const home=fixture(t),other=path.join(home,'other');fs.writeFileSync(other,'keep');
  fs.writeFileSync(path.join(home,'.notebook-context.lock'),'active');assert.throws(()=>setup({home}),/Another setup/);fs.unlinkSync(path.join(home,'.notebook-context.lock'));
  fs.symlinkSync(other,path.join(home,'hooks.json'));assert.throws(()=>setup({home}),/Unsafe/);assert.equal(fs.readFileSync(other,'utf8'),'keep');fs.unlinkSync(path.join(home,'hooks.json'));
  const dir=path.join(home,'notebook-context');fs.mkdirSync(dir,{mode:0o700});fs.symlinkSync(other,path.join(dir,'launcher.js'));assert.throws(()=>setup({home}),/Unsafe/);assert.equal(fs.readFileSync(other,'utf8'),'keep');
});
for(const value of [[],{hooks:[]},{hooks:{UserPromptSubmit:{}}},{hooks:{UserPromptSubmit:[null]}},{hooks:{UserPromptSubmit:[{hooks:[null]}]}}])test('invalid schema remains byte-identical: '+JSON.stringify(value),t=>{
  const home=fixture(t),file=path.join(home,'hooks.json'),bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);assert.throws(()=>setup({home}));assert.equal(fs.readFileSync(file,'utf8'),bytes);
});
test('ownership requires exact generated command and handles apostrophes',t=>{
  const home=fixture(t),handler={type:'command',statusMessage:'Codex Notebook Context',command:quote(process.execPath)+' '+quote(path.join(home,'notebook-context/launcher.js'))};assert(owned(handler,home));
  assert(!owned({...handler,command:'echo '+handler.command},home));assert(!owned({...handler,command:handler.command+'; echo other'},home));
  assert(!owned({...handler,statusMessage:'mine'},home));
});
test('explicit node is validated, relative/missing/outdated runtimes preserve config',t=>{
  const home=fixture(t),file=path.join(home,'hooks.json');fs.writeFileSync(file,'{}');
  assert(validateNode(process.execPath).version);assert.throws(()=>setup({home,node:'node'}),/absolute/);
  assert.throws(()=>setup({home,node:path.join(home,'missing')}));
  const fake=path.join(home,'old-node');fs.writeFileSync(fake,'#!/bin/sh\necho \'{"version":"18.0.0","electron":false}\'\n',{mode:0o700});assert.throws(()=>setup({home,node:fake}),/20/);
  assert.equal(fs.readFileSync(file,'utf8'),'{}');assert(!fs.existsSync(path.join(home,'notebook-context')));
});
test('IPC Unicode, invalid/oversized/duplicate requests, response bounds and lifecycle',async t=>{
  let calls=0;const server=await serve(cwd=>{calls++;return{cell:1,source:cwd==='/unicode'?'🧬'.repeat(10000):'x'.repeat(310000)};});t.after(()=>server.dispose());
  await assert.rejects(serve(()=>null),/already active/);assert(safeSocket(process.pid));
  assert.equal((await request(process.pid,'/unicode')).source,'🧬'.repeat(10000));
  assert.equal(await raw(socketPath(process.pid),'invalid\n'),'null');assert.equal(await raw(socketPath(process.pid),'x'.repeat(9000)+'\n'),'');
  assert.equal(await raw(socketPath(process.pid),'{"version":9,"cwd":"/unicode"}\n'),'null');
  const before=calls;await raw(socketPath(process.pid),'{"version":1,"cwd":"/unicode"}\n{"version":1,"cwd":"/unicode"}\n');assert.equal(calls,before+1);
  assert.equal(await request(process.pid,'/huge'),null);
  server.dispose();server.dispose();assert.equal(await request(process.pid,'/unicode'),null);
});
test('metadata is bounded and nonregular files are rejected',t=>{
  const home=fixture(t),file=path.join(home,'meta');fs.writeFileSync(file,JSON.stringify({type:'session_meta',payload:{source:'vscode',originator:'codex_vscode',pad:'x'.repeat(1024*1024)}})+'\n');
  assert(!isIdeTranscript(file));assert(!isIdeTranscript(home));assert(!isIdeTranscript('relative'));assert(!isIdeTranscript('/dev/null'));
});
test('installed launcher survives deletion of old version path and is inert without host',async t=>{
  const home=fixture(t);setup({home});const meta=path.join(home,'meta');fs.writeFileSync(meta,JSON.stringify({type:'session_meta',payload:{source:'vscode',originator:'codex_vscode'}})+'\n');
  const server=await serve(()=>({cell:2,source:'fresh'}));
  function launch(){return new Promise(resolve=>{const p=spawn(process.execPath,[path.join(home,'notebook-context/launcher.js')],{env:{...process.env,CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'}});let out='';p.stdout.on('data',b=>out+=b);p.on('close',code=>resolve({out,code}));p.stdin.end(JSON.stringify({hook_event_name:'UserPromptSubmit',cwd:home,transcript_path:meta}));});}
  try{assert.match((await launch()).out,/fresh/);}finally{server.dispose();}
  const after=await launch();assert.equal(after.out,'');assert.equal(after.code,0);
});

test('upgrade and rollback preserve current unrelated hooks while restoring prior assets on failure',t=>{
  const home=fixture(t),old=path.join(home,'old-version'),next=path.join(home,'new-version');
  fs.mkdirSync(old);fs.mkdirSync(next);for(const name of ['setup.js','runtime.js','launcher.js']){fs.copyFileSync(path.join(__dirname,'../scripts',name),path.join(old,name));fs.copyFileSync(path.join(old,name),path.join(next,name));}
  require(path.join(old,'setup.js')).setup({home});const launcher=path.join(home,'notebook-context/launcher.js'),before=fs.readFileSync(launcher);
  fs.rmSync(old,{recursive:true});fs.appendFileSync(path.join(next,'launcher.js'),'\n// new release\n');
  const file=path.join(home,'hooks.json'),config=JSON.parse(fs.readFileSync(file));config.hooks.Stop=[{hooks:[{type:'command',command:'echo newly added'}]}];fs.writeFileSync(file,JSON.stringify(config));
  // A concurrent unrelated edit is detected after staging, then all managed assets roll back.
  const write=fs.writeFileSync;let injected=false;
  t.mock.method(fs,'writeFileSync',function(target,...args){const result=write.call(fs,target,...args);if(String(target).includes('hooks.json.notebook-backup-')&&!injected){injected=true;write(file,JSON.stringify({...config,concurrent:true}));}return result;});
  assert.throws(()=>require(path.join(next,'setup.js')).setup({home}),/concurrently/);assert(fs.readFileSync(launcher).equals(before));assert(JSON.parse(fs.readFileSync(file)).concurrent);
  t.mock.restoreAll();require(path.join(next,'setup.js')).setup({home});assert(fs.readFileSync(launcher,'utf8').includes('new release'));assert(JSON.parse(fs.readFileSync(file)).concurrent);
  // Roll back via a previous managed asset, without restoring whole hook configuration.
  const prior=path.join(home,'prior');fs.mkdirSync(prior);for(const name of ['setup.js','runtime.js','launcher.js'])fs.copyFileSync(path.join(__dirname,'../scripts',name),path.join(prior,name));require(path.join(prior,'setup.js')).setup({home});assert(fs.readFileSync(launcher).equals(before));assert.deepEqual(JSON.parse(fs.readFileSync(file)).hooks.Stop,config.hooks.Stop);
});
test('a sibling extension host is never used by another process',async t=>{
  const home=fixture(t),worker=path.join(home,'worker.js');
  fs.writeFileSync(worker,`const {serve}=require(${JSON.stringify(path.resolve(__dirname,'../src/transport'))});serve(()=>({cell:9,source:'SIBLING_ONLY'})).then(()=>console.log('ready'));`);
  const sibling=spawn(process.execPath,[worker]);t.after(()=>sibling.kill());await new Promise((resolve,reject)=>{sibling.once('error',reject);sibling.stdout.once('data',resolve);});
  const transcript=path.join(home,'meta');fs.writeFileSync(transcript,JSON.stringify({type:'session_meta',payload:{source:'vscode',originator:'codex_vscode'}})+'\n');
  const out=execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/launcher.js')],{input:JSON.stringify({hook_event_name:'UserPromptSubmit',cwd:home,transcript_path:transcript}),env:{...process.env,CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'codex_vscode'},encoding:'utf8'});
  assert.equal(out,'');
});
