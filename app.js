import { CATALOG, CATEGORIES } from './catalog.js';

// ============================================================
// Utilitários
// ============================================================
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('colorir.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('colorir.' + k, JSON.stringify(v)); } catch { } },
};
const MAX_SIDE = 2048;

let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function hideToast() { $('#toast').hidden = true; }

function openSheet(html) {
  $('#sheetCard').innerHTML = html;
  $('#sheet').hidden = false;
  return $('#sheetCard');
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetCard').innerHTML = ''; }
$('#sheet').addEventListener('pointerdown', (e) => { if (e.target.id === 'sheet') closeSheet(); });

function confirmDialog(title, text, okLabel = 'Confirmar', danger = true) {
  return new Promise((res) => {
    const card = openSheet(`<h2>${title}</h2><p>${text}</p><div class="row-end">
      <button class="btn" data-a="no">Cancelar</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${okLabel}</button></div>`);
    card.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      closeSheet(); res(a === 'ok');
    });
  });
}

function canvasToBlob(c, type = 'image/png', q) {
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob falhou')), type, q));
}
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = src; });
}
async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
const toStored = async (blob) => ({ buf: await blob.arrayBuffer(), type: blob.type });
const fromStored = (o) => o ? new Blob([o.buf], { type: o.type }) : null;
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ============================================================
// Armazenamento (IndexedDB, com recurso a memória se indisponível)
// ============================================================
const DB = (() => {
  let dbp = null, ok = true;
  const mem = { works: new Map(), imports: new Map() };
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open('colorir', 1);
        rq.onupgradeneeded = () => {
          const d = rq.result;
          d.createObjectStore('works', { keyPath: 'id' });
          d.createObjectStore('imports', { keyPath: 'id' });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get ok() { return ok; },
    async init() { try { await open(); await tx('works', 'readonly', s => s.count()); } catch { ok = false; } return ok; },
    get: (st, id) => ok ? tx(st, 'readonly', s => s.get(id)) : Promise.resolve(mem[st].get(id)),
    all: (st) => ok ? tx(st, 'readonly', s => s.getAll()) : Promise.resolve([...mem[st].values()]),
    put: (st, v) => ok ? tx(st, 'readwrite', s => s.put(v)) : (mem[st].set(v.id, v), Promise.resolve()),
    del: (st, id) => ok ? tx(st, 'readwrite', s => s.delete(id)) : (mem[st].delete(id), Promise.resolve()),
  };
})();

// ============================================================
// Galeria
// ============================================================
const G = { chip: LS.get('chip', 'Tudo'), works: new Map(), imports: [], urls: [] };
const svgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function allPages() {
  const imps = G.imports.map(i => ({ id: i.id, name: i.name, cat: 'Importadas', kind: 'import' }));
  return [...CATALOG.map(c => ({ ...c, kind: 'catalog' })), ...imps];
}
function findPage(id) { return allPages().find(p => p.id === id); }

async function refreshData() {
  const [works, imports] = await Promise.all([DB.all('works'), DB.all('imports')]);
  G.works = new Map(works.map(w => [w.id, w]));
  G.imports = imports.sort((a, b) => (b.created || 0) - (a.created || 0));
}

function renderChips() {
  const chips = ['Em curso', 'Tudo', ...CATEGORIES, 'Importadas'];
  if (!chips.includes(G.chip)) G.chip = 'Tudo';
  $('#chips').innerHTML = chips.map(c => `<button class="chip ${c === G.chip ? 'on' : ''}" data-chip="${c}">${c}${c === 'Em curso' && G.works.size ? ` · ${G.works.size}` : ''}</button>`).join('');
}

