#!/usr/bin/env node
'use strict';
// Notebook Context for Codex managed asset v1
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const {discoverNode,homePath,quote,owned,readConfig}=require('./runtime');
function safeDirectory(dir, privateOnly = false) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const stat=fs.lstatSync(dir);
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o022)||(privateOnly&&(stat.mode&0o077)))throw Error('Unsafe hook directory; no changes made.');
}
function readOwnedFile(file) {
  try {const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||stat.size>1024*1024)throw Error('Unsafe hook asset; no changes made.');return fs.readFileSync(file);}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
function atomic(file,bytes) {
  const tmp=file+'.tmp-'+randomUUID();
  try{fs.writeFileSync(tmp,bytes,{mode:0o600,flag:'wx'});fs.renameSync(tmp,file);}
  finally{try{fs.unlinkSync(tmp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
function setup({home,remove=false,node}={}) {
  home=homePath(home);safeDirectory(home);
  const lock=path.join(home,'.notebook-context.lock');let fd;
  try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Another setup is running, or an earlier setup was interrupted. Retry after it finishes; inspect .notebook-context.lock before removing a stale lock.');throw e;}
  const changedAssets=[];
  try {
    const {file,previous,value}=readConfig(home);const groups=value.hooks?.UserPromptSubmit||[];let removed=0;
    const filtered=groups.flatMap(g=>{const handlers=g.hooks.filter(h=>{const ours=owned(h,home);if(ours)removed++;return !ours;});
      if(handlers.length===g.hooks.length)return[g];
      return handlers.length||Object.keys(g).some(k=>k!=='hooks')?[{...g,hooks:handlers}]:[];});
    let runtime;
    if(!remove) {
      runtime=discoverNode(node);const assetDir=path.join(home,'notebook-context');safeDirectory(assetDir,true);
      for(const name of ['launcher.js','setup.js','runtime.js']) {
        const asset=path.join(assetDir,name),before=readOwnedFile(asset),bytes=fs.readFileSync(path.join(__dirname,name));
        if(before?.equals(bytes))continue;
        if(before!==null&&!before.toString('utf8').includes('// Notebook Context for Codex managed asset v1'))throw Error('Unrecognized file in notebook-context; preserved without changes.');
        if(before!==null)fs.writeFileSync(asset+'.backup-'+randomUUID(),before,{mode:0o600,flag:'wx'});
        changedAssets.push({asset,before});atomic(asset,bytes);
      }
      filtered.push({hooks:[{type:'command',command:`${quote(runtime.path)} ${quote(path.join(assetDir,'launcher.js'))}`,timeout:3,statusMessage:'Codex Notebook Context',additionalContextLimit:0}]});
    }
    if(remove&&!removed)return{file,changed:false,message:'No notebook prompt hook was registered. No configuration changed.'};
    value.hooks??={};if(filtered.length)value.hooks.UserPromptSubmit=filtered;else delete value.hooks.UserPromptSubmit;
    const next=JSON.stringify(value,null,2)+'\n';
    if(previous!==next) {
      if(previous!==null)fs.writeFileSync(file+'.notebook-backup-'+randomUUID(),previous,{mode:0o600,flag:'wx'});
      if(readConfig(home).previous!==previous)throw Error('Hooks changed concurrently; retry setup.');
      atomic(file,next);
    }
    return{file,changed:previous!==next,node:runtime,message:remove?
      'Notebook prompt hook removed. Reload VS Code to refresh Codex. Recovery tools and backups remain in CODEX_HOME/notebook-context.':
      'Notebook hook installed. Review and trust the exact hook in Codex /hooks. Reload VS Code once for existing chats, then reselect the notebook cell. Other hooks and config.toml were preserved.'};
  }catch(e){for(const {asset,before} of changedAssets.reverse()){if(before===null)fs.unlinkSync(asset);else atomic(asset,before);}throw e;}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(require.main===module){try{console.log(JSON.stringify(setup({remove:process.argv.includes('--remove')})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={setup};
