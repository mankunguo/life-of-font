import { DEMO_RULE, evolve, maskFor, population, ruleName } from './engine.js';
import { sampleText } from './sampling.js';
import { cellPath, svgDocument, downloadBlob } from './vector.js';
import { createFrameWorld, frameGridDimensions, frameViewBox } from './world.js';

const $ = (id) => document.getElementById(id);
const LOAD_LOCAL_FONTS = true;
const fonts = new Map([
  ['archivo', { label: 'Archivo Black', family: 'Archivo Black', weight: 400 }],
  ['fira', { label: 'Fira Code', family: 'Fira Code', weight: 500 }],
]);
let localFontIds = [];
let importCounter = 0;
let generationRequest = 0;

const state = {
  grid: null, seedSource: null, scratch: null, specimen: null,
  generation: 0, running: false,
  birth: new Set(DEMO_RULE.birth), survive: new Set(DEMO_RULE.survive),
  gap: 0.12, gridVisible: false, zoom: 1, panX: 0, panY: 0,
  ruleHistory: [], lastTime: 0, frame: 0, toastTimer: null,
  exporting: false, exportJob: 0, worker: null,
  reframing: false, frameJob: 0, frameWorker: null, frameTarget: null, pendingFrameResize: false,
};

function toast(message, duration = 4500) {
  clearTimeout(state.toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  state.toastTimer = setTimeout(() => { $('toast').hidden = true; }, duration);
}

function closeExportMenu() {
  $('exportMenu').hidden = true;
  $('exportButton').setAttribute('aria-expanded', 'false');
}

function closeDropdowns(except = null) {
  for (const dropdown of document.querySelectorAll('[data-dropdown]')) {
    if (dropdown === except) continue;
    dropdown.querySelector('.dropdown-menu').hidden = true;
    dropdown.querySelector('.dropdown-trigger').setAttribute('aria-expanded', 'false');
  }
}

function syncDropdown(selectId) {
  const select = $(selectId);
  const dropdown = select.closest('[data-dropdown]');
  const list = dropdown.querySelector('[role="listbox"]');
  const selected = select.options[select.selectedIndex];
  dropdown.querySelector('.dropdown-value').textContent = selected?.textContent || '−';
  list.replaceChildren();
  const options = [...select.options].filter((option) => selectId !== 'fontSelect' || !localFontIds.length || localFontIds.includes(option.value) || option.value.startsWith('import-'));
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dropdown-option';
    button.role = 'option';
    button.tabIndex = -1;
    button.textContent = option.textContent;
    button.dataset.value = option.value;
    button.setAttribute('aria-selected', option.selected);
    button.addEventListener('click', () => {
      select.value = option.value;
      syncDropdown(selectId);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeDropdowns();
      dropdown.querySelector('.dropdown-trigger').focus();
    });
    list.append(button);
  }
}

for (const dropdown of document.querySelectorAll('[data-dropdown]')) {
  const trigger = dropdown.querySelector('.dropdown-trigger');
  const menu = dropdown.querySelector('.dropdown-menu');
  const selectId = dropdown.dataset.dropdown;
  syncDropdown(selectId);
  function openMenu(focus = false) {
    closeExportMenu(); closeDropdowns(dropdown);
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) (menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]'))?.focus();
  }
  trigger.addEventListener('click', () => {
    if (menu.hidden) openMenu(); else closeDropdowns();
  });
  dropdown.addEventListener('keydown', (event) => {
    const options = [...menu.querySelectorAll('[role="option"], .import-font')];
    const index = options.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (menu.hidden) { openMenu(true); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeDropdowns(); trigger.focus();
    } else if (event.key === 'Tab') {
      closeDropdowns();
    } else if (!menu.hidden && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const match = options.find((option) => option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match) { event.preventDefault(); match.focus(); }
    }
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-dropdown]')) closeDropdowns();
  if (!event.target.closest('.export-wrap')) closeExportMenu();
});

function setRunning(running) {
  state.running = !!running && !!state.grid && !state.exporting;
  state.lastTime = 0; state.frame = 0;
  $('playButton').textContent = state.running ? 'Pause' : 'Play';
  $('playButton').setAttribute('aria-label', state.running ? 'Pause evolution' : 'Play evolution');
}

