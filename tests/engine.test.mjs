import test from 'node:test';
import assert from 'node:assert/strict';
import { evolve, maskFor, population, boundsOf, rectangles } from '../src/engine.js';
import { svgDocument } from '../src/vector.js';

const grid = (rows) => Uint8Array.from(rows.join('').split('').map(Number));
const life = (cells, width, height) => evolve(cells, width, height, maskFor([3]), maskFor([2, 3]));

test('Conway blinker rotates and returns to its original state in two steps', () => {
  const seed = grid(['00000', '00100', '00100', '00100', '00000']);
  const next = life(seed, 5, 5);
  assert.deepEqual(next, grid(['00000', '00000', '01110', '00000', '00000']));
  assert.deepEqual(life(next, 5, 5), seed);
  assert.equal(population(next), 3);
});

test('a still life stays stable, and evolution does not mutate the input', () => {
  const seed = grid(['0000', '0110', '0110', '0000']);
  const copy = seed.slice();
  assert.deepEqual(life(seed, 4, 4), seed);
  assert.deepEqual(seed, copy);
});

test('edges do not wrap and B0 can revive an empty world including the boundary', () => {
  const seed = grid(['10000', '00000', '00000', '00000', '10001']);
  assert.equal(population(life(seed, 5, 5)), 0);
  const born = evolve(new Uint8Array(9), 3, 3, maskFor([0]), 0);
  assert.equal(population(born), 9);
  assert.equal(population(evolve(born, 3, 3, maskFor([0]), 0)), 0);
});

test('vector run merging covers exactly the live-cell area and preserves gaps', () => {
  const cells = grid(['1110', '1010']);
  const runs = [...rectangles(cells, 4, 2, 0)];
  assert.equal(runs.length, 3);
  assert.equal(runs.reduce((area, r) => area + r.width * r.height, 0), 5);
  assert.equal([...rectangles(cells, 4, 2, .12)].length, 5);
  assert.deepEqual(boundsOf(cells, 4, 2), { left: 0, top: 0, right: 3, bottom: 2 });
  assert.equal(boundsOf(new Uint8Array(8), 4, 2), null);
});

test('SVG export is self-contained geometry, transparent and XML escaped', () => {
  const svg = svgDocument({ cells: grid(['10', '01']), width: 2, height: 2,
    text: '<M&"', fontName: 'Example', generation: 2, rule: 'B3/S23', cellSize: 8, gap: .12 });
  assert.match(svg, /<path fill="#000000" d="M/);
  assert.match(svg, /&lt;M&amp;&quot;/);
  assert.match(svg, /viewBox="-2 -2 6 6"/);
  assert.doesNotMatch(svg, /<(image|text|foreignObject|rect)\b/);
  assert.doesNotMatch(svg, /data:image|<script|font-family/);
});

test('invalid in-place evolution is rejected', () => {
  const seed = new Uint8Array(9);
  assert.throws(() => evolve(seed, 3, 3, 0, 0, seed));
});
