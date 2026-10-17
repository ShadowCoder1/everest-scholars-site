// Security rules tests. Run with: npm test (starts the Firestore emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';

const ADMIN = 'founder@everest.test';
const MENTOR = 'mentor@everest.test';
const MENTOR2 = 'mentor2@everest.test';
const STUDENT = 'student@everest.test';   // mentored by MENTOR, enrolled
const OTHER = 'other@everest.test';       // mentored by MENTOR2, not enrolled
const STRANGER = 'stranger@everest.test'; // signed in, no profile

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-everest',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const m = (email, data) => setDoc(doc(db, 'members', email), { email, ...data });
    await m(ADMIN, { name: 'Founder', role: 'admin' });
    await m(MENTOR, { name: 'Mentor', role: 'mentor' });
    await m(MENTOR2, { name: 'Mentor Two', role: 'mentor' });
    await m(STUDENT, { name: 'Student', role: 'student', active: true, mentorEmail: MENTOR, paths: ['research'] });
    await m(OTHER, { name: 'Other', role: 'student', active: false, mentorEmail: MENTOR2 });
    const sub = (email, name, id, data) => setDoc(doc(db, 'members', email, name, id), data);
    for (const email of [STUDENT, OTHER]) {
      await sub(email, 'sessions', 's1', { start: Timestamp.now(), title: 'Weekly session', notes: 'n' });
      await sub(email, 'tasks', 't1', { title: 'Read paper', done: false, createdBy: MENTOR });
      await sub(email, 'milestones', 'ms1', { title: 'Pick a question', status: 'planned' });
      await sub(email, 'requests', 'r1', { type: 'question', title: 'Q', status: 'open', createdBy: email });
      await sub(email, 'colleges', 'c1', { name: 'MIT', tier: 'reach' });
      await sub(email, 'checkins', 'k1', { date: '2026-10-01', status: 'on_track', by: MENTOR });
    }
    await setDoc(doc(db, 'resources', 'res1'), {
      title: 'ISEF abstract', category: 'competitions', url: 'https://drive.google.com/x', addedBy: MENTOR,
    });
  });
});

const as = (email, verified = true) =>
  env.authenticatedContext(email.replace(/\W/g, '_'), { email, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ref = (db, ...p) => doc(db, ...p);

// ---------- signing in ----------
test('signed-out visitors see nothing', async () => {
  await assertFails(getDoc(ref(anon(), 'members', STUDENT)));
  await assertFails(getDoc(ref(anon(), 'resources', 'res1')));
});

test('unverified email is locked out even with a profile', async () => {
  await assertFails(getDoc(ref(as(STUDENT, false), 'members', STUDENT)));
});

test('signed-in stranger without a profile sees nothing', async () => {
  const db = as(STRANGER);
  await assertFails(getDoc(ref(db, 'members', STRANGER)));
  await assertFails(getDoc(ref(db, 'members', MENTOR)));
  await assertFails(getDoc(ref(db, 'resources', 'res1')));
  await assertFails(setDoc(ref(db, 'members', STRANGER), { email: STRANGER, name: 'x', role: 'admin' }));
});

test('email case in the token does not matter', async () => {
  await assertSucceeds(getDoc(ref(as('Student@Everest.test'), 'members', STUDENT)));
});

// ---------- students ----------
test('student reads own profile and work', async () => {
  const db = as(STUDENT);
  await assertSucceeds(getDoc(ref(db, 'members', STUDENT)));
  for (const sub of ['sessions', 'tasks', 'milestones', 'requests', 'colleges']) {
    await assertSucceeds(getDocs(collection(db, 'members', STUDENT, sub)));
  }
});

test('student can read their mentor profile but not other students', async () => {
  const db = as(STUDENT);
  await assertSucceeds(getDoc(ref(db, 'members', MENTOR)));
  await assertFails(getDoc(ref(db, 'members', OTHER)));
  await assertFails(getDocs(collection(db, 'members', OTHER, 'sessions')));
  await assertFails(getDocs(collection(db, 'members')));
});

test('student cannot read internal check-ins', async () => {
  await assertFails(getDocs(collection(as(STUDENT), 'members', STUDENT, 'checkins')));
});

test('student can only touch lastSeenAt on their profile', async () => {
  const db = as(STUDENT);
  await assertSucceeds(updateDoc(ref(db, 'members', STUDENT), { lastSeenAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { lastSeenAt: Timestamp.fromDate(new Date(2030, 0, 1)) }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { role: 'admin' }));
  // An unenrolled student cannot unlock the library by flipping their own flag.
  await assertFails(updateDoc(ref(as(OTHER), 'members', OTHER), { active: true, lastSeenAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { mentorEmail: MENTOR2 }));
  await assertFails(deleteDoc(ref(db, 'members', STUDENT)));
});

test('student checks off mentor tasks but cannot rewrite them', async () => {
  const db = as(STUDENT);
  await assertSucceeds(updateDoc(ref(db, 'members', STUDENT, 'tasks', 't1'), { done: true, doneAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT, 'tasks', 't1'), { title: 'Nothing' }));
  await assertFails(deleteDoc(ref(db, 'members', STUDENT, 'tasks', 't1')));
});

test('student adds and edits their own tasks', async () => {
  const db = as(STUDENT);
  const t = await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'tasks'), { title: 'Mine', done: false, createdBy: STUDENT }));
  await assertSucceeds(updateDoc(t, { title: 'Mine, renamed' }));
  await assertSucceeds(deleteDoc(t));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'tasks'), { title: 'Forged', done: false, createdBy: MENTOR }));
  await assertFails(addDoc(collection(db, 'members', OTHER, 'tasks'), { title: 'Theirs', done: false, createdBy: STUDENT }));
});

