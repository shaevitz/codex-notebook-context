'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {spawn, spawnSync} = require('node:child_process');
const {downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath} = require('@vscode/test-electron');
const root = path.resolve(__dirname, '..');
async function main() {
  if (process.platform !== 'darwin') throw Error('Integration targets macOS only.');
  const profile = process.env.NOTEBOOK_TEST_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(),'notebook-vscode-test-'));
  if (path.dirname(profile)!==os.tmpdir().replace(/\/$/, '') || !path.basename(profile).startsWith('notebook-vscode-test-') || !fs.lstatSync(profile).isDirectory() || fs.lstatSync(profile).uid!==process.getuid()) throw Error('Profile must be an owned synthetic test directory under the temporary directory.');
  // Keep every test notebook synthetic; native trust is required for local
  // positive coverage. CI uses a fresh Restricted Mode workspace.
  const workspace = process.env.CI || process.env.NOTEBOOK_TEST_UNTRUSTED==='1' ? path.join(profile,'workspace') : path.join(root,'.test-workspace',path.basename(profile));fs.mkdirSync(workspace,{recursive:true});
  const codexHome = path.join(profile,'codex-home');fs.mkdirSync(codexHome,{recursive:true});
  const userData = path.join(profile,'user-data');fs.mkdirSync(path.join(userData,'User'),{recursive:true});
  fs.writeFileSync(path.join(userData,'User/settings.json'),JSON.stringify({'codexNotebookContext.codexHome':codexHome,'codexNotebookContext.nodePath':process.execPath,'chat.disableAIFeatures':true,'workbench.startupEditor':'none','telemetry.telemetryLevel':'off','extensions.autoUpdate':false,'git.enabled':false}));
  fs.writeFileSync(path.join(workspace,'fixture.ipynb'),JSON.stringify({cells:[{cell_type:'code',execution_count:null,metadata:{},outputs:[],source:['alpha = 7\n','beta = alpha + 3']},{cell_type:'code',execution_count:null,metadata:{},outputs:[],source:['gamma = 11\n','print(gamma)']}],metadata:{kernelspec:{display_name:'Python',language:'python',name:'python3'}},nbformat:4,nbformat_minor:5}));
  // An inert fixture declares the tested Codex version; it never signs in or sends a prompt.
  const codex = path.join(profile,'codex-fixture');fs.mkdirSync(codex,{recursive:true});
  fs.writeFileSync(path.join(codex,'package.json'),JSON.stringify({name:'chatgpt',publisher:'openai',version:'26.5917.62051',engines:{vscode:'^1.140.0'},main:'./index.js',activationEvents:[]}));
  fs.writeFileSync(path.join(codex,'index.js'),'exports.activate=()=>{};');
  let executable = process.env.VSCODE_EXECUTABLE_PATH;
  if (!executable && !process.env.CI && fs.existsSync('/Applications/Visual Studio Code.app/Contents/MacOS/Code')) executable='/Applications/Visual Studio Code.app/Contents/MacOS/Code';
  executable ||= await downloadAndUnzipVSCode(process.env.VSCODE_VERSION || '1.140.0');
  // VS Code 1.140 renamed the macOS executable; test-electron 2.x still
  // returns the older Electron name after a successful download.
  if(!fs.existsSync(executable) && path.basename(executable)==='Electron' && fs.existsSync(path.join(path.dirname(executable),'Code'))) executable=path.join(path.dirname(executable),'Code');
  const extensions = path.join(profile,'extensions');
  let installedRoot;
  const development = process.env.NOTEBOOK_VSIX ? [] : [root];
  const driver=path.join(profile,'driver');fs.mkdirSync(driver,{recursive:true});
  fs.writeFileSync(path.join(driver,'package.json'),JSON.stringify({name:'integration-driver',publisher:'notebooktest',version:'1.0.0',engines:{vscode:'^1.140.0'},main:'./index.js',activationEvents:['onStartupFinished'],capabilities:{untrustedWorkspaces:{supported:true}}}));
  fs.writeFileSync(path.join(driver,'index.js'),'exports.activate=()=>{setTimeout(()=>require('+JSON.stringify(path.join(root,'test/integration-suite.js'))+').run().catch(e=>console.error(e)),1000);};');
  if (process.env.NOTEBOOK_VSIX) {
    const [cli,...args] = resolveCliArgsFromVSCodeExecutablePath(executable,{reuseMachineInstall:true});
    const installed = spawnSync(cli,[...args,'--user-data-dir='+userData,'--shared-data-dir='+path.join(profile,'shared-data'),'--extensions-dir='+extensions,'--install-extension',path.resolve(process.env.NOTEBOOK_VSIX),'--force'],{encoding:'utf8'});
    if (installed.status !== 0) throw Error('VSIX installation failed: '+installed.stderr);
    installedRoot=path.join(extensions,fs.readdirSync(extensions).find(n=>n.startsWith('shaevitz.codex-notebook-context-0.2.0')) || 'missing');
    const manifest=JSON.parse(fs.readFileSync(path.join(installedRoot,'package.json')));
    if(manifest.publisher!== 'shaevitz'||manifest.name!=='codex-notebook-context'||manifest.version!=='0.2.0')throw Error('Unexpected installed VSIX identity/version');
    for(const name of ['src/context.js','src/extension.js','src/transport.js','scripts/launcher.js','scripts/runtime.js','scripts/setup.js','scripts/hook.js'])if(!fs.readFileSync(path.join(installedRoot,name)).equals(fs.readFileSync(path.join(root,name))))throw Error('Installed runtime differs from candidate: '+name);

  }
  const resultFile=path.join(profile,'result.json');fs.rmSync(resultFile,{force:true});
  let passed = false;
  try {
    // Use a normal development host with an inert test driver. VS Code's
    // extensionTestsPath mode substitutes in-memory trust storage; a normal
    // host exercises native trust and the actual source/installed extension.
    console.log('Synthetic integration profile: '+profile);
    await new Promise((resolve,reject)=>{
      const child=spawn(executable,[workspace,'--user-data-dir='+userData,'--shared-data-dir='+path.join(profile,'shared-data'),'--extensions-dir='+extensions,
        ...development.map(p=>'--extensionDevelopmentPath='+p),'--extensionDevelopmentPath='+codex,
        ...(process.env.NOTEBOOK_PREPARE_ONLY ? [] : ['--extensionDevelopmentPath='+driver]),
        '--skip-welcome','--skip-release-notes','--disable-updates','--new-window','--disable-gpu','--disable-extension=github.copilot-chat'],
        {stdio:'inherit',env:{...process.env,NOTEBOOK_TEST_NODE:process.execPath,NOTEBOOK_TEST_HOME:codexHome,NOTEBOOK_TEST_PACKAGED:process.env.NOTEBOOK_VSIX?'1':'0',NOTEBOOK_TEST_RESULT:resultFile,NOTEBOOK_TEST_EXTENSION_PATH:installedRoot||root}});
      const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Integration timed out; inspect retained synthetic profile.'));},process.env.NOTEBOOK_PREPARE_ONLY?900000:180000);
      const monitor=setInterval(()=>{if(fs.existsSync(resultFile))child.kill('SIGKILL');},500);
      child.once('error',e=>{clearTimeout(timer);clearInterval(monitor);reject(e);});
      child.once('exit',(code,signal)=>{clearTimeout(timer);clearInterval(monitor);fs.existsSync(resultFile)||code===0?resolve():reject(Error('VS Code integration exited '+(signal||code)));});
    });
    if(process.env.NOTEBOOK_PREPARE_ONLY)return;
    if(!fs.existsSync(resultFile)||JSON.parse(fs.readFileSync(resultFile)).status!=='passed')throw Error('Suite did not report success; inspect retained profile.');
    passed = true;
  } finally {
    // Only this synthetic temporary profile. Never touch a user's open notebook/profile.
    if (passed && !process.env.NOTEBOOK_TEST_PROFILE) fs.rmSync(profile,{recursive:true,force:true});
    else console.error('Synthetic test profile retained for diagnostics: '+profile);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
