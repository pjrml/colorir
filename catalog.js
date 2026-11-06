// Catálogo gerado por código: cada página é um SVG de contornos, determinístico a partir de uma semente.
// Não há imagens de terceiros, por isso não há questões de licença.

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const range = (r, a, b) => a + r() * (b - a);
const f = (n) => Math.round(n * 10) / 10;
const C = 500;
const P = (rad, ang) => [f(C + rad * Math.cos(ang)), f(C + rad * Math.sin(ang))];
const TAU = Math.PI * 2;

function svgWrap(body, sw = 3.2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">` +
    `<rect width="1000" height="1000" fill="#fff"/>` +
    `<g fill="none" stroke="#000" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}
const circle = (r, cx = C, cy = C) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;

// ---------- Mandalas ----------
function ringMotif(r, kind, r0, r1, n, rot) {
  const out = [];
  const step = TAU / n;
  const mid = (r0 + r1) / 2;
  for (let i = 0; i < n; i++) {
    const a = rot + i * step;
    switch (kind) {
      case 'petal': {
        const w = step * 0.5;
        const [x0, y0] = P(r0, a), [x1, y1] = P(r1, a);
        const [ca, cb] = P(mid * 1.02, a - w), [cc, cd] = P(mid * 1.02, a + w);
        out.push(`<path d="M${x0} ${y0}Q${ca} ${cb} ${x1} ${y1}Q${cc} ${cd} ${x0} ${y0}Z"/>`);
        if (r1 - r0 > 50) {
          const m0 = r0 + (r1 - r0) * 0.25, m1 = r1 - (r1 - r0) * 0.2;
          const [a0, b0] = P(m0, a), [a1, b1] = P(m1, a);
          const [q0, q1] = P((m0 + m1) / 2, a - w * 0.45), [q2, q3] = P((m0 + m1) / 2, a + w * 0.45);
          out.push(`<path d="M${a0} ${b0}Q${q0} ${q1} ${a1} ${b1}Q${q2} ${q3} ${a0} ${b0}Z"/>`);
        }
        break;
      }
      case 'circles': {
        const rr = Math.min((r1 - r0) / 2, mid * Math.sin(step / 2)) * 0.92;
        const [x, y] = P(mid, a);
        out.push(circle(rr, x, y));
        if (rr > 14) out.push(circle(rr * 0.45, x, y));
        break;
      }
      case 'scallop': {
        const [x0, y0] = P(r0, a), [x1, y1] = P(r0, a + step);
        const [cx, cy] = P(r1 * 1.08, a + step / 2);
        out.push(`<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}"/>`);
        const [d0, e0] = P(r0 + (r1 - r0) * 0.45, a + step / 2);
        out.push(circle(Math.max(4, (r1 - r0) * 0.14), d0, e0));
        break;
      }
      case 'zigzag': {
        const [x0, y0] = P(r0, a), [x1, y1] = P(r1, a + step / 2), [x2, y2] = P(r0, a + step);
        out.push(`<path d="M${x0} ${y0}L${x1} ${y1}L${x2} ${y2}"/>`);
        break;
      }
      case 'lattice': {
        const [x0, y0] = P(r0, a), [x1, y1] = P(r1, a + step / 2), [x2, y2] = P(r0, a + step);
        const [u0, v0] = P(r1, a), [u1, v1] = P(r0, a + step / 2), [u2, v2] = P(r1, a + step);
        out.push(`<path d="M${x0} ${y0}L${x1} ${y1}L${x2} ${y2}M${u0} ${v0}L${u1} ${v1}L${u2} ${v2}"/>`);
        break;
      }
      case 'drop': {
        const [x0, y0] = P(r0 + 4, a);
        const [x1, y1] = P(r1 - (r1 - r0) * 0.35, a);
        const rr = Math.min((r1 - r0) * 0.3, mid * Math.sin(step / 2) * 0.8);
        const [tx, ty] = P(r1 - (r1 - r0) * 0.35 - rr * 0.2, a);
        out.push(`<path d="M${x0} ${y0}L${f(tx + rr * Math.cos(a + Math.PI / 2))} ${f(ty + rr * Math.sin(a + Math.PI / 2))}A${f(rr)} ${f(rr)} 0 1 0 ${f(tx + rr * Math.cos(a - Math.PI / 2))} ${f(ty + rr * Math.sin(a - Math.PI / 2))}Z"/>`);
        void x1; void y1;
        break;
      }
      case 'rays': {
        const [x0, y0] = P(r0, a), [x1, y1] = P(r1, a);
        out.push(`<path d="M${x0} ${y0}L${x1} ${y1}"/>`);
        const [d0, e0] = P(mid, a + step / 2);
        out.push(circle(Math.max(3, Math.min((r1 - r0) * 0.18, mid * Math.sin(step / 2) * 0.5)), d0, e0));
        break;
      }
      case 'arches': {
        const [x0, y0] = P(r0, a), [x1, y1] = P(r0, a + step);
        const [c0, c1] = P(r1 * 1.05, a), [c2, c3] = P(r1 * 1.05, a + step);
        out.push(`<path d="M${x0} ${y0}C${c0} ${c1} ${c2} ${c3} ${x1} ${y1}"/>`);
        break;
      }
    }
  }
  void r;
  return out.join('');
}

