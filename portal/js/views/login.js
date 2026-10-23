import {
  auth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut,
} from '../fb.js';
import { html, mount, esc, pendingCode } from '../ui.js';
import { GOOGLE_G } from '../icons.js';
import { DEMO, DEMO_ACCOUNTS } from '../config.js';

const HERO = 'https://images.unsplash.com/photo-1778003586047-69c68f764af5?auto=format&fit=crop&w=1600&q=80';

export function authFrame(app, inner) {
  mount(app, html`<div class="auth">
    <section class="auth-art" aria-hidden="true">
      <img class="auth-img" src="${HERO}" alt="">
      <div class="auth-brand"><img src="../assets/brand/mark-on-dark.png" alt="" width="46" height="38"><span class="brand-t"><b>Everest</b><i>Futures</i></span></div>
      <div class="auth-copy"><p class="auth-k">Mentor and student portal</p><p class="auth-h">Sessions, plans, drafts and past applications, in one place.</p></div>
    </section>
    <section class="auth-pane"><div class="auth-card">${inner}</div>
      <p class="auth-back"><a href="../">Back to Everest Futures</a></p></section>
  </div>`);
}

const ERRORS = {
  'auth/invalid-credential': 'That email and password do not match. Try again or reset your password.',
  'auth/wrong-password': 'That email and password do not match. Try again or reset your password.',
  'auth/user-not-found': 'No account uses that email yet. Choose "Set up your password" to create one.',
  'auth/email-already-in-use': 'An account already uses that email. Sign in instead, or reset your password.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/operation-not-allowed': 'This sign-in method is not turned on yet. Use the other option, or ask a founder.',
};
const authError = (ex) => (ex?.code in ERRORS ? ERRORS[ex.code] : 'Sign-in did not work. Try again.');

const google = () => { const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };
const prettyCode = (c) => `${c.slice(0, 4)}-${c.slice(4, 8)}`;

// Entering an invite code before signing in. The code waits in this browser until sign-in finishes.
export function renderCodeEntry(app) {
  authFrame(app, html`
    <h1>Join with an invite code</h1>
    <p class="auth-sub">Your mentor or the Everest team sends this code. It looks like K7QM-4XPA.</p>
    <form class="auth-form" novalidate>
      <label class="field-l" for="a-code">Invite code</label>
      <input id="a-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7QM-4XPA" required>
      <p class="auth-err" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block">Continue</button>
    </form>
    <p class="auth-links"><a href="#" data-mode="signin">Back to sign in</a></p>`);
  app.querySelector('[data-mode]').addEventListener('click', (e) => { e.preventDefault(); renderLogin(app); });
  const form = app.querySelector('.auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = form.code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 8) { form.querySelector('.auth-err').textContent = 'Invite codes are 8 letters and numbers, like K7QM-4XPA.'; form.code.focus(); return; }
    pendingCode.set(c);
    renderLogin(app, 'setup');
  });
}

