// Small rendering kit: escaped templates, dates, dialogs and toasts.

// ---------- templates ----------
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}
// Every interpolated value is escaped unless it is itself html`` or raw().
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Raw(out);
}
export const mount = (el, tpl) => { el.innerHTML = part(tpl); return el; };

// Only http(s) links are ever rendered as hrefs.
export const safeUrl = (u) => { const s = String(u ?? '').trim(); return /^https?:\/\/\S+$/i.test(s) ? s : ''; };

// ---------- people ----------
export const PATHS = {
  competitions: { label: 'Competitions', hue: 'glow' },
  research: { label: 'Research & Publication', hue: 'glacier' },
  programs: { label: 'Selective Programs', hue: 'rose' },
  admissions: { label: 'College Admissions', hue: 'violet' },
};
export const pathChips = (paths = []) => html`<span class="chips">${paths.filter((p) => PATHS[p]).map((p) =>
  html`<span class="chip chip-${PATHS[p].hue}"><i></i>${PATHS[p].label}</span>`)}</span>`;
export const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || '';
export const initials = (name = '', email = '') => {
  const parts = String(name || email).trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};
export const avatar = (person, size = '') => html`<span class="avatar ${size}" aria-hidden="true">${initials(person?.name, person?.email)}</span>`;
export const driveFolderName = (name) => `${String(name || '').trim()} - Everest Scholars`;
export const folderHref = (student) => safeUrl(student?.driveFolderUrl)
  || `https://drive.google.com/drive/search?q=${encodeURIComponent(`"${driveFolderName(student?.name)}"`)}`;

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s) => { const [y, m, d] = String(s).split('-').map(Number); return y ? new Date(y, m - 1, d) : null; };
export const toDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? parseDay(v) : null);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDay = (v) => { const d = toDate(v); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : ''; };
export const fmtShort = (v) => { const d = toDate(v); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : ''; };
export const fmtTime = (v) => { const d = toDate(v); return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''; };
export const fmtWhen = (v) => { const d = toDate(v); return d ? `${d.toLocaleDateString([], { weekday: 'short' })}, ${fmtShort(d)} at ${fmtTime(d)}` : ''; };
export const fmtMonth = (v) => { const d = toDate(v); return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''; };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysFromToday = (v) => {
  const d = toDate(v); if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
};
export const ago = (v) => {
  const n = daysFromToday(v); if (n == null) return '';
  if (n === 0) return 'Today'; if (n === -1) return 'Yesterday'; if (n === 1) return 'Tomorrow';
  if (n < 0) return -n < 60 ? `${-n} days ago` : fmtDay(v);
  return n < 60 ? `In ${n} days` : fmtDay(v);
};
export const dueLabel = (due) => {
  const n = daysFromToday(due); if (n == null) return '';
  if (n < 0) return `Overdue, ${fmtShort(due)}`;
  if (n === 0) return 'Due today'; if (n === 1) return 'Due tomorrow';
  if (n < 7) return `Due ${parseDay(due).toLocaleDateString([], { weekday: 'long' })}`;
  return `Due ${fmtShort(due)}`;
};
export const addBusinessDays = (date, n) => {
  const d = new Date(date);
  while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n -= 1; }
  return d;
};
export const byDate = (key, dir = 1) => (a, b) => {
  const x = toDate(a[key])?.getTime() ?? Infinity; const y = toDate(b[key])?.getTime() ?? Infinity;
  return dir * (x - y);
};

// ---------- status ----------
export const CHECKIN = {
  on_track: { label: 'On track', tone: 'ok' },
  needs_attention: { label: 'Needs attention', tone: 'warn' },
  at_risk: { label: 'At risk', tone: 'bad' },
};
export const pill = (label, tone = 'neutral') => html`<span class="pill pill-${tone}">${label}</span>`;

