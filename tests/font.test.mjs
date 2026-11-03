import test from 'node:test';
import assert from 'node:assert/strict';

test('OTF exporter creates parseable vector glyphs with Unicode and correct baseline', async () => {
  globalThis.self = globalThis;
  await import('../src/font-worker.js');
  const messages = [];
  globalThis.postMessage = (message) => messages.push(message);
  const seed = { width: 3, height: 3, originX: 1, originY: 2, advance: 3, cells: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]) };
  globalThis.onmessage({ data: { seeds: [{ character: ' ', ...seed, cells: new Uint8Array(9) }, { character: 'M', ...seed }, { character: '字', ...seed }],
    familyName: 'Life Test', cellSize: 8, gap: .12, history: [], generation: 0 } });
  assert.equal(messages.some((m) => m.type === 'error'), false, JSON.stringify(messages));
  const result = messages.find((m) => m.type === 'complete');
  assert.ok(result.buffer.byteLength > 500);
  assert.equal(result.glyphCount, 3);
  const font = globalThis.opentype.parse(result.buffer);
  assert.equal(font.names.fontFamily.en, 'Life Test');
  assert.equal(font.glyphs.length, 4);
  assert.ok(font.charToGlyph('M').path.commands.length >= 5);
  assert.ok(font.charToGlyph('字').path.commands.length >= 5);
  assert.equal(font.charToGlyph(' ').path.commands.length, 0);
  assert.ok(font.charToGlyph('M').getBoundingBox().y2 > 0);
});

test('OTF replays changing rules in order and keeps space blank under B0', async () => {
  const messages = [];
  globalThis.postMessage = (message) => messages.push(message);
  const seed = { width: 3, height: 3, originX: 1, originY: 1, advance: 3, cells: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]) };
  globalThis.onmessage({ data: { seeds: [{ character: ' ', ...seed, cells: new Uint8Array(9) }, { character: 'A', ...seed }],
    familyName: 'Rule Replay Test', cellSize: 8, gap: 0, history: [[0, 0], [1, 0]], generation: 2 } });
  const result = messages.find((m) => m.type === 'complete');
  assert.ok(result, JSON.stringify(messages));
  const font = globalThis.opentype.parse(result.buffer);
  // All nine cells are born after the second rule: three solid horizontal rectangles.
  assert.equal(font.charToGlyph('A').path.commands.filter((c) => c.type === 'M').length, 3);
  assert.equal(font.charToGlyph(' ').path.commands.length, 0);
});
