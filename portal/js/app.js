import { auth, configured, onAuthStateChanged, signOut } from './fb.js';
import { html, mount, raw, avatar, folderHref, toast, friendlyError, pendingCode } from './ui.js';
import { icon } from './icons.js';
import { getMember, touchLastSeen } from './store.js';
import { renderLogin, renderVerify, renderNoAccess, renderNotConfigured } from './views/login.js';
import { renderJoin } from './views/join.js';
import * as student from './views/student.js';
import * as mentor from './views/mentor.js';
import { renderPeople } from './views/admin.js';
import { renderResources } from './views/resources.js';

const app = document.getElementById('app');
let me = null;

// ---------- navigation ----------
const STUDENT_NAV = [
  { to: 'dashboard', label: 'Dashboard', icon: 'home' },
  { label: 'Mentorship', icon: 'sessions', children: [
    { to: 'sessions', label: 'Sessions' },
    { to: 'reviews', label: 'Draft reviews' },
    { to: 'questions', label: 'Questions' },
  ] },
  { label: 'Plan', icon: 'roadmap', children: [
    { to: 'roadmap', label: 'Roadmap' },
    { to: 'tasks', label: 'Tasks' },
    { to: 'calendar', label: 'Calendar' },
  ] },
  { to: 'colleges', label: 'College list', icon: 'college' },
  { to: 'resources', label: 'Resources', icon: 'resources' },
  { href: 'folder', label: 'Student folder', icon: 'folder' },
];
const staffNav = (isAdmin) => [
  { to: 'mentees', label: isAdmin ? 'Students' : 'My mentees', icon: 'mentees' },
  { to: 'inbox', label: 'Waiting on you', icon: 'inbox' },
  { to: 'calendar', label: 'Calendar', icon: 'calendar' },
  { to: 'resources', label: 'Resources', icon: 'resources' },
  ...(isAdmin ? [{ to: 'people', label: 'People', icon: 'people' }] : []),
];

const isStaff = () => me && (me.role === 'mentor' || me.role === 'admin');
const route = () => {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || (isStaff() ? 'mentees' : 'dashboard'), parts };
};

function navItem(item, current) {
  if (item.children) {
    const open = item.children.some((c) => c.to === current);
    return html`<div class="nav-g ${open ? 'is-open' : ''}">
      <button type="button" class="nav-i nav-gt" aria-expanded="${open ? 'true' : 'false'}">${icon(item.icon)}<span>${item.label}</span>${icon('chevron', 'nav-chev')}</button>
      <div class="nav-sub">${item.children.map((c) => html`<a class="nav-s ${c.to === current ? 'is-on' : ''}" href="#/${c.to}" ${c.to === current ? raw('aria-current="page"') : ''}>${c.label}</a>`)}</div>
    </div>`;
  }
  if (item.href === 'folder') {
    return html`<a class="nav-i" href="${folderHref(me)}" target="_blank" rel="noopener">${icon(item.icon)}<span>${item.label}</span>${icon('external', 'nav-ext')}</a>`;
  }
  const on = item.to === current || (item.to === 'mentees' && current === 'm');
  return html`<a class="nav-i ${on ? 'is-on' : ''}" href="#/${item.to}" ${on ? raw('aria-current="page"') : ''}>${icon(item.icon)}<span>${item.label}</span></a>`;
}

