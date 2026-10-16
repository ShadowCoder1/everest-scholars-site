// "Your climb": the roadmap drawn as a route up a ridge. Each milestone is a camp;
// the last one sits on the summit. Camps already reached glow.
import { html, raw, esc, fmtDay } from '../ui.js';

const ROUTE = [[16, 186], [70, 172], [112, 178], [164, 148], [204, 154], [258, 120], [296, 128], [348, 94], [384, 102], [436, 68], [470, 76], [520, 46], [562, 26]];
const FALL = [[606, 62], [640, 80], [640, 220], [0, 220], [0, 190]];
const BACK = [[0, 150], [84, 122], [146, 136], [228, 94], [300, 112], [376, 76], [448, 102], [536, 70], [600, 96], [640, 104], [640, 220], [0, 220]];

function along(points, t) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1]; const [x1, y1] = points[i];
    const len = Math.hypot(x1 - x0, y1 - y0); seg.push(len); total += len;
  }
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < seg.length; i += 1) {
    if (dist <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, dist / seg[i]) : 0;
      const [x0, y0] = points[i]; const [x1, y1] = points[i + 1];
      return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, i };
    }
    dist -= seg[i];
  }
  return { x: points.at(-1)[0], y: points.at(-1)[1], i: points.length - 2 };
}

// Route points from the base up to fraction t, for drawing the travelled part.
function routeTo(t) {
  const end = along(ROUTE, t);
  return [...ROUTE.slice(0, end.i + 1), [end.x, end.y]];
}
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export function climb(milestones, { large = false } = {}) {
  const n = milestones.length;
  const done = milestones.filter((m) => m.status === 'done').length;
  const nextIdx = milestones.findIndex((m) => m.status !== 'done');
  const next = nextIdx >= 0 ? milestones[nextIdx] : null;
  const camps = milestones.map((m, i) => ({ m, i, ...along(ROUTE, (i + 1) / n) }));
  // Travelled line runs to the furthest camp reached in order.
  let reached = 0;
  while (reached < n && milestones[reached].status === 'done') reached += 1;
  const travelled = reached ? routeTo(reached / n) : null;
  const uid = `cl${Math.random().toString(36).slice(2, 7)}`;

  const svg = `<svg class="climb-svg" viewBox="0 0 640 220" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(n ? `${done} of ${n} milestones reached` : 'No milestones yet')}">
    <defs>
      <linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ea8dc" stop-opacity=".22"/><stop offset="1" stop-color="#6ea8dc" stop-opacity="0"/></linearGradient>
      <linearGradient id="${uid}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ef8e7f"/><stop offset="1" stop-color="#f2a766"/></linearGradient>
    </defs>
    <polygon points="${pts(BACK)}" fill="rgba(255,255,255,.035)"/>
    <polygon points="${pts([...ROUTE, ...FALL])}" fill="url(#${uid}f)"/>
    <polyline points="${pts([...ROUTE, FALL[0], FALL[1]])}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
    <polyline points="${pts(ROUTE)}" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="1.25" stroke-dasharray="2 5" stroke-linecap="round"/>
    ${travelled ? `<polyline points="${pts(travelled)}" fill="none" stroke="url(#${uid}s)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <circle cx="16" cy="186" r="3.5" fill="rgba(255,255,255,.6)"/>
    ${camps.map(({ m, i, x, y }) => {
      const state = m.status === 'done' ? 'done' : i === nextIdx ? 'next' : 'later';
      const label = `${i + 1}. ${m.title}${m.due ? `, by ${fmtDay(m.due)}` : ''}`;
      return `<g class="camp camp-${state}"><title>${esc(label)}</title>
        ${state === 'next' ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="rgba(242,167,102,.16)" stroke="rgba(242,167,102,.55)" stroke-width="1"/>` : ''}
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${state === 'later' ? 4 : 5}" fill="${state === 'done' ? '#f2a766' : state === 'next' ? '#fff' : '#0c1222'}" stroke="${state === 'later' ? 'rgba(255,255,255,.55)' : 'none'}" stroke-width="1.25"/></g>`;
    }).join('')}
    ${n ? `<text x="562" y="12" text-anchor="middle" class="climb-peak">Summit</text>` : ''}
  </svg>`;

  return html`<div class="climb ${large ? 'is-large' : ''}">
    ${raw(svg)}
    <div class="climb-f">
      ${n ? html`<div><p class="climb-l">${next ? 'Next camp' : 'Summit reached'}</p>
          <p class="climb-v">${next ? next.title : milestones.at(-1).title}</p>
          ${next?.due ? html`<p class="climb-s">By ${fmtDay(next.due)}</p>` : ''}</div>
        <div class="climb-n"><p class="climb-l">Milestones reached</p><p class="climb-v num">${done}<span> of ${n}</span></p></div>`
        : html`<p class="climb-s">Your route appears here once you and your mentor set milestones.</p>`}
    </div>
  </div>`;
}
