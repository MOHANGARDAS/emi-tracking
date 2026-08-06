# EMI Tracker Pro 💰

Offline-first EMI & Loan tracking PWA built with React 19, TypeScript, Vite, Tailwind, Dexie (IndexedDB), Framer Motion, Recharts, ExcelJS, vite-plugin-pwa.

## Features

### Dashboard
- Total Active Loans count
- Total Outstanding Amount
- This Month's EMI due
- Upcoming Due (next 7 days)
- Overdue Loans count
- Monthly EMI chart (bar graph)
- Recent transactions list
- Lender-wise breakdown

### Two Loan Types
**Type A: EMI Loan** - auto-generates monthly entries (e.g., 12 month loan → 12 entries)
- Fields: Lender, Purpose, Total Amount, EMI Amount, Tenure, Start Date, EMI Date (1-31), Interest Rate
- Auto entries with Pending/Paid/Overdue

**Type B: One-Time Loan**
- Fields: Lender, Amount, Borrow Date, Due Date, Purpose, Notes
- Single reminder on due date

### Reminders
- Custom days: 1,3,7,15,30 days before or custom
- Multiple reminders (e.g., 7 days + 1 day)
- In-app badge, Browser notification (PWA push), Drive log (optional)
- Status: Upcoming/Sent/Acknowledged

### Loan Management
- Add, Edit, Mark Paid (date & mode), Closed, Delete with confirmation, Prepayment partial

### Reports
- Monthly breakdown, Yearly summary, Lender-wise outstanding, Payment timeline
- Filters: date range, loan type, status, lender
- Export: Excel (.xlsx), CSV, JSON backup

### History Page
- Search lender, Filter date/type/status, Sort due/amount/lender, Quick actions

## Tech Stack (Same as FixiProfit)
- React 19 + TypeScript + Vite
- Tailwind CSS (dark #0f172a, primary #22c55e, warning #f59e0b, danger #ef4444, accent #3b82f6)
- Dexie IndexedDB offline
- React Router
- Framer Motion
- Recharts
- ExcelJS
- vite-plugin-pwa

## Database Schema (Dexie)
```ts
Loan { id, type: 'emi'|'onetime', lenderName, purpose, totalAmount, emiAmount, emiDate, totalMonths, startDate, dueDate, interestRate, status, createdAt, updatedAt }
EMIEntry { id, loanId, monthNumber, dueDate, amount, status: 'pending'|'paid'|'overdue', paidDate, paymentMode, notes }
Reminder { id, loanId, emiEntryId, daysBefore, reminderDate, status: 'upcoming'|'sent'|'acknowledged', title, message }
```

## Google Drive Backup
- Hardcoded Client ID: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` (stored in localStorage, editable in Settings)
- Mock OAuth for demo (real app would open Google popup)
- Token stored in localStorage + auto refresh silent
- Files: EMI_Tracker_Latest.xlsx / .json / .csv in folder EMI_Tracker_Backup/
- Auto backup daily 2 AM check, Manual Backup Now button

## UI/UX
- Bottom Nav Mobile: Dashboard, Loans, Add (+ floating), Reports, Settings
- Sidebar Desktop: 260px left, max 1200px centered
- PWA: installable, offline, push notifications, custom icon, manifest

## Run Locally
```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
npm run build
```

## Workflows Implemented
1. Add EMI Loan → auto 12 entries + reminders
2. Mark EMI Paid → select mode & date → dashboard updates
3. Add One-Time → reminder created → upcoming due
4. Reminder System → badge + browser notification

Seed demo data on first load: HDFC 1.2L, Bajaj 60k, Rahul 2000 one-time.

## Pages
- `/` Dashboard
- `/loans` History
- `/loans/:id` EMI Schedule
- `/add` Add/Edit (tabs EMI / One-time) ?edit=id
- `/reports` Analytics
- `/settings` Drive, Backup, Reminders, Export, Danger Zone

## Future Enhancements (from spec)
SMS/Email reminders, Multi-currency, EMI calculator, Document upload, Shared loans, Credit score, Bank integration.