function shell(current) {
  const items = isStaff() ? staffNav(me.role === 'admin') : STUDENT_NAV;
  const roleLabel = { admin: 'Founder', mentor: 'Mentor', student: 'Student' }[me.role] || '';
  mount(app, html`<div class="pt">
    <aside class="side" id="side">
      <a class="brand" href="#/" aria-label="Everest Futures portal home">
        <img src="../assets/brand/mark-on-dark.png" alt="" width="46" height="38">
        <span class="brand-t"><b>Everest</b><i>Futures</i></span>
      </a>
      <nav class="nav" aria-label="Portal">${items.map((i) => navItem(i, current))}</nav>
      <div class="side-f">
        ${isStaff() ? '' : html`<a class="btn btn-side" href="#/questions">Ask your mentor</a>`}
        <p>Everest Futures portal</p>
      </div>
    </aside>
    <div class="scrim" data-close-side></div>
    <div class="main">
      <header class="top">
        <button type="button" class="icon-btn menu-btn" aria-label="Open menu" aria-controls="side" aria-expanded="false">${icon('menu')}</button>
        <span class="sp"></span>
        <div class="me">
          <button type="button" class="me-btn" aria-haspopup="menu" aria-expanded="false">
            <span class="me-t"><b>${me.name}</b><i>${roleLabel}</i></span>${avatar(me)}
          </button>
          <div class="me-menu" role="menu" hidden>
            <p class="me-mail">${me.email}</p>
            <button type="button" role="menuitem" class="me-out">${icon('signout')}Sign out</button>
          </div>
        </div>
      </header>
      <main class="page" id="page" tabindex="-1"></main>
    </div>
  </div>`);

  app.querySelectorAll('.nav-gt').forEach((b) => b.addEventListener('click', () => {
    const g = b.closest('.nav-g'); g.classList.toggle('is-open');
    b.setAttribute('aria-expanded', g.classList.contains('is-open') ? 'true' : 'false');
  }));
  const side = app.querySelector('#side'); const menuBtn = app.querySelector('.menu-btn');
  const setSide = (open) => { app.querySelector('.pt').classList.toggle('side-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setSide(true));
  app.querySelector('[data-close-side]').addEventListener('click', () => setSide(false));
  side.addEventListener('click', (e) => { if (e.target.closest('a')) setSide(false); });
  const meBtn = app.querySelector('.me-btn'); const menu = app.querySelector('.me-menu');
  meBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; meBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
  app.querySelector('.me-out').addEventListener('click', () => signOut(auth));
}

// ---------- pages ----------
let renderSeq = 0;
async function render() {
  if (!me) return;
  const r = route();
  shell(r.name);
  const page = app.querySelector('#page');
  const seq = ++renderSeq;
  const ctx = {
    root: page, me, self: true, coach: false, subject: me, params: r.parts,
    refresh: () => render(),
    stale: () => seq !== renderSeq,
  };
  mount(page, html`<div class="loading" aria-live="polite">Loading</div>`);
  try {
    if (isStaff()) await staffPage(r, ctx);
    else await studentPage(r, ctx);
  } catch (ex) {
    console.error(ex);
    if (seq === renderSeq) mount(page, html`<div class="card empty-card"><h2>This page did not load</h2><p>${friendlyError(ex)}</p><button class="btn btn-secondary" type="button" onclick="location.reload()">Reload</button></div>`);
  }
  if (seq === renderSeq) { page.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  document.title = `${page.querySelector('h1')?.textContent || 'Portal'} | Everest Futures`;
}

const STUDENT_PAGES = {
  dashboard: student.renderDashboard, sessions: student.renderSessions,
  reviews: (c) => student.renderRequests(c, 'review'), questions: (c) => student.renderRequests(c, 'question'),
  roadmap: student.renderRoadmap, tasks: student.renderTasks, calendar: student.renderCalendar,
  colleges: student.renderColleges, resources: renderResources,
};
async function studentPage(r, ctx) {
  const fn = STUDENT_PAGES[r.name] || student.renderDashboard;
  await fn(ctx);
}

async function staffPage(r, ctx) {
  if (r.name === 'm' && r.parts[1]) return mentor.renderMentee(ctx, r.parts[1], r.parts[2] || 'overview');
  if (r.name === 'inbox') return mentor.renderInbox(ctx);
  if (r.name === 'calendar') return mentor.renderStaffCalendar(ctx);
  if (r.name === 'resources') return renderResources(ctx);
  if (r.name === 'people' && me.role === 'admin') return renderPeople(ctx, r.parts[1]);
  return mentor.renderMentees(ctx);
}

// ---------- auth ----------
window.addEventListener('hashchange', render);
// One listener closes the account menu on any outside click or Escape.
const closeMenu = () => {
  const menu = app.querySelector('.me-menu'); if (!menu || menu.hidden) return;
  menu.hidden = true; app.querySelector('.me-btn')?.setAttribute('aria-expanded', 'false');
};
document.addEventListener('click', (e) => { if (!e.target.closest('.me')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); app.querySelector('.pt')?.classList.remove('side-open'); } });

if (!configured) {
  renderNotConfigured(app);
} else {
  // A join link (#/join/CODE) saves its code until sign-in finishes.
  const linkCode = () => (location.hash.match(/^#\/join\/([A-Za-z0-9-]{8,9})$/) || [])[1] || '';
  onAuthStateChanged(auth, async (user) => {
    me = null;
    if (linkCode()) { pendingCode.set(linkCode()); history.replaceState(null, '', location.pathname); }
    if (!user) return renderLogin(app, pendingCode.get() ? 'setup' : 'signin');
    if (!user.emailVerified) return renderVerify(app, user);
    try {
      me = await getMember(user.email);
    } catch (ex) {
      if (!String(ex?.code).includes('permission-denied')) { console.error(ex); toast(friendlyError(ex), 'bad'); }
      me = null;
    }
    if (!me) {
      if (pendingCode.get()) return renderJoin(app, user, pendingCode.get());
      return renderNoAccess(app, user, (code) => { pendingCode.set(code); renderJoin(app, user, code); });
    }
    if (pendingCode.get()) { pendingCode.clear(); toast('You already have portal access, so the invite was not needed.'); }
    touchLastSeen(me.email).catch(() => {});
    render();
  });
}
