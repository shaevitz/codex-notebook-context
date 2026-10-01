'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const manifest=require('../package.json');
fs.mkdirSync('dist',{recursive:true});
execFileSync('vsce',['package','--no-dependencies','--out',path.join('dist',`${manifest.name}-${manifest.version}.vsix`)],{stdio:'inherit'});