test('student asks questions and submits drafts but cannot answer them', async () => {
  const db = as(STUDENT);
  const reqs = collection(db, 'members', STUDENT, 'requests');
  const r = await assertSucceeds(addDoc(reqs, { type: 'review', title: 'Essay', url: 'https://docs.google.com/d', status: 'open', createdBy: STUDENT }));
  await assertSucceeds(updateDoc(r, { title: 'Essay v2' }));
  await assertFails(addDoc(reqs, { type: 'review', title: 'x', status: 'answered', createdBy: STUDENT }));
  await assertFails(addDoc(reqs, { type: 'question', title: 'x', status: 'open', createdBy: STUDENT, reply: 'self' }));
  await assertFails(addDoc(reqs, { type: 'review', title: 'x', url: 'javascript:alert(1)', status: 'open', createdBy: STUDENT }));
  await assertFails(updateDoc(r, { status: 'answered', reply: 'great' }));
  await assertFails(addDoc(reqs, { type: 'question', title: 'x', status: 'open', createdBy: STUDENT, answeredBy: MENTOR }));
});

test('student manages their college list only', async () => {
  const db = as(STUDENT);
  await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'colleges'), { name: 'Stanford', tier: 'reach' }));
  await assertSucceeds(updateDoc(ref(db, 'members', STUDENT, 'colleges', 'c1'), { status: 'Applying' }));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'colleges'), { name: 'X', tier: 'dream' }));
  await assertFails(addDoc(collection(db, 'members', OTHER, 'colleges'), { name: 'X' }));
});

test('student can move a milestone status but not edit or add milestones', async () => {
  const db = as(STUDENT);
  await assertSucceeds(updateDoc(ref(db, 'members', STUDENT, 'milestones', 'ms1'), { status: 'done' }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT, 'milestones', 'ms1'), { title: 'Easier' }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT, 'milestones', 'ms1'), { status: 'skipped' }));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'milestones'), { title: 'x', status: 'planned' }));
});

test('student cannot log sessions', async () => {
  await assertFails(addDoc(collection(as(STUDENT), 'members', STUDENT, 'sessions'), { start: Timestamp.now(), title: 'fake' }));
});

