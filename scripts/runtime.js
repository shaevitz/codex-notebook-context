'use strict';
// Notebook Context for Codex managed asset v1
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
function validateNode(file) {
  if (!path.isAbsolute(file)) throw Error('Node path must be absolute.');
  const result = JSON.parse(execFileSync(file, ['-e', 'console.log(JSON.stringify({version:process.versions.node,electron:!!process.versions.electron}))'], {
    encoding: 'utf8', timeout: 1500, maxBuffer: 4096, cwd: os.tmpdir(),
    env: {...process.env, NODE_OPTIONS: '', NODE_PATH: ''}
  }));
  if (result.electron || Number(result.version?.split('.')[0]) < 20 || !/^\d+\.\d+\.\d+$/.test(result.version)) throw Error('A standalone Node.js 20 or newer is required.');
  return {path: file, version: result.version};
}
function discoverNode(explicit) {
  if (explicit) return validateNode(explicit);
  const candidates = [!process.versions.electron && process.execPath,
    ...(process.env.PATH || '').split(path.delimiter).filter(p=>path.isAbsolute(p)).map(p=>path.join(p,'node')),
    '/opt/homebrew/bin/node', '/usr/local/bin/node',
    path.join(os.homedir(),'.volta/bin/node'),path.join(os.homedir(),'.asdf/shims/node')];
  const nvm=path.join(os.homedir(),'.nvm/versions/node');
  try {candidates.push(...fs.readdirSync(nvm).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>path.join(nvm,v,'bin/node')));} catch {}
  for (const file of new Set(candidates.filter(Boolean))) {try{return validateNode(file);}catch{}}
  throw Error('Standalone Node.js 20+ was not found. Install Node.js, or set Notebook Context for Codex: Node Path to its absolute executable path, then retry.');
}
function homePath(home) {return path.resolve(home || process.env.CODEX_HOME || path.join(os.homedir(),'.codex'));}
function quote(s) {return "'"+s.replace(/'/g,"'\\''")+"'";}
function tokens(command) {
  const atom="'(?:[^']|'\\\\'')*'";
  const match=new RegExp('^('+atom+') ('+atom+')$').exec(command);
  return match && match.slice(1).map(s=>s.slice(1,-1).replace(/'\\''/g,"'"));
}
function owned(handler,home) {
  if(handler?.type!=='command'||handler.statusMessage!=='Codex Notebook Context'||typeof handler.command!=='string')return false;
  const args=tokens(handler.command);
  if(!args || !path.isAbsolute(args[0]))return false;
  return args[1]===path.join(home,'notebook-context/launcher.js') || /\/(?:shaevitz\.codex-notebook-context-[^/]+|codex-notebook-context)\/scripts\/hook\.js$/.test(args[1]);
}
function readConfig(home) {
  const file=path.join(home,'hooks.json');let previous=null;
  try {
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||stat.size>2e6)throw Error('Unsafe or oversized hooks.json; no changes made.');
    previous=fs.readFileSync(file,'utf8');
  }catch(e){if(e.code!=='ENOENT')throw e;}
  const value=previous===null?{}:JSON.parse(previous);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Existing hooks.json must be an object; no changes made.');
  if(value.hooks!==undefined&&(!value.hooks||typeof value.hooks!=='object'||Array.isArray(value.hooks)))throw Error('Invalid hooks table; no changes made.');
  if(value.hooks?.UserPromptSubmit!==undefined&&!Array.isArray(value.hooks.UserPromptSubmit))throw Error('Invalid UserPromptSubmit hook list; no changes made.');
  for(const g of value.hooks?.UserPromptSubmit||[])if(!g||typeof g!=='object'||!Array.isArray(g.hooks)||g.hooks.some(h=>!h||typeof h!=='object'||Array.isArray(h)))throw Error('Invalid hook group; no changes made.');
  return {file,previous,value};
}
module.exports={discoverNode,validateNode,homePath,quote,owned,readConfig};
