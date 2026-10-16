import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, where,
  addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig, DEMO } from './config.js';

export const configured = DEMO || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = configured
  ? initializeApp(DEMO ? { apiKey: 'demo-key', projectId: 'demo-everest', authDomain: 'localhost' } : firebaseConfig)
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

if (DEMO) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut,
  doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp,
};
