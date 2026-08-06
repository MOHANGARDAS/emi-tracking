import { useEffect, useState } from 'react';
import { db } from '@/db';
import { Loan, EMIEntry, Income, Expense } from '@/types';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { exportExcel, exportCSV, exportJSON } from '@/utils/export';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';

export default function Reports(){
  const [loans, setLoans] = useState<Loan[]>([]);
  const [entries, setEntries] = useState<EMIEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState('month');
  const [lenderFilter, setLenderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customRange, setCustomRange] = useState({ from:'', to:'' });

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [lenderData, setLenderData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [incomeExpenseMonthly, setIncomeExpenseMonthly] = useState<any[]>([]);
  const [expenseCatData, setExpenseCatData] = useState<any[]>([]);
  const [incomeCatData, setIncomeCatData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  useEffect(()=>{ load(); },[]);

  async function load(){
    const l = await db.loans.toArray();
    const e = await db.emiEntries.toArray();
    const inc = await db.incomes.toArray();
    const exp = await db.expenses.toArray();
    setLoans(l); setEntries(e); setIncomes(inc); setExpenses(exp);
    compute(l,e,inc,exp,'month','all','all',{from:'',to:''});
  }

  useEffect(()=>{
    compute(loans, entries, incomes, expenses, period, lenderFilter, typeFilter, customRange);
  },[period, lenderFilter, typeFilter, customRange]);

  function compute(allLoans: Loan[], allEntries: EMIEntry[], allIncomes: Income[], allExpenses: Expense[], period: string, lender: string, type: string, range: {from:string,to:string}){
    if(allLoans.length===0 && allIncomes.length===0 && allExpenses.length===0){
      setMonthlyData([]); setLenderData([]); setStatusData([]); setIncomeExpenseMonthly([]); setExpenseCatData([]); setIncomeCatData([]);
      setSummary({ totalLoans:0, totalEMI:0, totalPaid:0, totalDue:0, avgEMI:0, totalIncome:0, totalExpense:0, net:0 });
      return;
    }
    let filteredLoans = allLoans;
    if(lender!=='all') filteredLoans = filteredLoans.filter(l=>l.lenderName===lender);
    if(type!=='all') filteredLoans = filteredLoans.filter(l=>l.type===type);
    let loanIds = new Set(filteredLoans.map(l=>l.id));
    let filteredEntries = allEntries.filter(e=> loanIds.has(e.loanId));

    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    const now = new Date();
    if(period==='today'){ fromDate=new Date(); fromDate.setHours(0,0,0,0); toDate=new Date(); toDate.setHours(23,59,59,999); }
    else if(period==='week'){ fromDate=new Date(now.getTime()-7*24*60*60*1000); toDate=now; }
    else if(period==='month'){ fromDate=new Date(now.getFullYear(), now.getMonth(), 1); toDate=new Date(now.getFullYear(), now.getMonth()+1,0); }
    else if(period==='year'){ fromDate=new Date(now.getFullYear(),0,1); toDate=new Date(now.getFullYear(),11,31); }
    else if(period==='custom' && range.from && range.to){ fromDate=new Date(range.from); toDate=new Date(range.to); }

    let filteredIncomes = allIncomes;
    let filteredExpenses = allExpenses;
    if(fromDate && toDate){
      filteredEntries = filteredEntries.filter(e=>{ const d=new Date(e.dueDate); return d>=fromDate! && d<=toDate!; });
      filteredIncomes = filteredIncomes.filter(i=>{ const d=new Date(i.date); return d>=fromDate! && d<=toDate!; });
      filteredExpenses = filteredExpenses.filter(ex=>{ const d=new Date(ex.date); return d>=fromDate! && d<=toDate!; });
    }

    const monthly: any[] = [];
    const incExpMonthly: any[] = [];
    for(let i=11;i>=0;i--){
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const m = d.getMonth(); const y = d.getFullYear();
      const mes = allEntries.filter(e=>{ const ed=new Date(e.dueDate); return ed.getMonth()===m && ed.getFullYear()===y && loanIds.has(e.loanId); });
      monthly.push({
        month: d.toLocaleDateString('en-IN',{month:'short', year:'2-digit'}),
        due: mes.filter(e=>e.status!=='paid').reduce((s,e)=>s+e.amount,0),
        paid: mes.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amount,0),
        overdue: mes.filter(e=>e.status==='overdue').reduce((s,e)=>s+e.amount,0)
      });

      const mInc = allIncomes.filter(i=>{ const md=new Date(i.date); return md.getMonth()===m && md.getFullYear()===y; }).reduce((s,i)=>s+i.amount,0);
      const mExp = allExpenses.filter(e=>{ const md=new Date(e.date); return md.getMonth()===m && md.getFullYear()===y; }).reduce((s,e)=>s+e.amount,0);
      incExpMonthly.push({
        month: d.toLocaleDateString('en-IN',{month:'short', year:'2-digit'}),
        income: mInc,
        expense: mExp,
        net: mInc - mExp,
        emiPaid: mes.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amount,0)
      });
    }
    setMonthlyData(monthly);
    setIncomeExpenseMonthly(incExpMonthly);

    const lenderMap = new Map<string, number>();
    for(const loan of filteredLoans){
      let outstanding = 0;
      if(loan.type==='onetime' && (loan.status==='active'||loan.status==='overdue')) outstanding = loan.totalAmount;
      else {
        outstanding = allEntries.filter(e=>e.loanId===loan.id && (e.status==='pending'||e.status==='overdue')).reduce((s,e)=>s+e.amount,0);
      }
      lenderMap.set(loan.lenderName, (lenderMap.get(loan.lenderName)||0)+outstanding);
    }
    setLenderData(Array.from(lenderMap.entries()).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value));

    const statusMap = [
      { name:'Paid', value: filteredEntries.filter(e=>e.status==='paid').length, color:'#22c55e' },
      { name:'Pending', value: filteredEntries.filter(e=>e.status==='pending').length, color:'#3b82f6' },
      { name:'Overdue', value: filteredEntries.filter(e=>e.status==='overdue').length, color:'#ef4444' },
    ];
    setStatusData(statusMap);

    const expCatMap = new Map<string, number>();
    filteredExpenses.forEach(e=>{ expCatMap.set(e.category, (expCatMap.get(e.category)||0)+e.amount); });
    setExpenseCatData(Array.from(expCatMap.entries()).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value));

    const incCatMap = new Map<string, number>();
    filteredIncomes.forEach(i=>{ incCatMap.set(i.category, (incCatMap.get(i.category)||0)+i.amount); });
    setIncomeCatData(Array.from(incCatMap.entries()).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value));

    setSummary({
      totalLoans: filteredLoans.length,
      totalEMI: filteredEntries.length,
      totalPaid: filteredEntries.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amount,0),
      totalDue: filteredEntries.filter(e=>e.status!=='paid').reduce((s,e)=>s+e.amount,0),
      avgEMI: filteredEntries.length ? filteredEntries.reduce((s,e)=>s+e.amount,0)/filteredEntries.length : 0,
      totalIncome: filteredIncomes.reduce((s,i)=>s+i.amount,0),
      totalExpense: filteredExpenses.reduce((s,e)=>s+e.amount,0),
      net: filteredIncomes.reduce((s,i)=>s+i.amount,0) - filteredExpenses.reduce((s,e)=>s+e.amount,0)
    });
  }

  const lenderList = Array.from(new Set(loans.map(l=>l.lenderName)));
  const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-[13px] text-slate-400">Loans, income and expenses - customized report</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Select label="Period" value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="month">This Month</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Loan Type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="emi">EMI Only</option>
            <option value="onetime">One-Time Only</option>
          </Select>
          <Select label="Lender" value={lenderFilter} onChange={e=>setLenderFilter(e.target.value)}>
            <option value="all">All Lenders</option>
            {lenderList.map(l=> <option key={l} value={l}>{l}</option>)}
          </Select>
          {period==='custom' && (
            <>
              <div><label className="text-[13px] text-slate-300">From</label><input type="date" value={customRange.from} onChange={e=>setCustomRange({...customRange, from:e.target.value})} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-xl text-[13px]" /></div>
              <div><label className="text-[13px] text-slate-300">To</label><input type="date" value={customRange.to} onChange={e=>setCustomRange({...customRange, to:e.target.value})} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-xl text-[13px]" /></div>
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4"><p className="text-[11px] text-slate-500 uppercase">Filtered Loans</p><p className="text-[20px] font-bold mt-1">{summary.totalLoans||0}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-slate-500 uppercase">Total Paid EMI</p><p className="text-[18px] font-bold mt-1 text-[#22c55e]">{formatCurrency(summary.totalPaid||0)}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-slate-500 uppercase">Total Due EMI</p><p className="text-[18px] font-bold mt-1 text-[#f59e0b]">{formatCurrency(summary.totalDue||0)}</p></Card>
        <Card className="p-4 border-[#22c55e]/20 bg-[#22c55e]/5"><p className="text-[11px] text-slate-500 uppercase">Total Income</p><p className="text-[18px] font-bold mt-1 text-[#22c55e]">{formatCurrency(summary.totalIncome||0)}</p><p className="text-[10px] text-slate-500 mt-1">Aaj + month + custom</p></Card>
        <Card className="p-4 border-[#ef4444]/20 bg-[#ef4444]/5"><p className="text-[11px] text-slate-500 uppercase">Total Expense</p><p className="text-[18px] font-bold mt-1 text-[#ef4444]">{formatCurrency(summary.totalExpense||0)}</p></Card>
        <Card className="p-4 bg-[#1e293b]"><p className="text-[11px] text-slate-500 uppercase">Net Savings</p><p className={`text-[18px] font-bold mt-1 ${summary.net>=0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(summary.net||0)}</p><p className="text-[10px] text-slate-500 mt-1">Income - Expense - EMI Paid</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-[15px] mb-4">Income vs Expense vs EMI (12 months)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseMonthly}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'12px', fontSize:'12px' }} formatter={(v:any)=>[formatCurrency(v as number),'']} />
                <Bar dataKey="income" fill="#22c55e" radius={[4,4,0,0]} barSize={12} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4,4,0,0]} barSize={12} />
                <Bar dataKey="emiPaid" fill="#3b82f6" radius={[4,4,0,0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 mt-3 text-[11px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]"/>Income</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]"/>Expense</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"/>EMI Paid</span>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-[15px] mb-4">Net Savings Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeExpenseMonthly}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'12px', fontSize:'12px' }} formatter={(v:any)=>[formatCurrency(v as number),'']} />
                <Area type="monotone" dataKey="net" stroke="#22c55e" fill="#22c55e30" strokeWidth={2} />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="transparent" strokeWidth={1} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold text-[15px] mb-4">Monthly EMI Trend (12 months)</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'12px', fontSize:'12px' }} formatter={(v:any)=>[formatCurrency(v as number),'']} />
                <Bar dataKey="paid" stackId="a" fill="#22c55e" barSize={16} />
                <Bar dataKey="due" stackId="a" fill="#3b82f6" barSize={16} />
                <Bar dataKey="overdue" stackId="a" fill="#ef4444" barSize={16} radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-[15px] mb-4">EMI Status</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}:${value}`}>
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1e293b', border:'1px solid #334155', borderRadius:'12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {statusData.map(s=>(
              <div key={s.name} className="flex justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:s.color}} />{s.name}</span><span className="font-medium">{s.value}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-[15px] mb-4">Expense by Category</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name, value})=> `${name}: ${formatCurrency(value)}`}>
                  {expenseCatData.map((_, i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1e293b', border:'1px solid #334155', borderRadius:'12px'}} formatter={(v:any)=>[formatCurrency(v as number),'']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2 max-h-[120px] overflow-y-auto">
            {expenseCatData.map((c,i)=>(
              <div key={c.name} className="flex justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:COLORS[i%COLORS.length]}} />{c.name}</span><span className="font-medium">{formatCurrency(c.value)}</span></div>
            ))}
            {expenseCatData.length===0 && <p className="text-[12px] text-slate-500 text-center py-4">No expenses in selected period</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-[15px] mb-4">Income by Category</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={incomeCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name, value})=> `${name}: ${formatCurrency(value)}`}>
                  {incomeCatData.map((_, i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1e293b', border:'1px solid #334155', borderRadius:'12px'}} formatter={(v:any)=>[formatCurrency(v as number),'']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2 max-h-[120px] overflow-y-auto">
            {incomeCatData.map((c,i)=>(
              <div key={c.name} className="flex justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:COLORS[i%COLORS.length]}} />{c.name}</span><span className="font-medium">{formatCurrency(c.value)}</span></div>
            ))}
            {incomeCatData.length===0 && <p className="text-[12px] text-slate-500 text-center py-4">No income in selected period</p>}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-[15px] mb-4">Lender-wise Outstanding</h3>
        <div className="space-y-3">
          {lenderData.map((l,i)=>(
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0f172a] border border-[#334155] flex items-center justify-center text-[12px] font-bold shrink-0">{l.name[0]}</div>
              <div className="flex-1">
                <div className="flex justify-between text-[13px]"><span className="font-medium">{l.name}</span><span className="font-bold">{formatCurrency(l.value)}</span></div>
                <div className="w-full h-1.5 bg-[#0f172a] rounded-full mt-1"><div className="h-full bg-[#3b82f6] rounded-full" style={{width:`${(l.value/(lenderData[0]?.value||1))*100}%`}} /></div>
              </div>
            </div>
          ))}
          {lenderData.length===0 && <p className="text-[13px] text-slate-500 text-center py-6">No data for selected filters</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-[15px] mb-4">Recent EMI Payments</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {[...entries].filter(e=>e.status==='paid').sort((a,b)=> new Date(b.paidDate||'').getTime() - new Date(a.paidDate||'').getTime()).slice(0,20).map(e=>{
            const loan = loans.find(l=>l.id===e.loanId);
            return (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#334155]/20 last:border-0">
                <div className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate">{loan?.lenderName} • Month {e.monthNumber} • {formatCurrency(e.amount)}</p>
                  <p className="text-[11px] text-slate-500">{e.paidDate ? formatDate(e.paidDate) : ''} • {e.paymentMode}</p>
                </div>
                <span className="text-[11px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">Paid</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-[15px] mb-3">Export Data (Includes Income/Expense)</h3>
        <p className="text-[12px] text-slate-500 mb-4">Download your data for backup. Now includes Income and Expense sheets.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button variant="secondary" onClick={()=>exportExcel()}>📊 Export Excel (.xlsx)</Button>
          <Button variant="secondary" onClick={()=>exportCSV()}>📄 Export CSV</Button>
          <Button variant="secondary" onClick={()=>exportJSON()}>💾 Export JSON Backup</Button>
        </div>
      </Card>
    </div>
  );
}