function renderGrid() {
  G.urls.forEach(u => URL.revokeObjectURL(u)); G.urls = [];
  let pages = allPages();
  if (G.chip === 'Em curso') pages = pages.filter(p => G.works.has(p.id)).sort((a, b) => G.works.get(b.id).updated - G.works.get(a.id).updated);
  else if (G.chip !== 'Tudo') pages = pages.filter(p => p.cat === G.chip);
  const grid = $('#grid');
  grid.innerHTML = '';
  const empty = $('#emptyMsg');
  empty.hidden = pages.length > 0;
  if (!pages.length) {
    empty.textContent = G.chip === 'Em curso' ? 'Ainda não começou nenhuma página. Escolha uma no catálogo.'
      : 'Sem páginas importadas. Use “Importar” para trazer imagens ou PDFs de páginas para colorir que tenha descarregado.';
  }
  const frag = document.createDocumentFragment();
  for (const p of pages) {
    const w = G.works.get(p.id);
    const card = document.createElement('div');
    card.className = 'card'; card.dataset.id = p.id;
    let src;
    if (w?.thumb) { src = URL.createObjectURL(fromStored(w.thumb)); G.urls.push(src); }
    else if (p.kind === 'catalog') src = svgURL(p.svg());
    else { const imp = G.imports.find(i => i.id === p.id); if (imp?.thumb) { src = URL.createObjectURL(fromStored(imp.thumb)); G.urls.push(src); } }
    const canDelete = G.chip === 'Em curso' || p.kind === 'import';
    card.innerHTML = `<img class="thumb" loading="lazy" alt="" src="${src || ''}">
      ${w && G.chip !== 'Em curso' ? '<span class="badge">Em curso</span>' : ''}
      ${canDelete ? `<button class="del" data-del="${p.id}" aria-label="Apagar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}
      <div class="meta"><span class="name">${p.name}</span>${G.chip === 'Em curso' ? `<small>${p.cat}</small>` : ''}</div>`;
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

async function showGallery() {
  await refreshData();
  renderChips(); renderGrid();
  $('#editor').classList.remove('active');
  $('#gallery').classList.add('active');
}

$('#chips').addEventListener('click', (e) => {
  const c = e.target.closest('[data-chip]')?.dataset.chip;
  if (!c) return;
  G.chip = c; LS.set('chip', c); renderChips(); renderGrid();
  $('#grid').scrollTop = 0;
});
$('#grid').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation();
    const id = del.dataset.del;
    const page = findPage(id);
    if (page.kind === 'import' && G.chip !== 'Em curso') {
      if (!await confirmDialog('Apagar página importada?', `“${page.name}” e a pintura feita nela serão apagadas.`, 'Apagar')) return;
      await DB.del('imports', id); await DB.del('works', id);
    } else {
      if (!await confirmDialog('Apagar pintura?', `A pintura de “${page.name}” será apagada. A página continua no catálogo.`, 'Apagar')) return;
      await DB.del('works', id);
    }
    await refreshData(); renderChips(); renderGrid();
    return;
  }
  const card = e.target.closest('.card');
  if (card) openPage(findPage(card.dataset.id));
});

// ============================================================
// Conversão de imagens em contornos
// ============================================================
function toLineArt(ctx, w, h, levels) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const lum = new Uint8Array(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const a = d[i + 3] / 255;
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    lum[j] = l * a + 255 * (1 - a);
  }
  let white = 255;
  if (levels) {
    // Página fotografada ou digitalizada: o papel é a maioria dos pixels, por isso o percentil 70 dá o "branco".
    const hist = new Uint32Array(256);
    for (let j = 0; j < n; j++) hist[lum[j]]++;
    let acc = 0, target = n * 0.7;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) { white = Math.max(120, v); break; } }
  }
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const v = Math.min(255, lum[j] * 255 / white);
    const a = v >= 235 ? 0 : Math.min(255, Math.round((235 - v) * 255 / 175));
    d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

async function catalogLineCanvas(page) {
  const blob = new Blob([page.svg()], { type: 'image/svg+xml' });
  const img = await blobToImage(blob);
  const c = mkCanvas(MAX_SIDE, MAX_SIDE), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, MAX_SIDE, MAX_SIDE);
  ctx.drawImage(img, 0, 0, MAX_SIDE, MAX_SIDE);
  toLineArt(ctx, MAX_SIDE, MAX_SIDE, false);
  return c;
}

function thumbFrom(line, color, size = 360) {
  const s = size / Math.max(line.width, line.height);
  const w = Math.round(line.width * s), h = Math.round(line.height * s);
  const c = mkCanvas(size, size), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  const x = (size - w) / 2, y = (size - h) / 2;
  if (color) ctx.drawImage(color, x, y, w, h);
  ctx.drawImage(line, x, y, w, h);
  return c;
}

// ============================================================
// Importar imagens e PDFs
// ============================================================
async function saveImport(srcCanvas, name) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  toLineArt(ctx, w, h, true);
  const line = await canvasToBlob(srcCanvas, 'image/png');
  const thumb = await canvasToBlob(thumbFrom(srcCanvas, null), 'image/jpeg', 0.85);
  const id = 'imp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await DB.put('imports', { id, name, w, h, created: Date.now(), line: await toStored(line), thumb: await toStored(thumb) });
}

function fitCanvas(srcW, srcH) {
  const s = MAX_SIDE / Math.max(srcW, srcH);
  const w = Math.round(srcW * s), h = Math.round(srcH * s);
  const c = mkCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  return { c, ctx, w, h };
}

async function importImage(file) {
  const img = await blobToImage(file);
  const { c, ctx, w, h } = fitCanvas(img.naturalWidth, img.naturalHeight);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  await saveImport(c, file.name.replace(/\.[^.]+$/, ''));
}

let pdfjsP = null;
async function importPdf(file, progress) {
  pdfjsP ??= import('./vendor/pdf.min.mjs').then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
    return m;
  });
  const pdfjs = await pdfjsP;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const n = Math.min(doc.numPages, 60);
  const base = file.name.replace(/\.pdf$/i, '');
  for (let i = 1; i <= n; i++) {
    progress(i, n);
    const page = await doc.getPage(i);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: MAX_SIDE / Math.max(v1.width, v1.height) });
    const { c, ctx } = fitCanvas(vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp, background: '#ffffff' }).promise;
    await saveImport(c, n > 1 ? `${base} · p.${i}` : base);
    page.cleanup();
  }
  try { await task.destroy(); } catch { }
  return n;
}

$('#importInput').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  let count = 0, failed = 0;
  for (const [k, f] of files.entries()) {
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        count += await importPdf(f, (i, n) => toast(`A importar ${f.name}: página ${i} de ${n}…`, 0));
      } else {
        toast(`A importar ${k + 1} de ${files.length}…`, 0);
        await importImage(f); count++;
      }
    } catch (err) { console.error(err); failed++; }
  }
  hideToast();
  toast(failed ? `${count} importada(s), ${failed} falharam` : `${count} página(s) importada(s)`);
  G.chip = 'Importadas'; LS.set('chip', G.chip);
  await refreshData(); renderChips(); renderGrid();
});

// ============================================================
// Editor
// ============================================================
const colorCanvas = $('#colorCanvas'), strokeCanvas = $('#strokeCanvas'), lineCanvas = $('#lineCanvas');
const colorCtx = colorCanvas.getContext('2d');
const strokeCtx = strokeCanvas.getContext('2d');
const lineCtx = lineCanvas.getContext('2d', { willReadFrequently: true });
const clipCanvas = mkCanvas(1, 1), clipCtx = clipCanvas.getContext('2d');
const vp = $('#viewport'), stage = $('#stage'), cursorEl = $('#cursor');

const PALETTES = {
  'Primavera': ['#F7C5CC', '#F49CAC', '#E8668A', '#FBD87F', '#F9B572', '#B5E0C4', '#7CC6A4', '#A7D3F2', '#6FA8DC', '#C3B1E1', '#9D84C9', '#FFF4D6'],
  'Outono': ['#7A2E1C', '#B5451B', '#D9822B', '#E8B04B', '#F2D492', '#8C7A3B', '#5E6B3A', '#3E4C2C', '#A0522D', '#6B3E26', '#C9A27E', '#EFE1C6'],
  'Oceano': ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#CAF0F8', '#2A9D8F', '#76C893', '#B5E48C', '#E9F5DB'],
  'Vibrante': ['#E63946', '#F77F00', '#FCBF49', '#FFE066', '#8AC926', '#06D6A0', '#118AB2', '#3A86FF', '#8338EC', '#FF006E', '#FB5607', '#222222'],
  'Pastel': ['#FFD1DC', '#FFE5B4', '#FFFACD', '#D4F0C4', '#C1E7E3', '#C6DEF1', '#DBCDF0', '#F2C6DE', '#F9E2AE', '#E2CFC4', '#D0E6A5', '#FFFFFF'],
  'Neutros': ['#000000', '#2B2B2B', '#4D4D4D', '#737373', '#999999', '#BFBFBF', '#E0E0E0', '#FFFFFF', '#5C4033', '#8B6F47', '#C2B280', '#F5F0E6'],
};

const E = {
  page: null, W: 0, H: 0, barrier: null, visited: null,
  view: { s: 1, tx: 0, ty: 0, fit: 1 },
  tool: LS.get('tool', 'fill'), prevTool: 'fill',
  color: LS.get('color', '#E8668A'), size: LS.get('size', 24), opacity: LS.get('opacity', 100), clip: LS.get('clip', true),
  palette: LS.get('palette', 'Primavera'), recent: LS.get('recent', []),
  undo: [], redo: [], undoBytes: 0,
  dirty: false, saveTimer: null, saving: null, penSeen: false,
};

// ---------- Vista (zoom e deslocação) ----------
function applyView() {
  const { s, tx, ty } = E.view;
  stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}
function fitView() {
  const r = vp.getBoundingClientRect();
  const pad = Math.min(24, r.width * 0.04);
  const s = Math.min((r.width - pad * 2) / E.W, (r.height - pad * 2) / E.H);
  E.view = { s, fit: s, tx: (r.width - E.W * s) / 2, ty: (r.height - E.H * s) / 2 };
  applyView();
}
function zoomAt(px, py, newS) {
  const v = E.view;
  newS = clamp(newS, v.fit * 0.6, Math.max(v.fit * 12, 3));
  const wx = (px - v.tx) / v.s, wy = (py - v.ty) / v.s;
  v.s = newS; v.tx = px - wx * newS; v.ty = py - wy * newS;
  applyView();
}
let vpRect = null;
const local = (e) => ({ x: e.clientX - vpRect.left, y: e.clientY - vpRect.top });
const toWorld = (p) => ({ x: (p.x - E.view.tx) / E.view.s, y: (p.y - E.view.ty) / E.view.s });

// ---------- Abrir página ----------
async function openPage(page) {
  if (!page) return;
  $('#gallery').classList.remove('active');
  $('#editor').classList.add('active');
  $('#eTitle').textContent = page.name;
  $('#busy').hidden = false;
  stage.style.visibility = 'hidden';
  await sleep(30);
  try {
    let line;
    if (page.kind === 'catalog') line = await catalogLineCanvas(page);
    else {
      const imp = await DB.get('imports', page.id);
      const img = await blobToImage(fromStored(imp.line));
      line = mkCanvas(img.naturalWidth, img.naturalHeight);
      line.getContext('2d').drawImage(img, 0, 0);
    }
    const W = line.width, H = line.height;
    E.page = page; E.W = W; E.H = H;
    for (const c of [colorCanvas, strokeCanvas, lineCanvas, clipCanvas]) { c.width = W; c.height = H; }
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    lineCtx.clearRect(0, 0, W, H);
    lineCtx.drawImage(line, 0, 0);
    const ld = lineCtx.getImageData(0, 0, W, H).data;
    E.barrier = new Uint8Array(W * H);
    for (let i = 0, j = 3; i < W * H; i++, j += 4) E.barrier[i] = ld[j] > 100 ? 1 : 0;
    E.visited = new Uint8Array(W * H);
    colorCtx.clearRect(0, 0, W, H);
    const work = await DB.get('works', page.id);
    if (work?.color) colorCtx.drawImage(await blobToImage(fromStored(work.color)), 0, 0);
    E.undo = []; E.redo = []; E.undoBytes = 0; E.dirty = false;
    updateUndoButtons();
    fitView();
  } catch (err) {
    console.error(err);
    toast('Não foi possível abrir esta página');
    await showGallery();
  } finally {
    $('#busy').hidden = true;
    stage.style.visibility = '';
  }
}

// ---------- Desfazer ----------
const UNDO_BUDGET = 220 * 1024 * 1024;
function pushUndo(x, y, before, after) {
  E.undo.push({ x, y, before, after });
  E.undoBytes += before.data.length * 2;
  for (const r of E.redo) E.undoBytes -= r.before.data.length * 2;
  E.redo = [];
  while (E.undoBytes > UNDO_BUDGET && E.undo.length > 1) { const u = E.undo.shift(); E.undoBytes -= u.before.data.length * 2; }
  updateUndoButtons();
}
function undo() {
  const u = E.undo.pop(); if (!u) return;
  colorCtx.putImageData(u.before, u.x, u.y); E.redo.push(u); markDirty(); updateUndoButtons();
}
function redo() {
  const u = E.redo.pop(); if (!u) return;
  colorCtx.putImageData(u.after, u.x, u.y); E.undo.push(u); markDirty(); updateUndoButtons();
}
function updateUndoButtons() { $('#undoBtn').disabled = !E.undo.length; $('#redoBtn').disabled = !E.redo.length; }

// ---------- Regiões (para balde e "dentro das linhas") ----------
function region(fx, fy) {
  const { W, H, barrier, visited } = E;
  let x = Math.floor(fx), y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  if (barrier[y * W + x]) {
    // Tocou numa linha: procura a área livre mais próxima.
    let found = false;
    for (let r = 1; r <= 6 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !barrier[ny * W + nx]) { x = nx; y = ny; found = true; break; }
    }
    if (!found) return null;
  }
  visited.fill(0);
  let minX = x, maxX = x, minY = y, maxY = y;
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop(); let cx = stack.pop();
    const row = cy * W;
    if (visited[row + cx] || barrier[row + cx]) continue;
    while (cx > 0 && !visited[row + cx - 1] && !barrier[row + cx - 1]) cx--;
    let up = false, down = false;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    if (cx < minX) minX = cx;
    for (; cx < W && !visited[row + cx] && !barrier[row + cx]; cx++) {
      visited[row + cx] = 1;
      if (cy > 0) { const a = row - W + cx; const free = !visited[a] && !barrier[a]; if (free && !up) { stack.push(cx, cy - 1); up = true; } else if (!free) up = false; }
      if (cy < H - 1) { const b = row + W + cx; const free = !visited[b] && !barrier[b]; if (free && !down) { stack.push(cx, cy + 1); down = true; } else if (!free) down = false; }
    }
    if (cx - 1 > maxX) maxX = cx - 1;
  }
  // Alarga a região 3 px para dentro das linhas, para não ficar uma orla branca.
  const D = 3;
  const x0 = Math.max(0, minX - D), y0 = Math.max(0, minY - D), x1 = Math.min(W - 1, maxX + D), y1 = Math.min(H - 1, maxY + D);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const m = new Uint8Array(bw * bh), tmp = new Uint8Array(bw * bh);
  for (let yy = 0; yy < bh; yy++) { const src = (y0 + yy) * W + x0, dst = yy * bw; for (let xx = 0; xx < bw; xx++) m[dst + xx] = visited[src + xx]; }
  for (let yy = 0; yy < bh; yy++) {
    const o = yy * bw; let last = -1e9;
    for (let xx = 0; xx < bw; xx++) { if (m[o + xx]) last = xx; if (xx - last <= D) tmp[o + xx] = 1; }
    last = 1e9;
    for (let xx = bw - 1; xx >= 0; xx--) { if (m[o + xx]) last = xx; if (last - xx <= D) tmp[o + xx] = 1; }
  }
  const out = new Uint8Array(bw * bh);
  for (let xx = 0; xx < bw; xx++) {
    let last = -1e9;
    for (let yy = 0; yy < bh; yy++) { if (tmp[yy * bw + xx]) last = yy; if (yy - last <= D) out[yy * bw + xx] = 1; }
    last = 1e9;
    for (let yy = bh - 1; yy >= 0; yy--) { if (tmp[yy * bw + xx]) last = yy; if (last - yy <= D) out[yy * bw + xx] = 1; }
  }
  for (let yy = 0; yy < bh; yy++) {
    const g = (y0 + yy) * W + x0, o = yy * bw;
    for (let xx = 0; xx < bw; xx++) out[o + xx] = m[o + xx] || (out[o + xx] && barrier[g + xx]) ? 1 : 0;
  }
  return { x0, y0, bw, bh, mask: out };
}

// ---------- Balde ----------
function doFill(p) {
  const reg = region(p.x, p.y);
  if (!reg) return;
  const { x0, y0, bw, bh, mask } = reg;
  const img = colorCtx.getImageData(x0, y0, bw, bh);
  const before = new ImageData(new Uint8ClampedArray(img.data), bw, bh);
  const d = img.data;
  const [r, g, b] = hexToRgb(E.color);
  const a = E.opacity / 100;
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    if (!mask[i]) continue;
    if (a >= 1) { d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255; continue; }
    const da = d[j + 3] / 255, oa = a + da * (1 - a);
    d[j] = (r * a + d[j] * da * (1 - a)) / oa;
    d[j + 1] = (g * a + d[j + 1] * da * (1 - a)) / oa;
    d[j + 2] = (b * a + d[j + 2] * da * (1 - a)) / oa;
    d[j + 3] = oa * 255;
  }
  colorCtx.putImageData(img, x0, y0);
  pushUndo(x0, y0, before, img);
  rememberColor(E.color);
  markDirty();
}

// ---------- Conta-gotas ----------
function pickColor(p) {
  const x = clamp(Math.floor(p.x), 0, E.W - 1), y = clamp(Math.floor(p.y), 0, E.H - 1);
  const d = colorCtx.getImageData(x, y, 1, 1).data;
  setColor(d[3] < 16 ? '#FFFFFF' : rgbToHex(d[0], d[1], d[2]).toUpperCase());
  setTool(E.prevTool === 'picker' ? 'brush' : E.prevTool);
}

// ---------- Pincel e borracha ----------
const S = { active: false, last: null, box: null, clip: false };
function strokeWidth(e) {
  if (e.pointerType === 'pen') return E.size * (0.18 + 0.82 * Math.pow(e.pressure || 0.5, 0.9));
  return E.size;
}
function grow(box, x, y, r) {
  if (!box) return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  box.x0 = Math.min(box.x0, x - r); box.y0 = Math.min(box.y0, y - r); box.x1 = Math.max(box.x1, x + r); box.y1 = Math.max(box.y1, y + r);
  return box;
}
function intBox(b, pad = 2) {
  const x0 = clamp(Math.floor(b.x0) - pad, 0, E.W), y0 = clamp(Math.floor(b.y0) - pad, 0, E.H);
  const x1 = clamp(Math.ceil(b.x1) + pad, 0, E.W), y1 = clamp(Math.ceil(b.y1) + pad, 0, E.H);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function stamp(x, y, w) {
  strokeCtx.beginPath(); strokeCtx.arc(x, y, Math.max(0.6, w / 2), 0, Math.PI * 2); strokeCtx.fill();
}
function strokeStart(e, p) {
  S.active = true; S.box = null;
  S.clip = false;
  if (E.clip) {
    const reg = region(p.x, p.y);
    if (reg) {
      clipCtx.clearRect(0, 0, E.W, E.H);
      const img = new ImageData(reg.bw, reg.bh);
      for (let i = 0, j = 3; i < reg.mask.length; i++, j += 4) img.data[j] = reg.mask[i] ? 255 : 0;
      clipCtx.putImageData(img, reg.x0, reg.y0);
      S.clip = true;
    }
  }
  strokeCtx.fillStyle = E.tool === 'eraser' ? '#ffffff' : E.color;
  strokeCanvas.style.opacity = E.opacity / 100;
  const w = strokeWidth(e);
  S.last = { x: p.x, y: p.y, w };
  stamp(p.x, p.y, w);
  const seg = grow(null, p.x, p.y, w / 2);
  S.box = grow(S.box, p.x, p.y, w / 2);
  applyClip(seg);
}
function strokeMove(e) {
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  let seg = null;
  for (const ev of list) {
    const p = toWorld(local(ev));
    const w = strokeWidth(ev);
    const L = S.last;
    const dist = Math.hypot(p.x - L.x, p.y - L.y);
    const step = Math.max(0.8, Math.min(L.w, w) * 0.12);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      stamp(L.x + (p.x - L.x) * t, L.y + (p.y - L.y) * t, L.w + (w - L.w) * t);
    }
    seg = grow(seg, L.x, L.y, Math.max(L.w, w) / 2); seg = grow(seg, p.x, p.y, Math.max(L.w, w) / 2);
    S.last = { x: p.x, y: p.y, w };
  }
  if (seg) { S.box = grow(S.box, seg.x0, seg.y0, 0); S.box = grow(S.box, seg.x1, seg.y1, 0); applyClip(seg); }
}
function applyClip(seg) {
  if (!S.clip) return;
  const r = intBox(seg);
  if (!r.w || !r.h) return;
  strokeCtx.save();
  strokeCtx.beginPath(); strokeCtx.rect(r.x, r.y, r.w, r.h); strokeCtx.clip();
  strokeCtx.globalCompositeOperation = 'destination-in';
  strokeCtx.drawImage(clipCanvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  strokeCtx.restore();
}
function strokeEnd(commit = true) {
  if (!S.active) return;
  S.active = false;
  const r = intBox(S.box);
  if (commit && r.w && r.h) {
    const before = colorCtx.getImageData(r.x, r.y, r.w, r.h);
    colorCtx.save();
    colorCtx.globalAlpha = E.opacity / 100;
    colorCtx.globalCompositeOperation = E.tool === 'eraser' ? 'destination-out' : 'source-over';
    colorCtx.drawImage(strokeCanvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    colorCtx.restore();
    const after = colorCtx.getImageData(r.x, r.y, r.w, r.h);
    pushUndo(r.x, r.y, before, after);
    if (E.tool !== 'eraser') rememberColor(E.color);
    markDirty();
  }
  strokeCtx.clearRect(0, 0, E.W, E.H);
}

// ---------- Ponteiros: Apple Pencil, dedos, rato ----------
const pts = new Map();
let action = null;   // { id, kind: 'stroke'|'tap', start, moved }
let gesture = null;  // { ids, c0, d0, view0, t0, maxMove, maxCount }
let ignoreTouches = false;

function touchList() { return [...pts.entries()].filter(([, p]) => p.type === 'touch'); }
function startGesture() {
  const t = touchList();
  if (!t.length) { gesture = null; return; }
  const c = centroid(t), d = spread(t, c);
  const prev = gesture;
  gesture = {
    ids: t.map(([id]) => id), c0: c, d0: d, view0: { ...E.view },
    t0: prev?.t0 ?? performance.now(), maxMove: prev?.maxMove ?? 0, maxCount: Math.max(prev?.maxCount ?? 0, t.length),
    start: prev?.start ?? new Map(t.map(([id, p]) => [id, { ...p }])),
  };
  for (const [id, p] of t) if (!gesture.start.has(id)) gesture.start.set(id, { ...p });
}
function centroid(t) { let x = 0, y = 0; for (const [, p] of t) { x += p.x; y += p.y; } return { x: x / t.length, y: y / t.length }; }
function spread(t, c) { if (t.length < 2) return 0; let s = 0; for (const [, p] of t) s += Math.hypot(p.x - c.x, p.y - c.y); return s / t.length; }
function updateGesture() {
  const t = touchList().filter(([id]) => gesture.ids.includes(id));
  if (!t.length) return;
  const c = centroid(t), d = spread(t, c);
  const g = gesture, v0 = g.view0;
  for (const [id, p] of t) { const s0 = g.start.get(id); if (s0) g.maxMove = Math.max(g.maxMove, Math.hypot(p.x - s0.x, p.y - s0.y)); }
  let s = v0.s;
  if (g.d0 > 0 && d > 0) s = clamp(v0.s * d / g.d0, v0.fit * 0.6, Math.max(v0.fit * 12, 3));
  const wx = (g.c0.x - v0.tx) / v0.s, wy = (g.c0.y - v0.ty) / v0.s;
  E.view.s = s; E.view.tx = c.x - wx * s; E.view.ty = c.y - wy * s;
  applyView();
}

function cancelAction() {
  if (!action) return;
  if (action.kind === 'stroke') strokeEnd(false);
  action = null;
}

function startAction(e, lp) {
  const p = toWorld(lp);
  if (E.tool === 'brush' || E.tool === 'eraser') {
    action = { id: e.pointerId, kind: 'stroke', type: e.pointerType };
    strokeStart(e, p);
  } else {
    action = { id: e.pointerId, kind: 'tap', start: lp, world: p, moved: false, type: e.pointerType };
  }
}

vp.addEventListener('pointerdown', (e) => {
  if (!E.page) return;
  e.preventDefault();
  vpRect = vp.getBoundingClientRect();
  const lp = local(e);
  try { vp.setPointerCapture(e.pointerId); } catch { }
  if (e.pointerType === 'pen') E.penSeen = true;
  pts.set(e.pointerId, { ...lp, type: e.pointerType });
  if (e.pointerType === 'touch') {
    const n = touchList().length;
    if (n >= 2) {
      if (action && action.type === 'touch') cancelAction();
      ignoreTouches = false;
      startGesture();
      return;
    }
    if (E.penSeen) { startGesture(); return; }  // com Pencil, o dedo só move a folha
    if (action) return;
  } else {
    hideCursor();
    if (action) return;
  }
  startAction(e, lp);
});

vp.addEventListener('pointermove', (e) => {
  if (!E.page) return;
  vpRect ??= vp.getBoundingClientRect();
  const lp = local(e);
  if ((e.pointerType === 'pen' || e.pointerType === 'mouse') && e.buttons === 0) { showCursor(lp); return; }
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { ...lp, type: e.pointerType });
  if (gesture && gesture.ids.includes(e.pointerId)) { updateGesture(); return; }
  if (action && action.id === e.pointerId) {
    if (action.kind === 'stroke') strokeMove(e);
    else if (Math.hypot(lp.x - action.start.x, lp.y - action.start.y) > 12) action.moved = true;
    if (e.pointerType !== 'touch') showCursor(lp);
  }
});

function endPointer(e, cancelled) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (action && action.id === e.pointerId) {
    if (action.kind === 'stroke') strokeEnd(!cancelled);
    else if (!cancelled && !action.moved) {
      if (E.tool === 'fill') doFill(action.world);
      else if (E.tool === 'picker') pickColor(action.world);
    }
    action = null;
  }
  if (gesture && gesture.ids.includes(e.pointerId)) {
    const left = touchList().length;
    if (left === 0) {
      const g = gesture; gesture = null; ignoreTouches = false;
      if (g.maxCount === 2 && g.maxMove < 14 && performance.now() - g.t0 < 350) { undo(); toast('Desfeito', 900); }
    } else if (E.penSeen || left >= 2) startGesture();
    else { gesture = null; ignoreTouches = true; }
  }
}
vp.addEventListener('pointerup', (e) => endPointer(e, false));
vp.addEventListener('pointercancel', (e) => endPointer(e, true));
vp.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !pts.has(e.pointerId)) hideCursor(); });
vp.addEventListener('wheel', (e) => {
  if (!E.page) return;
  e.preventDefault();
  vpRect = vp.getBoundingClientRect();
  const lp = local(e);
  if (e.ctrlKey || e.metaKey) zoomAt(lp.x, lp.y, E.view.s * Math.exp(-e.deltaY * 0.01));
  else { E.view.tx -= e.deltaX; E.view.ty -= e.deltaY; applyView(); }
}, { passive: false });
['gesturestart', 'gesturechange', 'touchmove'].forEach(t => vp.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('dblclick', (e) => e.preventDefault());

function showCursor(lp) {
  if (E.tool !== 'brush' && E.tool !== 'eraser') { hideCursor(); return; }
  const d = Math.max(4, E.size * E.view.s);
  cursorEl.style.display = 'block';
  cursorEl.style.width = cursorEl.style.height = d + 'px';
  cursorEl.style.left = lp.x + 'px'; cursorEl.style.top = lp.y + 'px';
}
function hideCursor() { cursorEl.style.display = 'none'; }

// ---------- Gravação automática ----------
function markDirty() {
  E.dirty = true;
  clearTimeout(E.saveTimer);
  E.saveTimer = setTimeout(save, 1200);
}
async function save() {
  clearTimeout(E.saveTimer);
  if (E.saving) await E.saving;
  if (!E.dirty || !E.page) return;
  E.dirty = false;
  const page = E.page;
  E.saving = (async () => {
    try {
      const color = await canvasToBlob(colorCanvas, 'image/png');
      const thumb = await canvasToBlob(thumbFrom(lineCanvas, colorCanvas), 'image/jpeg', 0.85);
      await DB.put('works', { id: page.id, updated: Date.now(), color: await toStored(color), thumb: await toStored(thumb) });
    } catch (err) {
      console.error(err); E.dirty = true;
      toast('Não foi possível guardar');
    }
  })();
  await E.saving; E.saving = null;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', () => save());

// ---------- Exportar ----------
function composite() {
  const c = mkCanvas(E.W, E.H), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, E.W, E.H);
  ctx.drawImage(colorCanvas, 0, 0);
  ctx.drawImage(lineCanvas, 0, 0);
  return c;
}
function offerFile(file, title, text, isImage) {
  const url = URL.createObjectURL(file);
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const card = openSheet(`<h2>${title}</h2><p>${text}</p>
    ${isImage ? `<img class="result" src="${url}" alt="">` : ''}
    <div class="row-end">
      <button class="btn" data-a="close">Fechar</button>
      <a class="btn" href="${url}" download="${file.name}">Descarregar</a>
      ${canShare ? '<button class="btn primary" data-a="share">Partilhar / Guardar</button>' : ''}
    </div>`);
  card.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') { closeSheet(); URL.revokeObjectURL(url); }
    if (a === 'share') {
      try { await navigator.share({ files: [file], title: file.name }); closeSheet(); }
      catch (err) { if (err.name !== 'AbortError') toast('Partilha indisponível aqui: use “Descarregar” ou o toque longo na imagem'); }
    }
  });
}
$('#exportBtn').addEventListener('click', async () => {
  if (!E.page) return;
  $('#busy').hidden = false;
  try {
    const blob = await canvasToBlob(composite(), 'image/png');
    const name = E.page.name.replace(/[\\/:*?"<>|]+/g, '-');
    offerFile(new File([blob], `${name}.png`, { type: 'image/png' }), 'Imagem pronta',
      'Use “Partilhar / Guardar” e escolha “Guardar imagem” para a pôr nas Fotos. Também pode tocar longamente na imagem.', true);
  } finally { $('#busy').hidden = true; }
});

// ---------- Controlos ----------
function setTool(t) {
  if (t !== E.tool) E.prevTool = E.tool;
  E.tool = t; LS.set('tool', t);
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const stroke = t === 'brush' || t === 'eraser';
  $('#sizeWrap').classList.toggle('disabled', !stroke);
  $('#size').disabled = !stroke;
  $('#clipToggle').classList.toggle('disabled', !stroke);
  if (!stroke) hideCursor();
}
function setColor(c) {
  E.color = c.toUpperCase(); LS.set('color', E.color);
  $('#currentSwatch').style.background = E.color;
  $('#colorInput').value = E.color.toLowerCase();
  document.querySelectorAll('#swatches .swatch, #recent .swatch').forEach(s => s.classList.toggle('on', s.dataset.c === E.color));
  if (E.tool === 'eraser' || E.tool === 'picker') setTool(E.prevTool === 'eraser' || E.prevTool === 'picker' ? 'fill' : E.prevTool);
}
function rememberColor(c) {
  E.recent = [c, ...E.recent.filter(x => x !== c)].slice(0, 8);
  LS.set('recent', E.recent);
  renderRecent();
}
function renderSwatches() {
  $('#swatches').innerHTML = PALETTES[E.palette].map(c => `<button class="swatch ${c === E.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
}
function renderRecent() {
  const pal = PALETTES[E.palette];
  $('#recent').innerHTML = E.recent.filter(c => !pal.includes(c)).map(c => `<button class="swatch ${c === E.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
}
$('#paletteSelect').innerHTML = Object.keys(PALETTES).map(p => `<option>${p}</option>`).join('');
$('#paletteSelect').value = E.palette;
$('#paletteSelect').addEventListener('change', (e) => { E.palette = e.target.value; LS.set('palette', E.palette); renderSwatches(); renderRecent(); });
document.querySelector('.colors-row').addEventListener('click', (e) => { const s = e.target.closest('[data-c]'); if (s) setColor(s.dataset.c); });
$('#colorInput').addEventListener('input', (e) => setColor(e.target.value));
$('#tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
$('#size').value = E.size; $('#sizeOut').textContent = E.size;
$('#size').addEventListener('input', (e) => { E.size = +e.target.value; $('#sizeOut').textContent = E.size; LS.set('size', E.size); });
$('#opacity').value = E.opacity; $('#opOut').textContent = E.opacity + '%';
$('#opacity').addEventListener('input', (e) => { E.opacity = +e.target.value; $('#opOut').textContent = E.opacity + '%'; LS.set('opacity', E.opacity); });
function renderClip() { $('#clipToggle').setAttribute('aria-pressed', String(E.clip)); }
$('#clipToggle').addEventListener('click', () => { E.clip = !E.clip; LS.set('clip', E.clip); renderClip(); });
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#fitBtn').addEventListener('click', fitView);
$('#backBtn').addEventListener('click', async () => {
  await save();
  E.page = null;
  await showGallery();
});
window.addEventListener('keydown', (e) => {
  if (!E.page) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  const map = { b: 'fill', p: 'brush', e: 'eraser', i: 'picker' };
  if (!e.metaKey && !e.ctrlKey && map[e.key]) setTool(map[e.key]);
});
window.addEventListener('resize', () => { if (E.page) fitView(); });

$('#eMenuBtn').addEventListener('click', () => {
  const card = openSheet(`<h2>${E.page.name}</h2>
    <p>Com o Apple Pencil, o lápis pinta e os dedos movem e ampliam a folha. Toque com dois dedos para desfazer.</p>
    <div class="list">
      <button class="btn danger" data-a="reset">Recomeçar esta página</button>
      <button class="btn" data-a="close">Fechar</button>
    </div>`);
  card.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') closeSheet();
    if (a === 'reset') {
      closeSheet();
      if (!await confirmDialog('Recomeçar?', 'Toda a cor desta página será apagada.', 'Recomeçar')) return;
      const before = colorCtx.getImageData(0, 0, E.W, E.H);
      colorCtx.clearRect(0, 0, E.W, E.H);
      pushUndo(0, 0, before, colorCtx.getImageData(0, 0, E.W, E.H));
      markDirty();
    }
  });
});

// ============================================================
// Cópia de segurança
// ============================================================
async function exportBackup() {
  toast('A preparar cópia…', 0);
  const [works, imports] = await Promise.all([DB.all('works'), DB.all('imports')]);
  const enc = async (o) => o ? blobToDataURL(fromStored(o)) : null;
  const data = {
    app: 'colorir', version: 1, date: new Date().toISOString(),
    imports: await Promise.all(imports.map(async i => ({ id: i.id, name: i.name, w: i.w, h: i.h, created: i.created, line: await enc(i.line), thumb: await enc(i.thumb) }))),
    works: await Promise.all(works.map(async w => ({ id: w.id, updated: w.updated, color: await enc(w.color), thumb: await enc(w.thumb) }))),
  };
  hideToast();
  const file = new File([JSON.stringify(data)], `colorir-copia-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  offerFile(file, 'Cópia de segurança', `${works.length} pintura(s) e ${imports.length} página(s) importada(s). Guarde o ficheiro na app Ficheiros ou no iCloud Drive.`, false);
}
async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'colorir') throw new Error('Ficheiro inválido');
    const dec = async (u) => u ? toStored(await dataURLToBlob(u)) : null;
    for (const i of data.imports || []) await DB.put('imports', { ...i, line: await dec(i.line), thumb: await dec(i.thumb) });
    for (const w of data.works || []) await DB.put('works', { ...w, color: await dec(w.color), thumb: await dec(w.thumb) });
    toast(`Restaurado: ${(data.works || []).length} pintura(s)`);
    await refreshData(); renderChips(); renderGrid();
  } catch (err) { console.error(err); toast('Não foi possível restaurar este ficheiro'); }
}
$('#restoreInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); });

$('#menuBtn').addEventListener('click', () => {
  const card = openSheet(`<h2>Colorir</h2>
    <p>As pinturas ficam guardadas neste dispositivo. Faça de vez em quando uma cópia de segurança.</p>
    <div class="list">
      <button class="btn" data-a="backup">Exportar cópia de segurança</button>
      <button class="btn" data-a="restore">Restaurar cópia de segurança</button>
      <button class="btn" data-a="help">Ajuda</button>
      <button class="btn" data-a="close">Fechar</button>
    </div>`);
  card.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') closeSheet();
    if (a === 'backup') { closeSheet(); exportBackup(); }
    if (a === 'restore') { closeSheet(); $('#restoreInput').click(); }
    if (a === 'help') {
      openSheet(`<h2>Ajuda</h2>
        <p><b>Balde</b>: toque numa área para a preencher.<br>
        <b>Pincel</b>: pinta com pressão do Apple Pencil. Com “Dentro das linhas” ligado, a tinta fica na área onde começou o traço.<br>
        <b>Borracha</b> e <b>Cor</b> (conta-gotas, apanha uma cor da pintura).<br><br>
        <b>Gestos</b>: dois dedos para ampliar e mover; toque com dois dedos para desfazer. Quando usa o Pencil, um dedo também move a folha.<br><br>
        <b>Mais páginas</b>: descarregue páginas para colorir gratuitas (imagem ou PDF) e use “Importar”. Funciona melhor com desenhos de linhas pretas e áreas fechadas.</p>
        <div class="row-end"><button class="btn primary" data-a="close">OK</button></div>`)
        .addEventListener('click', (ev) => { if (ev.target.closest('[data-a]')) closeSheet(); });
    }
  });
});