// ---------- toast ----------
let toastTimer;
export function toast(message, tone = '') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.className = `toast is-on ${tone}`; el.textContent = message;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// ---------- dialogs ----------
// openForm builds a modal form from a field list and resolves after onSubmit succeeds.
// Field: { name, label, type, value, required, options:[[value,label]], hint, placeholder, showIf(values), full }
export function openForm({ title, intro, fields, submitLabel = 'Save', onSubmit, extra, onOpen }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    const field = (f) => {
      const id = `f-${f.name}`; const v = f.value ?? '';
      let input;
      if (f.type === 'textarea') input = html`<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${f.placeholder || ''}">${v}</textarea>`;
      else if (f.type === 'select') input = html`<select id="${id}" name="${f.name}">${(f.options || []).map(([ov, ol]) => html`<option value="${ov}" ${String(ov) === String(v) ? raw('selected') : ''}>${ol}</option>`)}</select>`;
      else if (f.type === 'checks') input = html`<span class="checks">${(f.options || []).map(([ov, ol]) => html`<label class="check"><input type="checkbox" name="${f.name}" value="${ov}" ${(v || []).includes(ov) ? raw('checked') : ''}><span>${ol}</span></label>`)}</span>`;
      else if (f.type === 'radios') input = html`<span class="radios">${(f.options || []).map(([ov, ol]) => html`<label class="radio"><input type="radio" name="${f.name}" value="${ov}" ${String(ov) === String(v) ? raw('checked') : ''}><span>${ol}</span></label>`)}</span>`;
      else if (f.type === 'toggle') input = html`<label class="toggle"><input type="checkbox" id="${id}" name="${f.name}" ${v ? raw('checked') : ''}><span>${f.toggleLabel || ''}</span></label>`;
      else input = html`<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${v}" placeholder="${f.placeholder || ''}" ${f.list ? raw(`list="${esc(f.list)}"`) : ''} ${f.disabled ? raw('disabled') : ''} ${f.min != null ? raw(`min="${esc(f.min)}"`) : ''}>`;
      const labelFor = ['checks', 'radios', 'toggle'].includes(f.type) ? '' : id;
      return html`<div class="field ${f.full ? 'is-full' : ''}" data-field="${f.name}">
        ${f.label ? html`<label ${labelFor ? raw(`for="${labelFor}"`) : ''} class="field-l">${f.label}${f.required ? '' : html`<span class="opt"> (optional)</span>`}</label>` : ''}
        ${input}${f.hint ? html`<p class="field-h">${f.hint}</p>` : ''}</div>`;
    };
    mount(dlg, html`<form method="dialog" novalidate>
      <header class="dlg-h"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${raw(X_ICON)}</button></header>
      ${intro ? html`<p class="dlg-intro">${intro}</p>` : ''}
      <div class="dlg-b">${fields.map(field)}</div>
      <p class="dlg-err" role="alert"></p>
      <footer class="dlg-f">${extra || ''}<span class="sp"></span><button type="button" class="btn btn-quiet" data-close>Cancel</button><button type="submit" class="btn btn-primary">${submitLabel}</button></footer>
    </form>`);
    document.body.append(dlg);
    const form = dlg.querySelector('form');
    const values = () => {
      const out = {};
      for (const f of fields) {
        if (f.type === 'checks') out[f.name] = [...form.querySelectorAll(`[name="${f.name}"]:checked`)].map((i) => i.value);
        else if (f.type === 'radios') out[f.name] = form.querySelector(`[name="${f.name}"]:checked`)?.value || '';
        else if (f.type === 'toggle') out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
        else out[f.name] = (form.querySelector(`[name="${f.name}"]`)?.value ?? '').trim();
      }
      return out;
    };
    const sync = () => { const v = values(); for (const f of fields) if (f.showIf) form.querySelector(`[data-field="${f.name}"]`).hidden = !f.showIf(v); };
    form.addEventListener('input', sync); form.addEventListener('change', sync); sync();
    const close = (result) => { dlg.close(); dlg.remove(); resolve(result); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.dlg-err'); err.textContent = '';
      const v = values();
      for (const f of fields) {
        const hidden = f.showIf && !f.showIf(v);
        if (hidden) continue;
        if (f.required && (Array.isArray(v[f.name]) ? !v[f.name].length : !v[f.name])) { err.textContent = `${f.label} is required.`; form.querySelector(`[name="${f.name}"]`)?.focus(); return; }
        if (f.type === 'url' && v[f.name] && !safeUrl(v[f.name])) { err.textContent = `${f.label} must be a link starting with https://`; form.querySelector(`[name="${f.name}"]`)?.focus(); return; }
        if (f.type === 'email' && v[f.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[f.name])) { err.textContent = `${f.label} is not a valid email.`; return; }
      }
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      try { const r = await onSubmit(v, dlg); close(r ?? v); }
      catch (ex) { console.error(ex); err.textContent = friendlyError(ex); btn.disabled = false; }
    });
    dlg.showModal();
    form.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea, select')?.focus();
    onOpen?.(dlg, close);
  });
}

export function confirmAction({ title, message, confirmLabel = 'Delete', tone = 'danger' }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog'); dlg.className = 'dlg dlg-sm';
    mount(dlg, html`<form method="dialog"><header class="dlg-h"><h2>${title}</h2></header>
      <p class="dlg-intro">${message}</p>
      <footer class="dlg-f"><span class="sp"></span><button value="no" class="btn btn-quiet">Cancel</button><button value="yes" class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}">${confirmLabel}</button></footer></form>`);
    document.body.append(dlg);
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    dlg.showModal();
  });
}

export function showDialog({ title, body, actions = '' }) {
  const dlg = document.createElement('dialog'); dlg.className = 'dlg';
  mount(dlg, html`<form method="dialog"><header class="dlg-h"><h2>${title}</h2><button class="icon-btn" aria-label="Close">${raw(X_ICON)}</button></header>
    <div class="dlg-read">${body}</div><footer class="dlg-f">${actions}<span class="sp"></span><button class="btn btn-quiet">Close</button></footer></form>`);
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  return dlg;
}

// Plain text with line breaks preserved, safely escaped.
export const prose = (text) => html`${String(text || '').split(/\n{2,}/).filter(Boolean).map((p) => html`<p>${raw(esc(p).replace(/\n/g, '<br>'))}</p>`)}`;

export function friendlyError(ex) {
  const code = ex?.code || '';
  if (code.includes('permission-denied')) return 'You do not have access to do that. Ask a founder to check your role.';
  if (code.includes('unavailable')) return 'Could not reach the server. Check your connection and try again.';
  return ex?.message?.replace(/^Firebase:\s*/, '').replace(/\s*\(.*\)\.?$/, '.') || 'Something went wrong. Try again.';
}

const X_ICON = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
