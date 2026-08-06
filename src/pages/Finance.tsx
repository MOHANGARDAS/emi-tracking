import { useEffect, useState } from 'react';
import { db, isToday, isThisMonth } from '@/db';
import { Income, Expense } from '@/types';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Tab = 'income' | 'expense';
const incomeCats = ['Salary', 'Business', 'Freelance', 'Other'];
const expenseCats = ['Food', 'Travel', 'Bills', 'Shopping', 'Rent', 'Other'];

export default function Finance(){
  const [tab, setTab] = useState<Tab>('expense');
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [q, setQ] = useState('');
  const [dateFilter, setDateFilter] = useState<'today'|'week'|'month'|'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number|null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const [stats, setStats] = useState({ todayInc:0, todayExp:0, monthInc:0, monthExp:0, bal:0 });

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ calc(); },[incomes, expenses]);

  async function load(){
    const inc = await db.incomes.orderBy('date').reverse().toArray();
    const exp = await db.expenses.orderBy('date').reverse().toArray();
    setIncomes(inc); setExpenses(exp);
  }

  function calc(){
    const tInc = incomes.filter(i=> isToday(i.date)).reduce((s,i)=>s+i.amount,0);
    const tExp = expenses.filter(e=> isToday(e.date)).reduce((s,e)=>s+e.amount,0);
    const mInc = incomes.filter(i=> isThisMonth(i.date)).reduce((s,i)=>s+i.amount,0);
    const mExp = expenses.filter(e=> isThisMonth(e.date)).reduce((s,e)=>s+e.amount,0);
    setStats({ todayInc: tInc, todayExp: tExp, monthInc: mInc, monthExp: mExp, bal: (mInc - mExp) });
  }

  function getFiltered(){
    const now = new Date();
    const filterFn = (dStr: string) => {
      if(dateFilter==='all') return true;
      const d = new Date(dStr);
      if(dateFilter==='today') return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      if(dateFilter==='week'){ const w=new Date(); w.setDate(now.getDate()-7); return d>=w; }
      if(dateFilter==='month') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      return true;
    };
    let list: any[] = tab==='income' ? incomes : expenses;
    list = list.filter(x=> filterFn(x.date));
    if(q){
      const s=q.toLowerCase();
      if(tab==='income') list = (list as Income[]).filter(i=> i.source.toLowerCase().includes(s) || i.category.toLowerCase().includes(s));
      else list = (list as Expense[]).filter(e=> e.category.toLowerCase().includes(s) || (e.vendor||'').toLowerCase().includes(s));
    }
    return list;
  }

  function openAdd(type: Tab){
    setTab(type);
    setCategory(type==='income' ? 'Salary' : 'Food');
    setAmount(''); setSource(''); setDate(new Date().toISOString().slice(0,10));
    setEditingId(null);
    setShowAdd(true);
  }

  function openEditIncome(i: Income){
    setTab('income'); setAmount(String(i.amount)); setCategory(i.category); setSource(i.source); setDate(new Date(i.date).toISOString().slice(0,10)); setEditingId(i.id!); setShowAdd(true);
  }
  function openEditExpense(e: Expense){
    setTab('expense'); setAmount(String(e.amount)); setCategory(e.category); setSource(e.vendor||''); setDate(new Date(e.date).toISOString().slice(0,10)); setEditingId(e.id!); setShowAdd(true);
  }

  async function save(){
    if(!amount || Number(amount)<=0) return;
    const now = new Date().toISOString();
    if(tab==='income'){
      if(!source.trim() && !category) return;
      if(editingId){ await db.incomes.update(editingId, { amount:Number(amount), source: source.trim()||category, category, date:new Date(date).toISOString(), updatedAt:now }); }
      else { await db.incomes.add({ amount:Number(amount), source: source.trim()||category, category, date:new Date(date).toISOString(), notes:'', createdAt:now, updatedAt:now }); }
    } else {
      if(editingId){ await db.expenses.update(editingId, { amount:Number(amount), category, vendor:source.trim(), date:new Date(date).toISOString(), paymentMode:'UPI', updatedAt:now }); }
      else { await db.expenses.add({ amount:Number(amount), category, vendor:source.trim(), date:new Date(date).toISOString(), paymentMode:'UPI', createdAt:now, updatedAt:now }); }
    }
    setShowAdd(false); setAmount(''); setSource(''); setEditingId(null); load();
  }

  async function del(id:number, type:Tab){
    if(!confirm('Delete?')) return;
    if(type==='income') await db.incomes.delete(id); else await db.expenses.delete(id);
    load();
  }

  const filtered = getFiltered();

  return (
    <div className="max-w-[720px] mx-auto space-y-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Finance</h1>
        <p className="text-[13px] text-slate-400">Simple income & expense tracking</p>
      </div>

      {/* Simple Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-[#22c55e]/10 border-[#22c55e]/20">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Today Income</p>
          <p className="text-[22px] font-bold text-[#22c55e] mt-1">{formatCurrency(stats.todayInc)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Month: {formatCurrency(stats.monthInc)}</p>
        </Card>
        <Card className="p-4 bg-[#ef4444]/10 border-[#ef4444]/20">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Today Expense</p>
          <p className="text-[22px] font-bold text-[#ef4444] mt-1">{formatCurrency(stats.todayExp)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Month: {formatCurrency(stats.monthExp)}</p>
        </Card>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-400 uppercase">Month Balance</p>
          <p className={`text-[20px] font-bold mt-1 ${stats.bal>=0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(stats.bal)}</p>
          <p className="text-[11px] text-slate-500">Income - Expense this month</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#22c55e] hover:bg-[#16a34a] text-white" onClick={()=>openAdd('income')}>+ Income</Button>
          <Button size="sm" variant="secondary" className="border-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/10" onClick={()=>openAdd('expense')}>+ Expense</Button>
        </div>
      </Card>

      {/* Easy Tabs */}
      <div className="flex gap-2">
        <button onClick={()=>setTab('expense')} className={`flex-1 py-3 rounded-xl text-[14px] font-semibold border transition-all ${tab==='expense' ? 'bg-[#ef4444] text-white border-[#ef4444] shadow-lg shadow-[#ef4444]/20' : 'bg-[#1e293b] text-slate-400 border-[#334155]'}`}>
          💸 Expenses
        </button>
        <button onClick={()=>setTab('income')} className={`flex-1 py-3 rounded-xl text-[14px] font-semibold border transition-all ${tab==='income' ? 'bg-[#22c55e] text-white border-[#22c55e] shadow-lg shadow-[#22c55e]/20' : 'bg-[#1e293b] text-slate-400 border-[#334155]'}`}>
          💰 Income
        </button>
      </div>

      {/* Easy Filters - chips, not dropdown */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {(['all','today','week','month'] as const).map(f=>(
          <button key={f} onClick={()=>setDateFilter(f)} className={`px-4 py-2 rounded-full text-[12px] font-medium border whitespace-nowrap ${dateFilter===f ? 'bg-[#3b82f6] text-white border-[#3b82f6]' : 'bg-[#1e293b] text-slate-400 border-[#334155]'}`}>
            {f==='all' ? 'All' : f==='today' ? 'Today' : f==='week' ? '7 Days' : 'This Month'}
          </button>
        ))}
        <div className="ml-auto min-w-[140px]">
          <Input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} className="h-9" />
        </div>
      </div>

      {/* Simple Add Sheet */}
      {showAdd && (
        <Card className="p-5 border-[#22c55e]/30 bg-[#1e293b] animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[15px]">{editingId ? 'Edit' : 'Add'} {tab==='income' ? 'Income' : 'Expense'}</h3>
            <button onClick={()=>setShowAdd(false)} className="w-8 h-8 rounded-full bg-[#0f172a] border border-[#334155] flex items-center justify-center">✕</button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-slate-300">Amount *</label>
              <input autoFocus type="number" inputMode="numeric" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full mt-1.5 px-4 py-4 bg-[#0f172a] border border-[#334155] rounded-2xl text-[28px] font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/20 text-center" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-slate-400">{tab==='income' ? 'Source' : 'For what?'}</label>
                <input type="text" placeholder={tab==='income' ? 'Salary' : 'Food, Travel...'} value={source} onChange={e=>setSource(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-[14px] focus:outline-none focus:border-[#3b82f6]" />
              </div>
              <div>
                <label className="text-[12px] text-slate-400">Date</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-[14px] focus:outline-none focus:border-[#3b82f6]" />
              </div>
            </div>

            <div>
              <label className="text-[12px] text-slate-400 mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {(tab==='income' ? incomeCats : expenseCats).map(c=>(
                  <button key={c} onClick={()=>setCategory(c)} className={`px-3 py-2 rounded-full text-[12px] font-medium border transition-all ${category===c ? (tab==='income' ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#ef4444] text-white border-[#ef4444]') : 'bg-[#0f172a] text-slate-400 border-[#334155]'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1 py-3" onClick={()=>setShowAdd(false)}>Cancel</Button>
              <Button className={`flex-1 py-3 text-white ${tab==='income' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-[#ef4444] hover:bg-[#dc2626]'}`} onClick={save}>
                {editingId ? 'Update' : 'Save'} {tab==='income' ? 'Income' : 'Expense'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Easy List */}
      <div className="space-y-2">
        {filtered.length===0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center mx-auto text-[24px]">{tab==='income' ? '💰' : '💸'}</div>
            <p className="font-medium mt-4">No {tab} yet</p>
            <p className="text-[13px] text-slate-500 mt-1">Tap + {tab==='income' ? 'Income' : 'Expense'} to add your first entry</p>
            <Button className="mt-4" onClick={()=>openAdd(tab)}>+ Add {tab}</Button>
          </Card>
        ) : (
          filtered.map((item:any)=>(
            <Card key={item.id} className="p-4 flex items-center justify-between hover:border-[#334155] transition-colors group">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-[18px] border shrink-0 ${tab==='income' ? 'bg-[#22c55e]/10 border-[#22c55e]/20' : 'bg-[#ef4444]/10 border-[#ef4444]/20'}`}>
                  {tab==='income' ? '💰' : '🛒'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{tab==='income' ? (item as Income).source : (item as Expense).category} <span className="text-[11px] font-normal text-slate-500">{tab==='expense' && (item as Expense).vendor ? `• ${ (item as Expense).vendor}` : ''}</span></p>
                  <p className="text-[11px] text-slate-500">{formatDate(item.date)} • {item.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className={`font-bold text-[15px] ${tab==='income' ? 'text-[#22c55e]' : 'text-slate-100'}`}>{tab==='income' ? '+' : '-'}{formatCurrency(item.amount)}</p>
                <div className="hidden group-hover:flex md:flex gap-1">
                  <button onClick={()=> tab==='income' ? openEditIncome(item as Income) : openEditExpense(item as Expense)} className="w-8 h-8 rounded-full bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[12px] hover:bg-[#334155]">✏️</button>
                  <button onClick={()=> del(item.id!, tab)} className="w-8 h-8 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[12px] hover:bg-[#ef4444]/20">🗑️</button>
                </div>
                <div className="flex md:hidden gap-1">
                  <button onClick={()=> tab==='income' ? openEditIncome(item as Income) : openEditExpense(item as Expense)} className="text-[11px] text-[#3b82f6] px-2">Edit</button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="text-center py-4">
        <p className="text-[11px] text-slate-600">Tap + to add • Swipe to edit • Simple & fast</p>
      </div>
    </div>
  );
}
