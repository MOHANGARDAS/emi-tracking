# EMI Tracker Pro - Pura Setup Guide (Hinglish)

## 1. Prerequisites
- Node.js v18+ ya v22 (tumhare paas v22.22.3 hai, perfect)
- npm v9+
- Git
- Chrome/Edge (PWA + IndexedDB + Notification test ke liye)

## 2. Repo Clone & Branch

```bash
# GitHub se clone
git clone https://github.com/MOHANGARDAS/emi-tracking.git
cd emi-tracking

# Is session ka branch (pura code isi me hai)
git fetch origin arena/019fcc07-emi-tracking
git checkout arena/019fcc07-emi-tracking

# Ya main branch se naya banao
# git checkout -b main
```

Agar tum Arena me ho, toh repo already `/home/user/emi-tracking` me hai aur branch checked out hai.

## 3. Dependencies Install

```bash
cd /home/user/emi-tracking
npm install
```

Packages:
- dexie (IndexedDB)
- exceljs + file-saver (Excel export)
- recharts (charts)
- framer-motion (animation)
- react-router-dom
- vite-plugin-pwa (PWA)
- tailwind etc.

## 4. Project Structure Samjho

```
emi-tracking/
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png (PWA)
│   │   └── icon-512x512.png
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── ui/ (Button, Input, Card)
│   │   ├── layout/Layout.tsx (Sidebar + Bottom Nav + Overdue Banner + Notification logic)
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.tsx (stats, chart, upcoming, overdue)
│   │   ├── Loans.tsx (history + filters)
│   │   ├── AddLoan.tsx (EMI/OneTime tabs + auto preview)
│   │   ├── EMISchedule.tsx (mark paid, prepayment, close)
│   │   ├── Reports.tsx (analytics + export)
│   │   └── Settings.tsx (Drive + reminders + danger zone)
│   ├── db/index.ts (Dexie DB, getSetting/setSetting, refreshOverdueStatus)
│   ├── utils/
│   │   ├── helpers.ts (formatCurrency, generateEMIEntries, calculateReminders)
│   │   ├── export.ts (Excel/CSV/JSON + restore)
│   │   └── googleDrive.ts (mock OAuth, token localStorage, auto refresh)
│   ├── types/index.ts (Loan, EMIEntry, Reminder)
│   ├── App.tsx (lazy loading, routes)
│   ├── main.tsx (seed demo data + 2AM auto backup interval)
│   └── index.css (tailwind)
├── index.html
├── vite.config.ts (PWA manifest config)
├── tailwind.config.js (colors #0f172a, #22c55e, #f59e0b, #ef4444, #3b82f6)
└── package.json
```

## 5. Local Dev Server Chalao

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

- Local: http://localhost:5173
- Arena Preview: https://5173-xxxx.e2b.app (LIVE PREVIEW panel me dikhega)
- Agar port busy ho: `pkill -f vite` phir se try karo

Dev server features:
- Hot reload
- PWA dev me service worker nahi chalta, build me chalega
- Console me "Seeding demo data..." ayega first time (3 demo loans)

## 6. Build & Preview (Production jaisa test)

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Build output `dist/` me:
- `registerSW.js`, `manifest.webmanifest`, `sw.js`, `workbox-*.js`
- PWA precache 21 entries

## 7. Google Drive Setup (Real Client ID ke liye)

Spec ke hisaab se same as FixiProfit:

### Step A: Google Cloud Console
1. https://console.cloud.google.com jao
2. New Project banao: `emi-tracker-pro`
3. Left Menu → APIs & Services → Enable APIs → `Google Drive API` enable karo
4. APIs & Services → Credentials → Create Credentials → OAuth Client ID
5. Application type: Web Application
6. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://your-vercel-domain.vercel.app`
   - `https://{port}-{sandbox}.e2b.app` (arena preview)
7. Authorized redirect URIs: same + `http://localhost:5173/`
8. Client ID milega: `xxxxxxx.apps.googleusercontent.com` copy karo

### Step B: Code me hardcode karo
Do jagah update karna hai:

**File 1:** `src/utils/googleDrive.ts`
```ts
export const GOOGLE_CLIENT_ID = 'YOUR_REAL_CLIENT_ID.apps.googleusercontent.com';
```

**File 2:** Settings page me user bhi change kar sakta hai (localStorage me save hota hai)
- Settings → Google Drive Backup → OAuth Client ID input → Save ID

Real OAuth implementation ke liye (abhi mock hai):
```ts
// src/utils/googleDrive.ts connectDrive() me real code:
export async function connectDrive() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (tokenResponse) => {
      localStorage.setItem('gdrive_token', tokenResponse.access_token);
    }
  });
  client.requestAccessToken();
}
```
Aur `index.html` me gapi script add karna hoga:
```html
<script src="https://accounts.google.com/gsi/client"></script>
<script src="https://apis.google.com/js/api.js"></script>
```

