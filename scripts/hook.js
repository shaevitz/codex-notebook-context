#!/usr/bin/env node
'use strict';
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const {request,socketPath} = require('../src/transport');
const {format} = require('../src/context');
function ancestors(pid = process.ppid) {
  const result = [];
  for(let i=0;i<12 && pid>1;i++) {
    result.push(pid);
    try { pid = Number(execFileSync('/bin/ps',['-o','ppid=','-p',String(pid)],{encoding:'utf8',timeout:200}).trim()); } catch { break; }
  }
  return result;
}
function isIdeTranscript(file) {
  if(typeof file !== 'string')return false;
  let fd;try {
    fd=fs.openSync(file,'r');const bytes=Buffer.alloc(16384);const n=fs.readSync(fd,bytes,0,bytes.length,0);
    const line=bytes.subarray(0,n).toString('utf8').split('\n')[0];const entry=JSON.parse(line);
    return entry.type==='session_meta' && entry.payload?.source==='vscode' && entry.payload?.originator==='codex_vscode';
  }catch{return false;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function run(event, env=process.env) {
  if(event.hook_event_name !== 'UserPromptSubmit' || typeof event.cwd !== 'string' || env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE !== 'codex_vscode') return null;
  // Codex's app-server is a child of the same extension host. Never pick another window's socket.
  if(!isIdeTranscript(event.transcript_path))return null;
  const pid = ancestors().find(p=>fs.existsSync(socketPath(p)));
  if(!pid)return null;
  const context = await request(pid,event.cwd);
  if(!context)return null;
  return {hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:format(context)}};
}
if(require.main===module) {
  let input='';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',d=>{input+=d;if(input.length>2e6)process.exit(0);});
  process.stdin.on('end',async()=>{try{const out=await run(JSON.parse(input));if(out)process.stdout.write(JSON.stringify(out));}catch{/* Fail open; never block the user's prompt. */}});
  setTimeout(()=>process.exit(0),2500).unref();
}
module.exports={run,ancestors,isIdeTranscript};
