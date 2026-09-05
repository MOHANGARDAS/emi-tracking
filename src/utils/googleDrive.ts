// Google Drive backup configuration
// 1. Create a Cloud Console project, enable Drive API, create OAuth 2.0 Client ID (Web application)
// 2. Replace the placeholder below with your Client ID, or let the user set it via Settings → Google Drive Backup
// 3. The first time a user connects, they'll go through the Google consent screen.
// 4. Token is stored in localStorage and persists across browser restores (but not phone factory reset).
//
// To get a Client ID:
//   - Go to https://console.cloud.google.com/
//   - Create a new project (or select existing)
//   - Enable "Google Drive API"
//   - Go to "APIs & Services → Credentials"
//   - Create "Web application" OAuth client ID
//   - Set authorized redirect URIs (e.g. https://localhost)
//   - Copy the Client ID here or let users set it in the app Settings
export const GOOGLE_CLIENT_ID = '';

/**
 * Falls back to a meta tag <meta name="google-client-id" content="YOUR_ID"> if localStorage is empty.
 * This allows injection via index.html without code changes during demos.
 */
export const GOOGLE_CLIENT_ID_PLACEHOLDER = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

/**
 * Auto‑backup controls
 * – Auto‑backup runs once daily (23+ hours since last backup) if Drive is connected.
 * – Manual backup can be triggered anytime from Settings.
 * – If Drive is not connected, export (JSON/CSV/Excel) still works locally.
 */
export const AUTO_BACKUP_HOURS = 23;
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
export const BACKUP_FOLDER_NAME = 'EMI_Tracker_Backup';

interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

let tokenClient: any = null;
let gsiLoaded = false;

function loadGsiScript(): Promise<void> {
  if (gsiLoaded) return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) {
    gsiLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google GSI script'));
    document.head.appendChild(script);
  });
}

export function getStoredToken(): string | null {
  return localStorage.getItem('gdrive_token');
}

export function getStoredUser(): GoogleUser | null {
  const s = localStorage.getItem('gdrive_user');
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

export function getClientId(): string {
  return localStorage.getItem('gdrive_client_id') || GOOGLE_CLIENT_ID || (document.querySelector('meta[name="google-client-id"]')?.getAttribute('content') || '');
}

export function isDriveConnected(): boolean {
  const token = getStoredToken();
  const expiry = localStorage.getItem('gdrive_token_expiry');
  if (!token) return false;
  if (expiry) {
    const expTime = new Date(expiry).getTime();
    if (Date.now() > expTime) {
      // expired, but we can try silent refresh
      return true; // still considered connected, refresh will handle
    }
  }
  return true;
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  const data = await res.json();
  return {
    name: data.name || data.email || 'Google User',
    email: data.email || '',
    picture: data.picture
  };
}

export async function connectDrive(): Promise<GoogleUser> {
  const clientId = getClientId();
  if (!clientId || clientId.includes('YOUR_GOOGLE')) {
    throw new Error('Google Client ID not configured. Please set valid Client ID in Settings → Google Drive Backup.');
  }

  await loadGsiScript();

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          const accessToken = tokenResponse.access_token;
          const expiresIn = tokenResponse.expires_in || 3600;
          const expiryDate = new Date(Date.now() + expiresIn * 1000 - 60000); // 1 min buffer

          localStorage.setItem('gdrive_token', accessToken);
          localStorage.setItem('gdrive_token_expiry', expiryDate.toISOString());
          localStorage.setItem('gdrive_connected_at', new Date().toISOString());

          try {
            const user = await fetchUserInfo(accessToken);
            localStorage.setItem('gdrive_user', JSON.stringify(user));
            resolve(user);
          } catch (e) {
            // If userinfo fails, still resolve with basic
            const fallback: GoogleUser = { name: 'Google User', email: '', picture: `https://ui-avatars.com/api/?name=Google+User&background=22c55e&color=fff` };
            localStorage.setItem('gdrive_user', JSON.stringify(fallback));
            resolve(fallback);
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'OAuth failed'));
        }
      });
    } else {
      // Update callback for subsequent calls
      tokenClient.callback = async (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        const accessToken = tokenResponse.access_token;
        const expiresIn = tokenResponse.expires_in || 3600;
        const expiryDate = new Date(Date.now() + expiresIn * 1000 - 60000);
        localStorage.setItem('gdrive_token', accessToken);
        localStorage.setItem('gdrive_token_expiry', expiryDate.toISOString());
        try {
          const user = await fetchUserInfo(accessToken);
          localStorage.setItem('gdrive_user', JSON.stringify(user));
          resolve(user);
        } catch {
          const fallback: GoogleUser = { name: 'Google User', email: '', picture: '' };
          resolve(fallback);
        }
      };
    }

    // Request access token with consent prompt first time
    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e: any) {
      reject(e);
    }
  });
}

export function disconnectDrive() {
  const token = getStoredToken();
  if (token) {
    // Revoke token on Google side - fire and forget
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {});
  }
  localStorage.removeItem('gdrive_token');
  localStorage.removeItem('gdrive_user');
  localStorage.removeItem('gdrive_connected_at');
  localStorage.removeItem('gdrive_token_expiry');
  localStorage.removeItem('gdrive_last_backup');
  localStorage.removeItem('gdrive_last_backup_detail');
  localStorage.removeItem('gdrive_folder_id');
  tokenClient = null;
}

