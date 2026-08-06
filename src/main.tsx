import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

(async () => {
  try {
    if (localStorage.getItem('demo_data_removed_v2') === 'true') return;
    const { db } = await import('./db');
    const loans = await db.loans.toArray();
    const demoSignatures = [
      { lender: 'HDFC Bank', amount: 120000, purpose: 'Home Loan' },
      { lender: 'Bajaj Finance', amount: 60000, purpose: 'Phone EMI' },
      { lender: 'Rahul Sharma', amount: 2000, purpose: 'Emergency' }
    ];
    const isDemoLoan = (l: any) => demoSignatures.some(d => l.lenderName === d.lender && l.totalAmount === d.amount);
    const demoLoans = loans.filter(isDemoLoan);
    if (demoLoans.length > 0 && loans.length <= 3 && demoLoans.length === loans.length) {
      await db.transaction('rw', db.loans, db.emiEntries, db.reminders, async () => {
        await db.emiEntries.clear();
        await db.reminders.clear();
        await db.loans.clear();
      });
      sessionStorage.removeItem('overdue_banner_dismissed');
    }
    localStorage.setItem('demo_data_removed_v2', 'true');
  } catch {}
})();

setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 2 && now.getMinutes() < 10) {
    try {
      const { shouldAutoBackup, uploadToDrive } = await import('./utils/googleDrive');
      const { getFullBackup } = await import('./utils/export');
      if (shouldAutoBackup()) {
        const backup = await getFullBackup();
        const jsonBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const csvContent = `Loans,${backup.loans.length}\nEMI,${backup.emiEntries.length}\nDate,${new Date().toISOString()}`;
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        await uploadToDrive([
          { name: 'EMI_Tracker_Latest.json', blob: jsonBlob },
          { name: 'EMI_Tracker_Latest.csv', blob: csvBlob }
        ]);
      }
    } catch {}
  }
}, 60 * 60 * 1000);
