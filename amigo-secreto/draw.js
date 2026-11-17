(function (root) {
  'use strict';
  // A shuffled cycle guarantees one recipient per person and no self assignments.
  function createDraw(ids, random = Math.random) {
    if (ids.length < 3 || new Set(ids).size !== ids.length) {
      throw new Error('Se necesitan al menos tres participantes únicos.');
    }
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return Object.fromEntries(shuffled.map((id, i) => [id, shuffled[(i + 1) % shuffled.length]]));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createDraw };
  else root.createDraw = createDraw;
})(typeof window !== 'undefined' ? window : globalThis);
