// Reads and writes for the portal. Access is enforced by firebase/firestore.rules;
// these helpers only shape the data.
import {
  db, doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp,
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

export { serverTimestamp, Timestamp };