// ============================================================
// Chave de acesso no link (?k=...). Guarda-se o resumo SHA-256, não a chave.
// ============================================================
const KEY_HASH = '64360e2ffd287662a045419580853c815733ff3a613f0e460524bc01dd2ac4a3';
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hasAccess() {
  try {
    const k = new URL(location.href).searchParams.get('k');
    if (k && await sha256(k) === KEY_HASH) { LS.set('key', k); return true; }
    const saved = LS.get('key', null);
    return !!saved && await sha256(saved) === KEY_HASH;
  } catch { return false; }
}

// ============================================================
// Arranque
// ============================================================
(async function init() {
  if (!await hasAccess()) {
    document.body.innerHTML = '<p style="font:17px -apple-system,system-ui;text-align:center;padding:30vh 24px;color:#8a8178">Este link não é válido.<br>Peça o link completo a quem o partilhou.</p>';
    return;
  }
  setTool(E.tool); setColor(E.color); renderSwatches(); renderRecent(); renderClip();
  const ok = await DB.init();
  $('#storageWarn').hidden = ok;
  try { await navigator.storage?.persist?.(); } catch { }
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let framed = false; try { framed = window.top !== window.self; } catch { framed = true; }
  $('#installHint').hidden = !(isIOS && !standalone && !framed && !LS.get('hintClosed', false));
  $('#installHintClose').addEventListener('click', () => { LS.set('hintClosed', true); $('#installHint').hidden = true; });
  await showGallery();
  try { if ('serviceWorker' in navigator && !framed) navigator.serviceWorker.register('sw.js').catch(() => { }); } catch { }
})();

// Para testes automáticos
window.__colorir = { E, openPage, findPage, doFill, save, undo, setTool, setColor, DB };
