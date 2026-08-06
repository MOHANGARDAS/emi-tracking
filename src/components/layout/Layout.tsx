import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { db, refreshOverdueStatus, getSetting } from '@/db';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠', mobileLabel: 'Home' },
  { path: '/loans', label: 'Loans', icon: '📋', mobileLabel: 'Loans' },
  { path: '/finance', label: 'Finance', icon: '💰', mobileLabel: 'Finance' },
  { path: '/reports', label: 'Reports', icon: '📊', mobileLabel: 'Reports' },
  { path: '/settings', label: 'Settings', icon: '⚙️', mobileLabel: 'Settings' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [reminderCount, setReminderCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueDismissed, setOverdueDismissed] = useState(() => {
    try { return sessionStorage.getItem('overdue_banner_dismissed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    refreshOverdueStatus();
    const interval = setInterval(() => {
      refreshOverdueStatus();
      loadCounts();
    }, 60_000);
    loadCounts();
    checkBrowserNotificationPermission();
    return () => clearInterval(interval);
  }, [location.pathname]);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('overdue_banner_dismissed') === 'true';
      if (dismissed !== overdueDismissed) setOverdueDismissed(dismissed);
    } catch {}
  }, [location.pathname]);

  async function loadCounts() {
    const today = new Date();
    const next7 = new Date(); next7.setDate(today.getDate()+7);
    const overdueEMI = await db.emiEntries.where('status').equals('overdue').count();
    const upcoming = await db.emiEntries.where('status').equals('pending').filter(e=>{
      const d = new Date(e.dueDate);
      return d >= today && d <= next7;
    }).count();
    const oneTimeOverdue = await db.loans.where({ type: 'onetime', status: 'overdue' }).count();
    setOverdueCount(overdueEMI + oneTimeOverdue);
    const allReminders = await db.reminders.where('status').equals('upcoming').toArray();
    const now = new Date();
    const dueReminders = allReminders.filter(r=> new Date(r.reminderDate) <= now).length;
    setReminderCount(dueReminders + upcoming + overdueEMI + oneTimeOverdue);
    tryTriggerBrowserNotifications();
  }

  async function checkBrowserNotificationPermission() {
    const enabled = await getSetting('browserNotifications', false);
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  async function tryTriggerBrowserNotifications() {
    const enabled = await getSetting('browserNotifications', false);
    if (!enabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const allReminders = await db.reminders.where('status').equals('upcoming').toArray();
    const now = new Date();
    const due = allReminders.filter(r=> new Date(r.reminderDate) <= now && new Date(r.reminderDate) >= new Date(now.getTime() - 60*60*1000));
    for (const rem of due) {
      new Notification(rem.title, { body: rem.message, icon: '/icons/icon-192x192.png' });
      await db.reminders.update(rem.id!, { status: 'sent' });
    }
  }

  function dismissOverdueBanner() {
    try { sessionStorage.setItem('overdue_banner_dismissed', 'true'); } catch {}
    setOverdueDismissed(true);
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[260px] bg-[#1e293b]/50 backdrop-blur-xl border-r border-[#334155]/50 flex-col">
        <div className="p-6 border-b border-[#334155]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#22c55e] flex items-center justify-center font-bold text-white">₹</div>
            <div>
              <h1 className="font-bold text-[16px] tracking-tight">EMI Tracker Pro</h1>
              <p className="text-[11px] text-slate-400">Secure • Offline</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} className={({isActive})=>`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all ${isActive ? 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1e293b]'}`}>
              <span className="text-[18px]">{item.icon}</span>{item.label}
            </NavLink>
          ))}
          <NavLink to="/add" className="mt-4 flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-[14px] shadow-lg shadow-[#3b82f6]/20">
            <span className="text-[18px]">+</span> Add Loan
          </NavLink>
          <div className="mt-4 pt-4 border-t border-[#334155]/30">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 px-2">Quick Add</p>
            <div className="grid grid-cols-2 gap-2">
              <NavLink to="/finance" className="bg-[#22c55e]/10 border border-[#22c55e]/20 hover:bg-[#22c55e]/20 text-[#22c55e] px-3 py-2 rounded-xl text-[12px] font-medium text-center">+ Income</NavLink>
              <NavLink to="/finance" className="bg-[#ef4444]/10 border border-[#ef4444]/20 hover:bg-[#ef4444]/20 text-[#ef4444] px-3 py-2 rounded-xl text-[12px] font-medium text-center">+ Expense</NavLink>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-[#334155]/50">
          <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
            <p className="text-[12px] text-slate-400">Total Outstanding</p>
            <p className="text-[13px] font-semibold mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              Local storage
            </p>
          </div>
        </div>
      </aside>

      <main className="md:ml-[260px] min-h-screen pb-[90px] md:pb-0">
        <div className="max-w-[1200px] mx-auto">
          <div className="md:hidden sticky top-0 z-20 bg-[#0f172a]/80 backdrop-blur-xl border-b border-[#334155]/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center font-bold">₹</div>
              <span className="font-bold text-[15px]">EMI Tracker Pro</span>
            </div>
            <div className="flex items-center gap-2">
              {reminderCount>0 && <span className="bg-[#ef4444] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{reminderCount}</span>}
              <div className="w-7 h-7 rounded-full bg-[#1e293b] flex items-center justify-center text-[14px]">🔔</div>
            </div>
          </div>
          <div className="p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#1e293b]/90 backdrop-blur-2xl border-t border-[#334155]/60 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around gap-1">
          <NavLink to="/" className={({isActive})=>`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl ${isActive?'text-[#22c55e]':'text-slate-500'}`}>
            <span className="text-[18px]">🏠</span><span className="text-[10px]">Home</span>
          </NavLink>
          <NavLink to="/loans" className={({isActive})=>`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl ${isActive?'text-[#22c55e]':'text-slate-500'}`}>
            <span className="text-[18px]">📋</span><span className="text-[10px]">Loans</span>
          </NavLink>
          <NavLink to="/add" className="flex flex-col items-center -mt-5">
            <div className="w-12 h-12 rounded-full bg-[#22c55e] text-white flex items-center justify-center text-[24px] shadow-xl shadow-[#22c55e]/30">+</div>
          </NavLink>
          <NavLink to="/finance" className={({isActive})=>`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl ${isActive?'text-[#22c55e]':'text-slate-500'}`}>
            <span className="text-[18px]">💰</span><span className="text-[10px]">Finance</span>
          </NavLink>
          <NavLink to="/reports" className={({isActive})=>`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl ${isActive?'text-[#22c55e]':'text-slate-500'}`}>
            <span className="text-[18px]">📊</span><span className="text-[10px]">Reports</span>
          </NavLink>
        </div>
      </nav>

      {overdueCount>0 && !overdueDismissed && location.pathname !== '/loans' && (
        <div className="fixed bottom-[100px] md:bottom-6 left-4 right-4 md:left-[280px] md:right-6 z-20 bg-[#ef4444] text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl shadow-[#ef4444]/20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] truncate">{overdueCount} overdue payment{overdueCount>1?'s':''}</p>
              <p className="text-[11px] opacity-90 truncate">Requires immediate attention</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <NavLink to="/loans?filter=overdue" className="bg-white text-[#ef4444] px-3 py-1.5 rounded-full text-[12px] font-bold hover:bg-slate-100">View</NavLink>
            <button onClick={dismissOverdueBanner} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-[16px] font-bold">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};
