/** Finite, dead-boundary, Moore-neighborhood cellular automaton. */
export const DEMO_RULE = { birth: [6, 8], survive: [3, 4, 5, 6, 7] };

export function maskFor(values) {
  return values.reduce((mask, n) => mask | (1 << n), 0);
}

export function ruleName(birth, survive) {
  return `B${[...birth].sort().join('')}/S${[...survive].sort().join('')}`;
}

export function evolve(cells, width, height, birthMask, surviveMask, out = new Uint8Array(cells.length)) {
  if (cells.length !== width * height || out.length !== cells.length || out === cells) {
    throw new Error('Evolution requires distinct, equally sized grid buffers.');
  }
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let neighbors = 0;
      const index = row + x;
      if (y > 0) {
        neighbors += cells[index - width];
        if (x > 0) neighbors += cells[index - width - 1];
        if (x < width - 1) neighbors += cells[index - width + 1];
      }
      if (x > 0) neighbors += cells[index - 1];
      if (x < width - 1) neighbors += cells[index + 1];
      if (y < height - 1) {
        neighbors += cells[index + width];
        if (x > 0) neighbors += cells[index + width - 1];
        if (x < width - 1) neighbors += cells[index + width + 1];
      }
      out[index] = ((cells[index] ? surviveMask : birthMask) >> neighbors) & 1;
    }
  }
  return out;
}

export function population(cells) {
  let count = 0;
  for (let i = 0; i < cells.length; i++) count += cells[i];
  return count;
}

export function boundsOf(cells, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!cells[y * width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1 };
}

/** Horizontal runs reduce the geometry of a solid specimen. */
export function* rectangles(cells, width, height, gap = 0.12) {
  const inset = gap / 2;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (!cells[y * width + x]) { x++; continue; }
      const start = x++;
      if (gap === 0) while (x < width && cells[y * width + x]) x++;
      yield { x: start + inset, y: y + inset, width: x - start - gap, height: 1 - gap };
    }
  }
}
