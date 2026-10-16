// Student pages. Each page renders for ctx.subject: the signed-in student, or a
// mentee when a mentor or founder opens them (ctx.coach is then true).
import {
  html, raw, mount, esc, safeUrl, PATHS, pathChips, avatar, firstName, folderHref,
  fmtDay, fmtShort, fmtTime, fmtWhen, fmtMonth, toDate, isoDay, parseDay, daysFromToday, ago, dueLabel,
  addBusinessDays, byDate, pill, toast, openForm, confirmAction, showDialog, prose, friendlyError,
} from '../ui.js';
import { icon } from '../icons.js';
import {
  getMember, loadStudent, listSub, addSub, updateSub, removeSub, updateMember, serverTimestamp, Timestamp,
} from '../store.js';
import { climb } from './climb.js';

const who = (ctx) => ctx.subject.email;
const pathOptions = Object.entries(PATHS).map(([k, v]) => [k, v.label]);
const now = () => new Date();
const splitSessions = (sessions) => {
  const t = now().getTime();
  const past = sessions.filter((s) => toDate(s.start)?.getTime() <= t).sort(byDate('start', -1));
  const upcoming = sessions.filter((s) => toDate(s.start)?.getTime() > t).sort(byDate('start'));
  return { past, upcoming };
};
const openTasks = (tasks) => tasks.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
const sortMilestones = (ms) => [...ms].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || String(a.title).localeCompare(b.title));
const pageHead = (title, sub, actions = '') => html`<header class="ph"><div><h1>${title}</h1>${sub ? html`<p class="ph-sub">${sub}</p>` : ''}</div>${actions ? html`<div class="ph-a">${actions}</div>` : ''}</header>`;
const addBtn = (label, action) => html`<button type="button" class="btn btn-primary" data-action="${action}">${icon('plus')}${label}</button>`;
const on = (root, action, fn) => root.querySelectorAll(`[data-action="${action}"]`).forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); fn(el.dataset.id, el, e); }));
const guarded = async (work, done) => { try { await work(); if (done) toast(done); } catch (ex) { console.error(ex); toast(friendlyError(ex), 'bad'); } };
const linkOut = (href, label, ic = 'external') => (safeUrl(href) ? html`<a class="link-out" href="${safeUrl(href)}" target="_blank" rel="noopener">${label}${icon(ic)}</a>` : '');
const mentorOf = async (subject) => (subject.mentorEmail ? getMember(subject.mentorEmail).catch(() => null) : null);

// ---------- dashboard ----------
export async function renderDashboard(ctx, preloaded) {
  const s = ctx.subject;
  const [data, mentor] = await Promise.all([preloaded || loadStudent(who(ctx)), mentorOf(s)]);
  if (ctx.stale()) return;
  const { past, upcoming } = splitSessions(data.sessions);
  const next = upcoming[0];
  const tasks = openTasks(data.tasks);
  const week = tasks.filter((t) => t.due && daysFromToday(t.due) <= 7);
  const shownTasks = (week.length ? week : tasks).slice(0, 5);
  const waiting = data.requests.filter((r) => r.status === 'open').length;
  const planned = Number(s.sessionsPlanned) || 0;
  const base = ctx.self ? '#/' : `#/m/${encodeURIComponent(s.email)}/`;
  const today = now().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  mount(ctx.root, html`
    ${ctx.self ? pageHead(`Welcome back, ${firstName(s.name)}`, today) : ''}
    <div class="grid">
      <section class="card span-5">
        <header class="card-h"><h2>${ctx.self ? 'Your program' : 'Program'}</h2>${s.active ? '' : pill('Enrollment pending', 'warn')}</header>
        ${pathChips(s.paths)}
        <dl class="facts">
          ${s.termStart || s.termEnd ? html`<div><dt>Term</dt><dd>${fmtMonth(s.termStart)}${s.termEnd ? html` to ${fmtMonth(s.termEnd)}` : ''}</dd></div>` : ''}
          <div><dt>Weekly 1:1 sessions</dt><dd><b class="num">${past.length}</b> completed${planned ? html` of ${planned}` : ''}</dd></div>
          <div><dt>Founder review</dt><dd>Monthly</dd></div>
          <div><dt>Replies to questions</dt><dd>Within 2 business days</dd></div>
          ${waiting ? html`<div><dt>${ctx.self ? 'Waiting on your mentor' : 'Waiting on a reply'}</dt><dd><a href="${base}reviews">${waiting} open</a></dd></div>` : ''}
        </dl>
        ${s.goals ? html`<div class="goals"><h3>Goals</h3>${prose(s.goals)}</div>` : ''}
        <footer class="card-f"><a class="btn btn-secondary" href="${folderHref(s)}" target="_blank" rel="noopener">${icon('folder')}Open student folder</a></footer>
      </section>

      <section class="card span-7">
        <header class="card-h"><h2>Mentorship</h2><a class="card-link" href="${base}sessions">All sessions</a></header>
        <div class="duo">
          <div>
            <h3>Next session</h3>
            ${next ? html`<p class="next-when">${fmtWhen(next.start)}</p><p class="muted">${next.title}${next.durationMin ? html`, ${next.durationMin} min` : ''}</p>
              ${safeUrl(next.link) ? html`<a class="btn btn-primary btn-sm" href="${safeUrl(next.link)}" target="_blank" rel="noopener">${icon('video')}Join session</a>` : ''}`
              : html`<p class="muted">None scheduled yet.</p>`}
          </div>
          <div>
            <h3>${ctx.self ? 'Your mentor' : 'Mentor'}</h3>
            ${mentor ? html`<div class="person">${avatar(mentor)}<div><b>${mentor.name}</b><a href="mailto:${mentor.email}">${mentor.email}</a></div></div>`
              : html`<p class="muted">Your mentor will appear here once you are matched.</p>`}
          </div>
        </div>
        <h3 class="tbl-h">Past sessions</h3>
        ${past.length ? sessionTable(past.slice(0, 5)) : html`<p class="muted">Sessions appear here after your first meeting.</p>`}
      </section>

      <section class="card span-5">
        <header class="card-h"><h2>${week.length ? 'Due this week' : 'Open tasks'}</h2><a class="card-link" href="${base}tasks">All tasks</a></header>
        ${shownTasks.length ? html`<ul class="tasks">${shownTasks.map((t) => taskRow(t, ctx))}</ul>`
          : html`<p class="muted">Nothing open. New tasks from your mentor show up here.</p>`}
      </section>

      <section class="card card-night span-7">
        <header class="card-h"><h2>${ctx.self ? 'Your climb' : 'Climb'}</h2><a class="card-link" href="${base}roadmap">Roadmap</a></header>
        ${climb(sortMilestones(data.milestones))}
      </section>
    </div>`);
  bindSessionNotes(ctx.root, past);
  bindTaskChecks(ctx, data.tasks);
}

