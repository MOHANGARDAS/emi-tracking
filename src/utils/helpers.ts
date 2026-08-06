export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function isSameMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function isInNextNDays(dateStr: string, n: number): boolean {
  const due = new Date(dateStr);
  const now = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000*60*60*24);
  return diff >=0 && diff <= n;
}

export function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  due.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000*60*60*24));
  return diff;
}

export function generateEMIEntries(
  loanId: number,
  totalMonths: number,
  emiAmount: number,
  startDate: string,
  emiDate: number
) {
  const entries = [];
  const start = new Date(startDate);
  // EMI starts next month from startDate? according spec example 1 Jan start, first EMI 5 Feb.
  // Typically EMI is same month if emiDate > start day else next month.
  // Let's implement: first EMI = next month's emiDate from startDate month.
  for (let i=1;i<=totalMonths;i++){
    const due = new Date(start.getFullYear(), start.getMonth() + i, emiDate);
    // Fix for month overflow (e.g., Feb 31 -> Mar 3). Clamp to last day.
    if (due.getDate() !== emiDate) {
      // set to last day of that month
      due.setDate(0);
    }
    entries.push({
      loanId,
      monthNumber: i,
      dueDate: due.toISOString(),
      amount: emiAmount,
      status: 'pending' as const
    });
  }
  return entries;
}

export function calculateReminders(
  dueDateStr: string,
  loanId: number,
  emiEntryId: number | undefined,
  daysBeforeList: number[],
  title: string,
  message: string
) {
  const due = new Date(dueDateStr);
  return daysBeforeList.map(days => {
    const reminderDate = new Date(due);
    reminderDate.setDate(reminderDate.getDate() - days);
    return {
      loanId,
      emiEntryId,
      daysBefore: days,
      reminderDate: reminderDate.toISOString(),
      status: 'upcoming' as const,
      title,
      message
    };
  });
}

export function getStatusColor(status: string) {
  switch(status){
    case 'paid': case 'completed': case 'closed': return 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20';
    case 'overdue': return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20';
    case 'pending': case 'active': return 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20';
    case 'upcoming': return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
    default: return 'text-slate-400 bg-slate-800 border-slate-700';
  }
}

export function getDaysLabel(days: number) {
  if (days===0) return 'Today';
  if (days===1) return 'Tomorrow';
  if (days<0) return `${Math.abs(days)} days overdue`;
  return `${days} days left`;
}
