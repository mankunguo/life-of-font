export const SAMPLE_EM = 600;
export const PADDING = 18;
export const MAX_CELLS = 250_000;
const SUPERSAMPLE = 4;

/** Canvas only measures and samples the input. All visible/exported cells are paths. */
export function sampleText(text, { family, weight = 400, cellSize }) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${weight} ${SAMPLE_EM}px "${family}"`;
  const metrics = measure.measureText(text);
  const left = Math.floor(-metrics.actualBoundingBoxLeft / cellSize) - PADDING;
  const right = Math.ceil(Math.max(metrics.width, metrics.actualBoundingBoxRight) / cellSize) + PADDING;
  const top = Math.floor(-metrics.actualBoundingBoxAscent / cellSize) - PADDING;
  const bottom = Math.ceil(metrics.actualBoundingBoxDescent / cellSize) + PADDING;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  if (width * height > MAX_CELLS) {
    throw new Error('This text needs a larger cell size. Try 8 px or more, or use fewer characters.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * SUPERSAMPLE;
  canvas.height = height * SUPERSAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = SUPERSAMPLE / cellSize;
  ctx.setTransform(scale, 0, 0, scale, -left * SUPERSAMPLE, -top * SUPERSAMPLE);
  ctx.font = measure.font;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 0, 0);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alpha = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          alpha += data[((y * SUPERSAMPLE + sy) * canvas.width + x * SUPERSAMPLE + sx) * 4 + 3];
        }
      }
      cells[y * width + x] = alpha / (SUPERSAMPLE ** 2 * 255) >= 0.30 ? 1 : 0;
    }
  }
  return { cells, width, height, originX: -left, originY: -top, advance: metrics.width / cellSize };
}
