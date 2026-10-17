// People (founders only): add students, parents' contact, mentors and founders;
// assign mentors; mark enrollment; link or create each student's Drive folder.
import {
  html, raw, mount, PATHS, pathChips, avatar, safeUrl, driveFolderName, folderHref, fmtDay, ago, toDate,
  pill, toast, openForm, confirmAction, friendlyError,
} from '../ui.js';
import { icon } from '../icons.js';
import { listMembers, saveMember, removeMember, normEmail } from '../store.js';
import { googleClientId } from '../config.js';
import { createStudentFolder } from '../drive.js';
import { openInviteForm, pendingInvites } from './invites.js';

const ROLES = { student: 'Student', mentor: 'Mentor', admin: 'Founder' };
const FILTERS = [['all', 'Everyone'], ['student', 'Students'], ['mentor', 'Mentors'], ['admin', 'Founders']];

export async function renderPeople(ctx, openEmail) {
  const people = await listMembers();
  if (ctx.stale()) return;
  let filter = 'all';
  try { filter = sessionStorage.getItem('es-people') || 'all'; } catch (_) {}
  const staff = people.filter((p) => p.role !== 'student');
  const nameOf = (email) => people.find((p) => p.email === email)?.name || email;

  const draw = () => {
    const shown = people.filter((p) => filter === 'all' || p.role === filter);
    mount(ctx.root, html`
      <header class="ph"><div><h1>People</h1><p class="ph-sub">Everyone with portal access. Send an invite code, or add someone by the exact email they will sign in with.</p></div>
        <div class="ph-a"><button type="button" class="btn btn-secondary" data-add>Add by email</button><button type="button" class="btn btn-primary" data-invite>${icon('plus')}Create an invite</button></div></header>
      <div id="invites"></div>
      <div class="seg seg-filter" role="group" aria-label="Filter people">${FILTERS.map(([k, l]) => html`<button type="button" class="seg-b ${filter === k ? 'is-on' : ''}" data-filter="${k}" aria-pressed="${filter === k ? 'true' : 'false'}">${l}<span class="num">${k === 'all' ? people.length : people.filter((p) => p.role === k).length}</span></button>`)}</div>
      <section class="card">
        ${shown.length ? html`<div class="tbl-wrap"><table class="tbl tbl-people tbl-stack">
          <thead><tr><th>Name</th><th>Role</th><th>Mentor</th><th>Enrolled</th><th>Last active</th><th class="ta-r"><span class="vh">Actions</span></th></tr></thead>
          <tbody>${shown.map((p) => html`<tr>
            <td><span class="who">${avatar(p)}<span><b>${p.name}</b><span class="muted">${p.email}</span></span></span></td>
            <td data-l="Role">${ROLES[p.role] || p.role}${p.role === 'student' && p.paths?.length ? pathChips(p.paths) : ''}</td>
            <td data-l="Mentor">${p.role === 'student' ? (p.mentorEmail ? nameOf(p.mentorEmail) : html`<span class="is-late">Not assigned</span>`) : html`<span class="muted">Not applicable</span>`}</td>
            <td data-l="Enrolled">${p.role === 'student' ? (p.active ? pill('Enrolled', 'ok') : pill('Not yet', 'neutral')) : html`<span class="muted">Staff</span>`}</td>
            <td class="nowrap" data-l="Last active">${p.lastSeenAt ? ago(p.lastSeenAt) : html`<span class="muted">Never signed in</span>`}</td>
            <td class="ta-r nowrap">${p.role === 'student' ? html`<a class="btn btn-quiet btn-sm" href="#/m/${encodeURIComponent(p.email)}/overview">Open</a>` : ''}<button type="button" class="btn btn-secondary btn-sm" data-edit="${p.email}">Edit</button></td>
          </tr>`)}</tbody></table></div>`
          : html`<div class="empty"><p class="muted">No one here yet.</p></div>`}
      </section>`);
    ctx.root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter; try { sessionStorage.setItem('es-people', filter); } catch (_) {} draw();
    }));
    ctx.root.querySelector('[data-add]').addEventListener('click', () => personForm());
    ctx.root.querySelector('[data-invite]').addEventListener('click', async () => { if (await openInviteForm(ctx, staff)) pendingInvites(ctx, ctx.root.querySelector('#invites')); });
    pendingInvites(ctx, ctx.root.querySelector('#invites'));
    ctx.root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => personForm(people.find((p) => p.email === b.dataset.edit))));
  };

  const personForm = async (p) => {
    const isNew = !p;
    const isStudent = (v) => v.role === 'student';
    const mentorOptions = [['', 'Not assigned'], ...staff.map((s) => [s.email, `${s.name} (${ROLES[s.role]})`])];
    const folderTools = !isNew && p.role === 'student'
      ? html`${googleClientId && !safeUrl(p.driveFolderUrl) ? html`<button type="button" class="btn btn-secondary btn-sm" data-make-folder>${icon('folder')}Create Drive folder</button>` : ''}
        <a class="btn btn-quiet btn-sm" href="${folderHref(p)}" target="_blank" rel="noopener">Open folder</a>`
      : '';
    const removeBtn = !isNew && p.email !== ctx.me.email ? html`<button type="button" class="btn btn-danger-quiet btn-sm" data-remove>Remove access</button>` : '';
    const done = await openForm({
      title: isNew ? 'Add by email' : `Edit ${p.name}`,
      intro: isNew ? 'They can sign in right away with Google, or set up a password, using this exact email.' : '',
      fields: [
        { name: 'name', label: 'Full name', value: p?.name || '', required: true },
        { name: 'email', label: 'Email', type: 'email', value: p?.email || '', required: true, disabled: !isNew, hint: isNew ? '' : 'To change an email, remove this person and add them again.' },
        { name: 'role', label: 'Role', type: 'select', value: p?.role || 'student', options: Object.entries(ROLES) },
        { name: 'mentorEmail', label: 'Mentor', type: 'select', value: p?.mentorEmail || '', options: mentorOptions, showIf: isStudent },
        { name: 'active', label: 'Enrollment', type: 'toggle', value: p ? Boolean(p.active) : true, toggleLabel: 'Enrolled and paid. Opens the resource library.', showIf: isStudent, full: true },
        { name: 'paths', label: 'Paths', type: 'checks', value: p?.paths || [], options: Object.entries(PATHS).map(([k, v]) => [k, v.label]), showIf: isStudent, full: true },
        { name: 'grade', label: 'Grade', type: 'select', value: p?.grade || '', options: [['', 'Not set'], ['8', '8'], ['9', '9'], ['10', '10'], ['11', '11'], ['12', '12']], showIf: isStudent },
        { name: 'school', label: 'School', value: p?.school || '', showIf: isStudent },
        { name: 'termStart', label: 'Term starts', type: 'date', value: p?.termStart || '', showIf: isStudent },
        { name: 'termEnd', label: 'Term ends', type: 'date', value: p?.termEnd || '', showIf: isStudent },
        { name: 'sessionsPlanned', label: 'Sessions in package', type: 'number', value: p?.sessionsPlanned ?? '', min: 0, showIf: isStudent },
        { name: 'parentName', label: 'Parent or guardian', value: p?.parentName || '', showIf: isStudent },
        { name: 'parentEmail', label: 'Parent email', type: 'email', value: p?.parentEmail || '', showIf: isStudent },
        { name: 'driveFolderUrl', label: 'Student folder link', type: 'url', value: p?.driveFolderUrl || '', showIf: isStudent, full: true,
          hint: `The Google Drive folder "${driveFolderName(p?.name || 'Student Name')}". Without a link, Student folder searches Drive for that name.` },
      ],
      extra: html`${removeBtn}${folderTools}`,
      onOpen: (dlg, close) => {
        dlg.querySelector('[data-remove]')?.addEventListener('click', async () => {
          close(null);
          if (await confirmAction({ title: `Remove ${p.name}?`, message: `${p.email} loses portal access. Their sessions and notes stay in the database.`, confirmLabel: 'Remove access' })) {
            try { await removeMember(p.email); toast(`${p.name} removed`); } catch (ex) { toast(friendlyError(ex), 'bad'); }
            ctx.refresh();
          }
        });
        const make = dlg.querySelector('[data-make-folder]');
        make?.addEventListener('click', async () => {
          make.disabled = true;
          try {
            const share = [p.email, p.parentEmail, p.mentorEmail].filter(Boolean);
            const url = await createStudentFolder(p, share);
            await saveMember(p.email, { driveFolderUrl: url }, false);
            toast(`Created "${driveFolderName(p.name)}" and shared it`);
            close(null); ctx.refresh();
          } catch (ex) { console.error(ex); toast(friendlyError(ex), 'bad'); make.disabled = false; }
        });
      },
      submitLabel: isNew ? 'Add person' : 'Save changes',
      onSubmit: async (v, dlg) => {
        const email = normEmail(isNew ? v.email : p.email);
        if (isNew && people.some((x) => x.email === email)) throw new Error(`${email} already has access. Edit them instead.`);
        if (!isNew && p.email === ctx.me.email && v.role !== 'admin') throw new Error('You cannot remove your own founder access. Ask another founder.');
        const data = { name: v.name, role: v.role };
        if (v.role === 'student') {
          Object.assign(data, {
            mentorEmail: v.mentorEmail, active: Boolean(v.active), paths: v.paths, grade: v.grade, school: v.school,
            termStart: v.termStart, termEnd: v.termEnd, parentName: v.parentName, parentEmail: normEmail(v.parentEmail),
            driveFolderUrl: v.driveFolderUrl,
          });
          if (v.sessionsPlanned !== '') data.sessionsPlanned = Math.max(0, Math.round(Number(v.sessionsPlanned)) || 0);
        }
        await saveMember(email, data, isNew);
        return { email };
      },
    });
    if (done) { toast(isNew ? `${done.email} can now sign in` : 'Changes saved'); ctx.refresh(); }
  };

  draw();
  if (openEmail) { const p = people.find((x) => x.email === normEmail(openEmail)); if (p) personForm(p); }
}