for (const [id, values, verb] of [['bornRow', state.birth, 'Birth'], ['aliveRow', state.survive, 'Survive']]) {
  for (let n = 0; n <= 8; n++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = n;
    button.setAttribute('aria-label', `${verb} with ${n} living neighbors`);
    button.setAttribute('aria-pressed', values.has(n));
    button.addEventListener('click', () => {
      if (values.has(n)) values.delete(n); else values.add(n);
      button.setAttribute('aria-pressed', values.has(n));
    });
    $(id).append(button);
  }
}

function viewportSize() {
  const { width, height } = $('viewport').getBoundingClientRect();
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function updateViewBox() {
  if (!state.grid) return;
  const frame = viewportSize();
  const view = frameViewBox(state.grid.width, state.grid.height, frame.width, frame.height, state);
  state.panX = view.panX; state.panY = view.panY;
  $('specimen').setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  $('fitButton').textContent = `${Math.round(state.zoom * 100)}%`;
}

function cancelFrameUpdate() {
  state.frameJob++;
  state.frameWorker?.terminate();
  state.frameWorker = null; state.frameTarget = null;
  state.reframing = false;
  $('stepButton').disabled = state.exporting;
  $('exportButton').disabled = state.exporting;
}

function applyFrameWorld(world, cells = world.cells) {
  state.grid = { ...world, cells };
  state.scratch = new Uint8Array(cells.length);
  state.lastTime = 0; state.frame = 0;
  updateViewBox(); render();
}

function resizeWorldToFrame() {
  if (!state.seedSource) return;
  updateViewBox();
  if (state.exporting) { state.pendingFrameResize = true; return; }
  const frame = viewportSize();
  try {
    const target = frameGridDimensions(state.seedSource.width, state.seedSource.height, frame.width, frame.height);
    if (target.width === state.grid.width && target.height === state.grid.height) { cancelFrameUpdate(); return; }
    if (state.reframing && target.width === state.frameTarget.width && target.height === state.frameTarget.height) return;
    cancelFrameUpdate();
    const world = createFrameWorld(state.seedSource, frame.width, frame.height);
    if (state.generation === 0) { applyFrameWorld(world); return; }
    closeExportMenu();
    const job = ++state.frameJob;
    const worker = new Worker(new URL('./world-worker.js', import.meta.url), { type: 'module' });
    state.frameWorker = worker; state.frameTarget = target; state.reframing = true;
    $('stepButton').disabled = true;
    $('exportButton').disabled = true;
    worker.onmessage = ({ data }) => {
      if (job !== state.frameJob) return;
      cancelFrameUpdate();
      if (data.error) { toast(data.error, 7000); return; }
      applyFrameWorld(world, data.cells);
    };
    worker.onerror = () => {
      if (job !== state.frameJob) return;
      cancelFrameUpdate(); toast('Could not update the grid for this frame. Press Generate to try again.');
    };
    worker.postMessage({ cells: world.cells, width: world.width, height: world.height,
      history: state.ruleHistory.map((rule) => [...rule]) });
  } catch (error) { cancelFrameUpdate(); toast(error.message, 7000); }
}

let resizeTick = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(resizeTick);
  resizeTick = requestAnimationFrame(resizeWorldToFrame);
}).observe($('viewport'));

function fit() {
  state.zoom = 1; state.panX = 0; state.panY = 0;
  updateViewBox();
}

function render() {
  if (!state.grid) return;
  const { cells, width, height } = state.grid;
  const alive = population(cells);
  $('cellArtwork').setAttribute('d', cellPath(cells, width, height, state.gap));
  $('generation').value = state.generation;
  $('generation').textContent = state.generation.toLocaleString('en-US');
  $('emptyState').hidden = alive > 0;
  $('specimen').setAttribute('aria-label', `${state.specimen.text}, generation ${state.generation}, ${alive} living cells, vector paths`);
  $('gridOverlay').setAttribute('width', width);
  $('gridOverlay').setAttribute('height', height);
}

