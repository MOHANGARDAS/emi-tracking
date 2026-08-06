import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { db, refreshOverdueStatus } from '@/db';
import { Loan } from '@/types';
import { formatCurrency, formatDate, daysUntil } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function Loans(){
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filtered, setFiltered] = useState<Loan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [dateRange, setDateRange] = useState({ from:'', to:'' });
  const [showDel, setShowDel] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ applyFilters(); },[loans, search, statusFilter, typeFilter, sortBy, dateRange]);

  async function load(){
    await refreshOverdueStatus();
    const all = await db.loans.orderBy('createdAt').reverse().toArray();
    setLoans(all);
  }

  function applyFilters(){
    let res = [...loans];
    if(search){
      res = res.filter(l=> l.lenderName.toLowerCase().includes(search.toLowerCase()) || (l.purpose||'').toLowerCase().includes(search.toLowerCase()));
    }
    if(statusFilter!=='all'){
      if(statusFilter==='overdue') res = res.filter(l=>l.status==='overdue');
      else res = res.filter(l=>l.status===statusFilter);
    }
    if(typeFilter!=='all'){
      res = res.filter(l=>l.type===typeFilter);
    }
    if(dateRange.from){
      res = res.filter(l=> new Date(l.startDate) >= new Date(dateRange.from));
    }
    if(dateRange.to){
      res = res.filter(l=> new Date(l.startDate) <= new Date(dateRange.to));
    }
    res.sort((a,b)=>{
      switch(sortBy){
        case 'amount': return b.totalAmount - a.totalAmount;
        case 'lender': return a.lenderName.localeCompare(b.lenderName);
        case 'dueDate': 
          const ad = a.dueDate || a.startDate;
          const bd = b.dueDate || b.startDate;
          return new Date(ad).getTime() - new Date(bd).getTime();
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    setFiltered(res);
  }

  async function deleteLoan(id:number){
    // delete related entries too
    await db.transaction('rw', db.loans, db.emiEntries, db.reminders, async ()=>{
      await db.emiEntries.where('loanId').equals(id).delete();
      await db.reminders.where('loanId').equals(id).delete();
      await db.loans.delete(id);
    });
    setShowDel(null);
    load();
  }

  async function quickMarkPaid(id:number){
    // For one-time loans: mark completed
    await db.loans.update(id, { status:'completed', updatedAt: new Date().toISOString() });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">All Loans</h1>
          <p className="text-[13px] text-slate-400">{filtered.length} loans • Search, filter and manage</p>
        </div>
        <Link to="/add" className="hidden md:inline-flex bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2.5 rounded-xl text-[14px] font-medium">+ Add Loan</Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <Input placeholder="Search by lender, purpose..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="emi">EMI Loans</option>
              <option value="onetime">One-Time</option>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="created">Sort: Recent</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="lender">Sort: Lender Name</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Input type="date" label="From Date" value={dateRange.from} onChange={e=>setDateRange({...dateRange, from:e.target.value})} />
          <Input type="date" label="To Date" value={dateRange.to} onChange={e=>setDateRange({...dateRange, to:e.target.value})} />
        </div>
      </Card>

      {/* List */}
      <div className="grid gap-3">
        {filtered.map(loan=>(
          <Card key={loan.id} className="p-4 hover:border-[#475569] transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[16px] border shrink-0 ${loan.type==='emi' ? 'bg-[#3b82f6]/10 border-[#3b82f6]/20' : 'bg-[#f59e0b]/10 border-[#f59e0b]/20'}`}>
                  {loan.type==='emi' ? '🏦' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[14px] truncate">{loan.lenderName}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider
                      ${loan.status==='active' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' : ''}
                      ${loan.status==='overdue' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' : ''}
                      ${loan.status==='completed' || loan.status==='closed' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : ''}`}>{loan.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0f172a] border border-[#334155] text-slate-400">{loan.type==='emi' ? `${loan.totalMonths} MONTHS EMI` : 'ONE-TIME'}</span>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-0.5 truncate">{loan.purpose || (loan.type==='emi' ? `${formatCurrency(loan.emiAmount||0)}/month • EMI on ${loan.emiDate}th` : `Due: ${loan.dueDate ? formatDate(loan.dueDate) : ''}`)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[13px] font-bold">{formatCurrency(loan.totalAmount)}</span>
                    {loan.type==='emi' && loan.emiAmount && <span className="text-[11px] text-slate-500">{formatCurrency(loan.emiAmount)}/mo × {loan.totalMonths}</span>}
                    <span className="text-[11px] text-slate-500 hidden md:inline">• Start: {formatDate(loan.startDate)}</span>
                    {loan.type==='onetime' && loan.dueDate && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${daysUntil(loan.dueDate)<0 && loan.status!=='completed' ? 'bg-[#ef4444]/20 text-[#ef4444]' : daysUntil(loan.dueDate)<=7 ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'text-slate-500'}`}>
                        {daysUntil(loan.dueDate)>=0 ? `${daysUntil(loan.dueDate)} days left` : `${Math.abs(daysUntil(loan.dueDate))} days overdue`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-1.5 shrink-0">
                <Button size="sm" variant="secondary" onClick={()=>navigate(`/loans/${loan.id}`)}>View</Button>
                <div className="hidden md:flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={()=>navigate(`/add?edit=${loan.id}`)}>Edit</Button>
                  {loan.status!=='completed' && loan.status!=='closed' && loan.type==='onetime' && <Button size="sm" variant="primary" onClick={()=>quickMarkPaid(loan.id!)}>Paid</Button>}
                  <Button size="sm" variant="ghost" className="text-[#ef4444]" onClick={()=>setShowDel(loan.id!)}>Del</Button>
                </div>
              </div>
            </div>
            {/* Mobile actions */}
            <div className="md:hidden flex gap-2 mt-3">
              <Button size="sm" variant="secondary" className="flex-1" onClick={()=>navigate(`/add?edit=${loan.id}`)}>Edit</Button>
              {loan.status!=='completed' && loan.type==='onetime' && <Button size="sm" variant="primary" className="flex-1" onClick={()=>quickMarkPaid(loan.id!)}>Mark Paid</Button>}
              <Button size="sm" variant="ghost" className="text-[#ef4444]" onClick={()=>setShowDel(loan.id!)}>Delete</Button>
            </div>

            {/* Delete confirm */}
            {showDel===loan.id && (
              <div className="mt-4 p-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-between gap-3">
                <p className="text-[12px] text-[#ef4444]">Delete this loan? This will delete all related EMI entries. Cannot be undone.</p>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={()=>setShowDel(null)}>Cancel</Button>
                  <Button size="sm" variant="danger" onClick={()=>deleteLoan(loan.id!)}>Delete</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtered.length===0 && (
          <Card className="p-12 text-center">
            <div className="text-[32px] mb-2">📭</div>
            <p className="font-medium">No loans found</p>
            <p className="text-[13px] text-slate-500 mt-1">Try adjusting filters or add a new loan</p>
            <Link to="/add" className="mt-4 inline-block bg-[#22c55e] text-white px-4 py-2 rounded-xl text-[13px] font-medium">Add Your First Loan</Link>
          </Card>
        )}
      </div>
    </div>
  );
}
