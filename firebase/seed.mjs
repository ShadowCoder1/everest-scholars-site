// Sample data for the local preview (emulators only). Never run against production.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set, so this would hit a real database.');
  process.exit(1);
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-everest' });
const db = getFirestore();

const day = (offset, h = 16, m = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0); return d; };
const iso = (offset) => { const d = day(offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ts = (offset, h, m) => Timestamp.fromDate(day(offset, h, m));

const FOUNDER = 'founder@everest.test';
const MENTOR = 'mentor@everest.test';
const STUDENT = 'student@everest.test';

const members = [
  { email: FOUNDER, name: 'Jordan Lee', role: 'admin' },
  { email: MENTOR, name: 'Priya Natarajan', role: 'mentor' },
  { email: STUDENT, name: 'Maya Chen', role: 'student', active: true, mentorEmail: MENTOR, paths: ['research', 'competitions'], grade: '11', school: 'Lincoln High School',
    termStart: '2026-09-01', termEnd: '2027-08-31', sessionsPlanned: 48, parentName: 'Lin Chen', parentEmail: 'parent@everest.test',
    goals: 'Finish a computational biology project on drought stress in wheat, compete at ISEF 2027, and submit to a student journal by summer.' },
  { email: 'ethan@everest.test', name: 'Ethan Brooks', role: 'student', active: true, mentorEmail: MENTOR, paths: ['programs'], grade: '10', school: 'Westview Academy', sessionsPlanned: 48 },
  { email: 'sofia@everest.test', name: 'Sofia Alvarez', role: 'student', active: false, mentorEmail: FOUNDER, paths: ['admissions'], grade: '12', school: 'Riverside Prep' },
];

const batch = db.batch();
for (const m of members) batch.set(db.doc(`members/${m.email}`), { ...m, createdAt: Timestamp.now() });
const add = (email, sub, data) => batch.set(db.collection(`members/${email}/${sub}`).doc(), { ...data, createdAt: Timestamp.now() });

[[-42, 'Kickoff and goals'], [-35, 'Narrowing the research question'], [-28, 'Literature review plan'], [-21, 'Study design'], [-14, 'Data sources and methods'], [-7, 'First results']].forEach(([d, title], i) =>
  add(STUDENT, 'sessions', { start: ts(d, 16), durationMin: 60, title, mentorEmail: MENTOR,
    notes: i === 5 ? 'Maya ran the first model on the public drought dataset. Accuracy is promising but the validation split leaks across years.\n\nWe walked through how to split by season instead.' : 'Covered the plan for the week and reviewed progress.',
    nextSteps: i === 5 ? 'Re-split the data by season and rerun.\nDraft the methods section.' : '' }));
add(STUDENT, 'sessions', { start: ts(3, 16), durationMin: 60, title: 'Weekly session', link: 'https://meet.google.com/demo-link', mentorEmail: MENTOR });
add(STUDENT, 'tasks', { title: 'Re-split the dataset by season', due: iso(-1), done: false, createdBy: MENTOR });
add(STUDENT, 'tasks', { title: 'Draft the methods section', due: iso(4), done: false, createdBy: MENTOR, details: 'One page. Describe the dataset, the split and the model.' });
add(STUDENT, 'tasks', { title: 'Read the two papers on root imaging', due: iso(6), done: false, createdBy: MENTOR });
add(STUDENT, 'tasks', { title: 'Email the regional fair about registration', due: iso(12), done: false, createdBy: STUDENT });
add(STUDENT, 'tasks', { title: 'Summarize five related studies', due: iso(-10), done: true, createdBy: MENTOR });
[['Choose a research question', -30, 'done'], ['Finish literature review', -16, 'done'], ['Lock the study design', -6, 'done'], ['First full results', 14, 'in_progress'], ['Methods and results draft', 40, 'planned'], ['Regional fair submission', 95, 'planned'], ['ISEF 2027', 220, 'planned']].forEach(([title, d, status]) =>
  add(STUDENT, 'milestones', { title, due: iso(d), status, path: title.includes('fair') || title.includes('ISEF') ? 'competitions' : 'research' }));
add(STUDENT, 'requests', { type: 'review', kind: 'Research paper or abstract', title: 'Abstract, draft 2', url: 'https://docs.google.com/document/d/demo', body: 'Is the problem statement clear in the first two sentences?', status: 'answered', createdBy: STUDENT, reply: 'Much clearer than draft 1. Cut the second sentence and lead with the yield numbers.', answeredBy: MENTOR, answeredAt: ts(-4, 18) });
add(STUDENT, 'requests', { type: 'review', kind: 'Program application', title: 'Summer program essay', url: 'https://docs.google.com/document/d/demo2', body: 'Mostly want feedback on the ending.', status: 'open', createdBy: STUDENT });
add(STUDENT, 'requests', { type: 'question', title: 'Can I use the 2019 data if a few months are missing?', body: 'About 6% of rows have gaps.', status: 'answered', createdBy: STUDENT, reply: 'Yes. Drop those months and say so in your methods. Do not fill them in.', answeredBy: MENTOR, answeredAt: ts(-9, 12) });
[['Massachusetts Institute of Technology', 'reach', 'EA', iso(16)], ['Stanford University', 'reach', 'REA', iso(16)], ['University of Michigan', 'target', 'EA', iso(16)], ['Georgia Institute of Technology', 'target', 'EA', iso(30)], ['University of Wisconsin-Madison', 'likely', 'EA', iso(16)]].forEach(([name, tier, plan, deadline]) =>
  add(STUDENT, 'colleges', { name, tier, plan, deadline, status: 'Researching' }));
add(STUDENT, 'checkins', { date: iso(-14), status: 'on_track', note: 'Strong week. Question is locked.', by: MENTOR, byName: 'Priya Natarajan' });
add(STUDENT, 'checkins', { date: iso(-7), status: 'needs_attention', note: 'Validation split leaks across years. Fixable, but it pushes results back a week.', by: MENTOR, byName: 'Priya Natarajan' });
add('ethan@everest.test', 'sessions', { start: ts(-20, 17), durationMin: 60, title: 'Program shortlist', mentorEmail: MENTOR });
add('ethan@everest.test', 'requests', { type: 'question', title: 'Should I apply to both RSI and SSP?', status: 'open', createdBy: 'ethan@everest.test' });
add('ethan@everest.test', 'checkins', { date: iso(-20), status: 'on_track', note: 'Shortlist done.', by: MENTOR, byName: 'Priya Natarajan' });

const res = (data) => batch.set(db.collection('resources').doc(), { ...data, url: 'https://drive.google.com/file/d/demo', addedBy: FOUNDER, createdAt: Timestamp.now() });
res({ title: 'Research plan and abstract', category: 'competitions', program: 'ISEF', year: '2025', result: 'Grand Award', kind: 'PDF' });
res({ title: 'Poster and judging notes', category: 'competitions', program: 'ISEF', year: '2025', result: 'Grand Award', kind: 'Slides' });
res({ title: 'Research report', category: 'competitions', program: 'Regeneron STS', year: '2025', result: 'Top 300', kind: 'PDF' });
res({ title: 'Paper and presentation', category: 'competitions', program: 'JSHS', year: '2024', result: 'National first place', kind: 'PDF' });
res({ title: 'Application essays', category: 'programs', program: 'RSI', year: '2025', result: 'Admitted', kind: 'Google Doc' });
res({ title: 'Application and problem set', category: 'programs', program: 'SSP', year: '2025', result: 'Admitted', kind: 'PDF' });
res({ title: 'Personal statement', category: 'colleges', program: 'Common App personal statements', year: '2025', result: 'Admitted to MIT', kind: 'Google Doc' });
res({ title: 'Professor outreach email templates', category: 'guides', program: 'Professor outreach', kind: 'Google Doc', description: 'Three templates with notes on what to personalize.' });
await batch.commit();

// Accounts for the password sign-in path too (Google-style demo buttons need none).
const auth = getAuth();
for (const m of members) {
  await auth.createUser({ email: m.email, emailVerified: true, password: 'everest-demo', displayName: m.name }).catch(() => {});
}
console.log(`Seeded ${members.length} people and sample work. Demo password for every account: everest-demo`);
