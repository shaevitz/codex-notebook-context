'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
for(const dir of ['src','scripts','test'])for(const file of fs.readdirSync(dir))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});
const p=JSON.parse(fs.readFileSync('package.json'));const lock=JSON.parse(fs.readFileSync('package-lock.json'));
if(p.version!==lock.version||p.version!==lock.packages[''].version)throw Error('Package versions differ');
if(p.dependencies&&Object.keys(p.dependencies).length)throw Error('Runtime dependencies require a release review');
console.log('Syntax and package checks passed');
