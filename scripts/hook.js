#!/usr/bin/env node
'use strict';
// Legacy development entry point; installed hooks use the standalone launcher.
const launcher=require('./launcher');
if(require.main===module){let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>{input+=d;if(Buffer.byteLength(input)>2e6)process.exit(0);});
process.stdin.on('end',async()=>{try{const out=await launcher.run(JSON.parse(input));if(out)process.stdout.write(JSON.stringify(out));}catch{}});setTimeout(()=>process.exit(0),2500).unref();}
module.exports=launcher;