export function renderLogin(app, mode = 'signin', notice = '') {
  const code = pendingCode.get();
  const setup = mode === 'setup';
  const reset = mode === 'reset';
  const accept = setup && code;
  if (code && !notice && !accept) notice = `Invite ${prettyCode(code)} is ready. Sign in to accept it.`;
  authFrame(app, html`
    <h1>${accept ? 'Accept your invite' : setup ? 'Set up your password' : reset ? 'Reset your password' : 'Sign in'}</h1>
    <p class="auth-sub">${accept
      ? html`Invite <b>${prettyCode(code)}</b>. Continue with Google, or create an account with your email and a password.`
      : setup ? 'Use the email the Everest team has on file. We will send a link to confirm it.'
      : reset ? 'Enter your email and we will send a link to choose a new password.'
        : 'For enrolled students and their mentors.'}</p>
    ${notice ? html`<p class="auth-note" role="status">${notice}</p>` : ''}
    ${reset ? '' : html`<button type="button" class="btn btn-google" data-google>${GOOGLE_G}<span>Continue with Google</span></button>
    <div class="auth-or"><span>or</span></div>`}
    <form class="auth-form" novalidate>
      <label class="field-l" for="a-email">Email</label>
      <input id="a-email" name="email" type="email" autocomplete="email" required>
      ${reset ? '' : html`<label class="field-l" for="a-pass">${setup ? 'Choose a password' : 'Password'}</label>
      <input id="a-pass" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" minlength="8" required>`}
      <p class="auth-err" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block">${accept ? 'Create account' : setup ? 'Create password' : reset ? 'Send reset link' : 'Sign in'}</button>
    </form>
    <p class="auth-links">
      ${mode === 'signin'
        ? html`<a href="#" data-mode="reset">Forgot password?</a><a href="#" data-mode="setup">First time? Set up your password</a>`
        : html`<a href="#" data-mode="signin">${accept ? 'Already have an account? Sign in' : setup ? 'Already have a password? Sign in' : 'Back to sign in'}</a>`}
    </p>
    ${code ? html`<p class="auth-join">Wrong code? <a href="#" data-forget>Remove it</a></p>` : html`<p class="auth-join">New student or mentor? <a href="#" data-join>Join with an invite code</a></p>`}
    ${DEMO ? html`<div class="demo"><p>Local preview with sample data. Sign in as:</p>
      ${DEMO_ACCOUNTS.map((a) => html`<button type="button" class="btn btn-secondary btn-sm" data-demo="${a.email}">${a.label}</button>`)}</div>` : ''}
  `);

  const form = app.querySelector('.auth-form');
  const err = app.querySelector('.auth-err');
  app.querySelectorAll('[data-mode]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); renderLogin(app, a.dataset.mode); }));
  app.querySelector('[data-join]')?.addEventListener('click', (e) => { e.preventDefault(); renderCodeEntry(app); });
  app.querySelector('[data-forget]')?.addEventListener('click', (e) => { e.preventDefault(); pendingCode.clear(); renderLogin(app, mode); });
  app.querySelector('[data-google]')?.addEventListener('click', async () => {
    err.textContent = '';
    try { await signInWithPopup(auth, google()); } catch (ex) { err.textContent = authError(ex); }
  });
  app.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    const email = b.dataset.demo;
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const email = form.email.value.trim();
    const password = form.password?.value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email address.'; form.email.focus(); return; }
    if (!reset && password.length < 8) { err.textContent = 'Passwords are at least 8 characters.'; form.password.focus(); return; }
    const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      if (reset) {
        await sendPasswordResetEmail(auth, email);
        renderLogin(app, 'signin', `If an account uses ${email}, a reset link is on its way.`);
      } else if (setup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (ex) { err.textContent = authError(ex); btn.disabled = false; }
  });
}

export function renderVerify(app, user) {
  authFrame(app, html`
    <h1>Confirm your email</h1>
    <p class="auth-sub">We sent a link to <b>${user.email}</b>. Open it, then come back here.</p>
    <button type="button" class="btn btn-primary btn-block" data-done>I have confirmed it</button>
    <p class="auth-err" role="alert"></p>
    <p class="auth-links"><a href="#" data-resend>Send the link again</a><a href="#" data-out>Use a different email</a></p>`);
  const err = app.querySelector('.auth-err');
  app.querySelector('[data-done]').addEventListener('click', async () => {
    await user.reload();
    if (user.emailVerified) { await user.getIdToken(true); location.reload(); }
    else err.textContent = 'Not confirmed yet. Check your inbox and spam folder for the link.';
  });
  app.querySelector('[data-resend]').addEventListener('click', async (e) => {
    e.preventDefault();
    try { await sendEmailVerification(user); err.textContent = 'Sent. Check your inbox.'; } catch (ex) { err.textContent = authError(ex); }
  });
  app.querySelector('[data-out]').addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });
}

export function renderNoAccess(app, user, onCode) {
  authFrame(app, html`
    <h1>No portal access yet</h1>
    <p class="auth-sub"><b>${user.email}</b> is not on an Everest Futures account.</p>
    <form class="auth-form" novalidate>
      <label class="field-l" for="a-code">Have an invite code?</label>
      <input id="a-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7QM-4XPA">
      <p class="auth-err" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block">Join with this code</button>
    </form>
    <div class="auth-or"><span>or</span></div>
    <button type="button" class="btn btn-secondary btn-block" data-out>Sign in with a different account</button>
    <p class="auth-hint">Already enrolled or mentoring with us? Sign in with the email the team has on file, or ask your mentor for an invite code.</p>`);
  app.querySelector('[data-out]').addEventListener('click', () => signOut(auth));
  const form = app.querySelector('.auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = form.code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 8) { form.querySelector('.auth-err').textContent = 'Invite codes are 8 letters and numbers, like K7QM-4XPA.'; form.code.focus(); return; }
    onCode(c);
  });
}

export function renderNotConfigured(app) {
  authFrame(app, html`
    <h1>Portal setup in progress</h1>
    <p class="auth-sub">The portal is not connected to its database yet. Add the Firebase settings in <code>${esc('portal/js/config.js')}</code>.</p>`);
}
