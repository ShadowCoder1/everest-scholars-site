// Mentor and founder pages: mentee overview, one mentee's workspace, check-ins,
// the "waiting on you" inbox and a calendar of every session.
import {
  html, raw, mount, PATHS, pathChips, avatar, firstName, folderHref, CHECKIN, pill, toast,
  fmtDay, fmtShort, fmtTime, fmtWhen, toDate, isoDay, daysFromToday, ago, addBusinessDays,
  openForm, confirmAction, prose, friendlyError,
} from '../ui.js';
import { icon } from '../icons.js';
import { getMember, listMembers, listMentees, loadStudent, listSub, addSub, updateSub, removeSub } from '../store.js';
import * as student from './student.js';

const STALE_DAYS = 14;
const scopeKey = 'es-scope';

async function myStudents(ctx) {
  const admin = ctx.me.role === 'admin';
  let scope = 'mine';
  if (admin) { try { scope = sessionStorage.getItem(scopeKey) || 'all'; } catch (_) { scope = 'all'; } }
  const list = admin && scope === 'all'
    ? (await listMembers()).filter((m) => m.role === 'student')
    : await listMentees(ctx.me.email);
  return { list, scope, admin };
}

function summarize(st, data) {
  const t = Date.now();
  const past = data.sessions.filter((s) => toDate(s.start)?.getTime() <= t).sort((a, b) => toDate(b.start) - toDate(a.start));
  const upcoming = data.sessions.filter((s) => toDate(s.start)?.getTime() > t).sort((a, b) => toDate(a.start) - toDate(b.start));
  const open = data.tasks.filter((x) => !x.done);
  const overdue = open.filter((x) => x.due && daysFromToday(x.due) < 0);
  const waiting = data.requests.filter((r) => r.status === 'open');
  const lateReplies = waiting.filter((r) => r.createdAt?.toDate && addBusinessDays(r.createdAt.toDate(), 2) < new Date());
  const checkins = [...(data.checkins || [])].sort((a, b) => b.date.localeCompare(a.date));
  const last = past[0];
  const sinceSession = last ? -daysFromToday(last.start) : null;
  const flags = [];
  if (checkins[0] && checkins[0].status !== 'on_track') flags.push(CHECKIN[checkins[0].status].label);
  if (st.active && (sinceSession == null || sinceSession > STALE_DAYS)) flags.push(last ? `No session in ${sinceSession} days` : 'No sessions yet');
  if (overdue.length) flags.push(`${overdue.length} overdue ${overdue.length === 1 ? 'task' : 'tasks'}`);
  if (lateReplies.length) flags.push(`${lateReplies.length} late ${lateReplies.length === 1 ? 'reply' : 'replies'}`);
  return { past, upcoming, open, overdue, waiting, checkins, last, sinceSession, flags };
}