// ---------- mentors ----------
test('mentor sees their own mentees and nobody else', async () => {
  const db = as(MENTOR);
  await assertSucceeds(getDoc(ref(db, 'members', STUDENT)));
  await assertSucceeds(getDocs(query(collection(db, 'members'), where('mentorEmail', '==', MENTOR))));
  await assertFails(getDocs(collection(db, 'members')));
  await assertFails(getDoc(ref(db, 'members', OTHER)));
  await assertFails(getDocs(collection(db, 'members', OTHER, 'sessions')));
  await assertFails(getDocs(collection(db, 'members', OTHER, 'checkins')));
});

test('mentor logs sessions, tasks and milestones for their mentee', async () => {
  const db = as(MENTOR);
  await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'sessions'), { start: Timestamp.now(), title: 'Session', durationMin: 60, link: 'https://meet.google.com/x' }));
  await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'tasks'), { title: 'Draft intro', done: false, createdBy: MENTOR, due: '2026-11-01' }));
  await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'milestones'), { title: 'Abstract', status: 'planned' }));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'sessions'), { start: Timestamp.now(), title: 'x', link: 'javascript:alert(1)' }));
  await assertFails(addDoc(collection(db, 'members', OTHER, 'sessions'), { start: Timestamp.now(), title: 'x' }));
});

test('mentor check-ins are signed by the mentor writing them', async () => {
  const db = as(MENTOR);
  await assertSucceeds(getDocs(collection(db, 'members', STUDENT, 'checkins')));
  await assertSucceeds(addDoc(collection(db, 'members', STUDENT, 'checkins'), { date: '2026-10-16', status: 'needs_attention', note: 'Behind on reading', by: MENTOR }));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'checkins'), { date: '2026-10-16', status: 'on_track', by: ADMIN }));
  await assertFails(addDoc(collection(db, 'members', STUDENT, 'checkins'), { date: '2026-10-16', status: 'fine', by: MENTOR }));
});

test('mentor answers requests without rewriting the question', async () => {
  const db = as(MENTOR);
  const r = ref(db, 'members', STUDENT, 'requests', 'r1');
  await assertSucceeds(updateDoc(r, { status: 'answered', reply: 'Here is how', answeredBy: MENTOR, answeredAt: serverTimestamp() }));
  await assertFails(updateDoc(r, { title: 'Different question' }));
  await assertFails(updateDoc(r, { reply: 'x', answeredBy: ADMIN }));
});

test('mentor edits goals and Drive folder only', async () => {
  const db = as(MENTOR);
  await assertSucceeds(updateDoc(ref(db, 'members', STUDENT), { goals: 'ISEF 2027', driveFolderUrl: 'https://drive.google.com/drive/folders/abc' }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { active: false }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { mentorEmail: MENTOR2 }));
  await assertFails(updateDoc(ref(db, 'members', STUDENT), { driveFolderUrl: 'javascript:alert(1)' }));
  await assertFails(setDoc(ref(db, 'members', 'new@everest.test'), { email: 'new@everest.test', name: 'New', role: 'student' }));
});

// ---------- admins ----------
test('admin adds people with valid profiles only', async () => {
  const db = as(ADMIN);
  await assertSucceeds(setDoc(ref(db, 'members', 'new@everest.test'), { email: 'new@everest.test', name: 'New', role: 'student', active: true, mentorEmail: MENTOR }));
  await assertFails(setDoc(ref(db, 'members', 'bad@everest.test'), { email: 'bad@everest.test', name: 'Bad', role: 'owner' }));
  await assertFails(setDoc(ref(db, 'members', 'Upper@everest.test'), { email: 'Upper@everest.test', name: 'U', role: 'student' }));
  await assertFails(setDoc(ref(db, 'members', 'mismatch@everest.test'), { email: 'other@everest.test', name: 'M', role: 'student' }));
});

