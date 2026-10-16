// Creates "<Student Name> - Everest Scholars" in the founder's Google Drive and
// shares it with the student, their parent and their mentor. Uses the drive.file
// scope, so the portal only ever sees folders it created itself.
import { googleClientId } from './config.js';
import { driveFolderName } from './ui.js';

const FOLDER = 'application/vnd.google-apps.folder';
const PARENT_NAME = 'Everest Scholars Students';
let cached = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.append(s);
  });
}

async function accessToken() {
  if (cached && cached.expires > Date.now()) return cached.token;
  if (!googleClientId) throw new Error('Drive folder creation is not set up. Paste the folder link instead.');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || 'Google Drive access was not granted.'));
        cached = { token: r.access_token, expires: Date.now() + (Number(r.expires_in) - 60) * 1000 };
        resolve(r.access_token);
      },
      error_callback: () => reject(new Error('Google Drive access was not granted.')),
    });
    client.requestAccessToken();
  });
}

async function drive(path, token, init = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Google Drive returned ${res.status}.`);
  return body;
}

async function parentFolder(token) {
  const q = encodeURIComponent(`name = '${PARENT_NAME}' and mimeType = '${FOLDER}' and trashed = false`);
  const found = await drive(`files?q=${q}&fields=files(id)&pageSize=1`, token);
  if (found.files?.length) return found.files[0].id;
  const made = await drive('files?fields=id', token, { method: 'POST', body: JSON.stringify({ name: PARENT_NAME, mimeType: FOLDER }) });
  return made.id;
}

export async function createStudentFolder(student, shareWith = []) {
  const token = await accessToken();
  const parent = await parentFolder(token);
  const folder = await drive('files?fields=id,webViewLink', token, {
    method: 'POST', body: JSON.stringify({ name: driveFolderName(student.name), mimeType: FOLDER, parents: [parent] }),
  });
  const emails = [...new Set(shareWith.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  for (const emailAddress of emails) {
    await drive(`files/${folder.id}/permissions?sendNotificationEmail=true`, token, {
      method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress }),
    });
  }
  return folder.webViewLink;
}