// ---------- overview of mentees ----------
export async function renderMentees(ctx) {
  const { list, scope, admin } = await myStudents(ctx);
  const loaded = await Promise.all(list.map(async (st) => {
    try { return { st, sum: summarize(st, await loadStudent(st.email, { checkins: true })) }; }
    catch (ex) { console.error(ex); return { st, sum: null }; }
  }));
  if (ctx.stale()) return;
  const rows = loaded.sort((a, b) => (b.sum?.flags.length || 0) - (a.sum?.flags.length || 0) || a.st.name.localeCompare(b.st.name));
  const month = Date.now() - 30 * 86400000;
  const sessions30 = loaded.reduce((n, { sum }) => n + (sum ? sum.past.filter((s) => toDate(s.start).getTime() >= month).length : 0), 0);
  const waiting = loaded.reduce((n, { sum }) => n + (sum?.waiting.length || 0), 0);
  const attention = loaded.filter(({ sum }) => sum?.flags.length).length;
  const all = admin && scope === 'all';

  mount(ctx.root, html`
    <header class="ph"><div><h1>${all ? 'Students' : 'My mentees'}</h1><p class="ph-sub">${all ? 'Every enrolled student, with what needs attention first.' : `Check in on each student and keep their week moving, ${firstName(ctx.me.name)}.`}</p></div>
      ${admin ? html`<div class="ph-a seg" role="group" aria-label="Which students">
        <button type="button" class="seg-b ${all ? '' : 'is-on'}" data-scope="mine" aria-pressed="${all ? 'false' : 'true'}">My mentees</button>
        <button type="button" class="seg-b ${all ? 'is-on' : ''}" data-scope="all" aria-pressed="${all ? 'true' : 'false'}">All students</button></div>` : ''}</header>
    <div class="stats">
      <div class="stat"><p class="stat-l">${all ? 'Students' : 'Mentees'}</p><p class="stat-v num">${list.length}</p></div>
      <div class="stat"><p class="stat-l">Sessions, last 30 days</p><p class="stat-v num">${sessions30}</p></div>
      <div class="stat"><a href="#/inbox"><p class="stat-l">Waiting on a reply</p><p class="stat-v num">${waiting}</p></a></div>
      <div class="stat ${attention ? 'is-warn' : ''}"><p class="stat-l">Need attention</p><p class="stat-v num">${attention}</p></div>
    </div>
    <section class="card">
      ${rows.length ? html`<div class="tbl-wrap"><table class="tbl tbl-people tbl-stack">
        <thead><tr><th>Student</th><th>Last session</th><th>Next session</th><th>Open tasks</th><th>Latest check-in</th><th class="ta-r"><span class="vh">Actions</span></th></tr></thead>
        <tbody>${rows.map(({ st, sum }) => html`<tr class="row-link" data-href="#/m/${encodeURIComponent(st.email)}/overview">
          <td><a class="who" href="#/m/${encodeURIComponent(st.email)}/overview">${avatar(st)}<span><b>${st.name}</b><span class="muted">${[st.grade ? `Grade ${st.grade}` : '', st.school].filter(Boolean).join(', ') || st.email}</span></span></a>
            ${sum?.flags.length ? html`<p class="flags">${sum.flags.map((f) => html`<span>${f}</span>`)}</p>` : ''}</td>
          <td class="nowrap" data-l="Last session">${sum?.last ? html`<span class="${sum.sinceSession > STALE_DAYS ? 'is-late' : ''}">${ago(sum.last.start)}</span>` : html`<span class="muted">None yet</span>`}</td>
          <td class="nowrap" data-l="Next session">${sum?.upcoming[0] ? fmtWhen(sum.upcoming[0].start) : html`<span class="muted">Not scheduled</span>`}</td>
          <td class="nowrap" data-l="Open tasks">${sum ? html`<b class="num">${sum.open.length}</b>${sum.overdue.length ? html` <span class="is-late">${sum.overdue.length} overdue</span>` : ''}` : ''}</td>
          <td class="nowrap" data-l="Latest check-in">${sum?.checkins[0] ? html`${pill(CHECKIN[sum.checkins[0].status].label, CHECKIN[sum.checkins[0].status].tone)} <span class="muted">${fmtShort(sum.checkins[0].date)}</span>` : html`<span class="muted">None yet</span>`}</td>
          <td class="ta-r nowrap"><button type="button" class="btn btn-secondary btn-sm" data-checkin="${st.email}">Check in</button></td>
        </tr>`)}</tbody></table></div>`
        : html`<div class="empty"><h2>No ${all ? 'students' : 'mentees'} yet</h2><p class="muted">${admin ? 'Add students on the People page and assign them a mentor.' : 'A founder will assign students to you. They show up here.'}</p>${admin ? html`<a class="btn btn-primary" href="#/people">Go to People</a>` : ''}</div>`}
    </section>`);

  ctx.root.querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => {
    try { sessionStorage.setItem(scopeKey, b.dataset.scope); } catch (_) {}
    ctx.refresh();
  }));
  ctx.root.querySelectorAll('.row-link').forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    location.hash = tr.dataset.href;
  }));
  ctx.root.querySelectorAll('[data-checkin]').forEach((b) => b.addEventListener('click', async () => {
    const st = list.find((x) => x.email === b.dataset.checkin);
    if (await checkinForm(ctx, st)) { toast(`Check-in saved for ${firstName(st.name)}`); ctx.refresh(); }
  }));
}

function checkinForm(ctx, st, existing) {
  return openForm({
    title: existing ? 'Edit check-in' : `Check in on ${firstName(st.name)}`,
    intro: 'Check-ins are internal. Only mentors and founders see them.',
    fields: [
      { name: 'status', label: 'How are they doing?', type: 'radios', value: existing?.status || 'on_track', options: Object.entries(CHECKIN).map(([k, v]) => [k, v.label]), required: true, full: true },
      { name: 'note', label: 'Note', type: 'textarea', value: existing?.note || '', full: true, rows: 5, placeholder: 'Progress since last week, blockers, what you agreed on.' },
      { name: 'date', label: 'Date', type: 'date', value: existing?.date || isoDay(), required: true },
    ],
    submitLabel: 'Save check-in',
    onSubmit: (v) => {
      const data = { status: v.status, note: v.note, date: v.date, by: ctx.me.email, byName: ctx.me.name };
      return existing ? updateSub(st.email, 'checkins', existing.id, data) : addSub(st.email, 'checkins', data);
    },
  });
}

// ---------- one mentee ----------
const TABS = [
  ['overview', 'Overview'], ['sessions', 'Sessions'], ['checkins', 'Check-ins'], ['tasks', 'Tasks'],
  ['roadmap', 'Roadmap'], ['reviews', 'Drafts'], ['questions', 'Questions'], ['colleges', 'College list'], ['calendar', 'Calendar'],
];

