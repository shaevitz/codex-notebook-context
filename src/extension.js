'use strict';
const vscode = require('vscode');
const {capture,format} = require('./context');
const {serve} = require('./transport');
const {setup} = require('../scripts/setup');
let server;
async function activate(context) {
  if(process.platform !== 'darwin' || vscode.env.remoteName) return;
  const remembered = new Map();
  const output = vscode.window.createOutputChannel('Codex Notebook Context');
  context.subscriptions.push(output);
  function remember(editor) {
    if(editor?.document.uri.scheme === 'vscode-notebook-cell') remembered.set(editor.document.uri.toString(),editor.selection);
  }
  remember(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e=>remember(e.textEditor)));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(remember));
  context.subscriptions.push(vscode.workspace.onDidCloseNotebookDocument(n=>{for(const c of n.getCells())remembered.delete(c.document.uri.toString());}));
  // An edit may invalidate remembered offsets. Capture a live selection if available, otherwise forget it.
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>{remembered.delete(e.document.uri.toString());remember(vscode.window.activeTextEditor);}));
  function current(cwd) {
    const config = vscode.workspace.getConfiguration('codexNotebookContext');
    return config.get('enabled',true) ? capture(vscode,cwd,remembered,config.get('maxCellCharacters',6000)) : null;
  }
  server = await serve(current);context.subscriptions.push(server);
  context.subscriptions.push(vscode.commands.registerCommand('codexNotebookContext.preview',()=>{
    const n=vscode.window.activeNotebookEditor;
    const folder=n && vscode.workspace.getWorkspaceFolder(n.notebook.uri);
    output.clear();output.appendLine(format(folder && current(folder.uri.fsPath)) || 'No eligible active notebook context.');output.show(true);
  }));
  for(const [command,remove] of [['setup',false],['remove',true]]) context.subscriptions.push(vscode.commands.registerCommand(`codexNotebookContext.${command}`,async()=>{
    try {const result=setup({remove});vscode.window.showInformationMessage(result.message);} catch(e){vscode.window.showErrorMessage(`Notebook hook: ${e.message}`);}
  }));
  return {current};
}
function deactivate(){server?.dispose();}
module.exports={activate,deactivate};
