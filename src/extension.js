'use strict';
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const {capture, format, eligibility} = require('./context');
const {serve} = require('./transport');
const {setup} = require('../scripts/setup');
const {discoverNode, homePath, owned, readConfig} = require('../scripts/runtime');
const TESTED_CODEX = ['26.5917.62051'];
let server;
function compatibility() {
  if (process.platform !== 'darwin') return 'Only local macOS VS Code is supported.';
  if (vscode.env.remoteName) return 'Remote workspaces are unsupported.';
  const codex = vscode.extensions.getExtension('openai.chatgpt');
  if (!codex) return 'Install the OpenAI Codex VS Code extension.';
  if (!TESTED_CODEX.includes(codex.packageJSON.version) && !vscode.workspace.getConfiguration('codexNotebookContext').get('allowUntestedCodex', false)) {
    return 'Codex version is untested. Collection is paused. See Show Diagnostics and the compatibility table before opting in to an untested version.';
  }
  return null;
}
async function activate(context) {
  const remembered = new Map();
  const output = vscode.window.createOutputChannel('Notebook Context for Codex');
  context.subscriptions.push(output);
  let serverError = null, requests = 0, lastRequest = null;
  function remember(editor) {
    if (editor?.document.uri.scheme === 'vscode-notebook-cell') remembered.set(editor.document.uri.toString(), editor.selection);
  }
  remember(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e=>remember(e.textEditor)));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(remember));
  context.subscriptions.push(vscode.workspace.onDidCloseNotebookDocument(n=>{
    for (const c of n.getCells()) remembered.delete(c.document.uri.toString());
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>{
    remembered.delete(e.document.uri.toString()); remember(vscode.window.activeTextEditor);
  }));
  function reason(cwd) {
    return compatibility() || (!vscode.workspace.getConfiguration('codexNotebookContext').get('enabled', true) ? 'Collection is disabled in settings.' : null) || eligibility(vscode, cwd);
  }
  function current(cwd) {
    if (reason(cwd)) return null;
    return capture(vscode, cwd, remembered, vscode.workspace.getConfiguration('codexNotebookContext').get('maxCellCharacters', 6000));
  }
  if (process.platform === 'darwin' && !vscode.env.remoteName) {
    try {
      server = await serve(cwd=>{
        const value = current(cwd);
        requests++; lastRequest = {time: new Date().toISOString(), supplied: !!value, reason: value ? null : reason(cwd)};
        return value;
      });
      context.subscriptions.push(server);
    } catch(e) {
      serverError = e.message;
      output.appendLine('IPC unavailable: ' + e.message);
      vscode.window.showErrorMessage('Notebook Context for Codex could not start its local socket. Use Show Diagnostics for details.');
    }
  }
  function notebookRoot() {
    const n = vscode.window.activeNotebookEditor;
    return n && vscode.workspace.getWorkspaceFolder(n.notebook.uri)?.uri.fsPath;
  }
  function options() {
    const config = vscode.workspace.getConfiguration('codexNotebookContext');
    return {home: homePath(config.get('codexHome', '')), node: config.get('nodePath', '') || undefined};
  }
  context.subscriptions.push(vscode.commands.registerCommand('codexNotebookContext.preview', ()=>{
    output.clear(); output.appendLine(format(current(notebookRoot())) || reason(notebookRoot()) || 'No eligible active cell.'); output.show(true);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('codexNotebookContext.diagnostics', ()=>{
    const opt = options(), report = {extensionVersion: context.extension.packageJSON.version, vscodeVersion: vscode.version,
      codexExtensionVersion: vscode.extensions.getExtension('openai.chatgpt')?.packageJSON.version || 'missing',
      compatibility: compatibility() || 'tested Codex version (or explicit untested-version opt-in)',
      socket: serverError || (server ? 'running' : 'unsupported environment'),
      collection: reason(notebookRoot()) || 'eligible; actual chat directory must also match',
      hookTrust: 'Not inferred. Review the exact hook in Codex /hooks.', requests, lastRequest,
      delivery: 'A socket response does not prove Codex accepted/stored context. Test a normal sidebar prompt.'};
    try { report.node = discoverNode(opt.node); } catch(e) { report.node = e.message; }
    try {
      const config = readConfig(opt.home);
      const handlers = (config.value.hooks?.UserPromptSubmit || []).flatMap(g=>g.hooks).filter(h=>owned(h,opt.home));
      report.hookRegistration = handlers.length === 1 ? 'one handler' : handlers.length + ' handlers; run Install Prompt Hook to repair';
      const launcher = path.join(opt.home,'notebook-context/launcher.js');
      report.launcher = !fs.existsSync(launcher) ? 'missing; run Install Prompt Hook' :
        fs.readFileSync(launcher).equals(fs.readFileSync(path.join(context.extensionPath,'scripts/launcher.js'))) ? 'matches this release' : 'different revision; run Install Prompt Hook and review changes';
      report.codexHome = opt.home;
    } catch(e) { report.hookRegistration = e.message; }
    output.clear(); output.appendLine(JSON.stringify(report,null,2)); output.show(true);
    return report;
  }));
  for (const [command, remove] of [['setup',false],['remove',true]]) {
    context.subscriptions.push(vscode.commands.registerCommand(`codexNotebookContext.${command}`, ()=>{
      try {
        if (process.platform !== 'darwin' || vscode.env.remoteName) throw Error('Hook setup requires local macOS VS Code.');
        const result = setup({...options(), remove});
        vscode.window.showInformationMessage(result.message);
        return result;
      } catch(e) { vscode.window.showErrorMessage(`Notebook hook: ${e.message}`); }
    }));
  }
  return {current, reason};
}
function deactivate() { server?.dispose(); }
module.exports = {activate, deactivate};
