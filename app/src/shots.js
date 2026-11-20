// Vice Panels Deluxe — fixed scenes for the entry's screenshots.
//
// ?shot=editor stages the demo scene with the whole editor around it;
// ?shot=cover&size=1920x1080 (or &w=1920&h=1080) shows the exported cover
// alone at that size. window.__shotReady is set once the scene is painted,
// fonts and photos included, so a screenshot never catches a half-loaded app.

function nextFrames(count) {
  return new Promise((resolve) => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });
}

export async function runShot(shot, query, api) {
  await api.ready;
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const named = { '1920x1080': 'wide', '1080x1080': 'square', '1080x1350': 'portrait' };
    const sizeParam = query.get('size');
    const w = Number(query.get('w'));
    const h = Number(query.get('h'));
    if (sizeParam && named[sizeParam]) api.setSize(named[sizeParam]);
    else if (w > 0 && h > 0) api.setSize([w, h]);
    else api.setSize('wide');
  } else {
    api.setSize('wide');
  }
  await nextFrames(3);
  window.__shotReady = true;
}
