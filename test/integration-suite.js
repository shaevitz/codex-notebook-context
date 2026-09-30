'use strict';
const v=require('vscode');const assert=require('node:assert/strict');const path=require('node:path');const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');
const transcript=path.join(os.tmpdir(),`notebook-integration-${process.pid}.jsonl`);
fs.writeFileSync(transcript,JSON.stringify({type:'session_meta',payload:{source:'vscode',originator:'codex_vscode'}})+'\n');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(f){for(let i=0;i<40;i++){if(f())return;await wait(100);}throw Error('Timed out waiting for notebook editor');}
function hook(cwd,origin='codex_vscode') {return new Promise((resolve,reject)=>{const p=spawn('/usr/local/bin/node',[path.join(__dirname,'../scripts/hook.js')],{env:{...process.env,CODEX_INTERNAL_ORIGINATOR_OVERRIDE:origin}});let out='';p.stdout.on('data',b=>out+=b);p.on('error',reject);p.on('close',()=>{try{resolve(out?JSON.parse(out):null);}catch(e){reject(e);}});p.stdin.end(JSON.stringify({hook_event_name:'UserPromptSubmit',cwd,transcript_path:transcript}));});}
async function run(){
 const root=v.workspace.workspaceFolders[0].uri.fsPath;
 const extension=v.extensions.getExtension('shaevitz.codex-notebook-context');await extension.activate();
 const notebook=await v.workspace.openNotebookDocument(v.Uri.file(path.join(root,'fixture.ipynb')));
 const editor=await v.window.showNotebookDocument(notebook);
 await v.commands.executeCommand('notebook.cell.edit');
 await poll(()=>v.window.activeTextEditor?.document.uri.toString()===notebook.cellAt(0).document.uri.toString());
 let textEditor=v.window.activeTextEditor;
 textEditor.selection=new v.Selection(0,0,0,5);await wait(150);
 assert(v.window.state.focused,'Test window must be focused');
 let response=await hook(root);assert(response,'Hook should receive notebook');
 let c=JSON.parse(response.hookSpecificOutput.additionalContext.split('\n').slice(1).join('\n'));
 assert.equal(c.cell,1);assert.equal(c.selection.text,'alpha');assert.deepEqual(c.cursor,{line:1,column:6});
 await v.commands.executeCommand('workbench.view.explorer');await wait(150);
 assert(await hook(root),'Sidebar focus must retain notebook context');
 await v.commands.executeCommand('notebook.cell.edit');
 textEditor.selection=new v.Selection(1,7,1,7);await wait(150);
 c=JSON.parse((await hook(root)).hookSpecificOutput.additionalContext.split('\n').slice(1).join('\n'));
 assert.deepEqual(c.cursor,{line:2,column:8});assert.equal(c.selection.text,'');
 editor.selection=new v.NotebookRange(1,2);await v.commands.executeCommand('notebook.cell.edit');
 await poll(()=>v.window.activeTextEditor?.document.uri.toString()===notebook.cellAt(1).document.uri.toString());
 textEditor=v.window.activeTextEditor;textEditor.selection=new v.Selection(1,6,1,11);await wait(150);
 c=JSON.parse((await hook(root)).hookSpecificOutput.additionalContext.split('\n').slice(1).join('\n'));
 assert.equal(c.cell,2);assert.equal(c.selection.text,'gamma');assert.equal(c.cursor.column,12);
 assert.equal(await hook(root,'codex_cli_rs'),null);assert.equal(await hook(path.dirname(root)),null);
 await v.commands.executeCommand('workbench.action.closeActiveEditor');await wait(200);assert.equal(await hook(root),null);
 fs.unlinkSync(transcript);
 console.log('PASS: actual notebook cell/selection/cursor changes -> child hook -> additionalContext; CLI, other cwd and closed notebook excluded');
}
module.exports={run};
