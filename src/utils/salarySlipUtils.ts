import { 
  Employee, StaffRole, Shift, AttendanceRecord, SalaryAdvance, 
  BorrowRecord, SalaryPayment, SalaryDeductionLedgerItem, InvoiceSettings 
} from '@/types';

export interface SalarySlipItem {
  id: string;
  date: string; // DD-MM-YYYY
  amount: number;
  reason: string;
  deductedOrRecovered: number | 'Detail not recorded';
  balanceOutstanding: number;
}

export interface SalarySlipData {
  lodgeName: string;
  month: string; // YYYY-MM
  monthFormatted: string; // e.g. "November 2026"
  printedDate: string; // DD-MM-YYYY
  isPaid: boolean;
  statusText: string; // "PAID" | "DRAFT - NOT YET PAID"
  
  // Employee Info (NO Aadhaar, NO phone, NO address)
  employeeName: string;
  roleName: string;
  shiftName: string;
  joiningDate: string; // DD-MM-YYYY or "-"

  // Attendance
  presentDays: number;
  absentDays: number;

  // Financials
  grossSalary: number;
  bfAdvances: number; // Brought forward advances
  bfBorrows: number;  // Brought forward borrows
  bfTotal: number;

  totalAdvanceDeducted: number;
  totalBorrowDeducted: number;
  totalDeductions: number;
  netPaid: number;
  paidOn: string; // DD-MM-YYYY or "-"
  paymentRef: string;
  note: string;

  cfAdvances: number; // Carried forward advances
  cfBorrows: number;  // Carried forward borrows
  cfTotal: number;

  // Tables
  advancesList: SalarySlipItem[];
  advancesTotalAmount: number;
  advancesTotalDeducted: number | 'Detail not recorded';
  advancesTotalBalance: number;

  borrowsList: SalarySlipItem[];
  borrowsTotalAmount: number;
  borrowsTotalRecovered: number | 'Detail not recorded';
  borrowsTotalBalance: number;
}

/**
 * Formats a YYYY-MM-DD or ISO string into DD-MM-YYYY
 */
export function formatIndianDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    // If format is YYYY-MM-DD
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats amount into Indian currency: ₹1,000
 */
