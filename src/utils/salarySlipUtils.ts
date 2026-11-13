import {
  Employee, StaffRole, Shift, AttendanceRecord, SalaryAdvance,
  BorrowRecord, SalaryPayment, SalaryDeductionLedgerItem, InvoiceSettings, SalaryAdjustment
} from '@/types';
import {
  SalaryCycle, calculateCycleAttendance, calculateCycleFinancials,
  formatDDMMYYYY, getDaysInMonth, diffDaysInclusive, PAY_BASIS_DAYS, formatShiftLabel
} from './salaryCycleUtils';

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
  hotelAddress?: string;
  hotelPhone?: string;
  slipNumber: string; // e.g. SLIP-2026-0001 or "DRAFT"
  month: string; // YYYY-MM
  monthFormatted: string; // e.g. "November 2026" or "22-11-2026 to 21-12-2026"
  cycleStartFormatted: string; // DD-MM-YYYY
  cycleEndFormatted: string;   // DD-MM-YYYY
  cycleDays: number;
  printedDate: string; // DD-MM-YYYY
  isPaid: boolean;
  isReversed: boolean;
  statusText: string; // "PAID" | "DRAFT - NOT YET PAID" | "REVERSED"

  // Employee Info (NO Aadhaar, NO phone, NO address)
  employeeName: string;
  roleName: string;
  shiftName: string;
  joiningDate: string; // DD-MM-YYYY or "-"

  // Attendance
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;   // legacy slips only
  unpaidLeaveDays: number; // legacy slips only
  notMarkedDays: number;
  deductedDates: Array<{ date: string; type: 'Absent' | 'Half Day' | 'Unpaid Leave'; amount: number }>;

  // Financials
  grossSalary: number;
  salaryUsed: number;
  perDayAmount: number;
  /** 30 for the 30-day month basis; older slips used the cycle's day count. */
  payBasisDays: number;
  /** Debts deducted on this slip ("Debt carried forward from cycle #N"). */
  debtInLines: Array<{ label: string; amount: number }>;
  debtInTotal: number;
  /** Debt carried to the next cycle when the payable is negative. */
  debtOut: number;
  /** Signed payable (negative = debt). netPaid is never below 0. */
  payable: number;
  attendanceDeduction: number;
  earnedAmount: number;

  bfAdvances: number; // Brought forward advances
  bfBorrows: number;  // Brought forward borrows
  bfTotal: number;

  totalAdvanceDeducted: number;
  totalBorrowDeducted: number;
  adjustmentsTotal: number;
  adjustmentsList: Array<{ reason: string; amount: number }>;
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
  return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN')}`;
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
 * Compiles all data required for the salary slip (cycle or month)
 */
