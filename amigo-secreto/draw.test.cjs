const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDraw } = require('./draw.js');

test('cada persona entrega y recibe una vez, sin autoasignaciones', () => {
  for (const size of [3, 4, 10, 100]) {
    const ids = Array.from({ length: size }, (_, i) => `person-${i}`);
    for (let iteration = 0; iteration < 100; iteration++) {
      const result = createDraw(ids);
      assert.deepEqual(Object.keys(result).sort(), [...ids].sort());
      assert.deepEqual(Object.values(result).sort(), [...ids].sort());
      ids.forEach(id => assert.notEqual(result[id], id));
      assert.equal(ids.length, size);
    }
  }
});
test('rechaza grupos insuficientes y participantes duplicados', () => {
  for (const ids of [[], ['a'], ['a', 'b'], ['a', 'b', 'a']]) {
    assert.throws(() => createDraw(ids));
  }
});
