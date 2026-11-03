import '../vendor/opentype.min.js';
import { evolve, rectangles, boundsOf } from './engine.js';
import { SAMPLE_EM } from './sampling.js';

// Font construction and rule replay run away from the UI thread.
self.onmessage = ({ data }) => {
  try {
    const { seeds, familyName, cellSize, gap, history, generation } = data;
    const { Font, Glyph, Path } = self.opentype;
    const unit = cellSize * 1000 / SAMPLE_EM;
    const glyphs = [new Glyph({ name: '.notdef', advanceWidth: 600, path: new Path() })];
    let ascender = 1000, descender = -250;
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      let cells = seed.cells;
      let buffer = new Uint8Array(cells.length);
      const blank = /^\s$/u.test(seed.character);
      if (!blank) {
        for (const [birth, survive] of history) {
          const next = evolve(cells, seed.width, seed.height, birth, survive, buffer);
          buffer = cells; cells = next;
        }
      }
      const path = new Path();
      if (!blank) {
        for (const r of rectangles(cells, seed.width, seed.height, gap)) {
          const left = Math.round((r.x - seed.originX) * unit);
          const right = Math.round((r.x + r.width - seed.originX) * unit);
          const top = Math.round((seed.originY - r.y) * unit);
          const bottom = Math.round((seed.originY - r.y - r.height) * unit);
          path.moveTo(left, bottom); path.lineTo(right, bottom);
          path.lineTo(right, top); path.lineTo(left, top); path.close();
        }
        const bounds = boundsOf(cells, seed.width, seed.height);
        if (bounds) {
          ascender = Math.max(ascender, Math.ceil((seed.originY - bounds.top) * unit));
          descender = Math.min(descender, Math.floor((seed.originY - bounds.bottom) * unit));
        }
      }
      const codepoint = seed.character.codePointAt(0);
      glyphs.push(new Glyph({ name: codepoint === 32 ? 'space' : `uni${codepoint.toString(16).toUpperCase().padStart(4, '0')}`,
        unicode: codepoint, advanceWidth: Math.max(1, Math.round(seed.advance * unit)), path }));
      self.postMessage({ type: 'progress', done: i + 1, total: seeds.length });
    }
    // CFF/PostScript names use ASCII, while the family display name preserves Unicode.
    const postScriptName = (familyName.replace(/[^a-zA-Z0-9-]/g, '') || 'LifeOfFont').slice(0, 50) + '-Regular';
    const font = new Font({ familyName, styleName: 'Regular', unitsPerEm: 1000, ascender, descender, glyphs });
    font.names.postScriptName = { en: postScriptName };
    font.names.description = { en: `Life of Font. Generation ${generation}. Cell size ${cellSize}. Each character evolved independently; vector outlines.` };
    const buffer = font.toArrayBuffer();
    self.postMessage({ type: 'complete', buffer, glyphCount: seeds.length }, [buffer]);
  } catch (error) { self.postMessage({ type: 'error', message: `Font export failed: ${error.message}` }); }
};
