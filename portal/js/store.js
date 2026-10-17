// Reads and writes for the portal. Access is enforced by firebase/firestore.rules;
// these helpers only shape the data.
import {
  db, doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp, writeBatch,
} from './fb.js';

const withId = (snap) => ({ id: snap.id, ...snap.data() });
export const normEmail = (e) => String(e || '').trim().toLowerCase();

// ---------- members ----------
export async function getMember(email) {
  const s = await getDoc(doc(db, 'members', normEmail(email)));
  return s.exists() ? withId(s) : null;
}
export async function listMembers() {
  const s = await getDocs(collection(db, 'members'));
  return s.docs.map(withId).sort((a, b) => a.name.localeCompare(b.name));
}
export async function listMentees(mentorEmail) {
  const s = await getDocs(query(collection(db, 'members'), where('mentorEmail', '==', normEmail(mentorEmail))));
  return s.docs.map(withId).sort((a, b) => a.name.localeCompare(b.name));
}
export const saveMember = (email, data, isNew) => {
  const ref = doc(db, 'members', normEmail(email));
  return isNew
    ? setDoc(ref, { ...data, email: normEmail(email), createdAt: serverTimestamp() })
    : updateDoc(ref, data);
};
export const updateMember = (email, data) => updateDoc(doc(db, 'members', normEmail(email)), data);
export const removeMember = (email) => deleteDoc(doc(db, 'members', normEmail(email)));
export const touchLastSeen = (email) => updateDoc(doc(db, 'members', normEmail(email)), { lastSeenAt: serverTimestamp() });

// ---------- a student's work: sessions, tasks, milestones, requests, colleges, checkins ----------
export async function listSub(email, sub) {
  const s = await getDocs(collection(db, 'members', normEmail(email), sub));
  return s.docs.map(withId);
}
export const addSub = (email, sub, data) =>
  addDoc(collection(db, 'members', normEmail(email), sub), { ...data, createdAt: serverTimestamp() });
export const updateSub = (email, sub, id, data) => updateDoc(doc(db, 'members', normEmail(email), sub, id), data);
export const removeSub = (email, sub, id) => deleteDoc(doc(db, 'members', normEmail(email), sub, id));

// Everything a dashboard needs for one student, fetched in parallel.
// Check-ins are only readable by coaches, so they are skipped for students.
export async function loadStudent(email, { checkins = false } = {}) {
  const subs = ['sessions', 'tasks', 'milestones', 'requests', 'colleges'];
  if (checkins) subs.push('checkins');
  const lists = await Promise.all(subs.map((s) => listSub(email, s)));
  return Object.fromEntries(subs.map((s, i) => [s, lists[i]]));
}

// ---------- resources ----------
export async function listResources() {
  const s = await getDocs(collection(db, 'resources'));
  return s.docs.map(withId);
}
export const addResource = (data) => addDoc(collection(db, 'resources'), { ...data, createdAt: serverTimestamp() });
export const updateResource = (id, data) => updateDoc(doc(db, 'resources', id), data);
export const removeResource = (id) => deleteDoc(doc(db, 'resources', id));

// ---------- invites ----------
// An invite is a one-time code that decides the joiner's role (and for students,
// their mentor). The code is the document id. 8 characters from a 31-letter
// alphabet with no look-alikes (no 0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode() {
  let out = '';
  while (out.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < 8) out += ALPHABET[b % 31]; // 248 = 31 * 8, so every letter is equally likely
    }
  }
  return out;
}
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c) => `${c.slice(0, 4)}-${c.slice(4, 8)}`;
export const INVITE_DAYS = 14;

export async function createInvite(data) {
  const code = newCode();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + INVITE_DAYS * 86400000));
  await setDoc(doc(db, 'invites', code), { ...data, expiresAt, createdAt: serverTimestamp() });
  return { id: code, ...data, expiresAt };
}
export async function getInvite(code) {
  const s = await getDoc(doc(db, 'invites', cleanCode(code)));
  return s.exists() ? withId(s) : null;
}
export async function listInvites(createdBy) {
  const q = createdBy ? query(collection(db, 'invites'), where('createdBy', '==', normEmail(createdBy))) : collection(db, 'invites');
  const s = await getDocs(q);
  return s.docs.map(withId);
}
export const revokeInvite = (code) => deleteDoc(doc(db, 'invites', code));
// Creates the joiner's profile from the invite and spends the code, in one write.
export async function redeemInvite(invite, email, profile) {
  const me = normEmail(email);
  const b = writeBatch(db);
  const data = { email: me, name: profile.name, role: invite.role, inviteCode: invite.id, createdAt: serverTimestamp() };
  if ('mentorEmail' in invite) data.mentorEmail = invite.mentorEmail;
  if ('active' in invite) data.active = invite.active;
  if ('paths' in invite) data.paths = invite.paths;
  for (const k of ['grade', 'school', 'parentName', 'parentEmail']) if (profile[k]) data[k] = k === 'parentEmail' ? normEmail(profile[k]) : profile[k];
  b.set(doc(db, 'members', me), data);
  b.update(doc(db, 'invites', invite.id), { usedBy: me, usedAt: serverTimestamp() });
  await b.commit();
}

export { serverTimestamp, Timestamp };