export function calculateSalarySlipData(params: {
  employee: Employee;
  cycle?: SalaryCycle;
  month?: string;
  staffRoles: StaffRole[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  salaryAdjustments?: SalaryAdjustment[];
  salaryPayments: SalaryPayment[];
  salaryDeductionLedger?: SalaryDeductionLedgerItem[];
  invoiceSettings?: InvoiceSettings;
}): SalarySlipData {
  const {
    employee,
    cycle,
    month: inputMonth,
    staffRoles,
    shifts,
    attendance,
    salaryAdvances,
    borrows,
    salaryAdjustments = [],
    salaryPayments,
    salaryDeductionLedger = [],
    invoiceSettings,
  } = params;

  const anySettings = (invoiceSettings || {}) as any;
  const lodgeName = anySettings.hotel_name || anySettings.hotelName || 'HOTEL MAULI GUEST HOUSE';
  const hotelAddress = anySettings.hotel_address || anySettings.address || 'Prop. J.R. Jaiswal';
  const hotelPhone = anySettings.hotel_phone || anySettings.phone || '9405694695';

  // Determine cycle dates
  let cycleStart = '';
  let cycleEnd = '';
  let cycleDays = 30;
  let cycleMonthStr = inputMonth || '';

  if (cycle) {
    cycleStart = cycle.startDate;
    cycleEnd = cycle.endDate;
    cycleDays = cycle.cycleDays;
    cycleMonthStr = cycle.startDate.slice(0, 7);
  } else if (inputMonth) {
    cycleStart = `${inputMonth}-01`;
    const [yStr, mStr] = inputMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const daysInM = getDaysInMonth(y, m);
    cycleEnd = `${inputMonth}-${String(daysInM).padStart(2, '0')}`;
    cycleDays = diffDaysInclusive(cycleStart, cycleEnd);
    cycleMonthStr = inputMonth;
  } else {
    const nowStr = new Date().toISOString().slice(0, 7);
    cycleMonthStr = nowStr;
    cycleStart = `${nowStr}-01`;
    cycleEnd = `${nowStr}-28`;
    cycleDays = 28;
  }

  const cycleStartFormatted = formatIndianDate(cycleStart);
  const cycleEndFormatted = formatIndianDate(cycleEnd);
  const monthFormatted = cycle
    ? `${cycleStartFormatted} to ${cycleEndFormatted}`
    : formatMonthYear(cycleMonthStr);

  const now = new Date();
  const printedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  const roleName = staffRoles.find(r => r.id === employee.roleId)?.name || 'Staff';
  const shiftObj = shifts.find(s => s.id === employee.shiftId);
  const shiftName = shiftObj ? formatShiftLabel(shiftObj) : 'Standard';
  const joiningDate = formatIndianDate(employee.joiningDate);

  // Match existing payment for this cycle/month
  const payment = cycle?.payment || salaryPayments.find(
    p => p.employeeId === employee.id && !p.deleted_at && (
      (p.cycleStart && p.cycleEnd && p.cycleStart === cycleStart && p.cycleEnd === cycleEnd) ||
      (!p.cycleStart && p.month === cycleMonthStr)
    )
  ) || null;

  const isReversed = payment?.status === 'Reversed';
  const isPaid = !!payment && !isReversed;
  const statusText = isReversed ? 'REVERSED' : (isPaid ? 'PAID' : 'DRAFT - NOT YET PAID');
  const slipNumber = payment?.slipNumber || (payment ? 'SLIP-PAID' : 'DRAFT');

  // Attendance & Deductions
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let notMarkedDays = 0;
  let deductedDates: SalarySlipData['deductedDates'] = [];
  let attendanceDeduction = 0;
  let grossSalary = employee.monthlySalary;
  let salaryUsed = employee.monthlySalary;
  let payBasisDays = PAY_BASIS_DAYS;
  let perDayAmount = Math.round((salaryUsed / PAY_BASIS_DAYS) * 100) / 100;
  let earnedAmount = salaryUsed;
  let draftDeductedDays = 0;

  if (payment) {
    // Snapshot from finalized payment
    grossSalary = payment.gross;
    salaryUsed = payment.salaryUsed || payment.gross;
    cycleDays = payment.cycleDays || cycleDays;
    // Snapshot basis: older slips divided by the cycle's day count.
    payBasisDays = payment.payBasisDays || cycleDays;
    perDayAmount = payment.perDay || (payBasisDays > 0 ? Math.round((salaryUsed / payBasisDays) * 100) / 100 : 0);
    presentDays = payment.presentDays ?? 0;
    absentDays = payment.absentDays ?? 0;
    halfDays = payment.halfDays ?? 0;
    paidLeaveDays = payment.paidLeaveDays ?? 0;
    unpaidLeaveDays = payment.unpaidLeaveDays ?? 0;
    notMarkedDays = payment.notMarkedDays ?? 0;
    deductedDates = payment.deductedDates || [];
    attendanceDeduction = payment.attendanceDeduction ?? 0;
    earnedAmount = payment.earnedAmount ?? Math.max(0, salaryUsed - attendanceDeduction);
  } else {
    // Live calculation for draft
    const attSummary = calculateCycleAttendance(
      employee,
      { startDate: cycleStart, endDate: cycleEnd, cycleDays },
      attendance
    );
    // Legacy Paid/Unpaid Leave are already folded into present/absent.
    presentDays = attSummary.presentDays;
    absentDays = attSummary.absentDays;
    halfDays = attSummary.halfDays;
    notMarkedDays = attSummary.notMarkedDays;
    draftDeductedDays = attSummary.deductedDays;
    deductedDates = attSummary.deductedDates.map(d => ({
      date: d.date,
      type: d.type,
      amount: Math.round(perDayAmount * d.weight * 100) / 100,
    }));
    const preview = calculateCycleFinancials(salaryUsed, cycleDays, draftDeductedDays, 0, 0, 0, 0);
    attendanceDeduction = preview.deductionAmount;
    earnedAmount = preview.earnedAmount;
  }

  // Advances & Borrows
  const empAdvances = salaryAdvances.filter(a => a.employeeId === employee.id && !a.deleted_at);
  const empBorrows = borrows.filter(b => b.employeeId === employee.id && !b.deleted_at);
  const activeLedger = salaryDeductionLedger.filter(l => !l.deleted_at);

  const priorPayments = salaryPayments.filter(
    p => p.employeeId === employee.id && !p.deleted_at && (
      (p.cycleEnd && p.cycleEnd < cycleStart) ||
      (!p.cycleEnd && p.month < cycleMonthStr)
    )
  );
  const priorPaymentIds = new Set(priorPayments.map(p => p.id));

  // Brought forward calculations (advances and borrows taken before cycleStart)
  const priorAdvances = empAdvances.filter(a => (a.transactionDate || a.date) < cycleStart);
  let bfAdvances = 0;
  for (const pa of priorAdvances) {
    const priorDeductionsForAdv = activeLedger
      .filter(l => l.targetId === pa.id && l.targetType === 'advance' && priorPaymentIds.has(l.salaryPaymentId))
      .reduce((sum, l) => sum + l.amount, 0);
    const paBal = Math.max(0, pa.amount - priorDeductionsForAdv);
    bfAdvances += paBal;
  }

  const priorBorrows = empBorrows.filter(b => (b.transactionDate || b.date) < cycleStart);
  let bfBorrows = 0;
  for (const pb of priorBorrows) {
    const priorRepaymentsForBorrow = activeLedger
      .filter(l => l.targetId === pb.id && l.targetType === 'borrow' && priorPaymentIds.has(l.salaryPaymentId))
      .reduce((sum, l) => sum + l.amount, 0);
    const pbBal = Math.max(0, pb.amount - priorRepaymentsForBorrow);
    bfBorrows += pbBal;
  }
  const bfTotal = bfAdvances + bfBorrows;

  // This cycle's advances & borrows (Debt records are listed separately as debt lines)
  const currentAdvances = empAdvances.filter(a => {
    const d = a.transactionDate || a.date;
    return a.kind !== 'debt' && d >= cycleStart && d <= cycleEnd;
  });
  const currentBorrows = empBorrows.filter(b => {
    const d = b.transactionDate || b.date;
    return d >= cycleStart && d <= cycleEnd;
  });

  const currentPaymentLedger = payment
    ? activeLedger.filter(l => l.salaryPaymentId === payment.id)
    : [];
  const paymentHasLedger = isPaid && currentPaymentLedger.length > 0;

  // Compile Advances Table
  const advancesList: SalarySlipItem[] = currentAdvances.map(adv => {
    let deducted: number | 'Detail not recorded' = 0;
    if (isPaid) {
      if (paymentHasLedger) {
        const item = currentPaymentLedger.find(l => l.targetId === adv.id && l.targetType === 'advance');
        deducted = item ? item.amount : 0;
      } else {
        deducted = adv.deducted_amount || adv.amount;
      }
    } else {
      deducted = 0;
    }

    let balance = adv.amount;
    if (isPaid) {
      balance = Math.max(0, adv.amount - (adv.deducted_amount || 0));
    } else {
      balance = adv.amount;
    }

    return {
      id: adv.id,
      date: formatIndianDate(adv.transactionDate || adv.date),
      amount: adv.amount,
      reason: adv.reason?.trim() ? adv.reason : '-',
      deductedOrRecovered: deducted,
      balanceOutstanding: balance,
    };
  });

  const advancesTotalAmount = advancesList.reduce((s, a) => s + a.amount, 0);
  const advancesTotalDeducted = isPaid ? (payment?.advance_deducted ?? advancesList.reduce((s, a) => s + (typeof a.deductedOrRecovered === 'number' ? a.deductedOrRecovered : 0), 0)) : 0;
  const advancesTotalBalance = advancesList.reduce((s, a) => s + a.balanceOutstanding, 0);

  // Compile Borrows Table
  const borrowsList: SalarySlipItem[] = currentBorrows.map(b => {
    let recovered: number | 'Detail not recorded' = 0;
    if (isPaid) {
      if (payment?.borrowRecoveries && payment.borrowRecoveries.length > 0) {
        const rec = payment.borrowRecoveries.find(r => r.borrowId === b.id);
        recovered = rec ? rec.amount : 0;
      } else if (paymentHasLedger) {
        const item = currentPaymentLedger.find(l => l.targetId === b.id && l.targetType === 'borrow');
        recovered = item ? item.amount : 0;
      } else {
        recovered = b.repaid_amount || 0;
      }
    } else {
      recovered = 0;
    }

    const balance = Math.max(0, b.amount - (b.repaid_amount || 0));

    return {
      id: b.id,
      date: formatIndianDate(b.transactionDate || b.date),
      amount: b.amount,
      reason: b.reason?.trim() ? b.reason : '-',
      deductedOrRecovered: recovered,
      balanceOutstanding: balance,
    };
  });

  const borrowsTotalAmount = borrowsList.reduce((s, b) => s + b.amount, 0);
  const borrowsTotalRecovered = isPaid ? (payment?.borrow_deducted ?? borrowsList.reduce((s, b) => s + (typeof b.deductedOrRecovered === 'number' ? b.deductedOrRecovered : 0), 0)) : 0;
  const borrowsTotalBalance = borrowsList.reduce((s, b) => s + b.balanceOutstanding, 0);

  // Adjustments & Final Amounts
  let totalAdvanceDeducted = 0;
  let totalBorrowDeducted = 0;
  let adjustmentsTotal = 0;
  let adjustmentsList: Array<{ reason: string; amount: number }> = [];
  let netPaid = 0;
  let paidOn = '-';
  let paymentRef = '-';
  let note = '-';
  let debtInLines: Array<{ label: string; amount: number }> = [];
  let debtInTotal = 0;
  let debtOut = 0;
  let payable = 0;

  if (payment) {
    // Slips on the 30-day basis store advances + debt in advance_deducted,
    // with the debt part itemised in debtInLines. Older slips have neither.
    debtInLines = (payment.debtInLines || []).map(l => ({ label: l.label, amount: l.amount }));
    debtInTotal = debtInLines.reduce((s, l) => s + l.amount, 0);
    debtOut = payment.payBasisDays ? Number(payment.carriedForwardAdvanceOut || 0) : 0;
    totalAdvanceDeducted = Math.max(0, (payment.advance_deducted || 0) - debtInTotal);
    totalBorrowDeducted = payment.borrow_deducted || 0;
    adjustmentsTotal = payment.adjustmentsTotal || 0;
    adjustmentsList = (payment.adjustmentsApplied || []).map(a => ({ reason: a.reason, amount: a.amount }));
    netPaid = payment.net_paid;
    payable = payment.payableAmount ?? payment.net_paid;
    paidOn = formatIndianDate(payment.paid_on);
    paymentRef = payment.payment_ref?.trim() ? payment.payment_ref : '-';
    note = payment.note?.trim() ? payment.note : '-';
  } else {
    // Debt brought in: open balances from earlier cycles (the existing
    // carry-forward), each listed on its own line.
    debtInLines = empAdvances
      .filter(a => a.status === 'Open' && (a.transactionDate || a.date) < cycleStart)
      .map(a => ({
        label: a.kind === 'debt'
          ? (a.reason || 'Debt carried forward')
          : `Advance brought forward (${formatIndianDate(a.transactionDate || a.date)})`,
        amount: Math.max(0, a.amount - (a.deducted_amount || 0)),
      }))
      .filter(l => l.amount > 0);
    debtInTotal = debtInLines.reduce((s, l) => s + l.amount, 0);

    // Draft financials
    const openAdjustments = salaryAdjustments.filter(
      a => a.employeeId === employee.id && a.status === 'Open' && !a.deleted_at
    );
    adjustmentsTotal = openAdjustments.reduce((sum, a) => sum + a.amount, 0);
    adjustmentsList = openAdjustments.map(a => ({ reason: a.reason, amount: a.amount }));

    const fin = calculateCycleFinancials(
      employee.monthlySalary,
      cycleDays,
      draftDeductedDays,
      advancesTotalAmount,
      debtInTotal,
      0, // borrows require explicit selection
      adjustmentsTotal
    );
    totalAdvanceDeducted = fin.thisCycleAdvances;
    totalBorrowDeducted = 0;
    netPaid = fin.netPayable;
    payable = fin.payable;
    debtOut = fin.carriedForwardAdvanceOut;
  }

  const totalDeductions = attendanceDeduction + totalAdvanceDeducted + debtInTotal + totalBorrowDeducted;

  // Carried forward calculations (end of this cycle)
  let cfAdvances = 0;
  let cfBorrows = 0;
  if (isPaid && payment) {
    const eligibleAdvances = empAdvances.filter(a => (a.transactionDate || a.date) <= cycleEnd);
    for (const ea of eligibleAdvances) {
      const allDeductionsForAdv = activeLedger
        .filter(l => l.targetId === ea.id && l.targetType === 'advance' && (l.salaryPaymentId === payment.id || priorPaymentIds.has(l.salaryPaymentId)))
        .reduce((sum, l) => sum + l.amount, 0);
      const rem = Math.max(0, ea.amount - allDeductionsForAdv);
      cfAdvances += rem;
    }

    const eligibleBorrows = empBorrows.filter(b => (b.transactionDate || b.date) <= cycleEnd);
    for (const eb of eligibleBorrows) {
      const allRepaymentsForBorrow = activeLedger
        .filter(l => l.targetId === eb.id && l.targetType === 'borrow' && (l.salaryPaymentId === payment.id || priorPaymentIds.has(l.salaryPaymentId)))
        .reduce((sum, l) => sum + l.amount, 0);
      const rem = Math.max(0, eb.amount - allRepaymentsForBorrow);
      cfBorrows += rem;
    }
  } else {
    cfAdvances = Math.max(0, bfAdvances + advancesTotalAmount - totalAdvanceDeducted);
    cfBorrows = Math.max(0, bfBorrows + borrowsTotalAmount - totalBorrowDeducted);
  }
  const cfTotal = cfAdvances + cfBorrows;

  return {
    lodgeName,
    hotelAddress,
    hotelPhone,
    slipNumber,
    month: cycleMonthStr,
    monthFormatted,
    cycleStartFormatted,
    cycleEndFormatted,
    cycleDays,
    printedDate,
    isPaid,
    isReversed,
    statusText,
    employeeName: employee.name,
    roleName,
    shiftName,
    joiningDate,
    presentDays,
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    notMarkedDays,
    deductedDates,
    grossSalary,
    salaryUsed,
    perDayAmount,
    payBasisDays,
    debtInLines,
    debtInTotal,
    debtOut,
    payable,
    attendanceDeduction,
    earnedAmount,
    bfAdvances,
    bfBorrows,
    bfTotal,
    totalAdvanceDeducted,
    totalBorrowDeducted,
    adjustmentsTotal,
    adjustmentsList,
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
  const isDraft = !data.isPaid && !data.isReversed;
  const isReversed = data.isReversed;

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
          font-size: 10.5pt;
          width: 100%;
          position: relative;
        }
        .slip-header {
          text-align: center;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .slip-header h1 {
          font-size: 17pt;
          font-weight: 800;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .hotel-sub {
          font-size: 9pt;
          color: #444444;
          margin-bottom: 6px;
        }
        .slip-title {
          font-size: 13pt;
          font-weight: 700;
          margin: 4px 0 0 0;
          letter-spacing: 1px;
        }
        .slip-title.draft {
          color: #b91c1c;
        }
        .slip-title.reversed {
          color: #dc2626;
        }
        .slip-meta-strip {
          display: flex;
          justify-content: space-between;
          font-size: 9pt;
          color: #333333;
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid #e0e0e0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          border: 1px solid #000000;
          padding: 8px 12px;
          margin-bottom: 12px;
          background: #ffffff;
        }
        .info-col p {
          margin: 2px 0;
          font-size: 9.5pt;
        }
        .info-label {
          font-weight: 700;
          color: #222222;
          display: inline-block;
          min-width: 110px;
        }
        .attendance-strip {
          border: 1px dashed #444444;
          padding: 6px 10px;
          font-size: 9pt;
          margin-bottom: 12px;
          background: #fafafa;
        }
        .attendance-strip strong {
          font-weight: 700;
        }
        .deductions-list {
          margin-top: 4px;
          font-size: 8.5pt;
          color: #b91c1c;
        }
        .summary-card {
          border: 1.5px solid #000000;
          margin-bottom: 14px;
          background: #ffffff;
        }
        .summary-header {
          background: #f0f0f0;
          border-bottom: 1px solid #000000;
          padding: 5px 12px;
          font-weight: 700;
          font-size: 10pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          justify-content: space-between;
        }
        .summary-body {
          padding: 8px 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          font-size: 9.5pt;
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
          font-size: 10.5pt;
        }
        .calc-formula-box {
          border: 1px solid #d0d0d0;
          background: #fdfdfd;
          padding: 6px 10px;
          font-size: 9pt;
          margin-bottom: 12px;
          border-radius: 4px;
        }
        .calc-formula-title {
          font-weight: 700;
          font-size: 8.5pt;
          color: #555555;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .calc-formula-math {
          font-family: monospace;
          font-weight: 600;
        }
        .section-title {
          font-size: 10pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 10px 0 4px 0;
          border-bottom: 1px solid #000000;
          padding-bottom: 2px;
        }
        table.slip-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
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
          padding: 4px 6px;
          font-size: 9pt;
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
          padding: 8px;
          font-style: italic;
          color: #555555;
        }
        .forward-block {
          border: 1px solid #666666;
          padding: 6px 10px;
          margin-bottom: 12px;
          font-size: 9pt;
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
          margin-top: 30px;
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
          font-size: 9.5pt;
        }
        .sig-sub {
          font-size: 8.5pt;
          color: #444444;
        }
        .watermark-reversed {
          position: absolute;
          top: 35%;
          left: 10%;
          right: 10%;
          text-align: center;
          font-size: 72pt;
          font-weight: 900;
          color: rgba(220, 38, 38, 0.18);
          transform: rotate(-25deg);
          text-transform: uppercase;
          letter-spacing: 10px;
          pointer-events: none;
          z-index: 999;
          border: 10px dashed rgba(220, 38, 38, 0.25);
          padding: 20px;
        }
      </style>

      ${isReversed ? `<div class="watermark-reversed">REVERSED</div>` : ''}

      <!-- 1. HEADER -->
      <div class="slip-header">
        <h1>${data.lodgeName}</h1>
        ${(data.hotelAddress || data.hotelPhone) ? `
          <div class="hotel-sub">
            ${data.hotelAddress ? `<span>${data.hotelAddress}</span>` : ''}
            ${(data.hotelAddress && data.hotelPhone) ? ` &bull; ` : ''}
            ${data.hotelPhone ? `<span>Phone: ${data.hotelPhone}</span>` : ''}
          </div>
        ` : ''}
        <div class="slip-title ${isDraft ? 'draft' : ''} ${isReversed ? 'reversed' : ''}">
          ${isDraft ? 'SALARY SLIP (DRAFT - NOT YET PAID)' : (isReversed ? 'SALARY SLIP (REVERSED)' : 'SALARY SLIP')}
        </div>
        <div class="slip-meta-strip">
          <span><strong>Slip No:</strong> ${data.slipNumber}</span>
          <span><strong>Cycle:</strong> ${data.monthFormatted} (${data.cycleDays} days)</span>
          <span><strong>Date Printed:</strong> ${data.printedDate}</span>
          <span><strong>Status:</strong> ${data.statusText}</span>
        </div>
      </div>

      <!-- 2. EMPLOYEE DETAILS (NO Aadhaar, NO phone, NO address) -->
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

      <!-- 3. ATTENDANCE BREAKDOWN -->
      <div class="attendance-strip">
        <div>
          <strong>Attendance (${data.cycleDays} Days in Cycle):</strong> 
          Present: <strong>${data.presentDays}</strong> &nbsp;|&nbsp; 
          Absent: <strong>${data.absentDays}</strong> &nbsp;|&nbsp;
          Half Day: <strong>${data.halfDays}</strong> &nbsp;|&nbsp;
          ${data.paidLeaveDays > 0 ? `Paid Leave: <strong>${data.paidLeaveDays}</strong> &nbsp;|&nbsp; ` : ''}
          ${data.unpaidLeaveDays > 0 ? `Unpaid Leave: <strong>${data.unpaidLeaveDays}</strong> &nbsp;|&nbsp; ` : ''}
          Not Marked: <strong>${data.notMarkedDays}</strong> (paid in full)
        </div>
        ${data.deductedDates && data.deductedDates.length > 0 ? `
          <div class="deductions-list">
            <strong>Deducted dates (${data.deductedDates.length} days @ ${formatIndianCurrency(data.perDayAmount)}/day${data.payBasisDays === 30 ? ', 30-day month basis, half day = 0.5' : ''}):</strong>
            ${data.deductedDates.map(d => `${formatIndianDate(d.date)} (${d.type})`).join(', ')}
            &mdash; Total Attendance Deduction: <strong>-${formatIndianCurrency(data.attendanceDeduction)}</strong>
          </div>
        ` : `
          <div style="font-size: 8.5pt; color: #166534; margin-top: 3px;">
            No attendance deductions for this cycle (100% full pay).
          </div>
        `}
      </div>

      <!-- 4. LINE-BY-LINE CALCULATION FORMULA -->
      <div class="calc-formula-box">
        <div class="calc-formula-title">Salary Calculation Breakdown</div>
        <div class="calc-formula-math">
          ${formatIndianCurrency(data.salaryUsed)} (Salary) 
          - ${formatIndianCurrency(data.attendanceDeduction)} (Attendance) 
          - ${formatIndianCurrency(data.totalAdvanceDeducted)} (Advance)
          ${data.debtInTotal > 0 ? `- ${formatIndianCurrency(data.debtInTotal)} (Debt brought in) ` : ''}
          ${data.adjustmentsTotal >= 0 ? `+ ${formatIndianCurrency(data.adjustmentsTotal)}` : `- ${formatIndianCurrency(Math.abs(data.adjustmentsTotal))}`} (Adjustments)
          - ${formatIndianCurrency(data.totalBorrowDeducted)} (Borrow)
          = <strong style="color: ${data.payable < 0 ? '#b91c1c' : 'inherit'};">${formatIndianCurrency(data.payable)}</strong>
          ${data.debtOut > 0 ? `&rarr; Net paid ${formatIndianCurrency(data.netPaid)}, debt of ${formatIndianCurrency(data.debtOut)} carried to next cycle` : ''}
        </div>
        ${data.payBasisDays === 30 ? `<div style="font-size: 8pt; color: #555; margin-top: 2px;">Per-day rate on a 30-day month basis: ${formatIndianCurrency(data.grossSalary)} &divide; 30 = ${formatIndianCurrency(data.perDayAmount)}/day.</div>` : ''}
      </div>

      <!-- 5. FINANCIAL SUMMARY & BALANCES -->
      <div class="summary-card">
        <div class="summary-header">
          <span>Financials Summary</span>
          <span>${data.cycleStartFormatted} &rarr; ${data.cycleEndFormatted}</span>
        </div>
        <div class="summary-body">
          <div>
            <div class="summary-row">
              <span>Monthly Salary (Gross):</span>
              <strong>${formatIndianCurrency(data.grossSalary)}</strong>
            </div>
            <div class="summary-row">
              <span>Per Day Rate:</span>
              <span>${formatIndianCurrency(data.perDayAmount)} / day${data.payBasisDays === 30 ? ' (monthly &divide; 30)' : ''}</span>
            </div>
            <div class="summary-row">
              <span>Attendance Deduction:</span>
              <span style="color: ${data.attendanceDeduction > 0 ? '#b91c1c' : 'inherit'};">
                ${data.attendanceDeduction > 0 ? `-${formatIndianCurrency(data.attendanceDeduction)}` : '₹0'}
              </span>
            </div>
            <div class="summary-row" style="border-top: 1px dashed #cccccc; margin-top: 3px; padding-top: 3px;">
              <span><strong>Earned Salary:</strong></span>
              <strong>${formatIndianCurrency(data.earnedAmount)}</strong>
            </div>
            <div class="summary-row">
              <span>Total Advances Deducted:</span>
              <span>${formatTableCell(data.totalAdvanceDeducted)}</span>
            </div>
            ${data.debtInLines.map(l => `
            <div class="summary-row">
              <span>${l.label}:</span>
              <span style="color: #b91c1c;">-${formatIndianCurrency(l.amount)}</span>
            </div>`).join('')}
            <div class="summary-row">
              <span>Total Borrow Deducted:</span>
              <span>${formatTableCell(data.totalBorrowDeducted)}</span>
            </div>
            <div class="summary-row">
              <span>Salary Adjustments:</span>
              <span>${data.adjustmentsTotal >= 0 ? `+${formatIndianCurrency(data.adjustmentsTotal)}` : `-${formatIndianCurrency(Math.abs(data.adjustmentsTotal))}`}</span>
            </div>
          </div>

          <div>
            <div class="summary-row total">
              <span>Net Payable / Paid:</span>
              <span style="font-size: 13pt; color: ${isDraft ? '#b91c1c' : (isReversed ? '#dc2626' : '#000000')};">
                ${formatIndianCurrency(data.netPaid)}
              </span>
            </div>
            ${data.debtOut > 0 ? `
            <div class="summary-row">
              <span>Payable before debt:</span>
              <strong style="color: #b91c1c;">${formatIndianCurrency(data.payable)}</strong>
            </div>
            <div class="summary-row">
              <span>Debt carried to next cycle:</span>
              <strong style="color: #b91c1c;">${formatIndianCurrency(data.debtOut)}</strong>
            </div>` : ''}
            <div class="summary-row">
              <span>Payment Status:</span>
              <strong>${data.statusText}</strong>
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

      <!-- 6. BROUGHT FORWARD & CARRIED FORWARD -->
      <div class="forward-block">
        <div class="forward-item">
          <strong>Brought forward from earlier cycles:</strong>
          <span>Advances: ${formatIndianCurrency(data.bfAdvances)} &nbsp;|&nbsp; Borrows: ${formatIndianCurrency(data.bfBorrows)}</span>
          <span><strong>Total Brought Forward:</strong> ${formatIndianCurrency(data.bfTotal)}</span>
        </div>
        <div class="forward-item">
          <strong>Carried forward to next cycle:</strong>
          <span>Advances: ${formatIndianCurrency(data.cfAdvances)} &nbsp;|&nbsp; Borrows: ${formatIndianCurrency(data.cfBorrows)}</span>
          <span><strong>Total Carried Forward:</strong> ${formatIndianCurrency(data.cfTotal)}</span>
        </div>
      </div>

      <!-- 7. ADVANCES TABLE FOR THAT CYCLE -->
      <div class="section-title">Advances in Cycle (${data.monthFormatted})</div>
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
              <td colspan="5" class="empty-table-cell">None in this cycle</td>
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

      <!-- 8. BORROWS TABLE FOR THAT CYCLE -->
      <div class="section-title">Borrows in Cycle (${data.monthFormatted})</div>
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
              <td colspan="5" class="empty-table-cell">None in this cycle</td>
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

      ${data.adjustmentsList && data.adjustmentsList.length > 0 ? `
        <!-- 9. ADJUSTMENTS TABLE -->
        <div class="section-title">Salary Adjustments Applied</div>
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width: 70%;">Reason</th>
              <th class="text-right" style="width: 30%;">Adjustment Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.adjustmentsList.map(adj => `
              <tr>
                <td>${adj.reason}</td>
                <td class="text-right">${adj.amount >= 0 ? `+${formatIndianCurrency(adj.amount)}` : `-${formatIndianCurrency(Math.abs(adj.amount))}`}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td>Total Adjustments</td>
              <td class="text-right">${data.adjustmentsTotal >= 0 ? `+${formatIndianCurrency(data.adjustmentsTotal)}` : `-${formatIndianCurrency(Math.abs(data.adjustmentsTotal))}`}</td>
            </tr>
          </tfoot>
        </table>
      ` : ''}

      <!-- 10. SIGNATURE LINES -->
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
