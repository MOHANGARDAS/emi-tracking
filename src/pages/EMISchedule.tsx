import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '@/db';
import { Loan, EMIEntry } from '@/types';
import { formatCurrency, formatDate, daysUntil, getStatusColor } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

export default function EMISchedule(){
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [entries, setEntries] = useState<EMIEntry[]>([]);
  const [showPay, setShowPay] = useState<number | null>(null);
  const [payMode, setPayMode] = useState('UPI');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10));
  const [showPrepay, setShowPrepay] = useState(false);
  const [prepayAmount, setPrepayAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(()=>{ load(); },[id]);

  async function load(){
    if(!id) return;
    const l = await db.loans.get(Number(id));
    if(!l){ navigate('/loans'); return; }
    setLoan(l);
    if(l.type==='emi'){
      const emi = await db.emiEntries.where('loanId').equals(Number(id)).sortBy('monthNumber');
      setEntries(emi);
    }
  }

  async function markPaid(entryId:number){
    await db.emiEntries.update(entryId, { status:'paid', paidDate: new Date(payDate).toISOString(), paymentMode: payMode });
    const all = await db.emiEntries.where('loanId').equals(Number(id)).toArray();
    const remaining = all.filter(e=> e.id!==entryId && e.status!=='paid').length;
    if(remaining===0){
      await db.loans.update(Number(id), { status:'completed', updatedAt: new Date().toISOString() });
    } else {
      const stillOverdue = all.filter(e=> e.id!==entryId && e.status==='overdue').length;
      if(stillOverdue>0) await db.loans.update(Number(id), { status:'overdue' });
      else await db.loans.update(Number(id), { status:'active' });
    }
    setShowPay(null);
    load();
  }

  async function markUnpaid(entryId:number){
    await db.emiEntries.update(entryId, { status:'pending', paidDate: undefined, paymentMode: undefined });
    await db.loans.update(Number(id), { status:'active', updatedAt: new Date().toISOString() });
    load();
  }

  async function handlePrepayment(){
    if(!prepayAmount || Number(prepayAmount)<=0) return;
    const amount = Number(prepayAmount);
    let remaining = amount;
    const pending = entries.filter(e=>e.status==='pending'||e.status==='overdue').sort((a,b)=> new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    for(const p of pending){
      if(remaining<=0) break;
      if(remaining >= p.amount){
        await db.emiEntries.update(p.id!, { status:'paid', paidDate: new Date().toISOString(), paymentMode:'Prepayment', notes:`Prepaid ${formatCurrency(p.amount)}` });
        remaining -= p.amount;
      } else {
        const newAmount = p.amount - remaining;
        await db.emiEntries.update(p.id!, { amount: newAmount, notes: `Prepaid ${formatCurrency(remaining)}` });
        remaining=0;
      }
    }
    setShowPrepay(false);
    setPrepayAmount('');
    load();
  }

  async function closeLoan(){
    if(confirm('Mark this loan as closed? All pending EMIs will be marked as paid.')){
      await db.emiEntries.where('loanId').equals(Number(id)).modify({ status:'paid' as const, paidDate: new Date().toISOString(), paymentMode:'Closed' });
      await db.loans.update(Number(id), { status:'closed', updatedAt: new Date().toISOString() });
      load();
    }
  }

  if(!loan) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const filteredEntries = filterStatus==='all' ? entries : entries.filter(e=>e.status===filterStatus);
  const totalPaid = entries.filter(e=>e.status==='paid').reduce((s,e)=>s+e.amount,0);
  const totalPending = entries.filter(e=>e.status!=='paid').reduce((s,e)=>s+e.amount,0);
  const progress = entries.length ? (entries.filter(e=>e.status==='paid').length / entries.length)*100 : 0;

  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <button onClick={()=>navigate(-1)} className="text-[13px] text-slate-400 hover:text-slate-200">← Back</button>
      
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[20px]">🏦</div>
            <div>
              <h1 className="text-[18px] font-bold">{loan.lenderName}</h1>
              <p className="text-[12px] text-slate-400">{loan.purpose || 'EMI Loan'} • {loan.totalMonths} months • {formatCurrency(loan.emiAmount||0)}/mo</p>
              <div className="flex gap-2 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${getStatusColor(loan.status)}`}>{loan.status}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0f172a] border border-[#334155] text-slate-400">Start: {formatDate(loan.startDate)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={()=>navigate(`/add?edit=${loan.id}`)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={closeLoan}>Close Loan</Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Progress: {entries.filter(e=>e.status==='paid').length}/{entries.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]/30">
            <div className="h-full bg-[#22c55e] transition-all" style={{width:`${progress}%`}} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
              <p className="text-[11px] text-slate-500">Paid</p>
              <p className="text-[15px] font-bold text-[#22c55e]">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
              <p className="text-[11px] text-slate-500">Pending</p>
              <p className="text-[15px] font-bold text-[#f59e0b]">{formatCurrency(totalPending)}</p>
            </div>
            <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
              <p className="text-[11px] text-slate-500">Total</p>
              <p className="text-[15px] font-bold">{formatCurrency(loan.totalAmount)}</p>
            </div>
          </div>
        </div>
      </Card>

      {loan.type==='onetime' ? (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Loan Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-[#334155]/20"><span className="text-[13px] text-slate-400">Amount</span><span className="font-bold">{formatCurrency(loan.totalAmount)}</span></div>
            <div className="flex justify-between py-2 border-b border-[#334155]/20"><span className="text-[13px] text-slate-400">Borrow Date</span><span className="font-medium">{formatDate(loan.startDate)}</span></div>
            <div className="flex justify-between py-2 border-b border-[#334155]/20"><span className="text-[13px] text-slate-400">Due Date</span><span className="font-medium">{loan.dueDate ? formatDate(loan.dueDate) : '-'} {loan.dueDate ? `(${daysUntil(loan.dueDate)} days)` : ''}</span></div>
            <div className="flex justify-between py-2"><span className="text-[13px] text-slate-400">Status</span><span className={`px-2 py-0.5 rounded-full text-[11px] border ${getStatusColor(loan.status)}`}>{loan.status}</span></div>
          </div>
          {loan.status!=='completed' && loan.status!=='closed' && (
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={async()=>{
                await db.loans.update(loan.id!, { status:'completed', updatedAt: new Date().toISOString() });
                load();
              }}>Mark as Paid</Button>
              <Button variant="secondary" className="flex-1" onClick={()=>navigate('/loans')}>Back</Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-3 justify-between">
            <div className="flex gap-2">
              {['all','pending','paid','overdue'].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium border capitalize ${filterStatus===s ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#1e293b] text-slate-400 border-[#334155]'}`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={()=>setShowPrepay(v=>!v)}>{showPrepay ? 'Cancel' : 'Prepayment'}</Button>
            </div>
          </div>

          {showPrepay && (
            <Card className="p-4 border-[#22c55e]/20 bg-[#22c55e]/5">
              <h4 className="font-medium text-[14px] mb-3">Prepayment</h4>
              <p className="text-[12px] text-slate-400 mb-3">Enter amount to prepay. Pending EMIs will be adjusted.</p>
              <div className="flex gap-2">
                <Input type="number" placeholder="10000" value={prepayAmount} onChange={e=>setPrepayAmount(e.target.value)} className="flex-1" />
                <Button onClick={handlePrepayment}>Apply</Button>
              </div>
            </Card>
          )}

          <div className="grid gap-2.5">
            {filteredEntries.map(entry=>(
              <Card key={entry.id} className={`p-4 ${entry.status==='overdue' ? 'border-[#ef4444]/30 bg-[#ef4444]/5' : entry.status==='paid' ? 'border-[#22c55e]/20' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border ${entry.status==='paid' ? 'bg-[#22c55e] text-white border-[#22c55e]' : entry.status==='overdue' ? 'bg-[#ef4444] text-white border-[#ef4444]' : 'bg-[#0f172a] text-slate-400 border-[#334155]'}`}>{entry.monthNumber}</div>
                    <div>
                      <p className="text-[13px] font-medium">Month {entry.monthNumber} • {formatDate(entry.dueDate)}</p>
                      <p className="text-[11px] text-slate-500">{entry.status==='paid' ? `Paid on ${entry.paidDate ? formatDate(entry.paidDate) : ''} • ${entry.paymentMode}` : `${daysUntil(entry.dueDate)>=0 ? `${daysUntil(entry.dueDate)} days left` : `${Math.abs(daysUntil(entry.dueDate))} days overdue`}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[14px]">{formatCurrency(entry.amount)}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border uppercase ${getStatusColor(entry.status)}`}>{entry.status}</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {entry.status!=='paid' ? (
                    <>
                      {showPay===entry.id ? (
                        <div className="flex-1 bg-[#0f172a] rounded-xl p-3 border border-[#334155]/50 flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Input type="date" label="Paid Date" value={payDate} onChange={e=>setPayDate(e.target.value)} />
                            <Select label="Payment Mode" value={payMode} onChange={e=>setPayMode(e.target.value)}>
                              <option>UPI</option>
                              <option>Bank Transfer</option>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" className="flex-1" onClick={()=>setShowPay(null)}>Cancel</Button>
                            <Button size="sm" className="flex-1" onClick={()=>markPaid(entry.id!)}>Confirm</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" className="flex-1" onClick={()=>{setShowPay(entry.id!); setPayDate(new Date().toISOString().slice(0,10)); setPayMode('UPI');}}>Mark as Paid</Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="flex-1 text-slate-400" onClick={()=>markUnpaid(entry.id!)}>Undo</Button>
                  )}
                </div>
              </Card>
            ))}
            {filteredEntries.length===0 && <Card className="p-8 text-center text-slate-500 text-[13px]">No {filterStatus} EMIs</Card>}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Link to="/loans" className="flex-1 text-center py-3 rounded-xl bg-[#1e293b] border border-[#334155] text-[14px] font-medium">Back to Loans</Link>
        <Link to="/" className="flex-1 text-center py-3 rounded-xl bg-[#22c55e] text-white text-[14px] font-medium">Dashboard</Link>
      </div>
    </div>
  );
}
