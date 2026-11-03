import { MAX_CELLS } from './sampling.js';

/** Match the frame with extra cells, keeping the source centered on whole cells. */
export function frameGridDimensions(seedWidth, seedHeight, frameWidth, frameHeight, maxCells = MAX_CELLS) {
  if (![seedWidth, seedHeight, frameWidth, frameHeight].every((n) => Number.isFinite(n) && n > 0)
    || !Number.isInteger(seedWidth) || !Number.isInteger(seedHeight)) {
    throw new Error('Grid and frame dimensions must be positive.');
  }
  const pitch = Math.min(frameWidth / seedWidth, frameHeight / seedHeight);
  // Add cells in pairs so resizing never shifts the seed by half a cell.
  const extend = (original, needed) => original + 2 * Math.ceil(Math.max(0, needed - original) / 2 - 1e-9);
  const width = extend(seedWidth, frameWidth / pitch);
  const height = extend(seedHeight, frameHeight / pitch);
  if (width * height > maxCells) {
    throw new Error('This text and frame need more cells. Increase Cells size or use fewer characters.');
  }
  return { width, height };
}

export function createFrameWorld(seed, frameWidth, frameHeight) {
  const { width, height } = frameGridDimensions(seed.width, seed.height, frameWidth, frameHeight);
  if (seed.cells.length !== seed.width * seed.height) throw new Error('Invalid source grid.');
  const offsetX = (width - seed.width) / 2;
  const offsetY = (height - seed.height) / 2;
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < seed.height; y++) {
    cells.set(seed.cells.subarray(y * seed.width, (y + 1) * seed.width), (y + offsetY) * width + offsetX);
  }
  return { ...seed, cells, width, height,
    originX: (seed.originX ?? 0) + offsetX, originY: (seed.originY ?? 0) + offsetY };
}

/** Uniform scale and a frame-shaped viewBox: no letterboxing or stretched cells. */
export function frameViewBox(gridWidth, gridHeight, frameWidth, frameHeight, { zoom = 1, panX = 0, panY = 0 } = {}) {
  const scale = Math.max(frameWidth / gridWidth, frameHeight / gridHeight) * zoom;
  const width = frameWidth / scale;
  const height = frameHeight / scale;
  if (zoom >= 1) {
    const limitX = Math.max(0, (gridWidth - width) / 2);
    const limitY = Math.max(0, (gridHeight - height) / 2);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
  }
  return { x: (gridWidth - width) / 2 + panX, y: (gridHeight - height) / 2 + panY,
    width, height, scale, panX, panY };
}
