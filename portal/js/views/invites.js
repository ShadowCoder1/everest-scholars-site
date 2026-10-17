// Invite codes: founders and mentors create one-time codes; the person who uses
// the code joins with the role it carries. See firebase/firestore.rules.
import { html, mount, PATHS, pathChips, fmtDay, toDate, pill, toast, openForm, showDialog, confirmAction, copyText, friendlyError } from '../ui.js';
import { icon } from '../icons.js';
import { createInvite, listInvites, revokeInvite, prettyCode, INVITE_DAYS } from '../store.js';

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Founder' };
export const joinLink = (code) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}#/join/${code}`;

function inviteMessage(inv) {
  const who = inv.role === 'student' ? 'the Everest Scholars student portal' : `the Everest Scholars portal as a ${ROLE_LABEL[inv.role].toLowerCase()}`;
  return `You're invited to ${who}.\n\n1. Open ${joinLink(inv.id)}\n2. Sign in with Google, or create a password\n\nOr go to everestscholars.org/portal, choose "Join with an invite code" and enter ${prettyCode(inv.id)}. The code works once and expires ${fmtDay(toDate(inv.expiresAt))}.`;
}

export function showInvite(inv) {
  const dlg = showDialog({
    title: 'Invite ready',
    body: html`<p>Send this to ${inv.name ? html`<b>${inv.name}</b>` : `the new ${ROLE_LABEL[inv.role].toLowerCase()}`}. They join as a <b>${ROLE_LABEL[inv.role].toLowerCase()}</b>${inv.mentorName ? html`, mentored by ${inv.mentorName}` : ''}.</p>
      <div class="code-box"><p class="code-l">Invite code</p><p class="code-v">${prettyCode(inv.id)}</p><p class="code-s">Works once. Expires ${fmtDay(toDate(inv.expiresAt))}.</p></div>
      <label class="field-l" for="inv-link">Join link</label>
      <div class="copy-row"><input id="inv-link" readonly value="${joinLink(inv.id)}"><button type="button" class="btn btn-secondary" data-copy="link">Copy link</button></div>`,
    actions: html`<button type="button" class="btn btn-primary" data-copy="message">${icon('mail')}Copy invite message</button>`,
  });
  dlg.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await copyText(b.dataset.copy === 'link' ? joinLink(inv.id) : inviteMessage(inv));
    toast(ok ? (b.dataset.copy === 'link' ? 'Link copied' : 'Invite message copied') : 'Could not copy. Select the link and copy it.');
  }));
}

// staff: [{email, name, role}] for the mentor picker. Mentors can only invite students to themselves.
export async function openInviteForm(ctx, staff = []) {
  const admin = ctx.me.role === 'admin';
  const mentorOptions = [['', 'Assign later'], ...staff.map((s) => [s.email, `${s.name} (${ROLE_LABEL[s.role]})`])];
  const inv = await openForm({
    title: admin ? 'Create an invite' : 'Invite a student',
    intro: `You get a one-time code and link to send. It expires in ${INVITE_DAYS} days.`,
    fields: [
      ...(admin ? [{ name: 'role', label: 'They join as', type: 'radios', value: 'student', options: Object.entries(ROLE_LABEL), full: true }] : []),
      { name: 'name', label: 'Their name', placeholder: 'For your reference', full: true },
      ...(admin ? [{ name: 'mentorEmail', label: 'Mentor', type: 'select', value: '', options: mentorOptions, showIf: (v) => v.role === 'student' }] : []),
      ...(admin ? [{ name: 'active', label: 'Enrollment', type: 'toggle', value: true, toggleLabel: 'Enrolled and paid. Opens the resource library.', showIf: (v) => v.role === 'student', full: true }] : []),
      { name: 'paths', label: 'Paths', type: 'checks', value: [], options: Object.entries(PATHS).map(([k, v]) => [k, v.label]), showIf: (v) => !admin || v.role === 'student', full: true },
    ],
    submitLabel: 'Create invite',
    onSubmit: async (v) => {
      const role = admin ? v.role : 'student';
      const data = { role, name: v.name, createdBy: ctx.me.email };
      if (role === 'student') {
        const mentorEmail = admin ? v.mentorEmail : ctx.me.email;
        const mentor = admin ? staff.find((s) => s.email === mentorEmail) : ctx.me;
        Object.assign(data, { mentorEmail, mentorName: mentor?.name || '', active: admin ? Boolean(v.active) : false, paths: v.paths });
      }
      return createInvite(data);
    },
  });
  if (inv) showInvite(inv);
  return inv;
}

// Pending invites card. Mentors see their own; founders see everyone's.
export async function pendingInvites(ctx, el) {
  const admin = ctx.me.role === 'admin';
  let list = [];
  try { list = await listInvites(admin ? null : ctx.me.email); } catch (ex) { console.error(ex); }
  const now = Date.now();
  const open = list.filter((i) => !i.usedBy && toDate(i.expiresAt)?.getTime() > now).sort((a, b) => toDate(b.expiresAt) - toDate(a.expiresAt));
  if (!open.length) { el.replaceChildren(); return; }
  mount(el, html`<section class="card">
    <header class="card-h"><div><h2>Pending invites</h2><p class="muted">Codes that have not been used yet.</p></div></header>
    <ul class="invites">${open.map((i) => html`<li class="inv">
      <span class="inv-code">${prettyCode(i.id)}</span>
      <div class="inv-b"><p class="inv-t">${i.name || `New ${ROLE_LABEL[i.role].toLowerCase()}`}</p>
        <p class="inv-m">${pill(ROLE_LABEL[i.role], i.role === 'student' ? 'neutral' : 'info')}${i.mentorName ? html`<span>Mentor: ${i.mentorName}</span>` : ''}${i.paths?.length ? pathChips(i.paths) : ''}<span>Expires ${fmtDay(toDate(i.expiresAt))}</span></p></div>
      <div class="inv-a"><button type="button" class="btn btn-secondary btn-sm" data-show="${i.id}">Share</button><button type="button" class="btn btn-quiet btn-sm" data-revoke="${i.id}">Revoke</button></div>
    </li>`)}</ul></section>`);
  el.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => showInvite(open.find((i) => i.id === b.dataset.show))));
  el.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmAction({ title: `Revoke ${prettyCode(b.dataset.revoke)}?`, message: 'The code stops working right away. Anyone who already joined keeps their access.', confirmLabel: 'Revoke' }))) return;
    try { await revokeInvite(b.dataset.revoke); toast('Invite revoked'); } catch (ex) { toast(friendlyError(ex), 'bad'); }
    pendingInvites(ctx, el);
  }));
}