function sessionTable(rows, coach = false) {
  return html`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Date</th><th>Title</th><th>Notes</th>${coach ? html`<th class="ta-r"><span class="vh">Actions</span></th>` : ''}</tr></thead>
    <tbody>${rows.map((s) => html`<tr>
      <td class="num nowrap">${fmtDay(s.start)}</td>
      <td>${s.title}${s.durationMin ? html`<span class="muted">, ${s.durationMin} min</span>` : ''}</td>
      <td class="nowrap">${s.notes || s.nextSteps || safeUrl(s.notesUrl) ? html`<button type="button" class="link" data-notes="${s.id}">View notes</button>` : html`<span class="muted">None</span>`}</td>
      ${coach ? html`<td class="ta-r nowrap"><button type="button" class="icon-btn" data-action="edit-session" data-id="${s.id}" aria-label="Edit session">${icon('edit')}</button><button type="button" class="icon-btn" data-action="del-session" data-id="${s.id}" aria-label="Delete session">${icon('trash')}</button></td>` : ''}
    </tr>`)}</tbody></table></div>`;
}

function bindSessionNotes(root, sessions) {
  root.querySelectorAll('[data-notes]').forEach((b) => b.addEventListener('click', () => {
    const s = sessions.find((x) => x.id === b.dataset.notes); if (!s) return;
    showDialog({
      title: s.title,
      body: html`<p class="muted">${fmtWhen(s.start)}${s.durationMin ? html`, ${s.durationMin} min` : ''}</p>
        ${s.notes ? html`<h3>Notes</h3>${prose(s.notes)}` : ''}
        ${s.nextSteps ? html`<h3>Next steps</h3>${prose(s.nextSteps)}` : ''}`,
      actions: linkOut(s.notesUrl, 'Open notes doc'),
    });
  }));
}

