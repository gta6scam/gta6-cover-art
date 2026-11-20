// Vice Panels Deluxe — the editor.
//
// Owns the cover state, wires every control on the rail to it, and handles
// the direct manipulation on the preview: click a panel to select it, drag
// to pan its photo, scroll to zoom. The preview canvas is kept at the exact
// export resolution, so what you see is byte-for-byte what the PNG holds.
// A `?shot=` query hands over to ./shots.js, which stages fixed scenes for
// the entry's screenshots.

import { drawCover, currentRects, makePanel, GRADES } from './cover.js';
import { LAYOUTS, layoutFor } from './layouts.js';
import { runShot } from './shots.js';

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

const SAMPLES = {
  boulevard: 'samples/boulevard.jpg',
  pier: 'samples/pier.jpg',
};

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const fileInput = document.getElementById('fileInput');

export const state = {
  layout: 'poster5',
  sizeKey: 'wide',
  grade: 'sunset',
  vignette: true,
  grain: true,
  caption: {
    line1: 'VICE CITY',
    line2: 'DREAMS',
    sub: 'my vice story',
    sticker: 'DELUXE EDITION',
    color: 'white',
    scale: 1,
    pos: 'bottom',
  },
  panels: [],
  selected: 0,
};

function panelCount() {
  return layoutFor(state.layout).panels.length;
}

function ensurePanels() {
  while (state.panels.length < 6) state.panels.push(makePanel());
  if (state.selected >= panelCount()) state.selected = 0;
}

export function render() {
  ensurePanels();
  drawCover(canvas, state);
  drawSelection();
}

function drawSelection() {
  if (document.body.classList.contains('shot-cover')) return;
  const rects = currentRects(canvas, state.layout);
  const rect = rects[state.selected];
  if (!rect) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ff5da2';
  ctx.lineWidth = Math.max(3, canvas.width * 0.0035);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const sampleCache = {};
export async function loadSample(name) {
  if (!sampleCache[name]) sampleCache[name] = await loadImage(SAMPLES[name]);
  return sampleCache[name];
}

/** Puts an image into a panel, keeping the panel's crop. */
export function setPanelImage(index, img) {
  ensurePanels();
  state.panels[index].img = img;
  render();
}

/** Resizes the cover (and the canvas) to one of the SIZES keys, or a raw [w, h]. */
export function setSize(keyOrDims) {
  const dims = Array.isArray(keyOrDims) ? keyOrDims : SIZES[keyOrDims];
  if (!dims) return;
  state.sizeKey = Array.isArray(keyOrDims) ? 'custom' : keyOrDims;
  canvas.width = dims[0];
  canvas.height = dims[1];
  syncSeg('sizes', 'size', state.sizeKey);
  render();
}

function setStatus(text) {
  status.textContent = text;
}

/* ---------- segmented controls ---------- */

function buildSeg(containerId, entries, current, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  for (const [value, label] of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.setAttribute('aria-pressed', String(value === current));
    btn.addEventListener('click', () => onPick(value));
    box.appendChild(btn);
  }
}

function syncSeg(containerId, attr, value) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.querySelectorAll('button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset[attr] === value || btn.dataset.value === value));
  });
}

/* ---------- panel controls ---------- */

const panelLabel = document.getElementById('panelLabel');
const zoomInput = document.getElementById('zoom');

function syncPanelControls() {
  const panel = state.panels[state.selected];
  panelLabel.textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
  zoomInput.value = String(Math.round(panel.zoom * 100));
  syncSeg('modes', 'mode', panel.mode);
}

function pickPanel(index) {
  state.selected = index;
  syncPanelControls();
  render();
}

document.getElementById('uploadBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  setPanelImage(state.selected, img);
  setStatus(`Photo placed in panel ${state.selected + 1}. Drag it on the cover to frame it.`);
});

async function assignSample(name, index) {
  const img = await loadSample(name);
  setPanelImage(index, img);
}
document.getElementById('sampleBoulevard').addEventListener('click', () => assignSample('boulevard', state.selected));
document.getElementById('samplePier').addEventListener('click', () => assignSample('pier', state.selected));
async function fillAll(name) {
  const img = await loadSample(name);
  ensurePanels();
  state.panels.forEach((panel) => { panel.img = img; });
  render();
  setStatus(`Every panel now shows the ${name} photo. Swap any panel with your own.`);
}
document.getElementById('fillBoulevard').addEventListener('click', () => fillAll('boulevard'));
document.getElementById('fillPier').addEventListener('click', () => fillAll('pier'));

zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value) / 100;
  render();
});
document.getElementById('modes').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  state.panels[state.selected].mode = btn.dataset.mode;
  syncPanelControls();
  render();
});
document.getElementById('resetPanel').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  syncPanelControls();
  render();
});

/* ---------- direct manipulation on the canvas ---------- */

function pointerToCover(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
  };
}

function panelAt(x, y) {
  const rects = currentRects(canvas, state.layout);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = pointerToCover(e);
  const index = panelAt(x, y);
  if (index === -1) return;
  if (index !== state.selected) pickPanel(index);
  const rects = currentRects(canvas, state.layout);
  const panel = state.panels[index];
  drag = { x, y, ox: panel.ox, oy: panel.oy, rect: rects[index] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = pointerToCover(e);
  const panel = state.panels[state.selected];
  panel.ox = drag.ox + (x - drag.x) / drag.rect.w;
  panel.oy = drag.oy + (y - drag.y) / drag.rect.h;
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.min(6, Math.max(0.25, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  zoomInput.value = String(Math.round(panel.zoom * 100));
  render();
}, { passive: false });

canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const { x, y } = pointerToCover(e);
  const index = panelAt(x, y);
  const target = index === -1 ? state.selected : index;
  const img = await loadImage(URL.createObjectURL(file));
  if (target !== state.selected) pickPanel(target);
  setPanelImage(target, img);
  setStatus(`Photo dropped into panel ${target + 1}.`);
});

/* ---------- layout, grade, caption ---------- */

buildSeg('layouts', Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]), state.layout, (key) => {
  state.layout = key;
  syncSeg('layouts', 'value', key);
  syncPanelControls();
  render();
});
document.getElementById('sizes').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-size]');
  if (btn) setSize(btn.dataset.size);
});
buildSeg('grades', Object.entries(GRADES).map(([k, v]) => [k, v.label]), state.grade, (key) => {
  state.grade = key;
  syncSeg('grades', 'value', key);
  render();
});
document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; render(); });
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; render(); });

const captionBindings = [
  ['capLine1', 'line1'],
  ['capLine2', 'line2'],
  ['capSub', 'sub'],
  ['capSticker', 'sticker'],
];
for (const [id, key] of captionBindings) {
  document.getElementById(id).addEventListener('input', (e) => {
    state.caption[key] = e.target.value;
    render();
  });
}
document.getElementById('colors').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-color]');
  if (!btn) return;
  state.caption.color = btn.dataset.color;
  syncSeg('colors', 'color', state.caption.color);
  render();
});
document.getElementById('capScale').addEventListener('input', (e) => {
  state.caption.scale = Number(e.target.value) / 100;
  render();
});
document.getElementById('positions').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-pos]');
  if (!btn) return;
  state.caption.pos = btn.dataset.pos;
  syncSeg('positions', 'pos', state.caption.pos);
  render();
});

/* ---------- export ---------- */

document.getElementById('exportBtn').addEventListener('click', () => {
  drawCover(canvas, state); // the clean cover, without the selection outline
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-panels-cover-${canvas.width}x${canvas.height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus(`Saved vice-panels-cover-${canvas.width}x${canvas.height}.png`);
    render();
  }, 'image/png');
});

/* ---------- first paint: the demo scene ---------- */

/** The opening scene: boulevard up front, the pier behind it, sunset grade. */
export async function applyDemo() {
  const [boulevard, pier] = await Promise.all([loadSample('boulevard'), loadSample('pier')]);
  ensurePanels();
  state.panels[0].img = boulevard;
  state.panels[0].zoom = 1.05;
  for (let i = 1; i < state.panels.length; i++) {
    state.panels[i].img = pier;
    state.panels[i].zoom = i % 2 === 0 ? 1.12 : 1;
    state.panels[i].oy = i % 2 === 0 ? -0.04 : 0.03;
  }
  render();
}

async function init() {
  ensurePanels();
  syncSeg('sizes', 'size', state.sizeKey);
  syncSeg('colors', 'color', state.caption.color);
  syncSeg('positions', 'pos', state.caption.pos);
  syncPanelControls();
  render();
  try {
    await Promise.race([
      Promise.all([document.fonts.load('100px Anton'), document.fonts.load('40px Anton')]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* the fallback stack still letters the cover */
  }
  await applyDemo();
}

const ready = init();
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), { ready, setSize, state });
}