async function generate() {
  if (state.exporting || !$('inputForm').reportValidity()) return;
  const text = $('textInput').value;
  if (!text.trim()) { toast('Enter at least one visible character.'); $('textInput').focus(); return; }
  const cellSize = Number($('cellSize').value);
  const font = fonts.get($('fontSelect').value);
  const request = ++generationRequest;
  setRunning(false);
  try {
    await document.fonts.load(`${font.weight} 24px "${font.family}"`);
    if (request !== generationRequest) return;
    const seed = sampleText(text, { ...font, cellSize });
    if (!population(seed.cells)) throw new Error('No visible cells. Try another font or a smaller cell size.');
    const frame = viewportSize();
    const grid = createFrameWorld(seed, frame.width, frame.height);
    cancelFrameUpdate();
    state.seedSource = seed;
    state.specimen = { text, font: { ...font }, cellSize };
    state.generation = 0; state.ruleHistory = [];
    $('loadingState').hidden = true;
    applyFrameWorld(grid); fit();
  } catch (error) {
    $('loadingState').hidden = true;
    toast(error.message, 7000);
  }
}

function advance() {
  if (!state.grid || state.exporting || state.reframing) return;
  if (state.generation >= 2000) {
    setRunning(false); toast('2,000 generations reached. Export or reset to start again.'); return;
  }
  const birthMask = maskFor([...state.birth]);
  const surviveMask = maskFor([...state.survive]);
  const previous = state.grid.cells;
  state.grid.cells = evolve(previous, state.grid.width, state.grid.height, birthMask, surviveMask, state.scratch);
  state.scratch = previous;
  state.ruleHistory.push([birthMask, surviveMask]);
  state.generation++;
  render();
  if (!population(state.grid.cells) && !state.birth.has(0)) setRunning(false);
}

function reset() {
  if (!state.seedSource || state.exporting) return;
  try {
    const frame = viewportSize();
    const world = createFrameWorld(state.seedSource, frame.width, frame.height);
    cancelFrameUpdate(); setRunning(false);
    state.generation = 0; state.ruleHistory = [];
    applyFrameWorld(world);
  } catch (error) { toast(error.message, 7000); }
}

function loop(time) {
  if (state.running && !state.reframing && !document.hidden) {
    const interval = 1000 / Number($('speed').value);
    if (!state.lastTime) state.lastTime = time;
    const elapsed = time - state.lastTime;
    if (elapsed >= interval) {
      state.lastTime = time - (elapsed % interval);
      state.frame++;
      if (state.frame >= Number($('stepGap').value)) { state.frame = 0; advance(); }
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

$('inputForm').addEventListener('submit', (event) => { event.preventDefault(); generate(); });
$('playButton').addEventListener('click', () => setRunning(!state.running));
$('stepButton').addEventListener('click', () => { setRunning(false); advance(); });
$('resetButton').addEventListener('click', reset);
for (const id of ['stepGap', 'speed']) $(id).addEventListener('change', () => { state.lastTime = 0; state.frame = 0; });
document.addEventListener('visibilitychange', () => { state.lastTime = 0; state.frame = 0; });

function setAppearance(gap) {
  state.gap = gap;
  $('cellsView').setAttribute('aria-pressed', gap > 0);
  $('solidView').setAttribute('aria-pressed', gap === 0);
  render();
}
$('cellsView').addEventListener('click', () => setAppearance(0.12));
$('solidView').addEventListener('click', () => setAppearance(0));
function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  $('gridButton').setAttribute('aria-pressed', state.gridVisible);
  $('gridButton').setAttribute('aria-label', state.gridVisible ? 'Hide cell grid' : 'Show cell grid');
  $('gridOverlay').setAttribute('visibility', state.gridVisible ? 'visible' : 'hidden');
}
$('gridButton').addEventListener('click', toggleGrid);
function zoomTo(zoom) {
  state.zoom = Math.max(0.2, Math.min(8, zoom));
  updateViewBox();
}
$('zoomIn').addEventListener('click', () => zoomTo(Math.round((state.zoom + 0.2) * 100) / 100));
$('zoomOut').addEventListener('click', () => zoomTo(Math.round((state.zoom - 0.2) * 100) / 100));
$('fitButton').addEventListener('click', fit);
$('viewport').addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomTo(state.zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.003));
}, { passive: false });

