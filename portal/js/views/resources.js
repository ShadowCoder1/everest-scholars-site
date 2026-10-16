// Resource library: past applications and guides, grouped into four folders.
// Students see it once enrolled; mentors and founders can add to it.
import { html, raw, mount, safeUrl, pill, toast, openForm, confirmAction, friendlyError } from '../ui.js';
import { icon } from '../icons.js';
import { listResources, addResource, updateResource, removeResource } from '../store.js';

export const FOLDERS = {
  competitions: { label: 'Research competitions', blurb: 'Past applications, abstracts, research plans and judging prep for ISEF, Regeneron STS, JSHS and more.', hue: 'glow',
    programs: ['ISEF', 'Regeneron STS', 'JSHS', 'Davidson Fellows', 'Stockholm Junior Water Prize', 'Brain Bee', 'Regional and state fairs'] },
  programs: { label: 'Summer programs', blurb: 'Essays and applications to RSI, SSP, MITES, Simons and other selective research programs.', hue: 'rose',
    programs: ['RSI', 'SSP', 'MITES', 'Simons', 'Garcia', 'Clark Scholars', 'COSMOS', 'PROMYS', 'Ross'] },
  colleges: { label: 'College applications', blurb: 'Essays, activity lists and supplements from students admitted to HYPSM and peer schools.', hue: 'violet',
    programs: ['Harvard', 'Yale', 'Princeton', 'Stanford', 'MIT', 'Common App personal statements'] },
  guides: { label: 'Guides and templates', blurb: 'Professor outreach emails, abstract and poster templates, timelines and checklists.', hue: 'glacier',
    programs: ['Professor outreach', 'Writing', 'Presenting', 'Planning'] },
};
const KINDS = ['PDF', 'Google Doc', 'Slides', 'Spreadsheet', 'Video', 'Folder', 'Link'];