Abhi ke liye demo ke liye mock login hai taki bina Client ID ke test ho sake. `connectDrive()` 800ms delay ke baad fake user deta hai.

### Step C: Folder & Files
- First backup pe folder `EMI_Tracker_Backup/` Drive me banta hai
- Files: `EMI_Tracker_Latest.xlsx`, `.json`, `.csv`
- Token expiry 1 hour, auto refresh silent check har ghante
- Daily 2 AM auto backup: `src/main.tsx` me `setInterval` har ghante check karta hai, agar 23h ho gaye last backup se toh backup karta hai

## 8. Reminder System Setup

- Settings → Reminder Settings → Default days select (1,3,7,15,30)
- Ye `db.settings` me save hota hai key `defaultReminderDays`
- Loan add karte time ye days use hoke `reminders` table me entries banate hai
- Layout.tsx har 60 sec me `refreshOverdueStatus()` + reminder check + browser notification trigger karta hai
- Browser Notification enable: Settings → Browser Push toggle ON → Permission allow karo
- In-app: Dashboard → Upcoming Due section + badge

## 9. PWA Install & Offline

- Build ke baad Chrome me install prompt ayega (address bar me install icon)
- Mobile pe Add to Home Screen
- IndexedDB me sab data local, no server
- Service Worker `dist/sw.js` cache karta hai
- Offline me bhi kaam karega, online aane pe Drive backup manual karna

## 10. Vercel Deployment

```bash
# Vercel CLI
npm i -g vercel
vercel --prod

# Ya GitHub connect:
# 1. vercel.com → New Project → Import MOHANGARDAS/emi-tracking
# 2. Branch: arena/019fcc07-emi-tracking ya main
# 3. Framework: Vite
# 4. Build command: npm run build
# 5. Output dir: dist
# 6. Env vars: kuch nahi needed (Client ID hardcoded)
# 7. Domain: emi-tracker-pro.vercel.app custom set kar sakte
```

Vercel config auto vite se ho jayega.

## 11. Testing Workflows

### Workflow 1: EMI Loan Add
1. Add Loan → EMI Loan tab
2. Lender: HDFC Bank, Amount 120000, EMI 10000, Months 12, Start 1 Jan 2026, EMI Date 5
3. Preview me 6 entries dikhenge
4. Save → 12 entries auto Pending, reminders 3 & 1 day before
5. Dashboard update

### Workflow 2: Mark Paid
1. Loans → HDFC click → Schedule page
2. Current month EMI → Mark as Paid → Mode UPI → Confirm
3. Status Paid, progress bar update, Dashboard Recent Tx me ayega

### Workflow 3: One-Time
1. Add → One-Time tab → Lender Rahul, 2000, Borrow today, Due 15 Aug 2026
2. Save → Upcoming Due me dikhega
3. 7 days before reminder badge

### Workflow 4: Reports Export
1. Reports → Filter This Month → Lender HDFC → Export Excel → EMI_Tracker_Latest.xlsx download

## 12. Data Management

- **Export:** Reports page ya Settings me 3 buttons
- **Import:** Settings → Restore → JSON file select (EMI_Tracker_Latest.json)
- **Clear:** Settings → Danger Zone → 3-step confirm → DELETE type karna hota hai last me → sab clear

Dexie tables directly console me dekh sakte:
```js
// Chrome DevTools console
let db = await import('/src/db/index.ts').then(m=>m.db)
await db.loans.toArray()
```

## 13. Common Issues

- **Port busy:** `pkill -f vite` + `rm -rf node_modules/.vite`
- **ExcelJS large chunk warning:** Normal hai (946kB), code split se kam kar sakte but abhi OK
- **Overdue not updating:** `refreshOverdueStatus()` har 60 sec chalta hai, ya page reload karo
- **Notification nahi aa raha:** Permission check karo, Settings → Browser toggle ON, https needed
- **Drive connect fail:** Real Client ID nahi hai toh mock use hota hai, real ke liye gsi script add karna padega

## 14. Future Real Integration TODO

- [ ] Real Google OAuth with gsi client (abhi mock)
- [ ] Drive file create/update API (gapi.client.drive.files)
- [ ] Push notification service worker (web-push)
- [ ] SMS via Twilio (optional)
- [ ] Document upload (loan agreement pics) → IndexedDB blob

## 15. Final Commands Cheat Sheet

```bash
# Dev
npm run dev -- --host 0.0.0.0 --port 5173

# Build
npm run build

# Preview build
npm run preview -- --host 0.0.0.0 --port 4173

# Check DB in browser console
localStorage.getItem('gdrive_token')
localStorage.getItem('gdrive_last_backup')

# Clear demo & start fresh
# Settings → Danger Zone → Clear
# Ya console: localStorage.clear(); indexedDB.deleteDatabase('EMITrackerProDB')
```

Bas itna hi! Abhi dev server https://5173-...e2b.app pe live hai. Koi doubt ho toh bolo.