export function formatIndianCurrency(amount: number): string {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * Formats a month string like '2026-11' into 'November 2026'
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr) return '';
  const [yearStr, monthNum] = monthStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthNum, 10) - 1;
  const d = new Date(y, m, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Compiles all data required for the monthly salary slip
 */
export function calculateSalarySlipData(params: {
  employee: Employee;
  month: string; // YYYY-MM
  staffRoles: StaffRole[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  salaryPayments: SalaryPayment[];
  salaryDeductionLedger?: SalaryDeductionLedgerItem[];
  invoiceSettings?: InvoiceSettings;
}): SalarySlipData {
  const {
    employee,
    month,
    staffRoles,
    shifts,
    attendance,
    salaryAdvances,
    borrows,
    salaryPayments,
    salaryDeductionLedger = [],
    invoiceSettings,
  } = params;

  const lodgeName = 'HOTEL MAULI GUEST HOUSE';
  const monthFormatted = formatMonthYear(month);
  const now = new Date();
  const printedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  const roleName = staffRoles.find(r => r.id === employee.roleId)?.name || 'Staff';
  const shiftObj = shifts.find(s => s.id === employee.shiftId);
  const shiftName = shiftObj ? `${shiftObj.name} (${shiftObj.startTime} - ${shiftObj.endTime})` : 'Standard';
  const joiningDate = formatIndianDate(employee.joiningDate);

  // Check if month is paid
  const payment = salaryPayments.find(
    p => p.employeeId === employee.id && p.month === month && !p.deleted_at
  ) || null;
  const isPaid = !!payment;
  const statusText = isPaid ? 'PAID' : 'DRAFT - NOT YET PAID';

  // Attendance
  const presentDays = attendance.filter(
    a => a.employeeId === employee.id && a.date.startsWith(month) && a.status === 'Present' && !a.deleted_at
  ).length;
  const absentDays = attendance.filter(
    a => a.employeeId === employee.id && a.date.startsWith(month) && a.status === 'Absent' && !a.deleted_at
  ).length;

  const monthStart = `${month}-01`;
  const [yearStr, monthNumStr] = month.split('-');
  const lastDayNum = new Date(parseInt(yearStr, 10), parseInt(monthNumStr, 10), 0).getDate();
  const monthEnd = `${month}-${String(lastDayNum).padStart(2, '0')}`;

  // Employee advances and borrows
  const empAdvances = salaryAdvances.filter(a => a.employeeId === employee.id && !a.deleted_at);
  const empBorrows = borrows.filter(b => b.employeeId === employee.id && !b.deleted_at);

  // Active ledger entries
  const activeLedger = salaryDeductionLedger.filter(l => !l.deleted_at);

  // Helper: Find prior payments for this employee
  const priorPayments = salaryPayments.filter(
    p => p.employeeId === employee.id && p.month < month && !p.deleted_at
  );
  const priorPaymentIds = new Set(priorPayments.map(p => p.id));

  // --- BROUGHT FORWARD CALCULATIONS (start of this month) ---
  // Prior advances: taken before monthStart
  const priorAdvances = empAdvances.filter(a => a.date < monthStart);
  let bfAdvances = 0;
  for (const pa of priorAdvances) {
    const priorDeductionsForAdv = activeLedger
      .filter(l => l.targetId === pa.id && l.targetType === 'advance' && priorPaymentIds.has(l.salaryPaymentId))
      .reduce((sum, l) => sum + l.amount, 0);
    const paBal = Math.max(0, pa.amount - priorDeductionsForAdv);
    bfAdvances += paBal;
  }

  // Prior borrows: taken before monthStart
  const priorBorrows = empBorrows.filter(b => b.date < monthStart);
  let bfBorrows = 0;
  for (const pb of priorBorrows) {
    const priorRepaymentsForBorrow = activeLedger
      .filter(l => l.targetId === pb.id && l.targetType === 'borrow' && priorPaymentIds.has(l.salaryPaymentId))
      .reduce((sum, l) => sum + l.amount, 0);
    const pbBal = Math.max(0, pb.amount - priorRepaymentsForBorrow);
    bfBorrows += pbBal;
  }
  const bfTotal = bfAdvances + bfBorrows;

  // --- THIS MONTH ENTRIES ---
  const currentMonthAdvances = empAdvances.filter(a => a.date >= monthStart && a.date <= monthEnd);
  const currentMonthBorrows = empBorrows.filter(b => b.date >= monthStart && b.date <= monthEnd);

  // Check ledger for this payment
  const currentPaymentLedger = payment 
    ? activeLedger.filter(l => l.salaryPaymentId === payment.id)
    : [];
  const paymentHasLedger = isPaid && currentPaymentLedger.length > 0;

  // --- COMPILE ADVANCES TABLE ITEMS ---
  const advancesList: SalarySlipItem[] = currentMonthAdvances.map(adv => {
    let deducted: number | 'Detail not recorded' = 0;
    if (isPaid) {
      if (paymentHasLedger) {
        const item = currentPaymentLedger.find(l => l.targetId === adv.id && l.targetType === 'advance');
        deducted = item ? item.amount : 0;
      } else {
        deducted = 'Detail not recorded';
      }
    } else {
      deducted = 0;
    }

    // Balance outstanding calculation
    let balance = adv.amount;
    if (isPaid) {
      if (paymentHasLedger) {
        const allDeductionsForAdv = activeLedger
          .filter(l => l.targetId === adv.id && l.targetType === 'advance')
          .reduce((sum, l) => sum + l.amount, 0);
        balance = Math.max(0, adv.amount - allDeductionsForAdv);
      } else {
        balance = Math.max(0, adv.amount - (adv.deducted_amount || 0));
      }
    } else {
      balance = Math.max(0, adv.amount - (adv.deducted_amount || 0));
    }

    return {
      id: adv.id,
      date: formatIndianDate(adv.date),
      amount: adv.amount,
      reason: adv.reason?.trim() ? adv.reason : '-',
      deductedOrRecovered: deducted,
      balanceOutstanding: balance,
    };
  });

  const advancesTotalAmount = advancesList.reduce((s, a) => s + a.amount, 0);
  const advancesTotalDeducted: number | 'Detail not recorded' = isPaid
    ? (paymentHasLedger 
        ? advancesList.reduce((s, a) => s + (typeof a.deductedOrRecovered === 'number' ? a.deductedOrRecovered : 0), 0)
        : (payment?.advance_deducted ?? 'Detail not recorded'))
    : 0;
  const advancesTotalBalance = advancesList.reduce((s, a) => s + a.balanceOutstanding, 0);

  // --- COMPILE BORROWS TABLE ITEMS ---
  const borrowsList: SalarySlipItem[] = currentMonthBorrows.map(b => {
    let recovered: number | 'Detail not recorded' = 0;
    if (isPaid) {
      if (paymentHasLedger) {
        const item = currentPaymentLedger.find(l => l.targetId === b.id && l.targetType === 'borrow');
        recovered = item ? item.amount : 0;
      } else {
        recovered = 'Detail not recorded';
      }
    } else {
      recovered = 0;
    }

    let balance = b.amount;
    if (isPaid) {
      if (paymentHasLedger) {
        const allRepaymentsForBorrow = activeLedger
          .filter(l => l.targetId === b.id && l.targetType === 'borrow')
          .reduce((sum, l) => sum + l.amount, 0);
        balance = Math.max(0, b.amount - allRepaymentsForBorrow);
      } else {
        balance = Math.max(0, b.amount - (b.repaid_amount || 0));
      }
    } else {
      balance = Math.max(0, b.amount - (b.repaid_amount || 0));
    }

    return {
      id: b.id,
      date: formatIndianDate(b.date),
      amount: b.amount,
      reason: b.reason?.trim() ? b.reason : '-',
      deductedOrRecovered: recovered,
      balanceOutstanding: balance,
    };
  });

  const borrowsTotalAmount = borrowsList.reduce((s, b) => s + b.amount, 0);
  const borrowsTotalRecovered: number | 'Detail not recorded' = isPaid
    ? (paymentHasLedger 
        ? borrowsList.reduce((s, b) => s + (typeof b.deductedOrRecovered === 'number' ? b.deductedOrRecovered : 0), 0)
        : (payment?.borrow_deducted ?? 'Detail not recorded'))
    : 0;
  const borrowsTotalBalance = borrowsList.reduce((s, b) => s + b.balanceOutstanding, 0);

  // --- SUMMARY FINANCIALS ---
  const grossSalary = payment ? payment.gross : employee.monthlySalary;
  const totalAdvanceDeducted = payment ? payment.advance_deducted : 0;
  const totalBorrowDeducted = payment ? payment.borrow_deducted : 0;
  const totalDeductions = totalAdvanceDeducted + totalBorrowDeducted;
  const netPaid = payment ? payment.net_paid : Math.max(0, grossSalary - totalDeductions);
  const paidOn = payment ? formatIndianDate(payment.paid_on) : '-';
  const paymentRef = payment?.payment_ref?.trim() ? payment.payment_ref : '-';
  const note = payment?.note?.trim() ? payment.note : '-';

  // --- CARRIED FORWARD CALCULATIONS (end of this month) ---
  let cfAdvances = 0;
  let cfBorrows = 0;

  if (isPaid) {
    // Advances up to this month end
    const eligibleAdvances = empAdvances.filter(a => a.date <= monthEnd);
    for (const ea of eligibleAdvances) {
      const allDeductionsForAdv = activeLedger
        .filter(l => l.targetId === ea.id && l.targetType === 'advance' && (l.salaryPaymentId === payment.id || priorPaymentIds.has(l.salaryPaymentId)))
        .reduce((sum, l) => sum + l.amount, 0);
      const rem = Math.max(0, ea.amount - allDeductionsForAdv);
      cfAdvances += rem;
    }

    const eligibleBorrows = empBorrows.filter(b => b.date <= monthEnd);
    for (const eb of eligibleBorrows) {
      const allRepaymentsForBorrow = activeLedger
        .filter(l => l.targetId === eb.id && l.targetType === 'borrow' && (l.salaryPaymentId === payment.id || priorPaymentIds.has(l.salaryPaymentId)))
        .reduce((sum, l) => sum + l.amount, 0);
      const rem = Math.max(0, eb.amount - allRepaymentsForBorrow);
      cfBorrows += rem;
    }
  } else {
    // Unpaid month: carried forward is brought forward + this month additions
    cfAdvances = bfAdvances + advancesTotalAmount;
    cfBorrows = bfBorrows + borrowsTotalAmount;
  }
  const cfTotal = cfAdvances + cfBorrows;

  return {
    lodgeName,
    month,
    monthFormatted,
    printedDate,
    isPaid,
    statusText,
    employeeName: employee.name,
    roleName,
    shiftName,
    joiningDate,
    presentDays,
    absentDays,
    grossSalary,
    bfAdvances,
    bfBorrows,
    bfTotal,
    totalAdvanceDeducted,
    totalBorrowDeducted,
    totalDeductions,
    netPaid,
    paidOn,
    paymentRef,
    note,
    cfAdvances,
    cfBorrows,
    cfTotal,
    advancesList,
    advancesTotalAmount,
    advancesTotalDeducted,
    advancesTotalBalance,
    borrowsList,
    borrowsTotalAmount,
    borrowsTotalRecovered,
    borrowsTotalBalance,
  };
}

/**
 * Generates clean, printer-friendly A4 HTML for the salary slip
 */
export function generateSalarySlipHtml(data: SalarySlipData): string {
  const isDraft = !data.isPaid;

  const formatTableCell = (val: number | 'Detail not recorded') => {
    if (typeof val === 'number') {
      return formatIndianCurrency(val);
    }
    return val;
  };

  return `
    <div class="salary-slip">
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .salary-slip {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #000000;
          background: #ffffff;
          line-height: 1.4;
          font-size: 11pt;
          width: 100%;
        }
        .slip-header {
          text-align: center;
          border-bottom: 2px solid #000000;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .slip-header h1 {
          font-size: 18pt;
          font-weight: 800;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .slip-title {
          font-size: 13pt;
          font-weight: 700;
          margin: 0;
          letter-spacing: 1px;
        }
        .slip-title.draft {
          color: #b91c1c;
        }
        .slip-meta-strip {
          display: flex;
          justify-content: space-between;
          font-size: 9.5pt;
          color: #333333;
          margin-top: 6px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          border: 1px solid #000000;
          padding: 10px 14px;
          margin-bottom: 14px;
          background: #ffffff;
        }
        .info-col p {
          margin: 3px 0;
          font-size: 10pt;
        }
        .info-label {
          font-weight: 700;
          color: #222222;
          display: inline-block;
          min-width: 110px;
        }
        .attendance-strip {
          border: 1px dashed #444444;
          padding: 6px 12px;
          font-size: 9.5pt;
          margin-bottom: 14px;
          background: #fafafa;
        }
        .attendance-strip strong {
          font-weight: 700;
        }
        .attendance-note {
          font-style: italic;
          color: #555555;
          margin-left: 6px;
        }
        .summary-card {
          border: 1.5px solid #000000;
          margin-bottom: 16px;
          background: #ffffff;
        }
        .summary-header {
          background: #f0f0f0;
          border-bottom: 1px solid #000000;
          padding: 6px 12px;
          font-weight: 700;
          font-size: 10.5pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-body {
          padding: 10px 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 10pt;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .summary-row.total {
          border-top: 1.5px solid #000000;
          margin-top: 4px;
          padding-top: 4px;
          font-weight: 800;
          font-size: 11pt;
        }
        .section-title {
          font-size: 11pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 14px 0 6px 0;
          border-bottom: 1px solid #000000;
          padding-bottom: 2px;
        }
        table.slip-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          page-break-inside: auto;
        }
        table.slip-table thead {
          display: table-header-group;
        }
        table.slip-table tfoot {
          display: table-footer-group;
        }
        table.slip-table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        table.slip-table th, table.slip-table td {
          border: 1px solid #444444;
          padding: 5px 8px;
          font-size: 9.5pt;
          text-align: left;
        }
        table.slip-table th {
          background-color: #f2f2f2;
          font-weight: 700;
          text-align: center;
        }
        table.slip-table td.text-right, table.slip-table th.text-right {
          text-align: right;
        }
        table.slip-table td.text-center, table.slip-table th.text-center {
          text-align: center;
        }
        table.slip-table tr.total-row td {
          font-weight: 800;
          background-color: #f9f9f9;
          border-top: 1.5px solid #000000;
        }
        table.slip-table td.empty-table-cell {
          text-align: center;
          padding: 12px;
          font-style: italic;
          color: #555555;
        }
        .forward-block {
          border: 1px solid #666666;
          padding: 8px 12px;
          margin-bottom: 14px;
          font-size: 9.5pt;
          background: #fafafa;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .forward-item span {
          display: block;
        }
        .signatures-area {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 40px;
          padding-top: 10px;
          page-break-inside: avoid;
        }
        .sig-box {
          width: 42%;
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #000000;
          margin-bottom: 4px;
        }
        .sig-title {
          font-weight: 700;
          font-size: 10pt;
        }
        .sig-sub {
          font-size: 9pt;
          color: #444444;
        }
      </style>

      <!-- 1. HEADER -->
      <div class="slip-header">
        <h1>${data.lodgeName}</h1>
        <div class="slip-title ${isDraft ? 'draft' : ''}">
          ${isDraft ? 'SALARY SLIP (DRAFT - NOT YET PAID)' : 'MONTHLY SALARY SLIP'}
        </div>
        <div class="slip-meta-strip">
          <span><strong>Month:</strong> ${data.monthFormatted}</span>
          <span><strong>Date Printed:</strong> ${data.printedDate}</span>
          <span><strong>Status:</strong> ${data.statusText}</span>
        </div>
      </div>

      <!-- 2. EMPLOYEE DETAILS -->
      <div class="info-grid">
        <div class="info-col">
          <p><span class="info-label">Employee Name:</span> <strong>${data.employeeName}</strong></p>
          <p><span class="info-label">Designation / Role:</span> ${data.roleName}</p>
        </div>
        <div class="info-col">
          <p><span class="info-label">Work Shift:</span> ${data.shiftName}</p>
          <p><span class="info-label">Joining Date:</span> ${data.joiningDate}</p>
        </div>
      </div>

      <!-- 3. ATTENDANCE (Informational Only) -->
      <div class="attendance-strip">
        <strong>Attendance this Month:</strong> 
        Present: <strong>${data.presentDays}</strong> days &nbsp;|&nbsp; 
        Absent: <strong>${data.absentDays}</strong> days
        <span class="attendance-note">(Informational only &mdash; attendance does not change monthly salary)</span>
      </div>

      <!-- 4. FINANCIAL SUMMARY & BALANCES -->
      <div class="summary-card">
        <div class="summary-header">Salary & Deductions Summary</div>
        <div class="summary-body">
          <div>
            <div class="summary-row">
              <span>Monthly Salary (Gross):</span>
              <strong>${formatIndianCurrency(data.grossSalary)}</strong>
            </div>
            <div class="summary-row">
              <span>Total Advances Deducted:</span>
              <span>${formatTableCell(data.totalAdvanceDeducted)}</span>
            </div>
            <div class="summary-row">
              <span>Total Borrow Deducted:</span>
              <span>${formatTableCell(data.totalBorrowDeducted)}</span>
            </div>
            <div class="summary-row total">
              <span>Total Deductions:</span>
              <span>${formatIndianCurrency(data.totalDeductions)}</span>
            </div>
          </div>

          <div>
            <div class="summary-row total">
              <span>Net Payable / Paid:</span>
              <span style="font-size: 13pt; color: ${isDraft ? '#b91c1c' : '#000000'};">
                ${formatIndianCurrency(data.netPaid)}
              </span>
            </div>
            <div class="summary-row">
              <span>Paid on Date:</span>
              <span>${data.paidOn}</span>
            </div>
            <div class="summary-row">
              <span>Payment Ref:</span>
              <span>${data.paymentRef}</span>
            </div>
            <div class="summary-row">
              <span>Payment Note:</span>
              <span>${data.note}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. BROUGHT FORWARD & CARRIED FORWARD -->
      <div class="forward-block">
        <div class="forward-item">
          <strong>Brought forward from earlier months:</strong>
          <span>Advances: ${formatIndianCurrency(data.bfAdvances)} &nbsp;|&nbsp; Borrows: ${formatIndianCurrency(data.bfBorrows)}</span>
          <span><strong>Total Brought Forward:</strong> ${formatIndianCurrency(data.bfTotal)}</span>
        </div>
        <div class="forward-item">
          <strong>Carried forward to next month:</strong>
          <span>Advances: ${formatIndianCurrency(data.cfAdvances)} &nbsp;|&nbsp; Borrows: ${formatIndianCurrency(data.cfBorrows)}</span>
          <span><strong>Total Carried Forward:</strong> ${formatIndianCurrency(data.cfTotal)}</span>
        </div>
      </div>

      <!-- 6. ADVANCES TABLE FOR THAT MONTH -->
      <div class="section-title">Advances for ${data.monthFormatted}</div>
      <table class="slip-table">
        <thead>
          <tr>
            <th style="width: 15%;">Date</th>
            <th class="text-right" style="width: 20%;">Advance Amount</th>
            <th style="width: 25%;">Reason / Purpose</th>
            <th class="text-right" style="width: 20%;">Deducted from Salary</th>
            <th class="text-right" style="width: 20%;">Balance Still Outstanding</th>
          </tr>
        </thead>
        <tbody>
          ${data.advancesList.length === 0 ? `
            <tr>
              <td colspan="5" class="empty-table-cell">None this month</td>
            </tr>
          ` : data.advancesList.map(a => `
            <tr>
              <td class="text-center">${a.date}</td>
              <td class="text-right">${formatIndianCurrency(a.amount)}</td>
              <td>${a.reason}</td>
              <td class="text-right">${formatTableCell(a.deductedOrRecovered)}</td>
              <td class="text-right">${formatIndianCurrency(a.balanceOutstanding)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td class="text-center">Total</td>
            <td class="text-right">${formatIndianCurrency(data.advancesTotalAmount)}</td>
            <td>-</td>
            <td class="text-right">${formatTableCell(data.advancesTotalDeducted)}</td>
            <td class="text-right">${formatIndianCurrency(data.advancesTotalBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 7. BORROWS TABLE FOR THAT MONTH -->
      <div class="section-title">Borrows for ${data.monthFormatted}</div>
      <table class="slip-table">
        <thead>
          <tr>
            <th style="width: 15%;">Date</th>
            <th class="text-right" style="width: 20%;">Borrow Amount</th>
            <th style="width: 25%;">Reason / Purpose</th>
            <th class="text-right" style="width: 20%;">Recovered from Salary</th>
            <th class="text-right" style="width: 20%;">Balance Still Outstanding</th>
          </tr>
        </thead>
        <tbody>
          ${data.borrowsList.length === 0 ? `
            <tr>
              <td colspan="5" class="empty-table-cell">None this month</td>
            </tr>
          ` : data.borrowsList.map(b => `
            <tr>
              <td class="text-center">${b.date}</td>
              <td class="text-right">${formatIndianCurrency(b.amount)}</td>
              <td>${b.reason}</td>
              <td class="text-right">${formatTableCell(b.deductedOrRecovered)}</td>
              <td class="text-right">${formatIndianCurrency(b.balanceOutstanding)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td class="text-center">Total</td>
            <td class="text-right">${formatIndianCurrency(data.borrowsTotalAmount)}</td>
            <td>-</td>
            <td class="text-right">${formatTableCell(data.borrowsTotalRecovered)}</td>
            <td class="text-right">${formatIndianCurrency(data.borrowsTotalBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 8. SIGNATURE LINES -->
      <div class="signatures-area">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Employee Signature</div>
          <div class="sig-sub">(${data.employeeName})</div>
        </div>

        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Manager / Owner Signature</div>
          <div class="sig-sub">(${data.lodgeName})</div>
        </div>
      </div>
    </div>
  `;
}