export async function renderResources(ctx) {
  const staff = ctx.me.role !== 'student';
  if (!staff && !ctx.me.active) {
    mount(ctx.root, html`<header class="ph"><div><h1>Resources</h1></div></header>
      <section class="card empty-card locked">${icon('lock')}<h2>Opens once you are enrolled</h2>
        <p class="muted">The library of past applications and guides unlocks when your enrollment is confirmed. Questions? Ask your mentor or the Everest team.</p></section>`);
    return;
  }
  const items = await listResources();
  if (ctx.stale()) return;
  const cat = FOLDERS[ctx.params[1]] ? ctx.params[1] : '';
  let q = '';

  const row = (r) => html`<li class="res">
    <span class="res-i res-${FOLDERS[r.category]?.hue || 'glacier'}">${icon(r.kind === 'Folder' ? 'resources' : r.kind === 'Video' ? 'video' : 'review')}</span>
    <div class="res-b"><a class="res-t" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${r.title}</a>
      <p class="res-m">${[r.program, r.year, r.kind].filter(Boolean).join(', ')}${r.result ? html` ${pill(r.result, 'ok')}` : ''}</p>
      ${r.description ? html`<p class="muted res-d">${r.description}</p>` : ''}</div>
    <div class="res-a">${staff && (ctx.me.role === 'admin' || r.addedBy === ctx.me.email) ? html`<button type="button" class="icon-btn" data-edit="${r.id}" aria-label="Edit ${r.title}">${icon('edit')}</button><button type="button" class="icon-btn" data-del="${r.id}" aria-label="Delete ${r.title}">${icon('trash')}</button>` : ''}
      <a class="btn btn-secondary btn-sm" href="${safeUrl(r.url)}" target="_blank" rel="noopener">Open${icon('external')}</a></div></li>`;

  const draw = () => {
    const needle = q.trim().toLowerCase();
    const match = (r) => !needle || [r.title, r.program, r.year, r.result, r.description].some((v) => String(v || '').toLowerCase().includes(needle));
    const inCat = items.filter((r) => (!cat || r.category === cat) && match(r));
    const head = html`<header class="ph"><div>${cat ? html`<a class="back" href="#/resources">${icon('back')}Resources</a>` : ''}
        <h1>${cat ? FOLDERS[cat].label : 'Resources'}</h1><p class="ph-sub">${cat ? FOLDERS[cat].blurb : 'Real past applications and the guides we use with every student. For your eyes only; please do not share or copy them.'}</p></div>
      ${staff ? html`<div class="ph-a"><button type="button" class="btn btn-primary" data-add>${icon('plus')}Add a resource</button></div>` : ''}</header>`;
    const search = html`<label class="search">${icon('search')}<span class="vh">Search resources</span><input type="search" placeholder="Search by title, program or year" value="${q}" data-q></label>`;

    let body;
    if (!cat && !needle) {
      body = html`<div class="folders">${Object.entries(FOLDERS).map(([k, f]) => {
        const n = items.filter((r) => r.category === k).length;
        return html`<a class="folder folder-${f.hue}" href="#/resources/${k}">
          <span class="folder-i">${icon('resources')}</span><h2>${f.label}</h2><p class="muted">${f.blurb}</p>
          <p class="folder-n"><b class="num">${n}</b> ${n === 1 ? 'item' : 'items'}</p></a>`;
      })}</div>`;
    } else if (!inCat.length) {
      body = html`<section class="card"><div class="empty"><p class="muted">${needle ? 'Nothing matches that search.' : staff ? 'Nothing here yet. Add the first one.' : 'Nothing here yet. Check back soon.'}</p></div></section>`;
    } else {
      const groups = {};
      inCat.forEach((r) => { (groups[r.program || 'Other'] ||= []).push(r); });
      const order = cat ? FOLDERS[cat].programs : [];
      const names = Object.keys(groups).sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || a.localeCompare(b));
      body = names.map((g) => html`<section class="card"><header class="card-h"><h2>${g}</h2><span class="muted num">${groups[g].length}</span></header>
        <ul class="res-list">${groups[g].sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')) || a.title.localeCompare(b.title)).map(row)}</ul></section>`);
    }
    mount(ctx.root, html`${head}${search}${staff ? html`<p class="hint">Files live in Google Drive. Before adding a link, share the file (or the folder it sits in) with enrolled students, view only.</p>` : ''}${body}`);
    const input = ctx.root.querySelector('[data-q]');
    input.addEventListener('input', () => { q = input.value; const pos = input.selectionStart; draw(); const again = ctx.root.querySelector('[data-q]'); again.focus(); again.setSelectionRange(pos, pos); });
    ctx.root.querySelector('[data-add]')?.addEventListener('click', () => form());
    ctx.root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => form(items.find((r) => r.id === b.dataset.edit))));
    ctx.root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = items.find((x) => x.id === b.dataset.del);
      if (!(await confirmAction({ title: `Delete "${r.title}"?`, message: 'It comes out of the library. The file in Drive is not touched.' }))) return;
      try { await removeResource(r.id); toast('Resource deleted'); } catch (ex) { toast(friendlyError(ex), 'bad'); }
      ctx.refresh();
    }));
  };

  const form = async (r) => {
    const category = r?.category || cat || 'competitions';
    const done = await openForm({
      title: r ? 'Edit resource' : 'Add a resource',
      fields: [
        { name: 'title', label: 'Title', value: r?.title || '', required: true, full: true, placeholder: 'ISEF research plan and abstract' },
        { name: 'category', label: 'Folder', type: 'select', value: category, options: Object.entries(FOLDERS).map(([k, f]) => [k, f.label]) },
        { name: 'program', label: 'Program or school', value: r?.program || '', list: 'res-programs', placeholder: 'ISEF' },
        { name: 'year', label: 'Year', value: r?.year || '', placeholder: '2025' },
        { name: 'result', label: 'Result', value: r?.result || '', placeholder: 'Grand Award, admitted, finalist' },
        { name: 'kind', label: 'Type', type: 'select', value: r?.kind || 'PDF', options: KINDS.map((k) => [k, k]) },
        { name: 'url', label: 'Link', type: 'url', value: r?.url || '', required: true, full: true, placeholder: 'https://drive.google.com/...' },
        { name: 'description', label: 'Description', type: 'textarea', value: r?.description || '', full: true, rows: 3 },
      ],
      submitLabel: r ? 'Save resource' : 'Add resource',
      onOpen: (dlg) => {
        const list = document.createElement('datalist'); list.id = 'res-programs';
        list.innerHTML = Object.values(FOLDERS).flatMap((f) => f.programs).map((p) => `<option value="${p.replace(/"/g, '&quot;')}">`).join('');
        dlg.append(list);
      },
      onSubmit: async (v) => {
        const data = { title: v.title, category: v.category, program: v.program, year: v.year, result: v.result, kind: v.kind, url: v.url, description: v.description };
        if (r) await updateResource(r.id, { ...data, addedBy: r.addedBy });
        else await addResource({ ...data, addedBy: ctx.me.email });
      },
    });
    if (done) { toast('Resource saved'); ctx.refresh(); }
  };

  draw();
}