export async function renderMentee(ctx, email, tab) {
  const subject = await getMember(email).catch(() => null);
  if (ctx.stale()) return;
  if (!subject || subject.role !== 'student') {
    mount(ctx.root, html`<div class="card empty-card"><h1>Student not found</h1><p class="muted">They may have been removed, or they are not assigned to you.</p><a class="btn btn-secondary" href="#/mentees">Back to mentees</a></div>`);
    return;
  }
  const base = `#/m/${encodeURIComponent(subject.email)}`;
  const mentorName = subject.mentorEmail && subject.mentorEmail !== ctx.me.email ? (await getMember(subject.mentorEmail).catch(() => null))?.name : '';
  mount(ctx.root, html`
    <a class="back" href="#/mentees">${icon('back')}${ctx.me.role === 'admin' ? 'Students' : 'My mentees'}</a>
    <header class="ph ph-person">
      <div class="who-lg">${avatar(subject, 'xl')}<div><h1>${subject.name}</h1>
        <p class="ph-sub">${[subject.grade ? `Grade ${subject.grade}` : '', subject.school, mentorName ? `Mentor: ${mentorName}` : ''].filter(Boolean).join(', ') || subject.email}</p>
        ${pathChips(subject.paths)}</div></div>
      <div class="ph-a">
        <a class="btn btn-secondary" href="${folderHref(subject)}" target="_blank" rel="noopener">${icon('folder')}Student folder</a>
        <a class="btn btn-secondary" href="mailto:${subject.email}">${icon('mail')}Email</a>
        ${ctx.me.role === 'admin' ? html`<a class="btn btn-quiet" href="#/people/${encodeURIComponent(subject.email)}">Edit profile</a>` : ''}
      </div>
    </header>
    <nav class="tabs" aria-label="${subject.name}">${TABS.map(([k, l]) => html`<a href="${base}/${k}" class="tab ${k === tab ? 'is-on' : ''}" ${k === tab ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>
    <div id="tab"></div>`);
  const tabCtx = { ...ctx, subject, self: false, coach: true, root: ctx.root.querySelector('#tab') };
  if (tab === 'checkins') return renderCheckins(tabCtx);
  if (tab === 'overview') return renderOverview(tabCtx);
  const fn = {
    sessions: student.renderSessions, tasks: student.renderTasks, roadmap: student.renderRoadmap,
    reviews: (c) => student.renderRequests(c, 'review'), questions: (c) => student.renderRequests(c, 'question'),
    colleges: student.renderColleges, calendar: student.renderCalendar,
  }[tab] || renderOverview;
  return fn(tabCtx);
}

async function renderOverview(ctx) {
  const data = await loadStudent(ctx.subject.email, { checkins: true });
  if (ctx.stale()) return;
  const sum = summarize(ctx.subject, data);
  const latest = sum.checkins[0];
  const extra = sum.flags.filter((f) => !latest || f !== CHECKIN[latest.status].label);
  mount(ctx.root, html`
    <section class="card checkin-bar ${latest ? `is-${CHECKIN[latest.status].tone}` : ''}">
      <div><p class="stat-l">Latest check-in</p>
        ${latest ? html`<p class="ci-v">${pill(CHECKIN[latest.status].label, CHECKIN[latest.status].tone)}<span class="muted">${fmtDay(latest.date)}${latest.byName ? `, ${latest.byName}` : ''}</span></p>${latest.note ? html`<p class="ci-note">${latest.note}</p>` : ''}`
          : html`<p class="muted">No check-ins yet.</p>`}
        ${extra.length ? html`<p class="flags">${extra.map((f) => html`<span>${f}</span>`)}</p>` : ''}</div>
      <div class="row"><button type="button" class="btn btn-primary" data-ci>Check in</button><button type="button" class="btn btn-secondary" data-goals>Edit goals and folder</button></div>
    </section>
    <div id="dash"></div>`);
  ctx.root.querySelector('[data-ci]').addEventListener('click', async () => { if (await checkinForm(ctx, ctx.subject)) { toast('Check-in saved'); ctx.refresh(); } });
  ctx.root.querySelector('[data-goals]').addEventListener('click', async () => { if (await student.editGoals(ctx)) { toast('Saved'); ctx.refresh(); } });
  await student.renderDashboard({ ...ctx, root: ctx.root.querySelector('#dash') }, data);
}

async function renderCheckins(ctx) {
  const list = (await listSub(ctx.subject.email, 'checkins')).sort((a, b) => b.date.localeCompare(a.date));
  if (ctx.stale()) return;
  mount(ctx.root, html`<section class="card">
    <header class="card-h"><div><h2>Check-ins</h2><p class="muted">Internal notes. Only mentors and founders see these.</p></div><button type="button" class="btn btn-primary" data-ci>${icon('plus')}New check-in</button></header>
    ${list.length ? html`<ol class="timeline">${list.map((c) => html`<li class="tl tl-${CHECKIN[c.status].tone}">
      <div class="tl-h">${pill(CHECKIN[c.status].label, CHECKIN[c.status].tone)}<span class="num">${fmtDay(c.date)}</span><span class="muted">${c.byName || c.by}</span>
        ${c.by === ctx.me.email || ctx.me.role === 'admin' ? html`<span class="sp"></span>${c.by === ctx.me.email ? html`<button type="button" class="icon-btn" data-edit="${c.id}" aria-label="Edit check-in">${icon('edit')}</button>` : ''}<button type="button" class="icon-btn" data-del="${c.id}" aria-label="Delete check-in">${icon('trash')}</button>` : ''}</div>
      ${c.note ? html`<div class="tl-b">${prose(c.note)}</div>` : ''}</li>`)}</ol>`
      : html`<p class="muted">No check-ins yet. A short weekly note keeps founders in the loop for the monthly review.</p>`}
  </section>`);
  ctx.root.querySelector('[data-ci]').addEventListener('click', async () => { if (await checkinForm(ctx, ctx.subject)) { toast('Check-in saved'); ctx.refresh(); } });
  ctx.root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', async () => {
    if (await checkinForm(ctx, ctx.subject, list.find((c) => c.id === b.dataset.edit))) { toast('Check-in saved'); ctx.refresh(); }
  }));
  ctx.root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmAction({ title: 'Delete this check-in?', message: 'This cannot be undone.' }))) return;
    try { await removeSub(ctx.subject.email, 'checkins', b.dataset.del); toast('Check-in deleted'); } catch (ex) { toast(friendlyError(ex), 'bad'); }
    ctx.refresh();
  }));
}

// ---------- waiting on you ----------
export async function renderInbox(ctx) {
  const { list } = await myStudents(ctx);
  const per = await Promise.all(list.map(async (st) => ({ st, reqs: await listSub(st.email, 'requests').catch(() => []) })));
  if (ctx.stale()) return;
  const items = per.flatMap(({ st, reqs }) => reqs.filter((r) => r.status === 'open').map((r) => ({ ...r, _student: st.email, _name: st.name })))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const recent = per.flatMap(({ st, reqs }) => reqs.filter((r) => r.status === 'answered').map((r) => ({ ...r, _student: st.email, _name: st.name })))
    .sort((a, b) => (b.answeredAt?.seconds || 0) - (a.answeredAt?.seconds || 0)).slice(0, 5);
  mount(ctx.root, html`
    <header class="ph"><div><h1>Waiting on you</h1><p class="ph-sub">Drafts and questions from students. Aim to reply within 2 business days; the oldest is first.</p></div></header>
    <section class="card">
      ${items.length ? html`<ul class="reqs">${items.map((r) => student.reqRow(r, { ...ctx, self: false, coach: true }, r.type === 'review', r._name))}</ul>`
        : html`<div class="empty"><h2>All caught up</h2><p class="muted">New drafts and questions from students appear here.</p></div>`}
    </section>
    ${recent.length ? html`<section class="card"><header class="card-h"><h2>Recently answered</h2></header><ul class="reqs">${recent.map((r) => student.reqRow(r, { ...ctx, self: false, coach: true }, r.type === 'review', r._name))}</ul></section>` : ''}`);
  const all = [...items, ...recent];
  ctx.root.querySelectorAll('[data-action="reply"]').forEach((b) => b.addEventListener('click', async () => {
    const r = all.find((x) => x.id === b.dataset.id && x._student === b.dataset.student) || all.find((x) => x.id === b.dataset.id);
    if (await student.replyForm(ctx, r._student, r)) { toast('Reply sent'); ctx.refresh(); }
  }));
}

// ---------- calendar of every session ----------
export async function renderStaffCalendar(ctx) {
  const { list } = await myStudents(ctx);
  const per = await Promise.all(list.map(async (st) => ({ st, sessions: await listSub(st.email, 'sessions').catch(() => []) })));
  if (ctx.stale()) return;
  const events = per.flatMap(({ st, sessions }) => sessions.map((s) => ({
    day: isoDay(toDate(s.start)), kind: 'session', sort: toDate(s.start).getTime(),
    label: `${fmtTime(s.start)} ${firstName(st.name)}: ${s.title}`,
  })));
  student.calendarView({ ...ctx, subject: ctx.me }, events, html`<header class="ph"><div><h1>Calendar</h1><p class="ph-sub">Every scheduled and past session with your students.</p></div></header>`);
}