function mandala(seed) {
  const r = rng(seed * 7919 + 13);
  const folds = pick(r, [8, 10, 12, 12, 16]);
  let body = '';
  let rad = range(r, 28, 48);
  body += circle(rad) + circle(rad * 0.45);
  const kinds = ['petal', 'circles', 'scallop', 'zigzag', 'lattice', 'drop', 'rays', 'arches', 'petal'];
  let last = '';
  let n = folds;
  while (rad < 455) {
    const width = Math.min(470 - rad, range(r, 38, 78) + rad * 0.08);
    const r1 = rad + width;
    let kind = pick(r, kinds);
    if (kind === last) kind = pick(r, kinds);
    last = kind;
    if (rad > 180 && r() < 0.5) n = folds * 2;
    const rot = r() < 0.5 ? 0 : Math.PI / n;
    body += ringMotif(r, kind, rad, r1, n, rot);
    if (kind !== 'scallop' && kind !== 'arches') { body += circle(r1); rad = r1; }
    else if (r1 < 440) { rad = r1 + width * 0.14; body += circle(rad); }  // fecha o anel por fora das ondas
    else rad = r1;
  }
  return svgWrap(body, 3);
}

// ---------- Vitrais (polígonos subdivididos) ----------
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; s += x0 * y1 - x1 * y0; } return Math.abs(s) / 2; }
function splitPoly(p, r) {
  // Corta o polígono (convexo) por uma linha perto do centro, perpendicular ao eixo maior.
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0;
  for (const [x, y] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); cx += x; cy += y; }
  cx /= p.length; cy /= p.length;
  const wide = (maxX - minX) > (maxY - minY);
  const base = wide ? Math.PI / 2 : 0;
  const ang = base + range(r, -0.6, 0.6);
  const ox = cx + range(r, -0.18, 0.18) * (maxX - minX), oy = cy + range(r, -0.18, 0.18) * (maxY - minY);
  const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
  const side = (q) => (q[0] - ox) * nx + (q[1] - oy) * ny;
  const a = [], b = [];
  for (let i = 0; i < p.length; i++) {
    const q0 = p[i], q1 = p[(i + 1) % p.length], s0 = side(q0), s1 = side(q1);
    (s0 >= 0 ? a : b).push(q0);
    if ((s0 >= 0) !== (s1 >= 0)) {
      const t = s0 / (s0 - s1);
      const m = [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t];
      a.push(m); b.push(m);
    }
  }
  if (a.length < 3 || b.length < 3) return [p, null];
  return [a, b];
}
function vitral(seed) {
  const r = rng(seed * 104729 + 7);
  const round = seed % 2 === 1;
  let start;
  if (round) { start = []; for (let i = 0; i < 48; i++) start.push(P(450, (i / 48) * TAU)); }
  else start = [[40, 40], [960, 40], [960, 960], [40, 960]];
  const minA = range(r, 5500, 9000);
  let polys = [start], done = [];
  while (polys.length) {
    const p = polys.pop();
    const a = polyArea(p);
    if (a < minA || (a < minA * 3 && r() < 0.25)) { done.push(p); continue; }
    const [a1, b1] = splitPoly(p, r);
    if (!b1) { done.push(p); continue; }
    polys.push(a1, b1);
  }
  let body = '';
  for (const p of done) body += `<path d="M${p.map(q => f(q[0]) + ' ' + f(q[1])).join('L')}Z"/>`;
  if (round) body += circle(462);
  else body += `<rect x="28" y="28" width="944" height="944"/>`;
  return svgWrap(body, 4.5);
}

