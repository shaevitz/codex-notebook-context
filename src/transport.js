'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
function directory() { return path.join(os.tmpdir(), `codex-notebook-${process.getuid()}`); }
function socketPath(pid) { return path.join(directory(), `${pid}.sock`); }
let hosted = false;
async function listening(file) {
  return new Promise(resolve => {
    const socket = net.createConnection(file);
    let done = false;
    function finish(value) { if (done) return; done = true; clearTimeout(timer); socket.destroy(); resolve(value); }
    const timer = setTimeout(() => finish(true), 200);
    socket.on('connect', () => finish(true));
    socket.on('error', e => finish(e.code !== 'ECONNREFUSED' && e.code !== 'ENOENT'));
  });
}
async function serve(getContext) {
  if (hosted) throw Error('Notebook IPC server already active in this host');
  hosted = true;
  try {
  const dir = directory();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe notebook IPC directory');
  const file = socketPath(process.pid);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isSocket() || stat.uid !== process.getuid() || (stat.mode & 0o077) || await listening(file)) throw Error('Existing notebook IPC path is unsafe or active');
    fs.unlinkSync(file);
  } catch(e) { if(e.code !== 'ENOENT') throw e; }
  let disposed = false;
  const connections = new Set();
  const server = net.createServer(socket => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
    let input = '', handled = false;
    socket.setEncoding('utf8');
    const timer = setTimeout(() => socket.destroy(), 1000);
    socket.on('close', () => clearTimeout(timer));
    socket.setTimeout(1000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', data => {
      if (handled || disposed) return;
      input += data;
      if (Buffer.byteLength(input) > 8192) return socket.destroy();
      if (!input.includes('\n')) return;
      handled = true;
      try {
        const request = JSON.parse(input.split('\n')[0]);
        const value = request.version === 1 && typeof request.cwd === 'string' ? getContext(request.cwd) : null;
        const result = JSON.stringify(value ?? null);
        socket.end(Buffer.byteLength(result) <= 300000 ? result : 'null');
      } catch { socket.end('null'); }
    });
  });
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(file,resolve);});
  fs.chmodSync(file,0o600);
  return {dispose() {if(disposed)return;disposed=true;hosted=false;for(const socket of connections)socket.destroy();server.close();try{fs.unlinkSync(file);}catch{}}};
  } catch(e) { hosted = false; throw e; }
}
function request(pid, cwd) {
  return new Promise(resolve => {
    let result = '', done = false;
    const socket = net.createConnection(socketPath(pid));
    socket.setEncoding('utf8');
    const timer = setTimeout(()=>finish(null),700);
    function finish(value) { if(done)return;done=true;clearTimeout(timer);socket.destroy();resolve(value); }
    socket.setTimeout(700,()=>finish(null));
    socket.on('error',()=>finish(null));
    socket.on('connect',()=>socket.write(JSON.stringify({version:1,cwd})+'\n'));
    socket.on('data',b=>{result+=b;if(Buffer.byteLength(result)>300000)finish(null);});
    socket.on('end',()=>{try{finish(JSON.parse(result));}catch{finish(null);}});
  });
}
module.exports = {serve,request,socketPath};
