import Dexie, { Table } from 'dexie';
import { Loan, EMIEntry, Reminder, AppSettings, Income, Expense } from '@/types';

export class EMIDatabase extends Dexie {
  loans!: Table<Loan>;
  emiEntries!: Table<EMIEntry>;
  reminders!: Table<Reminder>;
  settings!: Table<AppSettings>;
  incomes!: Table<Income>;
  expenses!: Table<Expense>;

  constructor() {
    super('EMITrackerProDB');
    this.version(1).stores({
      loans: '++id, type, lenderName, status, createdAt',
      emiEntries: '++id, loanId, dueDate, status, monthNumber',
      reminders: '++id, loanId, emiEntryId, reminderDate, status',
      settings: '++id, &key'
    });
    this.version(2).stores({
      loans: '++id, type, lenderName, status, createdAt',
      emiEntries: '++id, loanId, dueDate, status, monthNumber',
      reminders: '++id, loanId, emiEntryId, reminderDate, status',
      settings: '++id, &key',
      incomes: '++id, date, category, source, createdAt',
      expenses: '++id, date, category, vendor, createdAt'
    });
  }
}

export const db = new EMIDatabase();

export async function getSetting(key: string, defaultValue: any = null) {
  const s = await db.settings.where('key').equals(key).first();
  return s ? s.value : defaultValue;
}

export async function setSetting(key: string, value: any) {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing?.id) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

export async function refreshOverdueStatus() {
  const today = new Date();
  today.setHours(0,0,0,0);

  const pendingEntries = await db.emiEntries.where('status').equals('pending').toArray();
  for (const entry of pendingEntries) {
    const due = new Date(entry.dueDate);
    due.setHours(0,0,0,0);
    if (due < today) {
      await db.emiEntries.update(entry.id!, { status: 'overdue' });
    }
  }

  const activeOneTime = await db.loans.where({ type: 'onetime', status: 'active' }).toArray();
  for (const loan of activeOneTime) {
    if (loan.dueDate) {
      const due = new Date(loan.dueDate);
      due.setHours(0,0,0,0);
      if (due < today) {
        await db.loans.update(loan.id!, { status: 'overdue', updatedAt: new Date().toISOString() });
      }
    }
  }

  const activeEmi = await db.loans.where({ type: 'emi', status: 'active' }).toArray();
  for (const loan of activeEmi) {
    const overdueCount = await db.emiEntries.where({ loanId: loan.id!, status: 'overdue' }).count();
    if (overdueCount > 0) {
      await db.loans.update(loan.id!, { status: 'overdue', updatedAt: new Date().toISOString() });
    }
  }
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
}

export function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
}