let drag = null;
$('viewport').addEventListener('pointerdown', (event) => {
  if (!state.grid || event.button !== 0) return;
  closeDropdowns(); closeExportMenu();
  drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  $('viewport').setPointerCapture(event.pointerId);
  $('viewport').classList.add('dragging');
});
$('viewport').addEventListener('pointermove', (event) => {
  if (!drag) return;
  const bounds = $('viewport').getBoundingClientRect();
  const { scale } = frameViewBox(state.grid.width, state.grid.height, bounds.width, bounds.height, state);
  state.panX = drag.panX - (event.clientX - drag.x) / scale;
  state.panY = drag.panY - (event.clientY - drag.y) / scale;
  updateViewBox();
});
function endDrag() { drag = null; $('viewport').classList.remove('dragging'); }
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('viewport').addEventListener(event, endDrag);

async function addFont(file) {
  if (!/\.(otf|ttf|woff2?)$/i.test(file.name)) throw new Error('Choose an OTF, TTF, WOFF or WOFF2 font file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a font smaller than 25 MB.');
  const family = `ImportedFont${++importCounter}`;
  const face = new FontFace(family, await file.arrayBuffer());
  await face.load(); document.fonts.add(face);
  const id = `import-${importCounter}`;
  const label = file.name.replace(/\.[^.]+$/, '');
  fonts.set(id, { family, label, weight: 400 });
  $('fontSelect').add(new Option(label, id));
  $('fontSelect').value = id;
  syncDropdown('fontSelect');
}
$('importFont').addEventListener('click', () => { closeDropdowns(); $('fontFile').click(); });
$('fontFile').addEventListener('change', async () => {
  let added = 0;
  for (const file of $('fontFile').files) {
    try { await addFont(file); added++; } catch (error) { toast(`${file.name}: ${error.message}`, 7000); }
  }
  if (added) toast(`${added === 1 ? 'Font' : `${added} fonts`} imported. Press Generate to use it.`);
  $('fontFile').value = '';
});

function exportSettings() {
  if (!state.grid) throw new Error('Generate a specimen first.');
  const rules = state.ruleHistory.map(([birth, survive]) => {
    const values = (mask) => Array.from({ length: 9 }, (_, n) => n).filter((n) => mask & (1 << n));
    return ruleName(values(birth), values(survive));
  }).filter((rule, index, all) => index === 0 || rule !== all[index - 1]);
  return { ...state.grid, ...state.specimen, fontName: state.specimen.font.label, generation: state.generation,
    rule: rules.length ? rules.join(' → ') : ruleName(state.birth, state.survive), gap: state.gap, crop: true };
}
const safeFilename = (text) => text.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 35) || 'specimen';
$('exportButton').addEventListener('click', () => {
  closeDropdowns();
  const open = $('exportMenu').hidden;
  $('exportMenu').hidden = !open;
  $('exportButton').setAttribute('aria-expanded', open);
});
$('exportSVG').addEventListener('click', () => {
  setRunning(false); closeExportMenu();
  try {
    downloadBlob(new Blob([svgDocument(exportSettings())], { type: 'image/svg+xml;charset=utf-8' }), `life-of-font-${safeFilename(state.specimen.text)}-step-${state.generation}.svg`);
  } catch (error) { toast(error.message); }
});

function finishFontExport() {
  state.exportJob++;
  state.worker?.terminate(); state.worker = null;
  state.exporting = false;
  for (const id of ['generateButton', 'playButton', 'stepButton', 'resetButton', 'fontTrigger', 'exportButton']) $(id).disabled = false;
  $('exportButton').textContent = 'Export';
  $('exportButton').removeAttribute('aria-busy');
  if (state.pendingFrameResize) { state.pendingFrameResize = false; resizeWorldToFrame(); }
}

