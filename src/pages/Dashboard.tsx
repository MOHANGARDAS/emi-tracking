import { useEffect, useState } from 'react';
import { db, refreshOverdueStatus, isToday, isThisMonth } from '@/db';
import { Loan, EMIEntry, Income, Expense } from '@/types';
import { formatCurrency, formatDate, formatDateShort, daysUntil, getDaysLabel, isSameMonth } from '@/utils/helpers';
import { StatCard, Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

function isNextMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.getMonth() === next.getMonth() && d.getFullYear() === next.getFullYear();
}

interface UpcomingItem {
  key: string;
  kind: 'emi' | 'onetime';
  loanId: number;
  lender: string;
  label: string;
  dueDate: string;
  amount: number;
}

function groupByMonth(items: UpcomingItem[]): { label: string; items: UpcomingItem[] }[] {
  const groups: { label: string; items: UpcomingItem[] }[] = [];
  for (const item of items) {
    const label = new Date(item.dueDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const due = new Date(item.dueDate);
  const days = daysUntil(item.dueDate);
  return (
    <Link to={`/loans/${item.loanId}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#0f172a] border border-[#334155]/50 hover:border-[#475569] transition-colors">
      <div className={`w-11 shrink-0 text-center rounded-lg border py-1.5 ${days <= 3 ? 'bg-[#f59e0b]/10 border-[#f59e0b]/20' : 'bg-[#3b82f6]/10 border-[#3b82f6]/20'}`}>
        <p className="text-[15px] font-bold leading-none">{due.getDate()}</p>
        <p className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-wide">{due.toLocaleDateString('en-IN',{month:'short'})}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{item.kind==='onetime' ? '👤' : '💳'} {item.lender} • {item.label}</p>
        <p className={`text-[11px] mt-0.5 ${days < 0 ? 'text-[#ef4444]' : days <= 3 ? 'text-[#f59e0b]' : 'text-slate-500'}`}>
          {formatDateShort(item.dueDate)} • {getDaysLabel(days)}
        </p>
      </div>
      <p className="text-[13px] font-bold shrink-0">{formatCurrency(item.amount)}</p>
    </Link>
  );
}

export default function Dashboard(){
  const [stats, setStats] = useState({
    activeLoans: 0,
    outstanding: 0,
    thisMonthDue: 0,
    nextMonthDue: 0,
    upcoming7: 0,
    overdueCount: 0,
    overdueAmount: 0,
    todayIncome: 0,
    todayExpense: 0,
    thisMonthIncome: 0,
    thisMonthExpense: 0,
    totalIncome: 0,
    totalExpense: 0,
    netSavings: 0
  });
  const [upcomingAll, setUpcomingAll] = useState<UpcomingItem[]>([]);
  const [showFullUpcoming, setShowFullUpcoming] = useState(false);
  const [overdueEMIs, setOverdueEMIs] = useState<(EMIEntry & { lender?: string })[]>([]);
  const [monthlyChart, setMonthlyChart] = useState<any[]>([]);
  const [incomeExpenseChart, setIncomeExpenseChart] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<(EMIEntry & { lender?: string })[]>([]);
  const [lenderOutstanding, setLenderOutstanding] = useState<any[]>([]);
  const [recentIncomes, setRecentIncomes] = useState<Income[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);

  useEffect(()=>{ loadData(); },[]);

  async function loadData(){
    await refreshOverdueStatus();
    const loans = await db.loans.toArray();
    const emiEntries = await db.emiEntries.toArray();
    const incomes = await db.incomes.toArray();
    const expenses = await db.expenses.toArray();

    const activeLoans = loans.filter(l=>l.status==='active' || l.status==='overdue');
    const emiMap = new Map(loans.map(l=>[l.id, l.lenderName]));

    let outstanding = 0;
    for (const loan of activeLoans){
      if(loan.type==='onetime') outstanding += loan.totalAmount;
      else {
        const pending = emiEntries.filter(e=>e.loanId===loan.id && (e.status==='pending'||e.status==='overdue'));
        outstanding += pending.reduce((s,e)=>s+e.amount,0);
      }
    }

    const thisMonthEMI = emiEntries.filter(e=> isSameMonth(e.dueDate) && (e.status==='pending'||e.status==='overdue'));
    const thisMonthOneTime = loans.filter(l=>l.type==='onetime' && (l.status==='active'||l.status==='overdue') && isSameMonth(l.dueDate||''));
    const thisMonthDue = thisMonthEMI.reduce((s,e)=>s+e.amount,0) + thisMonthOneTime.reduce((s,l)=>s+l.totalAmount,0);

    const nextMonthEMI = emiEntries.filter(e=> isNextMonth(e.dueDate) && (e.status==='pending'||e.status==='overdue'));
    const nextMonthOneTime = loans.filter(l=>l.type==='onetime' && (l.status==='active'||l.status==='overdue') && isNextMonth(l.dueDate||''));
    const nextMonthDue = nextMonthEMI.reduce((s,e)=>s+e.amount,0) + nextMonthOneTime.reduce((s,l)=>s+l.totalAmount,0);

    const today = new Date();
    const next7 = new Date(); next7.setDate(today.getDate()+7);
    const upcomingEMI = emiEntries.filter(e=>{ const d = new Date(e.dueDate); return d>=today && d<=next7 && e.status==='pending'; }).length;
    const upcomingOne = loans.filter(l=>{ if(l.type!=='onetime' || !l.dueDate) return false; if(l.status!=='active') return false; const d = new Date(l.dueDate); return d>=today && d<=next7; }).length;

    const overdueEMI = emiEntries.filter(e=>e.status==='overdue');
    const overdueOneTime = loans.filter(l=>l.type==='onetime' && l.status==='overdue');
    const overdueCount = overdueEMI.length + overdueOneTime.length;
    const overdueAmount = overdueEMI.reduce((s,e)=>s+e.amount,0) + overdueOneTime.reduce((s,l)=>s+l.totalAmount,0);

    // Income/Expense today and this month
    const todayIncome = incomes.filter(i=> isToday(i.date)).reduce((s,i)=>s+i.amount,0);
    const todayExpense = expenses.filter(e=> isToday(e.date)).reduce((s,e)=>s+e.amount,0);
    const thisMonthIncome = incomes.filter(i=> isThisMonth(i.date)).reduce((s,i)=>s+i.amount,0);
    const thisMonthExpense = expenses.filter(e=> isThisMonth(e.date)).reduce((s,e)=>s+e.amount,0);
    const totalIncome = incomes.reduce((s,i)=>s+i.amount,0);
    const totalExpense = expenses.reduce((s,e)=>s+e.amount,0);

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    // All upcoming: every pending EMI from today onwards + active one-time dues — date-wise sorted, no day limit
    const emiUpcoming: UpcomingItem[] = emiEntries
      .filter(e => e.status==='pending' && new Date(e.dueDate) >= todayStart)
      .map(e => ({ key:`emi-${e.id}`, kind:'emi' as const, loanId:e.loanId, lender: emiMap.get(e.loanId) || 'Loan', label:`EMI #${e.monthNumber}`, dueDate:e.dueDate, amount:e.amount }));
    const oneTimeUp: UpcomingItem[] = loans
      .filter(l => l.type==='onetime' && (l.status==='active'||l.status==='overdue') && l.dueDate && new Date(l.dueDate) >= todayStart)
      .map(l => ({ key:`ot-${l.id}`, kind:'onetime' as const, loanId:l.id!, lender:l.lenderName, label:'One-time', dueDate:l.dueDate!, amount:l.totalAmount }));
    const upcomingList = [...emiUpcoming, ...oneTimeUp].sort((a,b)=> new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const overdueList = overdueEMI.sort((a,b)=> new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0,5).map(e=>({...e, lender: emiMap.get(e.loanId)}));

    const chartData: any[] = [];
    const incExpChart: any[] = [];
    for(let i=-2;i<=5;i++){
      const d = new Date(); d.setMonth(d.getMonth()+i);
      const month = d.getMonth(); const year = d.getFullYear();
      const monthEntries = emiEntries.filter(e=>{ const ed = new Date(e.dueDate); return ed.getMonth()===month && ed.getFullYear()===year; });
      const paid = monthEntries.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amount,0);
      const pending = monthEntries.filter(e=>e.status!=='paid').reduce((s,e)=>s+e.amount,0);
      const oneTimeMonth = loans.filter(l=>l.type==='onetime' && l.dueDate && new Date(l.dueDate).getMonth()===month && new Date(l.dueDate).getFullYear()===year).reduce((s,l)=>s+l.totalAmount,0);
      chartData.push({ name: d.toLocaleDateString('en-IN',{month:'short'}), due: pending+oneTimeMonth, paid, total: pending+paid+oneTimeMonth });

      const monthIncome = incomes.filter(inc=>{ const md = new Date(inc.date); return md.getMonth()===month && md.getFullYear()===year; }).reduce((s,i)=>s+i.amount,0);
      const monthExpense = expenses.filter(exp=>{ const md = new Date(exp.date); return md.getMonth()===month && md.getFullYear()===year; }).reduce((s,e)=>s+e.amount,0);
      incExpChart.push({ name: d.toLocaleDateString('en-IN',{month:'short'}), income: monthIncome, expense: monthExpense, net: monthIncome - monthExpense });
    }

    const recent = emiEntries.filter(e=>e.status==='paid' && e.paidDate).sort((a,b)=> new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime()).slice(0,4).map(e=>({...e, lender: emiMap.get(e.loanId)}));
    const recentInc = [...incomes].sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3);
    const recentExp = [...expenses].sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3);

    const lenderMap = new Map<string, number>();
    for(const loan of activeLoans){
      if(loan.type==='onetime') lenderMap.set(loan.lenderName, (lenderMap.get(loan.lenderName)||0)+loan.totalAmount);
      else {
        const pend = emiEntries.filter(e=>e.loanId===loan.id && (e.status==='pending'||e.status==='overdue')).reduce((s,e)=>s+e.amount,0);
        lenderMap.set(loan.lenderName, (lenderMap.get(loan.lenderName)||0)+pend);
      }
    }
    const lenderData = Array.from(lenderMap.entries()).map(([name,value])=>({name, value})).sort((a,b)=>b.value-a.value).slice(0,5);

    setStats({
      activeLoans: activeLoans.length,
      outstanding,
      thisMonthDue,
      nextMonthDue,
      upcoming7: upcomingEMI+upcomingOne,
      overdueCount,
      overdueAmount,
      todayIncome,
      todayExpense,
      thisMonthIncome,
      thisMonthExpense,
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense
    });
    setUpcomingAll(upcomingList);
    setOverdueEMIs(overdueList);
    setMonthlyChart(chartData);
    setIncomeExpenseChart(incExpChart);
    setRecentTx(recent);
    setRecentIncomes(recentInc);
    setRecentExpenses(recentExp);
    setLenderOutstanding(lenderData);
  }

  const nextMonthName = new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).toLocaleDateString('en-IN',{month:'long'});
  const upcomingGroups = groupByMonth(upcomingAll);
  const upcomingTotal = upcomingAll.reduce((s,i)=>s+i.amount,0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-slate-400">Overview of loans, income and expenses</p>
      </div>

      {/* Loan Stats */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Loan Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.05}}>
            <StatCard title="Active Loans" value={stats.activeLoans} sub="Running" color="accent" icon={<span>📋</span>} />
          </motion.div>
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
            <StatCard title="Outstanding" value={formatCurrency(stats.outstanding)} sub="Total pending" color="primary" icon={<span>💰</span>} />
          </motion.div>
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.15}}>
            <StatCard title="This Month Due" value={formatCurrency(stats.thisMonthDue)} sub={new Date().toLocaleDateString('en-IN',{month:'short'})} color="warning" icon={<span>📅</span>} />
          </motion.div>
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.18}}>
            <StatCard title="Next Month Due" value={formatCurrency(stats.nextMonthDue)} sub={nextMonthName} color="accent" icon={<span>⏭️</span>} />
          </motion.div>
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="col-span-2 md:col-span-1">
            <StatCard title="Overdue" value={stats.overdueCount} sub={formatCurrency(stats.overdueAmount)} color={stats.overdueCount>0?'danger':'slate'} icon={<span>⚠️</span>} />
          </motion.div>
        </div>
      </div>

      {/* Income/Expense Stats - NEW */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Income & Expense Overview</p>
          <Link to="/finance" className="text-[11px] text-[#22c55e] hover:underline">Manage →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-4 border-[#22c55e]/20 bg-[#22c55e]/5">
            <p className="text-[11px] text-slate-400 uppercase">Today Income</p>
            <p className="text-[18px] font-bold text-[#22c55e] mt-1">{formatCurrency(stats.todayIncome)}</p>
            <p className="text-[10px] text-slate-500 mt-1">Aaj ka income</p>
          </Card>
          <Card className="p-4 border-[#ef4444]/20 bg-[#ef4444]/5">
            <p className="text-[11px] text-slate-400 uppercase">Today Expense</p>
            <p className="text-[18px] font-bold text-[#ef4444] mt-1">{formatCurrency(stats.todayExpense)}</p>
            <p className="text-[10px] text-slate-500 mt-1">Aaj ka kharcha</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] text-slate-400 uppercase">Net Today</p>
            <p className={`text-[18px] font-bold mt-1 ${stats.todayIncome - stats.todayExpense >=0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(stats.todayIncome - stats.todayExpense)}</p>
          </Card>
          <Card className="p-4 border-[#3b82f6]/20">
            <p className="text-[11px] text-slate-400 uppercase">Month Income</p>
            <p className="text-[16px] font-bold text-[#22c55e] mt-1">{formatCurrency(stats.thisMonthIncome)}</p>
          </Card>
          <Card className="p-4 border-[#f59e0b]/20">
            <p className="text-[11px] text-slate-400 uppercase">Month Expense</p>
            <p className="text-[16px] font-bold text-[#f59e0b] mt-1">{formatCurrency(stats.thisMonthExpense)}</p>
          </Card>
          <Card className="p-4 bg-[#1e293b] border-[#22c55e]/20">
            <p className="text-[11px] text-slate-400 uppercase">Net Savings</p>
            <p className={`text-[16px] font-bold mt-1 ${stats.netSavings>=0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(stats.netSavings)}</p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[15px]">EMI Overview</h3>
            <span className="text-[11px] text-slate-500 bg-[#0f172a] border border-[#334155] px-2 py-1 rounded-full">Last 2 + Next 6 months</span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v)=>`₹${v/1000}k`} />
                <Tooltip cursor={{fill:'rgba(51,65,85,0.2)'}} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius:'12px', fontSize:'12px' }} formatter={(value: any)=>[formatCurrency(value as number), '']} />
                <Bar dataKey="paid" stackId="a" fill="#22c55e" radius={[0,0,0,0]} barSize={24} />
                <Bar dataKey="due" stackId="a" fill="#3b82f6" radius={[6,6,0,0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[15px]">Income vs Expense</h3>
            <Link to="/finance" className="text-[11px] text-[#22c55e] hover:underline">Details →</Link>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeExpenseChart}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v)=>`₹${v/1000}k`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius:'12px', fontSize:'12px' }} formatter={(value: any)=>[formatCurrency(value as number), '']} />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="#22c55e20" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="#ef444420" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]" /> <span className="text-[11px] text-slate-400">Income</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]" /> <span className="text-[11px] text-slate-400">Expense</span></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5">
          <h3 className="font-semibold text-[15px] mb-4">Lender-wise Outstanding</h3>
          {lenderOutstanding.length===0 ? <p className="text-[13px] text-slate-500 py-8 text-center">No active loans</p> :
          <div className="space-y-3">
            {lenderOutstanding.map((l,i)=>(
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0f172a] border border-[#334155] flex items-center justify-center text-[12px] font-bold">{l.name[0]}</div>
                  <span className="text-[13px] font-medium truncate max-w-[120px]">{l.name}</span>
                </div>
                <span className="text-[13px] font-semibold">{formatCurrency(l.value)}</span>
              </div>
            ))}
          </div>}
        </Card>

        <Card className="p-4 md:p-5">
          <h3 className="font-semibold text-[15px] mb-4">Recent Income</h3>
          <div className="space-y-2">
            {recentIncomes.map(inc=>(
              <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0f172a] border border-[#334155]/30">
                <div>
                  <p className="text-[12px] font-medium">{inc.source}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(inc.date)} • {inc.category}</p>
                </div>
                <p className="text-[12px] font-bold text-[#22c55e]">+{formatCurrency(inc.amount)}</p>
              </div>
            ))}
            {recentIncomes.length===0 && <p className="text-[12px] text-slate-500 text-center py-4">No income yet</p>}
          </div>
          <Link to="/finance" className="mt-3 block text-center text-[11px] text-[#22c55e] hover:underline">Add income →</Link>
        </Card>

        <Card className="p-4 md:p-5">
          <h3 className="font-semibold text-[15px] mb-4">Recent Expenses</h3>
          <div className="space-y-2">
            {recentExpenses.map(exp=>(
              <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0f172a] border border-[#334155]/30">
                <div>
                  <p className="text-[12px] font-medium">{exp.category} {exp.vendor ? `• ${exp.vendor}` : ''}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(exp.date)}</p>
                </div>
                <p className="text-[12px] font-bold text-[#ef4444]">-{formatCurrency(exp.amount)}</p>
              </div>
            ))}
            {recentExpenses.length===0 && <p className="text-[12px] text-slate-500 text-center py-4">No expenses yet</p>}
          </div>
          <Link to="/finance" className="mt-3 block text-center text-[11px] text-[#ef4444] hover:underline">Add expense →</Link>
        </Card>
      </div>

      {overdueEMIs.length>0 && (
        <Card className="p-4 border-[#ef4444]/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-[#ef4444]/20 text-[#ef4444] flex items-center justify-center text-[12px]">!</span>
            <h3 className="font-semibold text-[14px] text-[#ef4444]">Overdue Payments</h3>
          </div>
          <div className="space-y-2">
            {overdueEMIs.map(e=>(
              <Link key={e.id} to={`/loans/${e.loanId}`} className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] border border-[#334155]/50 hover:border-[#ef4444]/30 transition-colors">
                <div>
                  <p className="text-[13px] font-medium">{e.lender} • Month {e.monthNumber}</p>
                  <p className="text-[11px] text-slate-500">Due: {formatDate(e.dueDate)} • {Math.abs(daysUntil(e.dueDate))} days overdue</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-[#ef4444]">{formatCurrency(e.amount)}</p>
                  <span className="text-[10px] bg-[#ef4444]/20 text-[#ef4444] px-2 py-0.5 rounded-full">OVERDUE</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[15px]">Upcoming Dues</h3>
            <span className="text-[11px] bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 px-2 py-1 rounded-full font-medium">{upcomingAll.length}</span>
          </div>
          <div className="space-y-2.5">
            {upcomingAll.slice(0,5).map(item=>(
              <UpcomingRow key={item.key} item={item} />
            ))}
            {upcomingAll.length===0 && <p className="text-[13px] text-slate-500 text-center py-8">No upcoming dues</p>}
          </div>
          {upcomingAll.length>5 && (
            <button onClick={()=>setShowFullUpcoming(true)} className="mt-3 w-full text-center text-[12px] font-medium text-[#22c55e] bg-[#22c55e]/5 hover:bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl py-2.5 transition-colors">
              View Full — all {upcomingAll.length} dues
            </button>
          )}
        </Card>

        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[15px]">Recent EMI Payments</h3>
            <Link to="/loans" className="text-[11px] text-[#22c55e] hover:underline">View all →</Link>
          </div>
          <div className="space-y-2.5">
            {recentTx.map(e=>(
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] border border-[#334155]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">✓</div>
                  <div>
                    <p className="text-[13px] font-medium">{e.lender} • Month {e.monthNumber}</p>
                    <p className="text-[11px] text-slate-500">Paid on {e.paidDate ? formatDate(e.paidDate) : ''}</p>
                  </div>
                </div>
                <p className="text-[13px] font-semibold text-[#22c55e]">{formatCurrency(e.amount)}</p>
              </div>
            ))}
            {recentTx.length===0 && <p className="text-[13px] text-slate-500 text-center py-8">No payments yet</p>}
          </div>
        </Card>
      </div>

      {/* Full upcoming list modal — all dues, date-wise, no limit */}
      {showFullUpcoming && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6" onClick={()=>setShowFullUpcoming(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-lg max-h-[85vh] bg-[#1e293b] border border-[#334155] rounded-t-[20px] sm:rounded-[20px] flex flex-col overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#334155]/60">
              <div>
                <h3 className="font-semibold text-[15px]">All Upcoming Dues</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{upcomingAll.length} payments • {formatCurrency(upcomingTotal)} total • date-wise</p>
              </div>
              <button onClick={()=>setShowFullUpcoming(false)} className="w-8 h-8 rounded-full bg-[#0f172a] border border-[#334155] text-slate-400 hover:text-slate-200 hover:border-[#475569] transition-colors flex items-center justify-center shrink-0">✕</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-5">
              {upcomingGroups.map(g=>(
                <div key={g.label}>
                  <div className="sticky top-0 bg-[#1e293b] flex items-center justify-between py-1.5 z-10">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f59e0b]">{g.label}</p>
                    <span className="text-[10px] text-slate-500">{g.items.length} • {formatCurrency(g.items.reduce((s,i)=>s+i.amount,0))}</span>
                  </div>
                  <div className="space-y-2 mt-1">
                    {g.items.map(item=> <UpcomingRow key={item.key} item={item} />)}
                  </div>
                </div>
              ))}
              {upcomingAll.length===0 && <p className="text-[13px] text-slate-500 text-center py-8">No upcoming dues</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