test('admin sees everyone but cannot delete themselves', async () => {
  const db = as(ADMIN);
  await assertSucceeds(getDocs(collection(db, 'members')));
  await assertSucceeds(getDocs(collection(db, 'members', OTHER, 'sessions')));
  await assertSucceeds(getDocs(collection(db, 'members', OTHER, 'checkins')));
  await assertFails(deleteDoc(ref(db, 'members', ADMIN)));
  await assertSucceeds(deleteDoc(ref(db, 'members', OTHER)));
});

// ---------- resources ----------
test('resources open to enrolled students and staff only', async () => {
  await assertSucceeds(getDoc(ref(as(STUDENT), 'resources', 'res1')));
  await assertSucceeds(getDocs(collection(as(STUDENT), 'resources')));
  await assertFails(getDoc(ref(as(OTHER), 'resources', 'res1')));
  await assertSucceeds(getDoc(ref(as(MENTOR2), 'resources', 'res1')));
});

test('staff add resources; students cannot', async () => {
  const good = { title: 'RSI essays', category: 'programs', url: 'https://drive.google.com/y' };
  await assertFails(addDoc(collection(as(STUDENT), 'resources'), { ...good, addedBy: STUDENT }));
  await assertSucceeds(addDoc(collection(as(MENTOR2), 'resources'), { ...good, addedBy: MENTOR2 }));
  await assertFails(addDoc(collection(as(MENTOR2), 'resources'), { ...good, addedBy: MENTOR }));
  await assertFails(addDoc(collection(as(MENTOR2), 'resources'), { ...good, url: 'javascript:alert(1)', addedBy: MENTOR2 }));
  await assertFails(addDoc(collection(as(MENTOR2), 'resources'), { ...good, category: 'secret', addedBy: MENTOR2 }));
  await assertFails(updateDoc(ref(as(MENTOR2), 'resources', 'res1'), { title: 'Mine now' }));
  await assertFails(deleteDoc(ref(as(MENTOR2), 'resources', 'res1')));
  await assertSucceeds(updateDoc(ref(as(MENTOR), 'resources', 'res1'), { title: 'ISEF abstract 2025' }));
  await assertSucceeds(deleteDoc(ref(as(ADMIN), 'resources', 'res1')));
});

// ---------- invite codes ----------
const inDays = (n) => Timestamp.fromDate(new Date(Date.now() + n * 86400000));
async function seedInvite(code, data) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'invites', code), {
    role: 'student', createdBy: MENTOR, mentorEmail: MENTOR, active: false, paths: ['research'], expiresAt: inDays(14), ...data,
  }));
}
function redeem(db, email, code, profile) {
  const b = writeBatch(db);
  b.set(doc(db, 'members', email), { email, name: 'New Person', role: 'student', mentorEmail: MENTOR, active: false, paths: ['research'], inviteCode: code, ...profile });
  b.update(doc(db, 'invites', code), { usedBy: email, usedAt: serverTimestamp() });
  return b.commit();
}

test('mentor invites students to themselves only, never enrolled or as staff', async () => {
  const db = as(MENTOR);
  const base = { role: 'student', createdBy: MENTOR, mentorEmail: MENTOR, mentorName: 'Mentor', active: false, expiresAt: inDays(14) };
  await assertSucceeds(setDoc(doc(db, 'invites', 'ABCD2345'), base));
  await assertFails(setDoc(doc(db, 'invites', 'ABCD2346'), { ...base, role: 'mentor' }));
  await assertFails(setDoc(doc(db, 'invites', 'ABCD2347'), { ...base, mentorEmail: MENTOR2 }));
  await assertFails(setDoc(doc(db, 'invites', 'ABCD2348'), { ...base, active: true }));
  await assertFails(setDoc(doc(db, 'invites', 'ABCD2349'), { ...base, createdBy: ADMIN }));
  await assertFails(setDoc(doc(db, 'invites', 'short'), base));
  await assertFails(setDoc(doc(as(STUDENT), 'invites', 'ABCD2350'), { ...base, createdBy: STUDENT }));
  await assertFails(setDoc(doc(as(STRANGER), 'invites', 'ABCD2351'), { ...base, createdBy: STRANGER }));
});

