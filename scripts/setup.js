#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const cp=require('node:child_process');const {randomUUID}=require('node:crypto');
const marker='Codex Notebook Context';
function quote(s){return "'"+s.replace(/'/g,"'\\''")+"'";}
function setup({home=process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),remove=false,node}={}) {
  const file=path.join(home,'hooks.json');
  fs.mkdirSync(home,{recursive:true});
  const previous=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  const value=previous===null?{}:JSON.parse(previous);
  if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Existing hooks.json must be an object; no changes made.');
  if(value.hooks!==undefined && (!value.hooks || typeof value.hooks!=='object'||Array.isArray(value.hooks)))throw Error('Invalid hooks table; no changes made.');
  value.hooks??={};
  const groups=value.hooks.UserPromptSubmit??[];
  if(!Array.isArray(groups))throw Error('Invalid UserPromptSubmit hook list; no changes made.');
  const filtered=groups.flatMap(g=>{
    if(!Array.isArray(g.hooks))throw Error('Invalid hook group; no changes made.');
    const hooks=g.hooks.filter(h=>!(h.statusMessage===marker && typeof h.command==='string' && h.command.includes('/scripts/hook.js')));
    return hooks.length===g.hooks.length ? [g] : hooks.length ? [{...g,hooks}] : [];
  });
  if(!remove) {
    // VS Code's process.execPath is Electron, not a standalone Node runtime.
    node??=process.versions.electron?cp.execFileSync('/bin/zsh',['-lc','command -v node'],{encoding:'utf8'}).trim():process.execPath;
    if(!path.isAbsolute(node))throw Error('A standalone Node.js executable is required.');
    filtered.push({hooks:[{type:'command',command:`${quote(node)} ${quote(path.join(__dirname,'hook.js'))}`,timeout:3,statusMessage:marker,additionalContextLimit:5000}]});
  }
  if(filtered.length)value.hooks.UserPromptSubmit=filtered;else delete value.hooks.UserPromptSubmit;
  const next=JSON.stringify(value,null,2)+'\n';
  if(previous!==next) {
    if(previous!==null)fs.writeFileSync(file+`.notebook-backup-${Date.now()}-${randomUUID()}`,previous,{mode:0o600,flag:'wx'});
    // Detect concurrent changes before replacement, rather than silently overwriting them.
    if((fs.existsSync(file)?fs.readFileSync(file,'utf8'):null)!==previous)throw Error('Hooks changed concurrently; retry setup.');
    const tmp=file+`.notebook-${process.pid}.tmp`;fs.writeFileSync(tmp,next,{mode:0o600,flag:'wx'});fs.renameSync(tmp,file);
  }
  return {file,message:remove?'Notebook prompt hook removed. Restart Codex to apply.':'Notebook hook installed. Review and trust it using Codex /hooks, then start a new Codex conversation. Existing hooks and config.toml were preserved.'};
}
if(require.main===module){try{console.log(JSON.stringify(setup({remove:process.argv.includes('--remove')})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={setup};
