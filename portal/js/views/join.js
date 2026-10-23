// Accepting an invite after signing in: confirm details, create the profile, spend the code.
import { auth, signOut } from '../fb.js';
import { html, fmtDay, toDate, pendingCode } from '../ui.js';
import { getInvite, redeemInvite, prettyCode, cleanCode } from '../store.js';
import { authFrame } from './login.js';

const ROLE = { student: 'student', mentor: 'mentor', admin: 'founder' };

function problem(app, user, title, text) {
  authFrame(app, html`<h1>${title}</h1><p class="auth-sub">${text}</p>
    <form class="auth-form" data-code novalidate><label class="field-l" for="j-code">Invite code</label>
      <input id="j-code" name="code" autocomplete="off" autocapitalize="characters" placeholder="K7QM-4XPA" required>
      <p class="auth-err" role="alert"></p><button type="submit" class="btn btn-primary btn-block">Use this code</button></form>
    <p class="auth-links"><span class="muted">Signed in as ${user.email}</span><a href="#" data-out>Use a different account</a></p>`);
  app.querySelector('[data-out]').addEventListener('click', (e) => { e.preventDefault(); pendingCode.clear(); signOut(auth); });
  app.querySelector('[data-code]').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = cleanCode(e.target.code.value);
    if (c.length !== 8) { app.querySelector('.auth-err').textContent = 'Invite codes are 8 letters and numbers, like K7QM-4XPA.'; return; }
    pendingCode.set(c); renderJoin(app, user, c);
  });
}

export async function renderJoin(app, user, code) {
  code = cleanCode(code);
  if (!code) return problem(app, user, 'Enter your invite code', 'Your mentor or the Everest team sends this code. It looks like K7QM-4XPA.');
  let inv = null;
  try { inv = await getInvite(code); } catch (ex) { console.error(ex); }
  if (!inv) { pendingCode.clear(); return problem(app, user, 'That code did not work', `${prettyCode(code)} does not match an invite. Check for typos, or ask for a new code.`); }
  if (inv.usedBy) { pendingCode.clear(); return problem(app, user, 'This invite was already used', 'Each code works once. If you already joined, sign in with the account you used. Otherwise ask for a new code.'); }
  const expires = toDate(inv.expiresAt);
  if (expires && expires < new Date()) { pendingCode.clear(); return problem(app, user, 'This invite has expired', `It expired ${fmtDay(expires)}. Ask your mentor or the Everest team for a new code.`); }

  const student = inv.role === 'student';
  authFrame(app, html`
    <h1>Join Everest Futures</h1>
    <p class="auth-sub">You are joining as a <b>${ROLE[inv.role]}</b>${inv.mentorName ? html`, mentored by <b>${inv.mentorName}</b>` : ''}. Signed in as <b>${user.email}</b>.</p>
    <form class="auth-form" novalidate>
      <label class="field-l" for="j-name">Your full name</label>
      <input id="j-name" name="name" autocomplete="name" value="${inv.name || user.displayName || ''}" required>
      ${student ? html`
        <div class="auth-two"><div><label class="field-l" for="j-grade">Grade</label>
          <select id="j-grade" name="grade"><option value="">Choose</option>${['8', '9', '10', '11', '12'].map((g) => html`<option value="${g}">${g}</option>`)}</select></div>
        <div><label class="field-l" for="j-school">School</label><input id="j-school" name="school" autocomplete="organization"></div></div>
        <label class="field-l" for="j-pname">Parent or guardian name <span class="opt">(optional)</span></label><input id="j-pname" name="parentName">
        <label class="field-l" for="j-pmail">Parent or guardian email <span class="opt">(optional)</span></label><input id="j-pmail" name="parentEmail" type="email">` : ''}
      <p class="auth-err" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block">Join as ${ROLE[inv.role]}</button>
    </form>
    <p class="auth-links"><span class="muted">Code ${prettyCode(code)}</span><a href="#" data-out>Not you? Use a different account</a></p>`);
  app.querySelector('[data-out]').addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });
  const form = app.querySelector('.auth-form'); const err = form.querySelector('.auth-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const v = Object.fromEntries(new FormData(form).entries());
    v.name = String(v.name || '').trim();
    if (!v.name) { err.textContent = 'Enter your full name.'; form.name.focus(); return; }
    if (v.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.parentEmail)) { err.textContent = 'Parent email is not a valid email.'; return; }
    const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await redeemInvite(inv, user.email, v);
      pendingCode.clear();
      location.replace(location.pathname);
    } catch (ex) {
      console.error(ex);
      err.textContent = String(ex?.code).includes('permission-denied')
        ? 'That did not work. This email may already have an account, or the invite was just used. Sign in instead, or ask for a new code.'
        : 'Could not join. Check your connection and try again.';
      btn.disabled = false;
    }
  });
}
