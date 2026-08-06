import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, getSetting, setSetting } from '@/db';
import { Loan } from '@/types';
import { generateEMIEntries, calculateReminders, formatCurrency } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function AddLoan(){
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const [tab, setTab] = useState<'emi'|'onetime'>('emi');
  const [loading, setLoading] = useState(false);
  const [reminderDays, setReminderDays] = useState<number[]>([3,1]);

  const [form, setForm] = useState({
    lenderName: '',
    purpose: '',
    totalAmount: '',
    emiAmount: '',
    totalMonths: '',
    startDate: new Date().toISOString().slice(0,10),
    emiDate: '5',
    interestRate: '',
    dueDate: '',
    notes: '',
    borrowDate: new Date().toISOString().slice(0,10)
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [autoCalculated, setAutoCalculated] = useState(false);

  useEffect(()=>{
    const loadEdit = async ()=>{
      if(editId){
        const loan = await db.loans.get(Number(editId));
        if(loan){
          setTab(loan.type);
          setForm({
            lenderName: loan.lenderName,
            purpose: loan.purpose||'',
            totalAmount: String(loan.totalAmount),
            emiAmount: String(loan.emiAmount||''),
            totalMonths: String(loan.totalMonths||''),
            startDate: loan.startDate.slice(0,10),
            emiDate: String(loan.emiDate||5),
            interestRate: String(loan.interestRate||''),
            dueDate: loan.dueDate ? loan.dueDate.slice(0,10) : '',
            notes: '',
            borrowDate: loan.startDate.slice(0,10)
          });
        }
      }
    };
    loadEdit();
    getSetting('defaultReminderDays', [3,1]).then(setReminderDays);
  },[editId]);

  useEffect(()=>{
    if(tab==='emi'){
      const emi = Number(form.emiAmount);
      const months = Number(form.totalMonths);
      if(!isNaN(emi) && !isNaN(months) && emi>0 && months>0){
        const total = emi * months;
        if(String(total) !== form.totalAmount){
          setForm(prev=>({...prev, totalAmount: String(total)}));
          setAutoCalculated(true);
          setTimeout(()=>setAutoCalculated(false), 2000);
        }
      }
    }
  },[form.emiAmount, form.totalMonths, tab]);

  useEffect(()=>{
    if(tab==='emi' && form.totalMonths && form.emiAmount && form.startDate && form.emiDate){
      const months = Number(form.totalMonths);
      const emiAmt = Number(form.emiAmount);
      if(!isNaN(months) && !isNaN(emiAmt) && months>0 && months<=360){
        const tempEntries = generateEMIEntries(0, months, emiAmt, new Date(form.startDate).toISOString(), Number(form.emiDate));
        setPreview(tempEntries.slice(0,6));
      } else setPreview([]);
    } else setPreview([]);
  },[form.totalMonths, form.emiAmount, form.startDate, form.emiDate, tab]);

  function validate(){
    const e: Record<string,string> = {};
    if(!form.lenderName.trim()) e.lenderName = 'Lender name is required';
    if(!form.totalAmount || Number(form.totalAmount)<=0) e.totalAmount='Valid amount is required';
    if(tab==='emi'){
      if(!form.emiAmount || Number(form.emiAmount)<=0) e.emiAmount='EMI amount is required';
      if(!form.totalMonths || Number(form.totalMonths)<=0) e.totalMonths='Tenure is required';
      if(Number(form.totalMonths) > 360) e.totalMonths='Maximum 360 months allowed';
      if(!form.startDate) e.startDate='Start date is required';
      const ed = Number(form.emiDate);
      if(isNaN(ed) || ed<1 || ed>31) e.emiDate='Enter 1-31';
    } else {
      if(!form.dueDate) e.dueDate='Due date is required';
      else if(new Date(form.dueDate) < new Date(form.borrowDate)) e.dueDate='Due date cannot be before borrow date';
    }
    setErrors(e);
    return Object.keys(e).length===0;
  }

  async function handleSubmit(){
    if(!validate()) return;
    setLoading(true);
    try{
      const now = new Date().toISOString();
      const finalTotal = tab==='emi' ? (Number(form.emiAmount) * Number(form.totalMonths)) : Number(form.totalAmount);

      if(editId){
        const existing = await db.loans.get(Number(editId));
        if(!existing) throw new Error('Loan not found');
        
        const updated: Partial<Loan> = {
          lenderName: form.lenderName.trim(),
          purpose: form.purpose.trim(),
          totalAmount: finalTotal,
          updatedAt: now
        };
        if(tab==='emi'){
          Object.assign(updated, {
            emiAmount: Number(form.emiAmount),
            totalMonths: Number(form.totalMonths),
            startDate: new Date(form.startDate).toISOString(),
            emiDate: Number(form.emiDate),
            interestRate: form.interestRate ? Number(form.interestRate) : undefined
          });
        } else {
          Object.assign(updated, {
            startDate: new Date(form.borrowDate).toISOString(),
            dueDate: new Date(form.dueDate).toISOString(),
            interestRate: undefined
          });
        }
        
        await db.loans.update(Number(editId), updated as Loan);

        if(existing.type==='emi' && tab==='emi'){
          const oldEmi = existing.emiAmount;
          const oldMonths = existing.totalMonths;
          const oldEmiDate = existing.emiDate;
          const oldStart = existing.startDate;

          const hasChanged = 
            Number(form.emiAmount) !== oldEmi ||
            Number(form.totalMonths) !== oldMonths ||
            Number(form.emiDate) !== oldEmiDate ||
            new Date(form.startDate).toISOString() !== oldStart;

          if(hasChanged){
            const existingEntries = await db.emiEntries.where('loanId').equals(Number(editId)).toArray();
            const paidEntries = existingEntries.filter(e=>e.status==='paid');
            const paidCount = paidEntries.length;

            let newTotalMonths = Number(form.totalMonths);
            if(newTotalMonths < paidCount){
              newTotalMonths = paidCount;
            }

            await db.emiEntries.where('loanId').equals(Number(editId)).filter(e=>e.status!=='paid').delete();
            await db.reminders.where('loanId').equals(Number(editId)).delete();

            const allNew = generateEMIEntries(Number(editId), newTotalMonths, Number(form.emiAmount), new Date(form.startDate).toISOString(), Number(form.emiDate));
            const newPending = allNew.filter(e=>e.monthNumber > paidCount);
            
            if(newPending.length>0){
              const newIds = await db.emiEntries.bulkAdd(newPending, { allKeys: true });
              const reminders: any[] = [];
              newPending.forEach((ent, idx)=>{
                const r = calculateReminders(
                  ent.dueDate,
                  Number(editId),
                  newIds[idx] as number,
                  reminderDays,
                  `EMI Due: ${form.lenderName.trim()}`,
                  `₹${ent.amount} EMI due on ${new Date(ent.dueDate).toLocaleDateString()} for ${form.lenderName.trim()} - Month ${ent.monthNumber}`
                );
                reminders.push(...r);
              });
              if(reminders.length) await db.reminders.bulkAdd(reminders);
            }

            if(newTotalMonths !== Number(form.totalMonths)){
              await db.loans.update(Number(editId), { totalMonths: newTotalMonths, totalAmount: Number(form.emiAmount)*newTotalMonths });
            }
          }
        } else if(existing.type==='onetime' && tab==='onetime'){
          if(existing.dueDate !== new Date(form.dueDate).toISOString()){
            await db.reminders.where('loanId').equals(Number(editId)).delete();
            const reminders = calculateReminders(
              new Date(form.dueDate).toISOString(),
              Number(editId),
              undefined,
              reminderDays,
              `Payment Due: ${form.lenderName.trim()}`,
              `₹${finalTotal} due on ${new Date(form.dueDate).toLocaleDateString()} to ${form.lenderName.trim()}`
            );
            if(reminders.length) await db.reminders.bulkAdd(reminders);
          }
        }

        await setSetting('defaultReminderDays', reminderDays);
        navigate(`/loans/${editId}`);
        return;
      }

      const loanBase: Loan = {
        type: tab,
        lenderName: form.lenderName.trim(),
        purpose: form.purpose.trim(),
        totalAmount: finalTotal,
        startDate: tab==='emi' ? new Date(form.startDate).toISOString() : new Date(form.borrowDate).toISOString(),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        emiAmount: tab==='emi' ? Number(form.emiAmount) : undefined,
        totalMonths: tab==='emi' ? Number(form.totalMonths) : undefined,
        emiDate: tab==='emi' ? Number(form.emiDate) : undefined,
        interestRate: tab==='emi' && form.interestRate ? Number(form.interestRate) : undefined,
        dueDate: tab==='onetime' ? new Date(form.dueDate).toISOString() : undefined
      };

      const loanId = await db.loans.add(loanBase);

      if(tab==='emi'){
        const entries = generateEMIEntries(loanId as number, Number(form.totalMonths), Number(form.emiAmount), new Date(form.startDate).toISOString(), Number(form.emiDate));
        const entryIds = await db.emiEntries.bulkAdd(entries, { allKeys: true });
        const reminders: any[] = [];
        entries.forEach((ent, idx)=>{
          const r = calculateReminders(
            ent.dueDate,
            loanId as number,
            entryIds[idx] as number,
            reminderDays,
            `EMI Due: ${loanBase.lenderName}`,
            `₹${ent.amount} EMI due on ${new Date(ent.dueDate).toLocaleDateString()} for ${loanBase.lenderName} - Month ${ent.monthNumber}`
          );
          reminders.push(...r);
        });
        if(reminders.length) await db.reminders.bulkAdd(reminders);
      } else {
        const reminders = calculateReminders(
          loanBase.dueDate!,
          loanId as number,
          undefined,
          reminderDays,
          `Payment Due: ${loanBase.lenderName}`,
          `₹${loanBase.totalAmount} due on ${new Date(loanBase.dueDate!).toLocaleDateString()} to ${loanBase.lenderName}`
        );
        if(reminders.length) await db.reminders.bulkAdd(reminders);
      }

      await setSetting('defaultReminderDays', reminderDays);
      navigate(`/loans/${loanId}`);
    }catch(err){
      console.error(err);
      alert('Error saving loan: '+err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-5">
      <div>
        <button onClick={()=>navigate(-1)} className="text-[13px] text-slate-400 hover:text-slate-200">← Back</button>
        <h1 className="text-[24px] font-bold tracking-tight mt-2">{editId ? 'Edit Loan' : 'Add New Loan'}</h1>
        <p className="text-[13px] text-slate-400">{editId ? 'Update loan details. Paid EMI history will be preserved.' : 'Add a new EMI or one-time loan. Total is auto-calculated.'}</p>
      </div>

      {!editId && (
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#1e293b] rounded-xl border border-[#334155]">
          <button onClick={()=>setTab('emi')} className={`py-2.5 rounded-lg text-[14px] font-medium transition-all ${tab==='emi' ? 'bg-[#3b82f6] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>EMI Loan</button>
          <button onClick={()=>setTab('onetime')} className={`py-2.5 rounded-lg text-[14px] font-medium transition-all ${tab==='onetime' ? 'bg-[#f59e0b] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>One-Time Loan</button>
        </div>
      )}

      <Card className="p-5 space-y-5">
        <Input label="Lender Name *" placeholder="e.g., HDFC Bank, Bajaj Finance" value={form.lenderName} onChange={e=>setForm({...form, lenderName:e.target.value})} error={errors.lenderName} />
        
        {tab==='emi' ? (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="EMI Amount *" type="number" placeholder="10000" value={form.emiAmount} onChange={e=>setForm({...form, emiAmount:e.target.value})} error={errors.emiAmount} />
              <Input label="Tenure (Months) *" type="number" placeholder="12" value={form.totalMonths} onChange={e=>setForm({...form, totalMonths:e.target.value})} error={errors.totalMonths} hint={form.totalMonths ? `${form.totalMonths} months = ${(Number(form.totalMonths)/12).toFixed(1)} years` : ''} />
            </div>

            <div className={`p-4 rounded-xl border-2 transition-all ${autoCalculated ? 'bg-[#22c55e]/10 border-[#22c55e]/50' : 'bg-[#0f172a] border-[#334155]'}`}>
              <label className="text-[13px] font-medium text-slate-300 flex items-center gap-2">
                Total Loan Amount (Auto) *
                {autoCalculated && <span className="text-[10px] bg-[#22c55e] text-white px-2 py-0.5 rounded-full animate-pulse">Auto Updated</span>}
              </label>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1">
                  <input
                    type="text"
                    readOnly
                    value={form.totalAmount ? formatCurrency(Number(form.totalAmount)) : '₹0'}
                    className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#22c55e]/30 rounded-xl text-[16px] font-bold text-[#22c55e] focus:outline-none"
                  />
                </div>
                <div className="text-[12px] text-slate-500 font-mono bg-[#1e293b] px-3 py-2 rounded-xl border border-[#334155]">
                  {form.emiAmount || 0} × {form.totalMonths || 0}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Calculated as EMI Amount × Tenure</p>
              {errors.totalAmount && <p className="text-[12px] text-[#ef4444] mt-1">{errors.totalAmount}</p>}
            </div>

            <Input label="Purpose (Optional)" placeholder="Home loan, personal loan" value={form.purpose} onChange={e=>setForm({...form, purpose:e.target.value})} />

            <div className="grid md:grid-cols-3 gap-4">
              <Input label="Start Date *" type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} error={errors.startDate} />
              <Input label="EMI Date (1-31) *" type="number" min="1" max="31" placeholder="5" value={form.emiDate} onChange={e=>setForm({...form, emiDate:e.target.value})} error={errors.emiDate} />
              <Input label="Interest Rate % (Optional)" type="number" step="0.01" placeholder="8.5" value={form.interestRate} onChange={e=>setForm({...form, interestRate:e.target.value})} />
            </div>

            {preview.length>0 && (
              <div className="bg-[#0f172a] rounded-xl p-4 border border-[#334155]/50">
                <h4 className="text-[13px] font-semibold mb-3">EMI Schedule Preview ({preview.length} of {form.totalMonths})</h4>
                <div className="space-y-2">
                  {preview.map((p,i)=>(
                    <div key={i} className="flex justify-between text-[12px] py-1.5 border-b border-[#1e293b] last:border-0">
                      <span className="text-slate-400">Month {p.monthNumber} • {new Date(p.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                      <span className="font-medium">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-3">{form.totalMonths} entries will be created as Pending</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Amount *" type="number" placeholder="2000" value={form.totalAmount} onChange={e=>setForm({...form, totalAmount:e.target.value})} error={errors.totalAmount} hint={form.totalAmount ? formatCurrency(Number(form.totalAmount)) : ''} />
              <Input label="Purpose (Optional)" placeholder="Emergency, personal" value={form.purpose} onChange={e=>setForm({...form, purpose:e.target.value})} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Borrow Date *" type="date" value={form.borrowDate} onChange={e=>setForm({...form, borrowDate:e.target.value})} />
              <Input label="Due Date *" type="date" value={form.dueDate} onChange={e=>setForm({...form, dueDate:e.target.value})} error={errors.dueDate} />
            </div>
            <Textarea label="Notes (Optional)" placeholder="Additional notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} />
          </>
        )}

        <div className="space-y-3 pt-2 border-t border-[#334155]/30">
          <label className="text-[13px] font-medium text-slate-300">Reminder Settings</label>
          <div className="flex flex-wrap gap-2">
            {[1,3,7,15].map(d=>(
              <button key={d} onClick={()=> setReminderDays(prev=> prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d])} className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${reminderDays.includes(d) ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#0f172a] text-slate-400 border-[#334155]'}`}>
                {d} day{d>1?'s':''} before {reminderDays.includes(d) ? '✓' : ''}
              </button>
            ))}
            <button onClick={()=>{
              const c = prompt('Custom days (comma separated, e.g., 2,5,10)');
              if(c){
                const nums = c.split(',').map(n=>parseInt(n.trim())).filter(n=>!isNaN(n)&&n>=0&&n<=365);
                if(nums.length) setReminderDays([...new Set([...reminderDays, ...nums])].sort((a,b)=>a-b));
              }
            }} className="px-3 py-1.5 rounded-full text-[12px] font-medium border bg-[#0f172a] text-slate-400 border-dashed border-[#475569]">+ Custom</button>
          </div>
          {reminderDays.length>0 && <p className="text-[11px] text-slate-500">{reminderDays.length} reminder(s): {reminderDays.sort((a,b)=>b-a).map(d=>`${d}d before`).join(', ')}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={()=>navigate(-1)}>Cancel</Button>
          <Button variant="primary" className="flex-1" loading={loading} onClick={handleSubmit}>{editId ? 'Update Loan' : 'Save Loan'}</Button>
        </div>
      </Card>
    </div>
  );
}
