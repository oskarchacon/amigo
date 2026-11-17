const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('./server.cjs');
test('API: validación, persistencia, conflictos, sorteo y archivos privados', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'amigo-test-'));
  const dbPath = path.join(dir, 'test.sqlite');
  let server;
  async function open() { server = createApp(dbPath); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); }
  async function close() { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  async function req(route, method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  try {
    await open();
    let state = (await req('/api/state')).data;
    assert.equal(state.people.length, 0);
    assert.equal((await req('/api/draw', 'POST', { version: 0 })).status, 400);
    for (const name of ['Ana', 'Luis', 'María']) {
      const result = await req('/api/people', 'POST', { name, version: state.version });
      assert.equal(result.status, 200); state = result.data;
    }
    assert.equal((await req('/api/people', 'POST', { name: ' ana ', version: state.version })).status, 409);
    assert.equal((await req('/api/people', 'POST', { name: 'Pedro', version: 0 })).status, 409);
    assert.equal((await req('/api/people', 'POST', { name: ' ', version: state.version })).status, 400);
    state = (await req('/api/draw', 'POST', { version: state.version })).data;
    assert.equal(state.hasDraw, true);
    assert.equal('assignments' in state, false);
    const recipients = [];
    for (const person of state.people) {
      const result = await req(`/api/secret/${person.id}`);
      assert.equal(result.status, 200); assert.notEqual(result.data.name, person.name); recipients.push(result.data.name);
    }
    assert.equal(new Set(recipients).size, 3);
    await close(); await open();
    assert.deepEqual((await req('/api/state')).data, state);
    assert.equal((await req(`/api/secret/${state.people[0].id}`)).data.name, recipients[0]);
    for (const route of ['/data/test.sqlite', '/server.cjs', '/README.md']) assert.equal((await req(route)).status, 404);
    const removed = await req(`/api/people/${state.people[0].id}`, 'DELETE', { version: state.version });
    assert.equal(removed.data.people.length, 2); assert.equal(removed.data.hasDraw, false);
    assert.equal((await req(`/api/secret/${state.people[1].id}`)).status, 404);
    const cleared = await req('/api/people', 'DELETE', { version: removed.data.version });
    assert.equal(cleared.data.people.length, 0);
  } finally { if (server?.listening) await close(); rmSync(dir, { recursive: true, force: true }); }
});
