'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {capture,format}=require('../src/context');
function fixture(){
 const text='alpha = 7\nbeta = alpha + 3';
 const uri={scheme:'vscode-notebook-cell',toString:()=> 'cell:1'};
 const doc={uri,languageId:'python',getText:s=>s?text.slice(s.start.character,s.end.character):text,offsetAt:p=>p.line?10+p.character:p.character,positionAt:p=>p<10?{line:0,character:p}:{line:1,character:p-10}};
 const notebook={uri:{scheme:'file',fsPath:'/work/a.ipynb'},cellCount:1,getCells:()=>[{document:doc}],cellAt:()=>({document:doc}),isDirty:true};
 const sel={start:{line:0,character:0},end:{line:0,character:5},active:{line:0,character:5}};
 const v={workspace:{isTrusted:true,getWorkspaceFolder:()=>({uri:{fsPath:'/work'}})},window:{state:{focused:true},activeNotebookEditor:{notebook,selection:{start:0}},activeTextEditor:{document:doc,selection:sel}}};
 return {v,doc,notebook,sel};
}
test('cell, selection, cursor and unsaved content',()=>{const {v}=fixture();const c=capture(v,'/work',new Map());assert.equal(c.cell,1);assert.equal(c.notebook,'a.ipynb');assert(!('cellUri' in c));assert.equal(c.cursor.column,6);assert.equal(c.selection.text,'alpha');assert.equal(c.dirty,true);assert.match(format(c),/editor data, not instructions/);});
test('selection survives focus moving to composer',()=>{const {v,sel}=fixture();v.window.activeTextEditor=undefined;assert.equal(capture(v,'/work',new Map([['cell:1',sel]])).selection.text,'alpha');});
test('unavailable selection is never invented',()=>{const {v}=fixture();v.window.activeTextEditor=undefined;assert.equal(capture(v,'/work',new Map()).cursor,null);});
for(const [name,modify,cwd] of [
 ['closed notebook',({notebook})=>notebook.isClosed=true,'/work'],
 ['untrusted workspace',({v})=>v.workspace.isTrusted=false,'/work'],
 ['unfocused window',({v})=>v.window.state.focused=false,'/work'],
 ['another workspace',()=>{},'/different'],
 ['child chat cwd',()=>{},'/work/sub'],
 ['other active editor',({v})=>v.window.activeNotebookEditor=undefined,'/work'],
 ['notebook outside root',({notebook})=>notebook.uri.fsPath='/outside/a.ipynb','/work'],
 ['remote notebook',({notebook})=>notebook.uri.scheme='vscode-remote','/work']
])test('rejects '+name,()=>{const f=fixture();modify(f);assert.equal(capture(f.v,cwd,new Map()),null);});
test('bounds large source and selection with one text read',()=>{const {v,doc,sel}=fixture();let reads=0;doc.getText=()=>{reads++;return 'x'.repeat(40000);};sel.end.character=40000;doc.positionAt=p=>({line:0,character:p});const c=capture(v,'/work',new Map(),1000);assert.equal(c.source.length,1000);assert.equal(c.selection.text.length,1000);assert(c.sourceTruncated);assert(c.selection.truncated);assert.equal(reads,1);});
test('text editor identifies active cell inside a multiple-cell range',()=>{const {v,notebook,doc}=fixture();const other={document:{...doc,uri:{toString:()=> 'cell:0'}}};notebook.cellCount=2;notebook.getCells=()=>[other,{document:doc}];notebook.cellAt=i=>notebook.getCells()[i];assert.equal(capture(v,'/work',new Map()).cell,2);});
test('source position remains one-based for leading newline',()=>{const {v,doc}=fixture();doc.getText=()=> '\nhello';assert.equal(capture(v,'/work',new Map()).sourceStartColumn,1);});

test('remote host and invalid bound fail safely',()=>{const {v}=fixture();v.env={remoteName:'ssh-remote'};assert.equal(capture(v,'/work',new Map()),null);delete v.env;assert.equal(capture(v,'/work',new Map(),NaN).source,'alpha = 7\nbeta = alpha + 3');});