test('founder can invite mentors and enrolled students', async () => {
  const db = as(ADMIN);
  await assertSucceeds(setDoc(doc(db, 'invites', 'MENT0R22'), { role: 'mentor', createdBy: ADMIN, expiresAt: inDays(14) }));
  await assertSucceeds(setDoc(doc(db, 'invites', 'STUD3NT2'), { role: 'student', createdBy: ADMIN, mentorEmail: MENTOR, active: true, expiresAt: inDays(14) }));
});

test('invites stay private: no listing by strangers, mentors list only their own', async () => {
  await seedInvite('PRIV4TE2', {});
  await seedInvite('OTHER222', { createdBy: MENTOR2, mentorEmail: MENTOR2 });
  await assertFails(getDocs(collection(as(STRANGER), 'invites')));
  await assertSucceeds(getDoc(doc(as(STRANGER), 'invites', 'PRIV4TE2')));
  await assertFails(getDoc(doc(anon(), 'invites', 'PRIV4TE2')));
  await assertSucceeds(getDocs(query(collection(as(MENTOR), 'invites'), where('createdBy', '==', MENTOR))));
  await assertFails(getDocs(collection(as(MENTOR), 'invites')));
  await assertSucceeds(getDocs(collection(as(ADMIN), 'invites')));
});

test('a new person joins with a valid code and lands with exactly its role', async () => {
  await seedInvite('JOIN2345', {});
  const email = 'newkid@everest.test';
  await assertSucceeds(redeem(as(email), email, 'JOIN2345', { grade: '10', school: 'Central High' }));
  await assertSucceeds(getDoc(doc(as(email), 'members', email)));
  await assertSucceeds(getDoc(doc(as(MENTOR), 'members', email)));
});

test('a code cannot be bent into more access', async () => {
  await seedInvite('BEND2345', {});
  const email = 'sneaky@everest.test';
  await assertFails(redeem(as(email), email, 'BEND2345', { role: 'admin' }));
  await assertFails(redeem(as(email), email, 'BEND2345', { role: 'mentor', mentorEmail: '' }));
  await assertFails(redeem(as(email), email, 'BEND2345', { active: true }));
  await assertFails(redeem(as(email), email, 'BEND2345', { mentorEmail: MENTOR2 }));
  await assertFails(redeem(as(email), email, 'BEND2345', { driveFolderUrl: 'https://x.test' }));
});

test('a code works once, before it expires, for a verified email', async () => {
  await seedInvite('ONCE2345', {});
  await assertSucceeds(redeem(as('first@everest.test'), 'first@everest.test', 'ONCE2345', {}));
  await assertFails(redeem(as('second@everest.test'), 'second@everest.test', 'ONCE2345', {}));
  await seedInvite('OLD23456', { expiresAt: Timestamp.fromDate(new Date(Date.now() - 1000)) });
  await assertFails(redeem(as('late@everest.test'), 'late@everest.test', 'OLD23456', {}));
  await seedInvite('UNVER234', {});
  await assertFails(redeem(as('unverified@everest.test', false), 'unverified@everest.test', 'UNVER234', {}));
});

test('nobody joins without spending a code, or spends one without joining', async () => {
  await seedInvite('HALF2345', {});
  const email = 'half@everest.test';
  const db = as(email);
  await assertFails(setDoc(doc(db, 'members', email), { email, name: 'x', role: 'student', mentorEmail: MENTOR, active: false, paths: ['research'], inviteCode: 'HALF2345' }));
  await assertFails(updateDoc(doc(db, 'invites', 'HALF2345'), { usedBy: email, usedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'members', email), { email, name: 'x', role: 'student' }));
  await assertFails(redeem(db, 'someoneelse@everest.test', 'HALF2345', {}));
});
