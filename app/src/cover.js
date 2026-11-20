// Vice Panels Deluxe — the cover renderer.
//
// One function, drawCover, paints a whole cover onto any 2D context at any
// size, so the on-screen preview and the exported PNG are the same drawing.
// A cover is: a black poster frame, a grid of photo panels (each with its own
// crop, pan and zoom), a Vice City colour grade, an optional vignette and
// film grain, then the caption — heavy condensed lettering with a black
// outline and a hard shadow — and a starburst sticker badge.

import { panelRects, frameMetrics } from './layouts.js';

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.03)',
    // [stop, colour] pairs for a top-to-bottom wash over each panel.
    wash: [
      [0, 'rgba(26, 8, 56, 0.30)'],
      [0.45, 'rgba(255, 94, 58, 0.02)'],
      [1, 'rgba(255, 64, 120, 0.32)'],
    ],
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.5) contrast(1.16) brightness(1.0) hue-rotate(-8deg)',
    wash: [
      [0, 'rgba(0, 229, 255, 0.16)'],
      [0.55, 'rgba(20, 0, 40, 0.05)'],
      [1, 'rgba(255, 0, 128, 0.24)'],
    ],
  },
  golden: {
    label: 'Golden Hour',
    filter: 'sepia(0.32) saturate(1.25) contrast(1.05) brightness(1.06)',
    wash: [
      [0, 'rgba(255, 176, 64, 0.14)'],
      [1, 'rgba(122, 52, 0, 0.22)'],
    ],
  },
  clean: {
    label: 'Clean',
    filter: 'none',
    wash: [],
  },
};

export const TITLE_COLORS = {
  white: '#ffffff',
  pink: '#ff5da2',
  yellow: '#ffd23e',
  cyan: '#3ee6ff',
};

const DISPLAY_FONT = "'Anton', 'Arial Black', 'Impact', sans-serif";
const FALLBACK_BG = ['#241038', '#471647'];

// A small tile of random grey noise, generated once and reused as a pattern
// for the film-grain pass.
let noiseCanvas = null;
function getNoiseCanvas() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 140;
  noiseCanvas.height = 140;
  const nctx = noiseCanvas.getContext('2d');
  const data = nctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 96);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

/** A fresh per-panel editing state. */
export function makePanel() {
  return { img: null, zoom: 1, ox: 0, oy: 0, mode: 'fill' };
}