export async function refreshTokenSilently(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  
  const expiryStr = localStorage.getItem('gdrive_token_expiry');
  if (!expiryStr) return true;
  
  const expiry = new Date(expiryStr).getTime();
  const now = Date.now();
  
  if (expiry - now > 5 * 60 * 1000) {
    return true; // still valid
  }

  // Token expiring soon, try silent refresh
  const clientId = getClientId();
  if (!clientId || clientId.includes('YOUR_GOOGLE')) return false;

  await loadGsiScript();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) return false;

  return new Promise((resolve) => {
    try {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              const accessToken = tokenResponse.access_token;
              const expiresIn = tokenResponse.expires_in || 3600;
              const expiryDate = new Date(Date.now() + expiresIn * 1000 - 60000);
              localStorage.setItem('gdrive_token', accessToken);
              localStorage.setItem('gdrive_token_expiry', expiryDate.toISOString());
              resolve(true);
            } else {
              resolve(false);
            }
          },
          error_callback: () => resolve(false)
        });
      }
      // Silent refresh - no prompt
      tokenClient.requestAccessToken({ prompt: '' });
      // Resolve after 5s if no callback
      setTimeout(() => resolve(false), 5000);
    } catch {
      resolve(false);
    }
  });
}

async function driveFetch(url: string, options: RequestInit = {}) {
  const token = getStoredToken();
  if (!token) throw new Error('Not connected to Google Drive');
  
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    // Token might be expired, try refresh once
    const refreshed = await refreshTokenSilently();
    if (refreshed) {
      const newToken = getStoredToken();
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        const txt = await retryRes.text();
        throw new Error(`Drive API error ${retryRes.status}: ${txt}`);
      }
      return retryRes;
    }
    throw new Error('Token expired, please reconnect Google Drive');
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive API error ${res.status}: ${txt}`);
  }
  return res;
}

async function getOrCreateBackupFolder(): Promise<string> {
  const cachedFolderId = localStorage.getItem('gdrive_folder_id');
  if (cachedFolderId) {
    // Verify folder still exists
    try {
      const check = await driveFetch(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,trashed`);
      const data = await check.json();
      if (data && !data.trashed) return cachedFolderId;
    } catch {
      localStorage.removeItem('gdrive_folder_id');
    }
  }

  // Search for folder
  const q = `mimeType='application/vnd.google-apps.folder' and name='${BACKUP_FOLDER_NAME}' and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const searchRes = await driveFetch(searchUrl);
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    const folderId = searchData.files[0].id;
    localStorage.setItem('gdrive_folder_id', folderId);
    return folderId;
  }

  // Create folder
  const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const createData = await createRes.json();
  localStorage.setItem('gdrive_folder_id', createData.id);
  return createData.id;
}

async function uploadFileToDrive(folderId: string, fileName: string, blob: Blob): Promise<string> {
  // Check if file exists in folder
  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const searchRes = await driveFetch(searchUrl);
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    // Update existing - simple media upload
    const fileId = searchData.files[0].id;
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    await driveFetch(uploadUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob
    });
    return fileId;
  } else {
    // Create new - multipart upload
    const metadata = {
      name: fileName,
      parents: [folderId]
    };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    // Use multipart for metadata + file
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const fileHeader = `Content-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;

    const body = new Blob([
      delimiter + metaPart,
      delimiter + fileHeader,
      blob,
      closeDelimiter
    ], { type: `multipart/related; boundary=${boundary}` });

    // For multipart, we need to handle manually because FormData with fetch uses different boundary
    // Using manual multipart approach with driveFetch but overriding content-type
    const uploadRes = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: body
    });
    const uploadData = await uploadRes.json();
    return uploadData.id;
  }
}

export async function uploadToDrive(files: { name: string, blob: Blob }[]): Promise<{ success: boolean; message: string }> {
  if (!isDriveConnected()) {
    return { success: false, message: 'Not connected to Google Drive' };
  }

  await refreshTokenSilently();

  try {
    const folderId = await getOrCreateBackupFolder();

    const uploadedIds: string[] = [];
    for (const file of files) {
      const fileId = await uploadFileToDrive(folderId, file.name, file.blob);
      uploadedIds.push(fileId);
    }

    const result = {
      filesUploaded: files.map(f => f.name),
      folder: BACKUP_FOLDER_NAME,
      folderId,
      fileIds: uploadedIds,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('gdrive_last_backup', new Date().toISOString());
    localStorage.setItem('gdrive_last_backup_detail', JSON.stringify(result));

    return { success: true, message: `Uploaded ${files.length} files to ${BACKUP_FOLDER_NAME} (Folder ID: ${folderId})` };
  } catch (e: any) {
    console.error('Drive upload failed', e);
    return { success: false, message: e?.message || 'Upload failed' };
  }
}

export function getLastBackupTime(): string | null {
  return localStorage.getItem('gdrive_last_backup');
}

export function shouldAutoBackup(): boolean {
  const last = getLastBackupTime();
  if (!last) return isDriveConnected();
  const lastDate = new Date(last);
  const now = new Date();
  const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  return diffHours >= 23;
}

export async function listBackupFiles(): Promise<any[]> {
  try {
    const folderId = await getOrCreateBackupFolder();
    const q = `'${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)`;
    const res = await driveFetch(url);
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}