// ---------- sessions ----------
export async function renderSessions(ctx) {
  const s = ctx.subject;
  const [sessions, mentor] = await Promise.all([listSub(who(ctx), 'sessions'), mentorOf(s)]);
  if (ctx.stale()) return;
  const { past, upcoming } = splitSessions(sessions);
  mount(ctx.root, html`
    ${ctx.self ? pageHead('Sessions', 'Your weekly one-on-one meetings, with notes from each.') : ''}
    <div class="grid">
      <section class="card span-8">
        <header class="card-h"><h2>Past sessions</h2>${ctx.coach ? addBtn('Log a session', 'add-session') : ''}</header>
        ${past.length ? sessionTable(past, ctx.coach) : html`<p class="muted">${ctx.coach ? 'Log each meeting here so the student and founders can see notes and next steps.' : 'Notes from each session appear here after you meet.'}</p>`}
      </section>
      <div class="span-4 stack">
        <section class="card">
          <header class="card-h"><h2>${upcoming.length > 1 ? 'Coming up' : 'Next session'}</h2>${ctx.coach ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="add-session" data-id="future">${icon('plus')}Schedule</button>` : ''}</header>
          ${upcoming.length ? html`<ul class="upcoming">${upcoming.slice(0, 4).map((u) => html`<li>
            <p class="next-when">${fmtWhen(u.start)}</p><p class="muted">${u.title}</p>
            <div class="row">${safeUrl(u.link) ? html`<a class="btn btn-primary btn-sm" href="${safeUrl(u.link)}" target="_blank" rel="noopener">${icon('video')}Join</a>` : ''}
            ${ctx.coach ? html`<button type="button" class="icon-btn" data-action="edit-session" data-id="${u.id}" aria-label="Edit">${icon('edit')}</button><button type="button" class="icon-btn" data-action="del-session" data-id="${u.id}" aria-label="Delete">${icon('trash')}</button>` : ''}</div></li>`)}</ul>`
            : html`<p class="muted">None scheduled yet.</p>`}
        </section>
        <section class="card">
          <header class="card-h"><h2>${ctx.self ? 'Your mentor' : 'Mentor'}</h2></header>
          ${mentor ? html`<div class="person">${avatar(mentor, 'lg')}<div><b>${mentor.name}</b><a href="mailto:${mentor.email}">${mentor.email}</a></div></div>
            ${ctx.self ? html`<div class="row"><a class="btn btn-secondary btn-sm" href="#/questions">Ask a question</a><a class="btn btn-quiet btn-sm" href="mailto:${mentor.email}">${icon('mail')}Email</a></div>` : ''}`
            : html`<p class="muted">Not matched yet.</p>`}
        </section>
      </div>
    </div>`);
  bindSessionNotes(ctx.root, sessions);
  const form = (existing, future) => {
    const start = existing ? toDate(existing.start) : null;
    const base = start || (() => { const d = now(); if (future) d.setDate(d.getDate() + 7); d.setMinutes(0, 0, 0); return d; })();
    return openForm({
      title: existing ? 'Edit session' : future ? 'Schedule a session' : 'Log a session',
      fields: [
        { name: 'date', label: 'Date', type: 'date', value: isoDay(base), required: true },
        { name: 'time', label: 'Start time', type: 'time', value: `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`, required: true },
        { name: 'durationMin', label: 'Length in minutes', type: 'number', value: existing?.durationMin ?? 60, min: 5 },
        { name: 'title', label: 'Title', value: existing?.title || 'Weekly session', required: true, full: true },
        { name: 'link', label: 'Meeting link', type: 'url', value: existing?.link || '', placeholder: 'https://meet.google.com/...', full: true },
        { name: 'notes', label: 'Notes', type: 'textarea', value: existing?.notes || '', full: true, rows: 5, hint: 'The student sees these notes.' },
        { name: 'nextSteps', label: 'Next steps', type: 'textarea', value: existing?.nextSteps || '', full: true, rows: 3 },
        { name: 'notesUrl', label: 'Notes doc', type: 'url', value: existing?.notesUrl || '', placeholder: 'https://docs.google.com/...', full: true },
      ],
      submitLabel: existing ? 'Save session' : future ? 'Schedule session' : 'Log session',
      onSubmit: async (v) => {
        const [y, m, d] = v.date.split('-').map(Number); const [hh, mm] = v.time.split(':').map(Number);
        const data = {
          start: Timestamp.fromDate(new Date(y, m - 1, d, hh, mm)), title: v.title,
          durationMin: Math.max(5, Math.round(Number(v.durationMin) || 60)),
          link: v.link, notes: v.notes, nextSteps: v.nextSteps, notesUrl: v.notesUrl, mentorEmail: ctx.me.email,
        };
        if (existing) await updateSub(who(ctx), 'sessions', existing.id, data);
        else await addSub(who(ctx), 'sessions', data);
      },
    });
  };
  on(ctx.root, 'add-session', async (id) => { if (await form(null, id === 'future')) { toast('Session saved'); ctx.refresh(); } });
  on(ctx.root, 'edit-session', async (id) => { if (await form(sessions.find((x) => x.id === id))) { toast('Session saved'); ctx.refresh(); } });
  on(ctx.root, 'del-session', async (id) => {
    if (await confirmAction({ title: 'Delete this session?', message: 'Its notes are deleted too. This cannot be undone.' })) {
      await guarded(() => removeSub(who(ctx), 'sessions', id), 'Session deleted'); ctx.refresh();
    }
  });
}

// ---------- tasks ----------
function taskRow(t, ctx, full = false) {
  const n = t.due ? daysFromToday(t.due) : null;
  const canEdit = ctx.coach || t.createdBy === ctx.me.email;
  return html`<li class="task ${t.done ? 'is-done' : ''}">
    <label class="task-c"><input type="checkbox" data-task="${t.id}" ${t.done ? raw('checked') : ''} aria-label="Mark ${t.title} done"><span class="box" aria-hidden="true"></span></label>
    <div class="task-b"><p class="task-t">${t.title}</p>
      ${full && t.details ? html`<p class="muted task-d">${t.details}</p>` : ''}
      <p class="task-m">${t.due ? html`<span class="${!t.done && n < 0 ? 'is-late' : ''}">${t.done ? `Due ${fmtShort(t.due)}` : dueLabel(t.due)}</span>` : html`<span>No due date</span>`}
        ${full && t.createdBy && t.createdBy !== ctx.subject.email ? html`<span>From your mentor</span>` : ''}</p></div>
    ${full && canEdit ? html`<div class="task-a"><button type="button" class="icon-btn" data-action="edit-task" data-id="${t.id}" aria-label="Edit task">${icon('edit')}</button><button type="button" class="icon-btn" data-action="del-task" data-id="${t.id}" aria-label="Delete task">${icon('trash')}</button></div>` : ''}
  </li>`;
}

function bindTaskChecks(ctx, tasks) {
  ctx.root.querySelectorAll('[data-task]').forEach((box) => box.addEventListener('change', async () => {
    const t = tasks.find((x) => x.id === box.dataset.task);
    const done = box.checked;
    box.closest('.task')?.classList.toggle('is-done', done);
    try { await updateSub(who(ctx), 'tasks', t.id, { done, doneAt: done ? serverTimestamp() : null }); t.done = done; }
    catch (ex) { box.checked = !done; box.closest('.task')?.classList.toggle('is-done', !done); toast(friendlyError(ex), 'bad'); }
  }));
}

export async function renderTasks(ctx) {
  const tasks = await listSub(who(ctx), 'tasks');
  if (ctx.stale()) return;
  const open = openTasks(tasks);
  const groups = [
    ['Overdue', open.filter((t) => t.due && daysFromToday(t.due) < 0)],
    ['This week', open.filter((t) => t.due && daysFromToday(t.due) >= 0 && daysFromToday(t.due) <= 7)],
    ['Later', open.filter((t) => t.due && daysFromToday(t.due) > 7)],
    ['No due date', open.filter((t) => !t.due)],
  ].filter(([, list]) => list.length);
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.due || '').localeCompare(a.due || ''));
  mount(ctx.root, html`
    ${ctx.self ? pageHead('Tasks', 'What to do between sessions. Check things off as you go.', addBtn('Add a task', 'add-task')) : ''}
    <section class="card">
      ${ctx.self ? '' : html`<header class="card-h"><h2>Tasks</h2>${addBtn('Assign a task', 'add-task')}</header>`}
      ${groups.length ? groups.map(([label, list]) => html`<h3 class="grp-h">${label}<span>${list.length}</span></h3><ul class="tasks">${list.map((t) => taskRow(t, ctx, true))}</ul>`)
        : html`<p class="muted">No open tasks.${ctx.coach ? ' Assign one to give your mentee a clear next step.' : ''}</p>`}
      ${done.length ? html`<details class="done-list"><summary>Completed <span>${done.length}</span></summary><ul class="tasks">${done.map((t) => taskRow(t, ctx, true))}</ul></details>` : ''}
    </section>`);
  bindTaskChecks(ctx, tasks);
  const form = (t) => openForm({
    title: t ? 'Edit task' : ctx.coach ? 'Assign a task' : 'Add a task',
    fields: [
      { name: 'title', label: 'Task', value: t?.title || '', required: true, full: true },
      { name: 'due', label: 'Due date', type: 'date', value: t?.due || '' },
      { name: 'details', label: 'Details', type: 'textarea', value: t?.details || '', full: true, rows: 3 },
    ],
    submitLabel: t ? 'Save task' : ctx.coach ? 'Assign task' : 'Add task',
    onSubmit: async (v) => {
      if (t) await updateSub(who(ctx), 'tasks', t.id, { title: v.title, due: v.due, details: v.details, done: Boolean(t.done), createdBy: t.createdBy });
      else await addSub(who(ctx), 'tasks', { title: v.title, due: v.due, details: v.details, done: false, createdBy: ctx.me.email });
    },
  });
  on(ctx.root, 'add-task', async () => { if (await form()) { toast('Task saved'); ctx.refresh(); } });
  on(ctx.root, 'edit-task', async (id) => { if (await form(tasks.find((x) => x.id === id))) { toast('Task saved'); ctx.refresh(); } });
  on(ctx.root, 'del-task', async (id) => {
    if (await confirmAction({ title: 'Delete this task?', message: 'This cannot be undone.' })) { await guarded(() => removeSub(who(ctx), 'tasks', id), 'Task deleted'); ctx.refresh(); }
  });
}

// ---------- roadmap ----------
const MS_STATUS = { planned: ['Planned', 'neutral'], in_progress: ['In progress', 'info'], done: ['Done', 'ok'] };
export async function renderRoadmap(ctx) {
  const milestones = sortMilestones(await listSub(who(ctx), 'milestones'));
  if (ctx.stale()) return;
  mount(ctx.root, html`
    ${ctx.self ? pageHead('Roadmap', 'The milestones you and your mentor are working toward, in order.') : ''}
    <section class="card card-night card-climb">${climb(milestones, { large: true })}</section>
    <section class="card">
      <header class="card-h"><h2>Milestones</h2>${ctx.coach ? addBtn('Add a milestone', 'add-ms') : ''}</header>
      ${milestones.length ? html`<ol class="ms-list">${milestones.map((m, i) => html`<li class="ms ms-${m.status}">
        <span class="ms-n num">${i + 1}</span>
        <div class="ms-b"><p class="ms-t">${m.title}</p>
          <p class="ms-m">${m.due ? html`<span>By ${fmtDay(m.due)}</span>` : ''}${m.path && PATHS[m.path] ? pathChips([m.path]) : ''}</p>
          ${m.notes ? html`<p class="muted">${m.notes}</p>` : ''}</div>
        <div class="ms-a">
          <label class="vh" for="ms-${m.id}">Status</label>
          <select id="ms-${m.id}" class="select-sm" data-ms="${m.id}">${Object.entries(MS_STATUS).map(([k, [l]]) => html`<option value="${k}" ${m.status === k ? raw('selected') : ''}>${l}</option>`)}</select>
          ${ctx.coach ? html`<button type="button" class="icon-btn" data-action="edit-ms" data-id="${m.id}" aria-label="Edit milestone">${icon('edit')}</button><button type="button" class="icon-btn" data-action="del-ms" data-id="${m.id}" aria-label="Delete milestone">${icon('trash')}</button>` : ''}
        </div></li>`)}</ol>`
        : html`<p class="muted">${ctx.coach ? 'Lay out the route: a research question, a first draft, a submission, a result.' : 'Your mentor will map out milestones with you in your first sessions.'}</p>`}
    </section>`);
  ctx.root.querySelectorAll('[data-ms]').forEach((sel) => sel.addEventListener('change', async () => {
    await guarded(() => updateSub(who(ctx), 'milestones', sel.dataset.ms, { status: sel.value }), 'Milestone updated'); ctx.refresh();
  }));
  const form = (m) => openForm({
    title: m ? 'Edit milestone' : 'Add a milestone',
    fields: [
      { name: 'title', label: 'Milestone', value: m?.title || '', required: true, full: true, placeholder: 'Submit abstract to regional fair' },
      { name: 'due', label: 'Target date', type: 'date', value: m?.due || '' },
      { name: 'path', label: 'Path', type: 'select', value: m?.path || '', options: [['', 'None'], ...pathOptions] },
      { name: 'status', label: 'Status', type: 'select', value: m?.status || 'planned', options: Object.entries(MS_STATUS).map(([k, [l]]) => [k, l]) },
      { name: 'notes', label: 'Notes', type: 'textarea', value: m?.notes || '', full: true, rows: 3 },
    ],
    submitLabel: m ? 'Save milestone' : 'Add milestone',
    onSubmit: async (v) => {
      const data = { title: v.title, due: v.due, path: v.path, status: v.status, notes: v.notes };
      if (m) await updateSub(who(ctx), 'milestones', m.id, data); else await addSub(who(ctx), 'milestones', data);
    },
  });
  on(ctx.root, 'add-ms', async () => { if (await form()) { toast('Milestone saved'); ctx.refresh(); } });
  on(ctx.root, 'edit-ms', async (id) => { if (await form(milestones.find((x) => x.id === id))) { toast('Milestone saved'); ctx.refresh(); } });
  on(ctx.root, 'del-ms', async (id) => {
    if (await confirmAction({ title: 'Delete this milestone?', message: 'This cannot be undone.' })) { await guarded(() => removeSub(who(ctx), 'milestones', id), 'Milestone deleted'); ctx.refresh(); }
  });
}

// ---------- draft reviews and questions ----------
const KINDS = [['College essay', 'College essay'], ['Program application', 'Program application'], ['Research paper or abstract', 'Research paper or abstract'], ['Competition materials', 'Competition materials'], ['Outreach email', 'Outreach email'], ['Other', 'Other']];
export async function renderRequests(ctx, type) {
  const review = type === 'review';
  const all = await listSub(who(ctx), 'requests');
  if (ctx.stale()) return;
  const list = all.filter((r) => r.type === type).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const open = list.filter((r) => r.status === 'open');
  const askLabel = review ? 'Submit a draft' : 'Ask a question';
  mount(ctx.root, html`
    ${ctx.self ? pageHead(review ? 'Draft reviews' : 'Questions', review
      ? 'Share a draft and your mentor returns comments within 2 business days.'
      : 'Ask anything between sessions. Your mentor replies within 2 business days.') : ''}
    <div class="grid">
      ${ctx.self ? html`<section class="card span-8">
        ${review ? html`<h2>Before you submit</h2><ul class="bullets">
          <li>Share a Google Doc link with comment access for your mentor.</li>
          <li>Every word should be your own. Mentors ask questions and give feedback; they never write for you.</li>
          <li>Submit early. Turnaround can run longer around program and college deadlines.</li>
          <li>Send one draft at a time per piece, and say what feedback you want most.</li></ul>`
        : html`<h2>Good questions to ask here</h2><ul class="bullets">
          <li>Anything blocking your next task: a method, a source, a step you are unsure of.</li>
          <li>Choices between options: which program, which journal, which fair.</li>
          <li>Logistics: deadlines, forms, recommendations.</li></ul>`}
      </section>
      <section class="card span-4 stat-card"><p class="stat-l">${review ? 'Drafts with your mentor' : 'Waiting for a reply'}</p><p class="stat-v num">${open.length}</p>
        <button type="button" class="btn btn-primary" data-action="ask">${askLabel}</button></section>` : ''}
      <section class="card span-12">
        <header class="card-h"><h2>${review ? (ctx.self ? 'Your drafts' : 'Draft reviews') : (ctx.self ? 'Your questions' : 'Questions')}</h2>${ctx.self && list.length ? html`<button type="button" class="btn btn-secondary btn-sm" data-action="ask">${icon('plus')}${askLabel}</button>` : ''}</header>
        ${list.length ? html`<ul class="reqs">${list.map((r) => reqRow(r, ctx, review))}</ul>`
          : html`<p class="muted">${review ? 'No drafts yet. Submit one to get feedback.' : 'No questions yet.'}</p>`}
      </section>
    </div>`);
  const askForm = (r) => openForm({
    title: r ? (review ? 'Edit draft' : 'Edit question') : askLabel,
    fields: review ? [
      { name: 'title', label: 'What is it?', value: r?.title || '', required: true, full: true, placeholder: 'Common App personal statement, draft 2' },
      { name: 'kind', label: 'Type', type: 'select', value: r?.kind || 'College essay', options: KINDS },
      { name: 'url', label: 'Link to the draft', type: 'url', value: r?.url || '', required: true, full: true, placeholder: 'https://docs.google.com/...' },
      { name: 'body', label: 'What feedback do you want?', type: 'textarea', value: r?.body || '', full: true, rows: 4 },
    ] : [
      { name: 'title', label: 'Your question', value: r?.title || '', required: true, full: true },
      { name: 'body', label: 'Details', type: 'textarea', value: r?.body || '', full: true, rows: 5 },
      { name: 'url', label: 'Related link', type: 'url', value: r?.url || '', full: true },
    ],
    submitLabel: r ? 'Save' : review ? 'Submit draft' : 'Send question',
    onSubmit: async (v) => {
      const data = { title: v.title, body: v.body, url: v.url, ...(review ? { kind: v.kind } : {}) };
      if (r) await updateSub(who(ctx), 'requests', r.id, data);
      else await addSub(who(ctx), 'requests', { ...data, type, status: 'open', createdBy: ctx.me.email });
    },
  });
  on(ctx.root, 'ask', async () => { if (await askForm()) { toast(review ? 'Draft submitted' : 'Question sent'); ctx.refresh(); } });
  on(ctx.root, 'edit-req', async (id) => { if (await askForm(list.find((x) => x.id === id))) { toast('Saved'); ctx.refresh(); } });
  on(ctx.root, 'del-req', async (id) => {
    if (await confirmAction({ title: review ? 'Withdraw this draft?' : 'Delete this question?', message: 'This cannot be undone.', confirmLabel: review ? 'Withdraw' : 'Delete' })) {
      await guarded(() => removeSub(who(ctx), 'requests', id), 'Removed'); ctx.refresh();
    }
  });
  on(ctx.root, 'reply', async (id) => { if (await replyForm(ctx, who(ctx), list.find((x) => x.id === id))) { toast('Reply sent'); ctx.refresh(); } });
}

export function reqRow(r, ctx, review, studentName = '') {
  const due = r.createdAt?.toDate ? addBusinessDays(r.createdAt.toDate(), 2) : null;
  const late = r.status === 'open' && due && due < now();
  const status = r.status === 'answered'
    ? pill(review ? 'Feedback returned' : 'Answered', 'ok')
    : pill(due ? `Reply by ${fmtShort(due)}` : 'Waiting', late ? 'bad' : 'warn');
  return html`<li class="req">
    <div class="req-h"><div>
      ${studentName ? html`<p class="req-who">${studentName}</p>` : ''}
      <p class="req-t">${r.title}</p>
      <p class="req-m">${review && r.kind ? html`<span>${r.kind}</span>` : ''}<span>Sent ${fmtDay(r.createdAt?.toDate ? r.createdAt.toDate() : null) || 'just now'}</span></p></div>${status}</div>
    ${r.body ? html`<div class="req-body">${prose(r.body)}</div>` : ''}
    <div class="row">${linkOut(r.url, review ? 'Open draft' : 'Open link')}
      ${ctx.self && r.status === 'open' ? html`<button type="button" class="btn btn-quiet btn-sm" data-action="edit-req" data-id="${r.id}">Edit</button><button type="button" class="btn btn-quiet btn-sm" data-action="del-req" data-id="${r.id}">${review ? 'Withdraw' : 'Delete'}</button>` : ''}
      ${ctx.coach ? html`<button type="button" class="btn ${r.status === 'open' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="reply" data-id="${r.id}" ${studentName ? raw(`data-student="${esc(r._student || '')}"`) : ''}>${r.status === 'open' ? (review ? 'Return feedback' : 'Reply') : 'Edit reply'}</button>` : ''}</div>
    ${r.reply || safeUrl(r.replyUrl) ? html`<div class="reply"><p class="reply-l">${review ? 'Feedback' : 'Reply'}${r.answeredAt?.toDate ? html`<span>, ${fmtDay(r.answeredAt.toDate())}</span>` : ''}</p>${prose(r.reply)}${linkOut(r.replyUrl, 'Open comments')}</div>` : ''}
  </li>`;
}

export function replyForm(ctx, studentEmail, r) {
  const review = r.type === 'review';
  return openForm({
    title: review ? 'Return feedback' : 'Reply',
    intro: r.title,
    fields: [
      { name: 'reply', label: review ? 'Feedback' : 'Reply', type: 'textarea', value: r.reply || '', required: true, full: true, rows: 7 },
      { name: 'replyUrl', label: review ? 'Link to your comments' : 'Link', type: 'url', value: r.replyUrl || '', full: true, hint: review ? 'If you left comments in the doc, link it here.' : '' },
    ],
    submitLabel: review ? 'Send feedback' : 'Send reply',
    onSubmit: (v) => updateSub(studentEmail, 'requests', r.id, {
      reply: v.reply, replyUrl: v.replyUrl, status: 'answered', answeredBy: ctx.me.email, answeredAt: serverTimestamp(),
    }),
  });
}

// ---------- college list ----------
const TIERS = { reach: ['Reach', 'rose'], target: ['Target', 'glacier'], likely: ['Likely', 'ok'] };
const PLANS = [['', 'Not set'], ['ED', 'Early Decision'], ['ED2', 'Early Decision II'], ['EA', 'Early Action'], ['REA', 'Restrictive Early Action'], ['RD', 'Regular Decision'], ['Rolling', 'Rolling']];
const C_STATUS = ['Researching', 'Planning to apply', 'Applying', 'Submitted', 'Admitted', 'Waitlisted', 'Deferred', 'Denied', 'Enrolling'];
const SCHOOLS = ['Harvard University', 'Yale University', 'Princeton University', 'Stanford University', 'Massachusetts Institute of Technology', 'Columbia University', 'University of Pennsylvania', 'Brown University', 'Dartmouth College', 'Cornell University', 'University of Chicago', 'Duke University', 'Northwestern University', 'Johns Hopkins University', 'California Institute of Technology', 'Rice University', 'Vanderbilt University', 'Washington University in St. Louis', 'University of Notre Dame', 'Georgetown University', 'Carnegie Mellon University', 'Emory University', 'University of Southern California', 'University of California, Berkeley', 'University of California, Los Angeles', 'University of California, San Diego', 'University of Michigan', 'University of Virginia', 'University of North Carolina at Chapel Hill', 'Georgia Institute of Technology', 'New York University', 'Tufts University', 'Boston University', 'Northeastern University', 'University of Texas at Austin', 'University of Illinois Urbana-Champaign', 'University of Wisconsin-Madison', 'University of Washington', 'Purdue University', 'Williams College', 'Amherst College', 'Swarthmore College', 'Pomona College', 'Harvey Mudd College', 'Wellesley College', 'Bowdoin College', 'Case Western Reserve University', 'University of Rochester', 'Rensselaer Polytechnic Institute', 'Brandeis University'];

export async function renderColleges(ctx) {
  const list = (await listSub(who(ctx), 'colleges')).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.name.localeCompare(b.name));
  if (ctx.stale()) return;
  const count = (t) => list.filter((c) => c.tier === t).length;
  mount(ctx.root, html`
    ${ctx.self ? pageHead('College list', 'Add schools as you research them. Your mentor helps you shape a balanced list of reaches, targets and likelies.', addBtn('Add a school', 'add-col')) : ''}
    <section class="card">
      <header class="card-h"><h2>${ctx.self ? 'Your list' : 'College list'}</h2>
        <div class="row">${Object.entries(TIERS).map(([k, [l, tone]]) => html`<span class="tally tally-${tone}"><b class="num">${count(k)}</b> ${l}</span>`)}${ctx.self ? '' : addBtn('Add a school', 'add-col')}</div></header>
      ${list.length ? html`<div class="tbl-wrap"><table class="tbl tbl-stack">
        <thead><tr><th>School</th><th>Fit</th><th>Plan</th><th>Deadline</th><th>Status</th><th class="ta-r"><span class="vh">Actions</span></th></tr></thead>
        <tbody>${list.map((c) => html`<tr>
          <td><b class="strong">${c.name}</b>${c.notes ? html`<p class="muted cell-note">${c.notes}</p>` : ''}</td>
          <td data-l="Fit">${c.tier ? pill(TIERS[c.tier][0], TIERS[c.tier][1]) : html`<span class="muted">Not set</span>`}</td>
          <td data-l="Plan">${c.plan || html`<span class="muted">Not set</span>`}</td>
          <td class="num nowrap" data-l="Deadline">${c.deadline ? fmtDay(c.deadline) : html`<span class="muted">Not set</span>`}</td>
          <td data-l="Status">${c.status || 'Researching'}</td>
          <td class="ta-r nowrap"><button type="button" class="icon-btn" data-action="edit-col" data-id="${c.id}" aria-label="Edit ${c.name}">${icon('edit')}</button><button type="button" class="icon-btn" data-action="del-col" data-id="${c.id}" aria-label="Remove ${c.name}">${icon('trash')}</button></td>
        </tr>`)}</tbody></table></div>`
        : html`<p class="muted">No schools yet. Start with the ones you already know you love.</p>`}
    </section>
    <datalist id="schools">${SCHOOLS.map((n) => html`<option value="${n}">`)}</datalist>`);
  const form = (c) => openForm({
    title: c ? `Edit ${c.name}` : 'Add a school',
    fields: [
      { name: 'name', label: 'School', value: c?.name || '', required: true, full: true, list: 'schools' },
      { name: 'tier', label: 'Fit', type: 'select', value: c?.tier || 'target', options: Object.entries(TIERS).map(([k, [l]]) => [k, l]) },
      { name: 'plan', label: 'Application plan', type: 'select', value: c?.plan || '', options: PLANS },
      { name: 'deadline', label: 'Deadline', type: 'date', value: c?.deadline || '' },
      { name: 'status', label: 'Status', type: 'select', value: c?.status || 'Researching', options: C_STATUS.map((s) => [s, s]) },
      { name: 'notes', label: 'Notes', type: 'textarea', value: c?.notes || '', full: true, rows: 3 },
    ],
    submitLabel: c ? 'Save school' : 'Add school',
    onSubmit: async (v) => {
      const data = { name: v.name, tier: v.tier, plan: v.plan, deadline: v.deadline, status: v.status, notes: v.notes };
      if (c) await updateSub(who(ctx), 'colleges', c.id, data); else await addSub(who(ctx), 'colleges', data);
    },
  });
  on(ctx.root, 'add-col', async () => { if (await form()) { toast('School saved'); ctx.refresh(); } });
  on(ctx.root, 'edit-col', async (id) => { if (await form(list.find((x) => x.id === id))) { toast('School saved'); ctx.refresh(); } });
  on(ctx.root, 'del-col', async (id) => {
    const c = list.find((x) => x.id === id);
    if (await confirmAction({ title: `Remove ${c.name}?`, message: 'It comes off the list. You can add it again later.', confirmLabel: 'Remove' })) {
      await guarded(() => removeSub(who(ctx), 'colleges', id), 'School removed'); ctx.refresh();
    }
  });
}

// ---------- calendar ----------
export async function renderCalendar(ctx) {
  const data = await loadStudent(who(ctx));
  if (ctx.stale()) return;
  const events = [
    ...data.sessions.map((s) => ({ day: isoDay(toDate(s.start)), kind: 'session', label: `${fmtTime(s.start)} ${s.title}`, sort: toDate(s.start).getTime() })),
    ...data.tasks.filter((t) => t.due && !t.done).map((t) => ({ day: t.due, kind: 'task', label: t.title })),
    ...data.milestones.filter((m) => m.due).map((m) => ({ day: m.due, kind: 'milestone', label: m.title })),
    ...data.colleges.filter((c) => c.deadline).map((c) => ({ day: c.deadline, kind: 'deadline', label: `${c.name} ${c.plan || ''}`.trim() })),
  ];
  calendarView(ctx, events, ctx.self ? pageHead('Calendar', 'Sessions, due dates, milestones and application deadlines.') : '');
}

const KIND_LABEL = { session: 'Session', task: 'Task due', milestone: 'Milestone', deadline: 'Application deadline' };
export function calendarView(ctx, events, head = '') {
  const key = `es-cal-${ctx.subject.email}`;
  let cursor = (() => { try { const s = sessionStorage.getItem(key); if (s) return parseDay(`${s}-01`); } catch (_) {} const d = now(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  const draw = () => {
    const y = cursor.getFullYear(); const m = cursor.getMonth();
    const first = new Date(y, m, 1); const startPad = first.getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    events.forEach((e) => { (byDay[e.day] ||= []).push(e); });
    Object.values(byDay).forEach((l) => l.sort((a, b) => (a.sort || 0) - (b.sort || 0)));
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(html`<div class="cal-c is-pad" aria-hidden="true"></div>`);
    const today = isoDay();
    for (let d = 1; d <= days; d += 1) {
      const iso = isoDay(new Date(y, m, d)); const list = byDay[iso] || [];
      cells.push(html`<div class="cal-c ${iso === today ? 'is-today' : ''}"><span class="cal-d num">${d}</span>
        ${list.slice(0, 3).map((e) => html`<span class="ev ev-${e.kind}" title="${KIND_LABEL[e.kind]}: ${e.label}">${e.label}</span>`)}
        ${list.length > 3 ? html`<span class="ev-more">${list.length - 3} more</span>` : ''}</div>`);
    }
    const monthEvents = events.filter((e) => e.day.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).sort((a, b) => a.day.localeCompare(b.day) || (a.sort || 0) - (b.sort || 0));
    mount(ctx.root, html`${head}
      <section class="card cal">
        <header class="card-h"><h2>${cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
          <div class="row"><button type="button" class="btn btn-secondary btn-sm" data-cal="-1" aria-label="Previous month">${icon('back')}</button><button type="button" class="btn btn-secondary btn-sm" data-cal="0">Today</button><button type="button" class="btn btn-secondary btn-sm cal-next" data-cal="1" aria-label="Next month">${icon('back')}</button></div></header>
        <div class="legend">${Object.entries(KIND_LABEL).map(([k, l]) => html`<span class="lg lg-${k}"><i></i>${l}</span>`)}</div>
        <div class="cal-g" role="grid" aria-label="Month view">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => html`<div class="cal-w">${d}</div>`)}${cells}</div>
        <div class="cal-list">${monthEvents.length ? html`<ul>${monthEvents.map((e) => html`<li><span class="num">${fmtShort(e.day)}</span><span class="lg lg-${e.kind}"><i></i></span><span>${e.label}</span></li>`)}</ul>` : html`<p class="muted">Nothing on the calendar this month.</p>`}</div>
      </section>`);
    ctx.root.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
      const step = Number(b.dataset.cal);
      if (step === 0) { const d = now(); cursor = new Date(d.getFullYear(), d.getMonth(), 1); } else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
      try { sessionStorage.setItem(key, `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`); } catch (_) {}
      draw();
    }));
  };
  draw();
}

// ---------- goals (mentor edit, shown on overview) ----------
export async function editGoals(ctx) {
  const s = ctx.subject;
  return openForm({
    title: 'Goals and folder',
    fields: [
      { name: 'goals', label: 'Goals', type: 'textarea', value: s.goals || '', full: true, rows: 5, hint: 'The student sees these on their dashboard.' },
      { name: 'driveFolderUrl', label: 'Student folder link', type: 'url', value: s.driveFolderUrl || '', full: true, hint: 'The Google Drive folder named after the student. Leave empty to search Drive by name.' },
    ],
    submitLabel: 'Save',
    onSubmit: (v) => updateMember(s.email, { goals: v.goals, driveFolderUrl: v.driveFolderUrl }),
  });
}