// ---------- Quilts ----------
function quilt(seed) {
  const r = rng(seed * 15485863 + 3);
  const n = pick(r, [6, 8, 8, 10]);
  const m = 50, s = (1000 - 2 * m) / n;
  const types = ['hst', 'qst', 'sis', 'four', 'hst2', 'bars', 'circle'];
  const half = Math.ceil(n / 2);
  const grid = [];
  for (let y = 0; y < half; y++) { grid[y] = []; for (let x = 0; x < half; x++) grid[y][x] = { t: pick(r, types), o: Math.floor(r() * 2) }; }
  let body = `<rect x="${m}" y="${m}" width="${1000 - 2 * m}" height="${1000 - 2 * m}"/><rect x="${m - 22}" y="${m - 22}" width="${1000 - 2 * m + 44}" height="${1000 - 2 * m + 44}"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const gy = y < half ? y : n - 1 - y, gx = x < half ? x : n - 1 - x;
    const c = grid[gy][gx];
    const flipX = x >= half, flipY = y >= half;
    const x0 = m + x * s, y0 = m + y * s, x1 = x0 + s, y1 = y0 + s, cx = x0 + s / 2, cy = y0 + s / 2;
    body += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(s)}" height="${f(s)}"/>`;
    let diagA = (c.o === 0) !== (flipX !== flipY);
    const L = (a, b, cc, d) => `<path d="M${f(a)} ${f(b)}L${f(cc)} ${f(d)}"/>`;
    switch (c.t) {
      case 'hst': body += diagA ? L(x0, y0, x1, y1) : L(x1, y0, x0, y1); break;
      case 'hst2': body += diagA ? L(x0, y0, x1, y1) + L(cx, y0, x1, cy) + L(x0, cy, cx, y1) : L(x1, y0, x0, y1) + L(cx, y0, x0, cy) + L(x1, cy, cx, y1); break;
      case 'qst': body += L(x0, y0, x1, y1) + L(x1, y0, x0, y1); break;
      case 'sis': body += `<path d="M${f(cx)} ${f(y0)}L${f(x1)} ${f(cy)}L${f(cx)} ${f(y1)}L${f(x0)} ${f(cy)}Z"/><rect x="${f(x0 + s / 4 + s * 0.06)}" y="${f(y0 + s / 4 + s * 0.06)}" width="${f(s / 2 - s * 0.12)}" height="${f(s / 2 - s * 0.12)}"/>`; break;
      case 'four': body += L(cx, y0, cx, y1) + L(x0, cy, x1, cy) + (diagA ? L(x0, y0, cx, cy) + L(cx, cy, x1, y1) : L(x1, y0, cx, cy) + L(cx, cy, x0, y1)); break;
      case 'bars': body += (flipY !== (c.o === 0)) ? L(x0, y0 + s / 3, x1, y0 + s / 3) + L(x0, y0 + 2 * s / 3, x1, y0 + 2 * s / 3) : L(x0 + s / 3, y0, x0 + s / 3, y1) + L(x0 + 2 * s / 3, y0, x0 + 2 * s / 3, y1); break;
      case 'circle': body += circle(s * 0.36, cx, cy) + circle(s * 0.16, cx, cy); break;
    }
  }
  return svgWrap(body, 3.2);
}

// ---------- Espirógrafos ----------
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
const SPIRO_PAIRS = [[96, 42], [96, 56], [96, 60], [96, 40], [120, 54], [120, 50], [120, 64], [84, 60], [90, 48], [90, 35]];
function spiro(seed) {
  const r = rng(seed * 32452843 + 11);
  let body = circle(470) + circle(455);
  const used = new Set();
  for (let c = 0; c < 2; c++) {
    let idx = Math.floor(r() * SPIRO_PAIRS.length);
    while (used.has(idx)) idx = (idx + 1) % SPIRO_PAIRS.length;
    used.add(idx);
    const [R, rr] = SPIRO_PAIRS[idx];
    const t2 = rr / gcd(R, rr);
    const d = range(r, rr * 0.6, rr * 1.05);
    const maxR = (R - rr) + d;
    const scale = (c === 0 ? 440 : range(r, 170, 260)) / maxR;
    const steps = Math.ceil(t2 * 300);
    let dpath = '';
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * TAU * t2;
      const x = (R - rr) * Math.cos(t) + d * Math.cos(((R - rr) / rr) * t);
      const y = (R - rr) * Math.sin(t) - d * Math.sin(((R - rr) / rr) * t);
      dpath += (i ? 'L' : 'M') + f(C + x * scale) + ' ' + f(C + y * scale);
    }
    body += `<path d="${dpath}Z"/>`;
  }
  return svgWrap(body, 2.6);
}

