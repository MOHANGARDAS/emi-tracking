import { db } from '@/db';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

export async function getFullBackup() {
  return {
    loans: await db.loans.toArray(),
    emiEntries: await db.emiEntries.toArray(),
    reminders: await db.reminders.toArray(),
    settings: await db.settings.toArray(),
    incomes: await db.incomes.toArray(),
    expenses: await db.expenses.toArray(),
    exportedAt: new Date().toISOString(),
    app: 'EMI_Tracker_Pro'
  };
}

export async function generateJSONBlob(): Promise<Blob> {
  const backup = await getFullBackup();
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}

export async function generateCSVBlob(): Promise<Blob> {
  const loans = await db.loans.toArray();
  const emiEntries = await db.emiEntries.toArray();
  const incomes = await db.incomes.toArray();
  const expenses = await db.expenses.toArray();
  let csv = 'Type,Lender,Purpose,TotalAmount,EMIAmount,TotalMonths,StartDate,DueDate,Status,InterestRate\n';
  loans.forEach(l => {
    csv += `${l.type},"${l.lenderName}","${l.purpose||''}",${l.totalAmount},${l.emiAmount||''},${l.totalMonths||''},${l.startDate},${l.dueDate||''},${l.status},${l.interestRate||''}\n`;
  });
  csv += '\n\nEMI Entries\nLoanId,Month,DueDate,Amount,Status,PaidDate,PaymentMode\n';
  emiEntries.forEach(e => {
    csv += `${e.loanId},${e.monthNumber},${e.dueDate},${e.amount},${e.status},${e.paidDate||''},${e.paymentMode||''}\n`;
  });
  csv += '\n\nIncomes\nID,Source,Category,Amount,Date,Notes\n';
  incomes.forEach(i => {
    csv += `${i.id},"${i.source}","${i.category}",${i.amount},${i.date},"${i.notes||''}"\n`;
  });
  csv += '\n\nExpenses\nID,Category,Vendor,Amount,Date,PaymentMode,Notes\n';
  expenses.forEach(e => {
    csv += `${e.id},"${e.category}","${e.vendor||''}",${e.amount},${e.date},${e.paymentMode||''},"${e.notes||''}"\n`;
  });
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export async function generateExcelBlob(): Promise<Blob> {
  const loans = await db.loans.toArray();
  const emiEntries = await db.emiEntries.toArray();
  const reminders = await db.reminders.toArray();
  const incomes = await db.incomes.toArray();
  const expenses = await db.expenses.toArray();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMI Tracker Pro';
  workbook.created = new Date();

  const loanSheet = workbook.addWorksheet('Loans');
  loanSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Lender', key: 'lenderName', width: 20 },
    { header: 'Purpose', key: 'purpose', width: 20 },
    { header: 'Total Amount', key: 'totalAmount', width: 15 },
    { header: 'EMI Amount', key: 'emiAmount', width: 15 },
    { header: 'Total Months', key: 'totalMonths', width: 12 },
    { header: 'EMI Date', key: 'emiDate', width: 10 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'Due Date', key: 'dueDate', width: 15 },
    { header: 'Interest', key: 'interestRate', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created', key: 'createdAt', width: 20 },
  ];
  loans.forEach(l => loanSheet.addRow(l));

  const emiSheet = workbook.addWorksheet('EMI Schedule');
  emiSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Loan ID', key: 'loanId', width: 10 },
    { header: 'Month #', key: 'monthNumber', width: 10 },
    { header: 'Due Date', key: 'dueDate', width: 15 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Paid Date', key: 'paidDate', width: 15 },
    { header: 'Payment Mode', key: 'paymentMode', width: 15 },
  ];
  emiEntries.forEach(e => emiSheet.addRow(e));

  const remSheet = workbook.addWorksheet('Reminders');
  remSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Loan ID', key: 'loanId', width: 10 },
    { header: 'EMI Entry ID', key: 'emiEntryId', width: 12 },
    { header: 'Days Before', key: 'daysBefore', width: 12 },
    { header: 'Reminder Date', key: 'reminderDate', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Title', key: 'title', width: 25 },
    { header: 'Message', key: 'message', width: 30 },
  ];
  reminders.forEach(r => remSheet.addRow(r));

  const incomeSheet = workbook.addWorksheet('Incomes');
  incomeSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Source', key: 'source', width: 20 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Created', key: 'createdAt', width: 20 },
  ];
  incomes.forEach(i => incomeSheet.addRow(i));

  const expenseSheet = workbook.addWorksheet('Expenses');
  expenseSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Payment Mode', key: 'paymentMode', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  expenses.forEach(e => expenseSheet.addRow(e));

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 30 },
  ];
  const totalOutstanding = loans.filter(l=>l.status==='active'||l.status==='overdue').reduce((s,l)=>s+l.totalAmount,0);
  const totalIncome = incomes.reduce((s,i)=>s+i.amount,0);
  const totalExpense = expenses.reduce((s,e)=>s+e.amount,0);
  summary.addRows([
    { metric: 'Total Loans', value: loans.length },
    { metric: 'Active Loans', value: loans.filter(l=>l.status==='active').length },
    { metric: 'Overdue Loans', value: loans.filter(l=>l.status==='overdue').length },
    { metric: 'Completed Loans', value: loans.filter(l=>l.status==='completed'||l.status==='closed').length },
    { metric: 'Total Outstanding', value: totalOutstanding },
    { metric: 'Total EMI Entries', value: emiEntries.length },
    { metric: 'Pending EMIs', value: emiEntries.filter(e=>e.status==='pending').length },
    { metric: 'Paid EMIs', value: emiEntries.filter(e=>e.status==='paid').length },
    { metric: 'Total Income', value: totalIncome },
    { metric: 'Total Expenses', value: totalExpense },
    { metric: 'Net Savings', value: totalIncome - totalExpense },
    { metric: 'Export Date', value: new Date().toISOString() },
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportJSON() {
  const blob = await generateJSONBlob();
  saveAs(blob, `EMI_Tracker_Latest.json`);
  const backup = await getFullBackup();
  return backup;
}

export async function exportCSV() {
  const blob = await generateCSVBlob();
  saveAs(blob, `EMI_Tracker_Latest.csv`);
}

export async function exportExcel() {
  const blob = await generateExcelBlob();
  saveAs(blob, `EMI_Tracker_Latest.xlsx`);
}

export async function restoreFromBackup(data: any) {
  await db.transaction('rw', [db.loans, db.emiEntries, db.reminders, db.settings, db.incomes, db.expenses], async () => {
    await db.loans.clear();
    await db.emiEntries.clear();
    await db.reminders.clear();
    if (data.settings) {
      await db.settings.clear();
      await db.settings.bulkAdd(data.settings);
    }
    if (data.loans) await db.loans.bulkAdd(data.loans);
    if (data.emiEntries) await db.emiEntries.bulkAdd(data.emiEntries);
    if (data.reminders) await db.reminders.bulkAdd(data.reminders);
    if (data.incomes) {
      await db.incomes.clear();
      await db.incomes.bulkAdd(data.incomes);
    }
    if (data.expenses) {
      await db.expenses.clear();
      await db.expenses.bulkAdd(data.expenses);
    }
  });
}
