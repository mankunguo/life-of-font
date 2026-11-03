import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameWorld, frameGridDimensions, frameViewBox } from '../src/world.js';
import { boundsOf, evolve, population } from '../src/engine.js';

function seed() {
  const cells = new Uint8Array(64);
  cells[3 * 8 + 3] = 1;
  return { cells, width: 8, height: 8, originX: 4, originY: 5, advance: 7 };
}

test('a wide frame adds real simulation columns, with the original seed centered', () => {
  const source = seed();
  const world = createFrameWorld(source, 1200, 600);
  assert.deepEqual([world.width, world.height], [16, 8]);
  assert.equal(world.cells[3 * 16 + 7], 1);
  assert.equal(population(world.cells), 1);
  assert.deepEqual([world.originX, world.originY], [8, 5]);
  assert.equal(population(source.cells), 1);
});

test('a tall frame adds simulation rows, and does not stretch the source letter', () => {
  const world = createFrameWorld(seed(), 600, 1200);
  assert.deepEqual([world.width, world.height], [8, 16]);
  assert.equal(world.cells[7 * 8 + 3], 1);
  assert.deepEqual([world.originX, world.originY], [4, 9]);
});

test('fractional frame sizes have no letterboxing and keep equal horizontal/vertical scale', () => {
  for (const [width, height] of [[1111.5, 1017.25], [355, 477.078125], [1450.25, 733.5]]) {
    const grid = frameGridDimensions(97, 88, width, height);
    const view = frameViewBox(grid.width, grid.height, width, height);
    assert.ok(Math.abs(width / view.width - height / view.height) < 1e-9);
    assert.ok(view.x >= -1e-9 && view.y >= -1e-9);
    assert.ok(view.x + view.width <= grid.width + 1e-9);
    assert.ok(view.y + view.height <= grid.height + 1e-9);
    assert.ok(grid.width - view.width < 2 + 1e-9);
    assert.ok(grid.height - view.height < 2 + 1e-9);
    assert.equal((grid.width - 97) % 2, 0);
    assert.equal((grid.height - 88) % 2, 0);
  }
});

test('every frame-edge cell participates in evolution', () => {
  const world = createFrameWorld(seed(), 1200, 600);
  const cells = evolve(world.cells, world.width, world.height, 0x1ff, 0x1ff);
  assert.equal(population(cells), world.width * world.height);
  assert.deepEqual(boundsOf(cells, world.width, world.height), { left: 0, top: 0, right: world.width, bottom: world.height });
  assert.ok([cells[0], cells[world.width - 1], cells[cells.length - world.width], cells[cells.length - 1]].every(Boolean));
});

test('panning at 100% or closer cannot expose an area outside the simulated world', () => {
  for (const zoom of [1, 1.2, 3]) {
    const view = frameViewBox(16, 8, 1200, 600, { zoom, panX: 999, panY: -999 });
    assert.ok(view.x >= 0 && view.y >= 0);
    assert.ok(view.x + view.width <= 16 && view.y + view.height <= 8);
  }
});

test('oversized frame grids are rejected before allocation', () => {
  assert.throws(() => frameGridDimensions(250, 250, 10000, 100), /Increase Cells size/);
});

test('resize worker replays the rule history in the expanded world, including its edges', async () => {
  globalThis.self = globalThis;
  const messages = [];
  globalThis.postMessage = (message) => messages.push(message);
  await import('../src/world-worker.js');
  const world = createFrameWorld(seed(), 1200, 600);
  globalThis.onmessage({ data: { ...world, history: [[0, 0], [1, 0]] } });
  assert.equal(messages.length, 1);
  assert.equal(population(messages[0].cells), world.width * world.height);
});