// ---------- Mosaicos ----------
function mosaico(seed) {
  const r = rng(seed * 49979687 + 5);
  const truchet = seed % 2 === 0;
  let body = '';
  if (truchet) {
    const n = pick(r, [8, 10, 12]);
    const m = 40, s = (1000 - 2 * m) / n;
    body += `<rect x="${m}" y="${m}" width="${1000 - 2 * m}" height="${1000 - 2 * m}"/>`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const x0 = m + x * s, y0 = m + y * s, h = s / 2;
      const A = (cx, cy, a0) => { const p0 = [cx + h * Math.cos(a0), cy + h * Math.sin(a0)], p1 = [cx + h * Math.cos(a0 + Math.PI / 2), cy + h * Math.sin(a0 + Math.PI / 2)]; return `<path d="M${f(p0[0])} ${f(p0[1])}A${f(h)} ${f(h)} 0 0 1 ${f(p1[0])} ${f(p1[1])}"/>`; };
      if (r() < 0.5) body += A(x0, y0, 0) + A(x0 + s, y0 + s, Math.PI);
      else body += A(x0 + s, y0, Math.PI / 2) + A(x0, y0 + s, -Math.PI / 2);
    }
  } else {
    const n = 4, m = 40, s = (1000 - 2 * m) / n;
    const kinds = ['rings', 'squares', 'flower', 'waves', 'diag', 'quarter', 'star', 'checks'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const x0 = m + x * s, y0 = m + y * s, cx = x0 + s / 2, cy = y0 + s / 2;
      body += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(s)}" height="${f(s)}"/>`;
      const k = kinds[(x + y * 3 + seed) % kinds.length];
      switch (k) {
        case 'rings': for (let i = 1; i <= 4; i++) body += circle(s * 0.11 * i, cx, cy); break;
        case 'squares': for (let i = 1; i <= 4; i++) { const w = s * 0.2 * i; body += `<rect x="${f(cx - w / 2)}" y="${f(cy - w / 2)}" width="${f(w)}" height="${f(w)}" transform="rotate(${i % 2 ? 45 : 0} ${f(cx)} ${f(cy)})"/>`; } break;
        case 'flower': { const pr = s * 0.17; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; body += circle(pr, cx + pr * Math.cos(a), cy + pr * Math.sin(a)); } body += circle(pr, cx, cy) + circle(s * 0.46, cx, cy); break; }
        case 'waves': for (let i = 1; i < 6; i++) { const yy = y0 + i * s / 6; body += `<path d="M${f(x0)} ${f(yy)}Q${f(x0 + s / 4)} ${f(yy - s / 10)} ${f(cx)} ${f(yy)}T${f(x0 + s)} ${f(yy)}"/>`; } break;
        case 'diag': for (let i = 1; i < 5; i++) { const t = i * s / 5 * 2; body += `<path d="M${f(x0 + Math.min(t, s))} ${f(y0 + Math.max(0, t - s))}L${f(x0 + Math.max(0, t - s))} ${f(y0 + Math.min(t, s))}"/>`; } break;
        case 'quarter': for (let i = 1; i <= 4; i++) { const rr = s * 0.24 * i; if (rr < s) body += `<path d="M${f(x0 + rr)} ${f(y0)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x0)} ${f(y0 + rr)}"/><path d="M${f(x0 + s - rr)} ${f(y0 + s)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x0 + s)} ${f(y0 + s - rr)}"/>`; } break;
        case 'star': { let d = ''; for (let i = 0; i < 16; i++) { const a = i * TAU / 16 - Math.PI / 2, rr = i % 2 ? s * 0.2 : s * 0.44; d += (i ? 'L' : 'M') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a)); } body += `<path d="${d}Z"/>` + circle(s * 0.1, cx, cy); break; }
        case 'checks': for (let i = 1; i < 4; i++) body += `<path d="M${f(x0 + i * s / 4)} ${f(y0)}V${f(y0 + s)}M${f(x0)} ${f(y0 + i * s / 4)}H${f(x0 + s)}"/>`; break;
      }
    }
  }
  return svgWrap(body, 3.2);
}

const GENERATORS = [
  { cat: 'Mandalas', one: 'Mandala', key: 'mandala', fn: mandala, count: 20 },
  { cat: 'Vitrais', one: 'Vitral', key: 'vitral', fn: vitral, count: 10 },
  { cat: 'Quilts', one: 'Quilt', key: 'quilt', fn: quilt, count: 10 },
  { cat: 'Espirógrafos', one: 'Espirógrafo', key: 'spiro', fn: spiro, count: 10 },
  { cat: 'Mosaicos', one: 'Mosaico', key: 'mosaico', fn: mosaico, count: 10 },
];

export const CATALOG = [];
for (const g of GENERATORS) {
  for (let i = 1; i <= g.count; i++) {
    let cache = null;
    CATALOG.push({ id: `${g.key}-${i}`, cat: g.cat, name: `${g.one} ${i}`, svg: () => (cache ??= g.fn(i)) });
  }
}
export const CATEGORIES = GENERATORS.map(g => g.cat);