$('exportFont').addEventListener('click', async () => {
  closeExportMenu(); closeDropdowns(); setRunning(false);
  if (state.exporting || state.reframing) return;
  if (!state.specimen) { toast('Generate a specimen first.'); return; }
  state.exporting = true;
  const job = ++state.exportJob;
  for (const id of ['generateButton', 'playButton', 'stepButton', 'resetButton', 'fontTrigger', 'exportButton']) $(id).disabled = true;
  $('exportButton').textContent = 'Exporting…';
  $('exportButton').setAttribute('aria-busy', 'true');
  // Capture the displayed generation before sampling so later rule edits cannot alter the export.
  const { text, font, cellSize } = state.specimen;
  const generation = state.generation;
  const gap = state.gap;
  const history = state.ruleHistory.map((rule) => [...rule]);
  try {
    const latin = Array.from({ length: 95 }, (_, n) => String.fromCodePoint(n + 32)).join('');
    const characters = [...new Set([...latin, ...text])].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
    const seeds = [];
    for (let i = 0; i < characters.length; i++) {
      seeds.push({ character: characters[i], ...sampleText(characters[i], { ...font, cellSize }) });
      if (i % 8 === 0) await new Promise(requestAnimationFrame);
      if (!state.exporting || job !== state.exportJob) return;
    }
    const familyName = `Life of Font ${generation}`;
    const worker = new Worker(new URL('./font-worker.js', import.meta.url), { type: 'module' });
    state.worker = worker;
    worker.onmessage = ({ data }) => {
      if (job !== state.exportJob) return;
      if (data.type === 'progress') { $('exportButton').textContent = `${data.done} / ${data.total}`; return; }
      if (data.type === 'error') { finishFontExport(); toast(data.message, 7000); return; }
      if (data.type === 'complete') {
        downloadBlob(new Blob([data.buffer], { type: 'font/otf' }), `${safeFilename(familyName)}.otf`);
        finishFontExport();
      }
    };
    worker.onerror = () => { if (job === state.exportJob) { finishFontExport(); toast('Font export could not complete. Please try again.'); } };
    worker.postMessage({ seeds, familyName, cellSize, gap, history, generation });
  } catch (error) { if (job === state.exportJob) { finishFontExport(); toast(error.message, 7000); } }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeExportMenu(); closeDropdowns();
    if (state.exporting) { finishFontExport(); toast('Font export cancelled.'); }
    return;
  }
  if (event.target.closest('input, textarea, select, [data-dropdown], [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('button, a[href]') && ['Space', 'Enter'].includes(event.code)) return;
  if (event.code === 'Space') { event.preventDefault(); setRunning(!state.running); }
  else if (event.code === 'ArrowRight') { event.preventDefault(); setRunning(false); advance(); }
  else if (event.key.toLowerCase() === 'r') reset();
  else if (event.key.toLowerCase() === 'g') toggleGrid();
  else if (event.key === '0') fit();
  else if (event.key === 'Enter') generate();
});

async function boot() {
  await Promise.all([document.fonts.load('400 24px "Archivo Black"'), document.fonts.load('500 24px "Fira Code"')]);
  if (LOAD_LOCAL_FONTS && ['localhost', '127.0.0.1', '::1'].includes(location.hostname)) {
    const local = [
      { id: 'social', label: 'Social', family: 'LocalSocial', file: 'Social.otf', weight: 700, variable: true },
      { id: 'movio', label: 'Movio', family: 'LocalMovio', file: 'Movio.otf', weight: 400 },
      { id: 'neplus', label: 'Neplus', family: 'LocalNeplus', file: 'Neplus.otf', weight: 400 },
      { id: 'shelley', label: 'Shelley', family: 'LocalShelley', file: 'Shelley.ttf', weight: 400 },
    ];
    const results = await Promise.all(local.map(async (font) => {
      try {
        const face = new FontFace(font.family, `url("${new URL(`../assets/local-fonts/${font.file}`, import.meta.url)}")`, font.variable ? { weight: '100 900' } : {});
        await face.load(); document.fonts.add(face); return font;
      } catch { return null; }
    }));
    for (const font of results.filter(Boolean)) { fonts.set(font.id, font); $('fontSelect').add(new Option(font.label, font.id)); localFontIds.push(font.id); }
    if (fonts.has('social')) $('fontSelect').value = 'social';
    syncDropdown('fontSelect');
  }
  await generate();
}
boot().catch((error) => { $('loadingState').hidden = true; toast(`Could not prepare font: ${error.message}`); });
