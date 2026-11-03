import { rectangles, boundsOf } from './engine.js';

export const escapeXML = (value) => String(value).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const number = (n) => Number(n.toFixed(3));

export function cellPath(cells, width, height, gap = 0.12) {
  const parts = [];
  for (const r of rectangles(cells, width, height, gap)) {
    parts.push(`M${number(r.x)} ${number(r.y)}h${number(r.width)}v${number(r.height)}h-${number(r.width)}Z`);
  }
  return parts.join('');
}

export function svgDocument({ cells, width, height, text, fontName, generation, rule, cellSize, gap, crop = true }) {
  const bounds = crop ? boundsOf(cells, width, height) : null;
  const box = bounds
    ? [bounds.left - 2, bounds.top - 2, bounds.right - bounds.left + 4, bounds.bottom - bounds.top + 4]
    : [0, 0, width, height];
  const metadata = { project: 'Life of Font', text, sourceFont: fontName, generation, rule, cellSize, cellGap: gap,
    world: { width, height }, boundary: 'finite, outside cells dead' };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${number(box[2] * cellSize)}" height="${number(box[3] * cellSize)}">\n<title>${escapeXML(text)} — generation ${generation}</title>\n<desc>Life of Font. Self-contained vector paths; no embedded bitmap or font dependency.</desc>\n<metadata>${escapeXML(JSON.stringify(metadata))}</metadata>\n<path fill="#000000" d="${cellPath(cells, width, height, gap)}"/>\n</svg>\n`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
