'use strict';
const path=require('node:path');const fs=require('node:fs');const {runTests}=require('@vscode/test-electron');
const root=path.resolve(__dirname,'..');
const workspace=path.join(root,'.test-workspace');fs.mkdirSync(workspace,{recursive:true});
fs.writeFileSync(path.join(workspace,'fixture.ipynb'),JSON.stringify({cells:[{cell_type:'code',execution_count:null,metadata:{},outputs:[],source:['alpha = 7\n','beta = alpha + 3']},{cell_type:'code',execution_count:null,metadata:{},outputs:[],source:['gamma = 11\n','print(gamma)']}],metadata:{kernelspec:{display_name:'Python',language:'python',name:'python3'}},nbformat:4,nbformat_minor:5}));
runTests({vscodeExecutablePath:'/Applications/Visual Studio Code.app/Contents/MacOS/Code',extensionDevelopmentPath:root,extensionTestsPath:path.join(root,'test/integration-suite.js'),launchArgs:[workspace,'--user-data-dir='+path.join(root,'.test-user-data'),'--disable-extensions','--skip-welcome','--skip-release-notes','--disable-workspace-trust']}).catch(e=>{console.error(e);process.exitCode=1;});
