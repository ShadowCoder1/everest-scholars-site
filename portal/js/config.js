// Firebase project settings for the portal. These values are public by design:
// what each person can read or change is enforced by firebase/firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyAsNZ1I5qmaaPhW_Ph08vN-8CFPUU-FcwU',
  authDomain: 'everest-scholars-portal.firebaseapp.com',
  projectId: 'everest-scholars-portal',
  appId: '1:139246497846:web:5c1c638a6473c4642be897',
};

// OAuth client used to create each student's "Name - Everest Futures" folder in
// Google Drive from the People page. Leave empty to paste folder links by hand.
export const googleClientId = '';

// Local preview: open the portal on localhost with ?demo to use the Firebase
// emulators and sample accounts (see firebase/README.md).
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if (local && new URLSearchParams(location.search).has('demo')) sessionStorage.setItem('es-demo', '1');
export const DEMO = local && sessionStorage.getItem('es-demo') === '1';

export const DEMO_ACCOUNTS = [
  { email: 'founder@everest.test', label: 'Founder (admin)' },
  { email: 'mentor@everest.test', label: 'Mentor' },
  { email: 'student@everest.test', label: 'Student' },
  { email: 'newcomer@everest.test', label: 'New person' },
  { email: 'newcomer2@everest.test', label: 'Another new person' },
];