function drawPanelPhoto(ctx, img, rect, panel, filter) {
  const { x, y, w, h } = rect;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const base = panel.mode === 'fit' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const s = base * panel.zoom;
  const dw = iw * s;
  const dh = ih * s;
  const cx = x + w / 2 + panel.ox * w;
  const cy = y + h / 2 + panel.oy * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawPanelPlaceholder(ctx, rect, index) {
  const { x, y, w, h } = rect;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, FALLBACK_BG[0]);
  grad.addColorStop(1, FALLBACK_BG[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  const size = Math.min(w, h) * 0.11;
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2 - size * 0.4);
  ctx.font = `${size * 0.7}px ${DISPLAY_FONT}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillText(`PANEL ${index + 1}`, x + w / 2, y + h / 2 + size * 0.6);
  ctx.textBaseline = 'alphabetic';
}

function applyGradeWash(ctx, rect, grade, panelIndex) {
  if (!grade.wash.length) return;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  // Alternate panels lean a touch harder into the wash, like the mixed
  // grades across a printed poster grid.
  const boost = panelIndex % 2 === 1 ? 1.18 : 1;
  for (const [stop, colour] of grade.wash) {
    grad.addColorStop(stop, boost === 1 ? colour : boostAlpha(colour, boost));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function boostAlpha(rgba, factor) {
  const m = rgba.match(/rgba\(([^)]+)\)/);
  if (!m) return rgba;
  const parts = m[1].split(',').map((p) => p.trim());
  const a = Math.min(1, parseFloat(parts[3]) * factor);
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
}

function applyVignette(ctx, w, h) {
  const r = Math.max(w, h) * 0.78;
  const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function applyGrain(ctx, w, h) {
  const pattern = ctx.createPattern(getNoiseCanvas(), 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Fits a font size for `text` so it spans at most maxWidth. Returns the size. */
function fitFontSize(ctx, text, baseSize, maxWidth, family) {
  let size = baseSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size *= 0.94;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

function drawTitleLine(ctx, text, cx, baselineY, baseSize, maxWidth, color) {
  const size = fitFontSize(ctx, text, baseSize, maxWidth, DISPLAY_FONT);
  ctx.save();
  ctx.translate(cx, baselineY);
  ctx.transform(1, 0, -0.07, 1, 0, 0); // a slight italic lean
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // Hard offset shadow first, then the black outline, then the face.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText(text, size * 0.05, size * 0.055);
  ctx.strokeStyle = '#0a0a0c';
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return size;
}

function drawSticker(ctx, text, cx, cy, radius, color) {
  const spikes = 18;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.84;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = radius * 0.07;
  ctx.strokeStyle = '#0a0a0c';
  ctx.lineJoin = 'round';
  ctx.stroke();
  const size = fitFontSize(ctx, text, radius * 0.52, radius * 1.5, DISPLAY_FONT);
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0a0a0c';
  ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}

function drawCaption(ctx, w, h, caption) {
  const line1 = (caption.line1 || '').trim().toUpperCase();
  const line2 = (caption.line2 || '').trim().toUpperCase();
  const sub = (caption.sub || '').trim().toUpperCase();
  const color = TITLE_COLORS[caption.color] ?? TITLE_COLORS.white;
  const baseSize = h * 0.115 * (caption.scale || 1);
  const maxWidth = w * 0.92;
  const atBottom = caption.pos !== 'top';

  // A soft scrim behind the words so they read over bright photos.
  const scrimH = h * 0.42;
  const grad = ctx.createLinearGradient(0, atBottom ? h - scrimH : 0, 0, atBottom ? h : scrimH);
  if (atBottom) {
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  } else {
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, atBottom ? h - scrimH : 0, w, scrimH);

  const lines = [line1, line2].filter(Boolean);
  const lineGap = baseSize * 1.04;
  const subSize = baseSize * 0.34;
  const margin = h * 0.045;
  // Baselines are laid out from the block's anchor edge: at the bottom the
  // subtitle's descent lands exactly on the margin, at the top the first
  // line's cap starts at the margin.
  let firstBaseline;
  if (atBottom) {
    const lastBaseline = sub
      ? h - margin - subSize * 0.25 - subSize * 1.5 - baseSize * 0.22
      : h - margin - baseSize * 0.22;
    firstBaseline = lastBaseline - Math.max(0, lines.length - 1) * lineGap;
  } else {
    firstBaseline = margin + baseSize * 0.8;
  }
  let usedSize = baseSize;
  lines.forEach((line, i) => {
    usedSize = drawTitleLine(ctx, line, w / 2, firstBaseline + i * lineGap, baseSize, maxWidth, color);
  });
  if (sub) {
    ctx.save();
    try {
      ctx.letterSpacing = `${subSize * 0.32}px`;
    } catch {
      /* older engines: the subtitle just sits tighter */
    }
    ctx.font = `${subSize}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const subY = firstBaseline + Math.max(0, lines.length - 1) * lineGap + subSize * 1.5 + usedSize * 0.22;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(sub, w / 2 + subSize * 0.05, subY + subSize * 0.06);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, w / 2, subY);
    ctx.restore();
  }

  const sticker = (caption.sticker || '').trim().toUpperCase();
  if (sticker) {
    const r = Math.min(w, h) * 0.105;
    const sx = w - r - w * 0.035;
    const sy = atBottom ? r + h * 0.035 : h - r - h * 0.035;
    drawSticker(ctx, sticker, sx, sy, r, TITLE_COLORS[caption.color] ?? TITLE_COLORS.yellow);
  }
}

/**
 * Paints the whole cover described by `state` onto the canvas.
 * state: { layout, panels, grade, vignette, grain, caption }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const { frame, gutter } = frameMetrics(w, h);
  const rects = panelRects(state.layout, w, h, frame, gutter);

  ctx.fillStyle = '#060607';
  ctx.fillRect(0, 0, w, h);

  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    // Panel bed: the placeholder gradient shows through fit-mode letterbox.
    drawPanelPlaceholder(ctx, rect, i);
    if (panel && panel.img) drawPanelPhoto(ctx, panel.img, rect, panel, grade.filter);
    applyGradeWash(ctx, rect, grade, i);
  });

  if (state.vignette) applyVignette(ctx, w, h);
  if (state.grain) applyGrain(ctx, w, h);
  drawCaption(ctx, w, h, state.caption);

  // The poster's outer edge: a hairline of light inside the black frame.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = Math.max(1, frame * 0.08);
  ctx.strokeRect(frame / 2, frame / 2, w - frame, h - frame);
}

/** Pixel rects of the current layout, for hit-testing in the editor. */
export function currentRects(canvas, layoutKey) {
  const { frame, gutter } = frameMetrics(canvas.width, canvas.height);
  return panelRects(layoutKey, canvas.width, canvas.height, frame, gutter);
}
