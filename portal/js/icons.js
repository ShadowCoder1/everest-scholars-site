import { raw } from './ui.js';

// 20px line icons, drawn on a 20x20 grid with a 1.5 stroke.
const P = {
  home: '<path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1V9Z"/>',
  sessions: '<circle cx="7.5" cy="7" r="2.75"/><path d="M2.75 16.25c.5-2.6 2.4-4.25 4.75-4.25s4.25 1.65 4.75 4.25"/><path d="M13 4.5a2.6 2.6 0 0 1 0 5M14.5 12.4c1.5.5 2.5 1.8 2.8 3.85"/>',
  review: '<path d="M11.5 3H5.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7l-4-4Z"/><path d="M11.5 3v4h4M7.5 11h5M7.5 14h3"/>',
  question: '<path d="M16.5 10a6.5 6.5 0 0 1-9.6 5.7L3.5 16.5l.85-3.2A6.5 6.5 0 1 1 16.5 10Z"/><path d="M8.2 8.2a1.9 1.9 0 1 1 2.6 1.75c-.5.2-.8.6-.8 1.1v.2M10 13.4v.1"/>',
  roadmap: '<path d="M2.5 16.5 7.5 7l3 5 2-3 5 7.5h-15Z"/><path d="M7.5 7V3.5l3 1.25-3 1.25"/>',
  tasks: '<rect x="3.25" y="3.25" width="13.5" height="13.5" rx="2"/><path d="m6.75 10.25 2.25 2.25 4.5-5"/>',
  calendar: '<rect x="3" y="4.25" width="14" height="12.5" rx="1.75"/><path d="M3 8.25h14M7 2.75v3M13 2.75v3"/>',
  college: '<path d="M2.5 7.5 10 4l7.5 3.5L10 11 2.5 7.5Z"/><path d="M5.5 9v4c1.2 1.3 2.7 2 4.5 2s3.3-.7 4.5-2V9M17.5 7.5V12"/>',
  resources: '<path d="M3 5.5a1 1 0 0 1 1-1h3.6l1.6 1.75H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5Z"/>',
  folder: '<path d="M3 5.5a1 1 0 0 1 1-1h3.6l1.6 1.75H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5Z"/><path d="M10 9v4.25M8 11.25l2 2 2-2"/>',
  mentees: '<circle cx="10" cy="6.75" r="3"/><path d="M4 16.5c.6-3 2.95-4.75 6-4.75s5.4 1.75 6 4.75"/>',
  inbox: '<path d="M3 11.5 5 4.5h10l2 7v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z"/><path d="M3 11.5h4.25l.9 1.75h3.7l.9-1.75H17"/>',
  people: '<circle cx="7.5" cy="7" r="2.75"/><path d="M2.75 16.25c.5-2.6 2.4-4.25 4.75-4.25 1.3 0 2.4.45 3.25 1.25"/><path d="M15 11.75v5M12.5 14.25h5"/>',
  checkin: '<path d="M2.5 10h3l2-4.5 3 9 2-4.5h5"/>',
  chevron: '<path d="m6 8 4 4 4-4"/>',
  back: '<path d="M12 5 7 10l5 5"/>',
  external: '<path d="M11.5 3.5h5v5M16.5 3.5l-7 7M14 11.5V16a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V6.5A.5.5 0 0 1 4 6h4.5"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  edit: '<path d="m12.75 4.25 3 3L7.5 15.5l-3.75.75.75-3.75 8.25-8.25Z"/>',
  trash: '<path d="M4 6h12M8 6V4.5h4V6M5.5 6l.75 10h7.5L14.5 6"/>',
  search: '<circle cx="8.75" cy="8.75" r="5"/><path d="m12.5 12.5 4 4"/>',
  mail: '<rect x="2.75" y="4.5" width="14.5" height="11" rx="1.5"/><path d="m3.5 5.5 6.5 5 6.5-5"/>',
  menu: '<path d="M3.5 6h13M3.5 10h13M3.5 14h13"/>',
  signout: '<path d="M8 16.5H4.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H8M12.5 6.5 16 10l-3.5 3.5M16 10H7.5"/>',
  lock: '<rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9"/>',
  link: '<path d="M8.5 11.5a3 3 0 0 0 4.25 0l2.5-2.5a3 3 0 0 0-4.25-4.25l-1 1M11.5 8.5a3 3 0 0 0-4.25 0l-2.5 2.5a3 3 0 0 0 4.25 4.25l1-1"/>',
  video: '<rect x="2.75" y="5.25" width="10.5" height="9.5" rx="1.5"/><path d="m13.25 8.75 4-2.25v7l-4-2.25"/>',
};

export const icon = (name, cls = '') =>
  raw(`<svg class="ic ${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

export const GOOGLE_G = raw('<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>');
