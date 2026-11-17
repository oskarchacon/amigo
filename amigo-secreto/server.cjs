'use strict';
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, randomInt } = require('node:crypto');
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { createDraw } = require('./draw.js');
function createApp(dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'amigo-secreto.sqlite')) {
  if (dbPath !== ':memory:') mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS assignments(giver_id TEXT PRIMARY KEY REFERENCES participants(id), recipient_id TEXT NOT NULL UNIQUE REFERENCES participants(id), CHECK(giver_id<>recipient_id));
    CREATE TABLE IF NOT EXISTS metadata(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
    INSERT OR IGNORE INTO metadata VALUES(1,0);`);
  const state = () => ({ people: db.prepare('SELECT id,name FROM participants ORDER BY rowid').all(), hasDraw: db.prepare('SELECT count(*) n FROM assignments').get().n > 0, version: db.prepare('SELECT version FROM metadata').get().version });
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  function json(res, status, value) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415,'Se requiere JSON.');
    let text=''; for await (const chunk of req) { text+=chunk; if(Buffer.byteLength(text)>8192) fail(413,'Solicitud demasiado grande.'); }
    try { return JSON.parse(text); } catch { fail(400,'JSON inválido.'); }
  }
  const assets={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/styles.css':['styles.css','text/css'],'/app.js':['app.js','text/javascript']};
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET' && assets[url.pathname]) { const [file,type]=assets[url.pathname]; res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}); return res.end(readFileSync(path.join(__dirname,file))); }
      if(req.method==='GET' && url.pathname==='/api/state') return json(res,200,state());
      if(req.method==='GET' && /^\/api\/secret\/[^/]+$/.test(url.pathname)) {
        const recipient=db.prepare('SELECT p.name FROM assignments a JOIN participants p ON p.id=a.recipient_id WHERE a.giver_id=?').get(decodeURIComponent(url.pathname.split('/').pop()));
        if(!recipient) fail(404,'No hay resultado para esta persona. Actualiza la página.');
        return json(res,200,recipient);
      }
      const route=`${req.method} ${url.pathname}`;
      if(!['POST /api/people','DELETE /api/people','POST /api/draw'].includes(route) && !(req.method==='DELETE' && /^\/api\/people\/[^/]+$/.test(url.pathname))) fail(404,'Ruta no encontrada.');
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) fail(403,'Origen no permitido.');
      const input=await body(req);
      db.exec('BEGIN IMMEDIATE');
      try {
        if(!input || input.version!==state().version) fail(409,'Los datos cambiaron. Revisa la lista actualizada e intenta de nuevo.');
        if(route==='POST /api/people') {
          const name=typeof input.name==='string'?input.name.normalize('NFC').trim().replace(/\s+/g,' '):'';
          if(!name || name.length>60) fail(400,'Escribe un nombre entre 1 y 60 caracteres.');
          const key=name.toLocaleLowerCase('es');
          if(db.prepare('SELECT id FROM participants WHERE name_key=?').get(key)) fail(409,'Ese nombre ya existe. Agrega un apellido.');
          db.exec('DELETE FROM assignments'); db.prepare('INSERT INTO participants VALUES(?,?,?)').run(randomUUID(),name,key);
        } else if(route==='POST /api/draw') {
          const ids=state().people.map(p=>p.id); if(ids.length<3) fail(400,'Se necesitan al menos tres participantes.');
          const assignments=createDraw(ids,()=>randomInt(0,0x100000000)/0x100000000);
          db.exec('DELETE FROM assignments'); const insert=db.prepare('INSERT INTO assignments VALUES(?,?)');
          for(const [giver,recipient] of Object.entries(assignments)) insert.run(giver,recipient);
        } else {
          db.exec('DELETE FROM assignments');
          if(route==='DELETE /api/people') db.exec('DELETE FROM participants');
          else if(!db.prepare('DELETE FROM participants WHERE id=?').run(decodeURIComponent(url.pathname.split('/').pop())).changes) fail(404,'Participante no encontrado.');
        }
        db.exec('UPDATE metadata SET version=version+1 WHERE id=1; COMMIT');
      } catch(error) { db.exec('ROLLBACK'); throw error; }
      json(res,200,state());
    } catch(error) { if(!error.status) console.error(error); json(res,error.status||500,{error:error.status?error.message:'No se pudo guardar en SQLite.'}); }
  });
  server.on('close',()=>db.close()); return server;
}
if(require.main===module) {
  const server=createApp(); const port=Number(process.env.PORT||3000);
  server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Entre amigos: http://localhost:${port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close());
}
module.exports={createApp};
