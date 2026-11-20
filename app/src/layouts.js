// Vice Panels Deluxe — panel layouts for the cover maker.
//
// Each layout is a list of panel rectangles in fractions of the whole cover
// ([x, y, width, height], all 0..1). The renderer insets every panel by the
// gutter, which is what gives the cover its thick black poster grid. Layouts
// are pure data so the editor, the exporter and the screenshot scenes all
// agree on the geometry.

export const LAYOUTS = {
  poster5: {
    label: 'Poster Five',
    blurb: 'One tall hero panel and a four-panel stack — the classic box-art grid.',
    panels: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.25, 0.5],
      [0.75, 0, 0.25, 0.5],
      [0.5, 0.5, 0.25, 0.5],
      [0.75, 0.5, 0.25, 0.5],
    ],
  },
  triptych: {
    label: 'Triptych',
    blurb: 'Three tall panels side by side.',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  mosaic6: {
    label: 'Mosaic Six',
    blurb: 'A six-panel mosaic, three across and two down.',
    panels: [
      [0, 0, 1 / 3, 0.5],
      [1 / 3, 0, 1 / 3, 0.5],
      [2 / 3, 0, 1 / 3, 0.5],
      [0, 0.5, 1 / 3, 0.5],
      [1 / 3, 0.5, 1 / 3, 0.5],
      [2 / 3, 0.5, 1 / 3, 0.5],
    ],
  },
  duo: {
    label: 'Duo Split',
    blurb: 'Two big panels — one scene, one portrait.',
    panels: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 1],
    ],
  },
};

/** The layout object for a key, falling back to Poster Five. */
export function layoutFor(key) {
  return LAYOUTS[key] ?? LAYOUTS.poster5;
}

/**
 * Pixel rectangles for a layout on a w x h cover. `frame` is the outer black
 * border and `gutter` the black gap between panels; both are in pixels.
 */
export function panelRects(key, w, h, frame, gutter) {
  const innerW = w - frame * 2;
  const innerH = h - frame * 2;
  return layoutFor(key).panels.map(([fx, fy, fw, fh]) => {
    const x = frame + fx * innerW;
    const y = frame + fy * innerH;
    const pw = fw * innerW;
    const ph = fh * innerH;
    return {
      x: x + (fx > 0 ? gutter / 2 : 0),
      y: y + (fy > 0 ? gutter / 2 : 0),
      w: pw - (fw < 1 ? gutter / 2 : 0) - (fx > 0 ? gutter / 2 : 0),
      h: ph - (fh < 1 ? gutter / 2 : 0) - (fy > 0 ? gutter / 2 : 0),
    };
  });
}

/** Frame and gutter thicknesses that scale with the cover's short side. */
export function frameMetrics(w, h) {
  const short = Math.min(w, h);
  return { frame: Math.max(8, Math.round(short * 0.016)), gutter: Math.max(6, Math.round(short * 0.012)) };
}
