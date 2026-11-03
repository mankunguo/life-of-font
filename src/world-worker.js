import { evolve } from './engine.js';

// Rebuild a resized world's actual history without blocking the interface.
self.onmessage = ({ data }) => {
  try {
    const { width, height, history } = data;
    let cells = data.cells;
    let scratch = new Uint8Array(cells.length);
    for (const [birth, survive] of history) {
      const next = evolve(cells, width, height, birth, survive, scratch);
      scratch = cells;
      cells = next;
    }
    self.postMessage({ cells }, [cells.buffer]);
  } catch (error) { self.postMessage({ error: error.message }); }
};
