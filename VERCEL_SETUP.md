# Vercel Deployment - Full Setup Guide (Hinglish)

## Method 1: Vercel Dashboard (Sabse Easy - 3 min)

### Step 1: Vercel Login
1. https://vercel.com pe jao
2. **Sign up with GitHub** karo (MOHANGARDAS account se)
3. GitHub authorize karo

### Step 2: Import Project
1. Dashboard → **Add New → Project**
2. **Import Git Repository** → `MOHANGARDAS/emi-tracking` select karo
3. Agar repo nahi dikh raha → **Adjust GitHub App Permissions** → All repos allow karo

### Step 3: Configure Project (IMPORTANT)
Vercel auto detect karega Vite hai, par ye settings confirm karo:

- **Framework Preset:** `Vite` (auto)
- **Root Directory:** `./` (default, change mat karo)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `dist` (default Vite ka)
- **Install Command:** `npm install`
- **Node Version:** `22.x` (Vercel → Settings → Node 22 select karo, tumhara local 22.22.3 hai)

**Environment Variables:** Abhi ke liye koi jarurat nahi (Client ID hardcoded hai)
Optional agar env var use karna hai future me:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```
Phir code me `import.meta.env.VITE_GOOGLE_CLIENT_ID` use karna.

### Step 4: Branch Select
- **Production Branch:** `arena/019fcc07-emi-tracking` select karo (ya `main` agar merge kiya)
- **Deploy** pe click karo

### Step 5: Deploy Log Dekho
- Build logs me ayega:
```
vite v6.4.3 building...
✓ 1086 modules transformed
dist/index.html 1.16 kB
PWA v0.21.2
precache 21 entries
```
- Agar success → Confetti 🎉 + URL milega: `https://emi-tracking-xxxx.vercel.app`

### Step 6: Domain Set Karo
1. Project → **Settings → Domains**
2. Add domain: `emi-tracker-pro.vercel.app` ya custom `emitracker.yourdomain.com`
3. Vercel auto SSL dega (https zaruri hai PWA ke liye)

### Step 7: Auto Deploy ON
- Har baar jab tum `git push origin arena/019fcc07-emi-tracking` karoge, Vercel auto deploy karega
- Preview deployments har branch ke liye alag URL banega

---

## Method 2: Vercel CLI (Terminal se)

```bash
# 1. Vercel CLI install
npm i -g vercel

# 2. Login
vercel login
# Browser khulega → GitHub se login

# 3. Project folder me jao
cd /home/user/emi-tracking

# 4. Deploy (first time)
vercel --prod

# Questions ayenge:
# ? Set up and deploy? Y
# ? Which scope? MOHANGARDAS
# ? Link to existing project? N (agar new)
# ? Project name? emi-tracker-pro
# ? In which directory is your code? ./
# ? Override settings? N (vercel.json se lega)

# 5. Next deployments sirf:
vercel --prod

# Logs:
vercel logs emi-tracker-pro
```

CLI se second time se 20 sec me deploy ho jayega.

---

## vercel.json Samjho (already add kiya hai repo me)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- **rewrites:** React Router SPA ke liye zaruri - har route ko index.html pe bhejo, nahi toh /loans pe refresh pe 404 ayega
- **headers:** icons aur assets ko 1 year cache

---

## Google Drive ke liye Vercel pe Extra Step

Real Google OAuth use kar rahe ho toh:

1. Google Cloud Console → OAuth Client ID → **Authorized JavaScript origins** me add karo:
```
https://emi-tracker-pro.vercel.app
https://emi-tracking-xxxx.vercel.app
https://*.vercel.app
http://localhost:5173
```

2. Agar env var use kar rahe ho:
- Vercel Dashboard → Settings → Environment Variables → `VITE_GOOGLE_CLIENT_ID` add → Save → Redeploy

3. `src/utils/googleDrive.ts` me:
```ts
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'fallback-id.apps.googleusercontent.com';
```

---

## PWA Check on Vercel

Deploy ke baad:
1. URL open karo Chrome me (desktop)
2. Address bar ke right me **Install icon** ayega → Install karo
3. Mobile pe Chrome → Menu → Add to Home Screen
4. Lighthouse test: Chrome DevTools → Lighthouse → PWA 100% aana chahiye
   - Manifest: /manifest.webmanifest auto generate (vite-plugin-pwa)
   - Service Worker: /sw.js
   - Icons: /icons/...

---

## Troubleshooting Vercel pe

**404 on refresh (/loans etc):**
→ vercel.json me rewrites check karo, already fixed hai

**Build fail - ExcelJS large:**
→ Warning hai par fail nahi hoga, agar fail ho toh `NODE_OPTIONS="--max-old-space-size=4096"` env var add karo

**PWA not installing:**
→ https check karo, Vercel auto https deta hai, localhost pe bhi chrome://flags me bypass kar sakte

**Drive connect fail on deployed URL:**
→ Google Cloud me origin whitelist karo (upar dekho)

**Blank page:**
→ Console me error dekho, mostly Router basename issue - hamara basename="/" hai jo Vercel pe OK hai

---

## Final Deploy Checklist

- [ ] `npm run build` local pe success (already tested - 9.92s)
- [ ] `dist/` me `index.html`, `manifest.webmanifest`, `sw.js` hai
- [ ] Branch `arena/019fcc07-emi-tracking` GitHub pe pushed (cb5b6ab)
- [ ] Vercel me import → Build Command `npm run build` → Output `dist`
- [ ] Domain set: `emi-tracker-pro.vercel.app`
- [ ] Google Cloud me Vercel domain whitelist
- [ ] Deploy → Test: Dashboard, Add Loan, Reports Export, Settings Backup
- [ ] PWA Install test mobile/desktop

---

## Ek Command Me Sab

Agar tumhare paas Vercel CLI hai aur abhi deploy karna hai Arena se:

```bash
cd /home/user/emi-tracking
vercel --prod --yes
# 2 min me live URL milega
```

Vercel auto GitHub integration se future pushes auto deploy honge.

Ho gaya! Ab batao CLI se deploy karun ya Dashboard guide enough hai?
