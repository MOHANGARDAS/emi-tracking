export type LoanType = 'emi' | 'onetime';
export type LoanStatus = 'active' | 'completed' | 'overdue' | 'closed';
export type EMIStatus = 'pending' | 'paid' | 'overdue';
export type ReminderStatus = 'upcoming' | 'sent' | 'acknowledged';

export interface Loan {
  id?: number;
  type: LoanType;
  lenderName: string;
  purpose?: string;
  totalAmount: number;
  emiAmount?: number;
  emiDate?: number; // 1-31
  totalMonths?: number;
  startDate: string; // ISO
  dueDate?: string; // for onetime
  interestRate?: number;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EMIEntry {
  id?: number;
  loanId: number;
  monthNumber: number;
  dueDate: string;
  amount: number;
  status: EMIStatus;
  paidDate?: string;
  paymentMode?: string;
  notes?: string;
}

export interface Reminder {
  id?: number;
  loanId?: number;
  emiEntryId?: number;
  daysBefore: number;
  reminderDate: string;
  status: ReminderStatus;
  title: string;
  message: string;
}

export interface AppSettings {
  id?: number;
  key: string;
  value: any;
}

export interface Income {
  id?: number;
  amount: number;
  source: string;
  category: string;
  date: string; // ISO
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id?: number;
  amount: number;
  category: string;
  vendor?: string;
  date: string;
  paymentMode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  activeLoansCount: number;
  totalOutstanding: number;
  thisMonthDue: number;
  upcoming7Days: number;
  overdueCount: number;
  monthlyEMI: number;
}

export interface ExportData {
  loans: Loan[];
  emiEntries: EMIEntry[];
  reminders: Reminder[];
  incomes?: Income[];
  expenses?: Expense[];
  exportedAt: string;
}
