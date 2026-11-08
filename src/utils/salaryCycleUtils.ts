/**
 * Salary Cycle and Attendance Calculation Utilities
 * 
 * Strict local-date arithmetic according to PRD:
 * - Each cycle starts on employee's joining day-of-month.
 * - Cycle end is the day before the next cycle start.
 * - Calculations performed in integer paise with round-half-up at deduction step.
 * - Local-date parsing without UTC timezone shifts.
 */

import { Employee, AttendanceRecord, SalaryPayment, SalaryAdvance, BorrowRecord, SalaryAdjustment } from '@/types';
import { toLocalDateString } from './dateUtils';

export interface SalaryCycle {
  id: string; // e.g. `${employeeId}_${cycleIndex}`
  employeeId: string;
  cycleIndex: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  nextPayoutDate: string; // YYYY-MM-DD (endDate + 1)
  cycleDays: number; // inclusive days
  status: 'Running' | 'Due' | 'Paid' | 'Reversed';
  paymentId?: string | null;
  payment?: SalaryPayment | null;
  hasAttendanceChangedAfter?: boolean;
}

export interface CycleAttendanceSummary {
  presentDays: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  notMarkedDays: number;
  deductedDays: number; // absent + unpaidLeave
  unmarkedDates: string[];
  deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave' }>;
}

export interface CycleFinancialSummary {
  monthlySalary: number;
  salaryUsed: number;
  cycleDays: number;
  perDayAmount: number;
  deductionAmount: number; // in rupees (rounded half up from paise)
  earnedAmount: number;    // salaryUsed - deductionAmount
  thisCycleAdvances: number;
  carriedForwardAdvanceIn: number;
  advanceDeducted: number;
  carriedForwardAdvanceOut: number;
  borrowRecoveryDeducted: number;
  adjustmentsAmount: number;
  netPayable: number;
}

/**
 * Returns the number of days in a given year and month (1-12)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formats YYYY, MM, DD into YYYY-MM-DD
 */
export function formatYYYYMMDD(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Formats YYYY-MM-DD into DD-MM-YYYY
 */
export function formatDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

/**
 * Parses YYYY-MM-DD into year, month (1-12), day
 */
export function parseYYYYMMDD(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Adds (or subtracts) days using local calendar arithmetic
 */
export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseYYYYMMDD(dateStr);
  const d = new Date(year, month - 1, day + days);
  return formatYYYYMMDD(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Calculates inclusive number of days between two YYYY-MM-DD dates
 */
export function diffDaysInclusive(startDate: string, endDate: string): number {
  const s = parseYYYYMMDD(startDate);
  const e = parseYYYYMMDD(endDate);
  const d1 = new Date(s.year, s.month - 1, s.day);
  const d2 = new Date(e.year, e.month - 1, e.day);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Computes the start and end dates for a specific cycle index k (0, 1, 2, ...)
 * based on the employee's joining date.
 * 
 * Rules:
 * - Start of cycle k = same day-of-month as joining day.
 * - If a month lacks that day, use that month's last day.
 * - Cycle end = day before the next cycle's start.
 */
export function getCycleStartAndEnd(
  joiningDate: string,
  cycleIndex: number
): { startDate: string; endDate: string; cycleDays: number; nextPayoutDate: string } {
  const { year: joinYear, month: joinMonth, day: joinDay } = parseYYYYMMDD(joiningDate);

  // Compute startDate of cycle k
  let startDate: string;
  if (cycleIndex === 0) {
    startDate = joiningDate;
  } else {
    const targetMonthTotal = (joinMonth - 1) + cycleIndex;
    const targetYear = joinYear + Math.floor(targetMonthTotal / 12);
    const targetMonth = (targetMonthTotal % 12) + 1;
    const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
    const startDay = Math.min(joinDay, daysInTargetMonth);
    startDate = formatYYYYMMDD(targetYear, targetMonth, startDay);
  }

  // Compute startDate of cycle k + 1
  const nextMonthTotal = (joinMonth - 1) + cycleIndex + 1;
  const nextYear = joinYear + Math.floor(nextMonthTotal / 12);
  const nextMonth = (nextMonthTotal % 12) + 1;
  const daysInNextMonth = getDaysInMonth(nextYear, nextMonth);
  const nextStartDay = Math.min(joinDay, daysInNextMonth);
  const nextStartDate = formatYYYYMMDD(nextYear, nextMonth, nextStartDay);

  // Cycle end is the day before next cycle's start
  const endDate = addDays(nextStartDate, -1);
  const cycleDays = diffDaysInclusive(startDate, endDate);
  const nextPayoutDate = nextStartDate;

  return { startDate, endDate, cycleDays, nextPayoutDate };
}

/**
 * Determines which cycle a transaction or attendance date belongs to.
 */
export function getCycleIndexForDate(joiningDate: string, dateStr: string): number | null {
  if (dateStr < joiningDate) return null; // Transaction cannot be before joining

  // Iterate from cycle 0 upwards
  let k = 0;
  while (k < 1000) { // Safety cap
    const { startDate, endDate } = getCycleStartAndEnd(joiningDate, k);
    if (dateStr >= startDate && dateStr <= endDate) {
      return k;
    }
    if (dateStr < startDate) {
      return k > 0 ? k - 1 : 0;
    }
    k++;
  }
  return 0;
}

/**
 * Generates all salary cycles for an employee from joiningDate up to today
 * (plus the active running cycle).
 */
export function generateEmployeeCycles(
  employee: Employee,
  asOfDateStr?: string,
  payments?: SalaryPayment[],
  attendanceRecords?: AttendanceRecord[]
): SalaryCycle[] {
  const joiningDate = employee.joiningDate;
  if (!joiningDate) return [];

  const todayStr = asOfDateStr || toLocalDateString();
  const activePayments = (payments || []).filter(
    p => p.employeeId === employee.id && !p.deleted_at
  );

  const cycles: SalaryCycle[] = [];
  let k = 0;

  // Generate cycles until the cycle containing today is reached
  while (true) {
    const { startDate, endDate, cycleDays, nextPayoutDate } = getCycleStartAndEnd(joiningDate, k);
    const cycleId = `${employee.id}_cycle_${k}`;

    // Find if a payment exists for this cycle
    const matchedPayment = activePayments.find(p => {
      // Check exact cycleStart/cycleEnd match or legacy month match
      if (p.cycleStart && p.cycleEnd) {
        return p.cycleStart === startDate && p.cycleEnd === endDate;
      }
      // Legacy payment month format: YYYY-MM
      return p.month === startDate.slice(0, 7);
    });

    let status: SalaryCycle['status'] = 'Running';
    if (matchedPayment) {
      status = matchedPayment.status === 'Reversed' ? 'Reversed' : 'Paid';
    } else if (todayStr > endDate) {
      status = 'Due';
    } else {
      status = 'Running';
    }

    // Check if attendance changed after payout
    let hasAttendanceChangedAfter = false;
    if (matchedPayment && matchedPayment.status === 'Paid' && attendanceRecords) {
      // Compare current cycle attendance with snapshot in payment
      const currentAttendance = calculateCycleAttendance(
        employee,
        { startDate, endDate, cycleDays },
        attendanceRecords,
        todayStr
      );
      if (
        matchedPayment.absentDays !== undefined &&
        (matchedPayment.absentDays !== currentAttendance.absentDays ||
         (matchedPayment.unpaidLeaveDays || 0) !== currentAttendance.unpaidLeaveDays)
      ) {
        hasAttendanceChangedAfter = true;
      }
    }

    cycles.push({
      id: cycleId,
      employeeId: employee.id,
      cycleIndex: k,
      startDate,
      endDate,
      nextPayoutDate,
      cycleDays,
      status,
      paymentId: matchedPayment?.id || null,
      payment: matchedPayment || null,
      hasAttendanceChangedAfter,
    });

    // If this cycle extends beyond today, stop
    if (todayStr <= endDate) {
      break;
    }

    k++;
    if (k > 200) break; // Defensive guard
  }

  return cycles;
}

/**
 * Calculates attendance counts for an employee within a cycle.
 * Unmarked is NEVER an absence.
 * "Not marked" counts only days from max(cycle start, joining date) to min(cycle end, today).
 */
export function calculateCycleAttendance(
  employee: Employee,
  cycle: Pick<SalaryCycle, 'startDate' | 'endDate' | 'cycleDays'>,
  attendanceRecords: AttendanceRecord[],
  todayStr?: string
): CycleAttendanceSummary {
  const today = todayStr || toLocalDateString();
  const empJoining = employee.joiningDate || cycle.startDate;

  // Evaluation bounds for unmarked days
  const effectiveStart = cycle.startDate < empJoining ? empJoining : cycle.startDate;
  const effectiveEnd = cycle.endDate > today ? today : cycle.endDate;

  // Filter records for this employee in this cycle date range
  const recordsMap = new Map<string, string>();
  for (const r of attendanceRecords) {
    if (r.employeeId === employee.id && !r.deleted_at && r.date >= cycle.startDate && r.date <= cycle.endDate) {
      recordsMap.set(r.date, r.status);
    }
  }

  let presentDays = 0;
  let absentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  const deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave' }> = [];
  const unmarkedDates: string[] = [];

  // Traverse all days in cycle
  let cur = cycle.startDate;
  while (cur <= cycle.endDate) {
    const status = recordsMap.get(cur);

    if (status === 'Present') {
      presentDays++;
    } else if (status === 'Absent') {
      absentDays++;
      deductedDates.push({ date: cur, type: 'Absent' });
    } else if (status === 'Paid Leave') {
      paidLeaveDays++;
    } else if (status === 'Unpaid Leave') {
      unpaidLeaveDays++;
      deductedDates.push({ date: cur, type: 'Unpaid Leave' });
    } else {
      // Unmarked: only count as "not marked" if within effectiveStart..effectiveEnd
      if (cur >= effectiveStart && cur <= effectiveEnd) {
        unmarkedDates.push(cur);
      }
    }

    cur = addDays(cur, 1);
  }

  return {
    presentDays,
    absentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    notMarkedDays: unmarkedDates.length,
    deductedDays: absentDays + unpaidLeaveDays,
    unmarkedDates,
    deductedDates,
  };
}

/**
 * Calculates complete salary financials in integer paise with round-half-up at deduction step.
 */
export function calculateCycleFinancials(
  monthlySalary: number,
  cycleDays: number,
  deductedDays: number,
  thisCycleAdvances: number,
  carriedForwardAdvanceIn: number,
  selectedBorrowRecovery: number,
  adjustmentsAmount: number
): CycleFinancialSummary {
  // Integer paise conversion
  const salaryInPaise = Math.round(monthlySalary * 100);

  // Deduction = round2(salary * (absent + unpaid leave) / cycle days)
  // Round half up: Math.round((salaryInPaise * deductedDays) / cycleDays)
  const deductionInPaise = cycleDays > 0 
    ? Math.round((salaryInPaise * deductedDays) / cycleDays)
    : 0;
  const deductionAmount = deductionInPaise / 100;

  // Earned = salary - deduction
  const earnedInPaise = Math.max(0, salaryInPaise - deductionInPaise);
  const earnedAmount = earnedInPaise / 100;

  // Advances deduction: this cycle's first, then carried forward
  const thisAdvPaise = Math.round(thisCycleAdvances * 100);
  const cfAdvInPaise = Math.round(carriedForwardAdvanceIn * 100);
  const totalAdvancesAvailablePaise = thisAdvPaise + cfAdvInPaise;

  const advanceDeductedPaise = Math.min(earnedInPaise, totalAdvancesAvailablePaise);
  const advanceDeducted = advanceDeductedPaise / 100;

  // Excess advance carries forward
  const cfAdvOutPaise = totalAdvancesAvailablePaise - advanceDeductedPaise;
  const carriedForwardAdvanceOut = cfAdvOutPaise / 100;

  // Remaining payable after advances
  const remainingAfterAdvancePaise = earnedInPaise - advanceDeductedPaise;

  // Selected borrow recovery (cannot exceed remaining payable)
  const requestedBorrowPaise = Math.round(selectedBorrowRecovery * 100);
  const borrowDeductedPaise = Math.min(remainingAfterAdvancePaise, requestedBorrowPaise);
  const borrowRecoveryDeducted = borrowDeductedPaise / 100;

  const remainingAfterBorrowPaise = remainingAfterAdvancePaise - borrowDeductedPaise;

  // Adjustments (+/-)
  const adjPaise = Math.round(adjustmentsAmount * 100);
  const netPayablePaise = Math.max(0, remainingAfterBorrowPaise + adjPaise);
  const netPayable = netPayablePaise / 100;

  const perDayAmount = cycleDays > 0 ? Math.round((monthlySalary / cycleDays) * 100) / 100 : 0;

  return {
    monthlySalary,
    salaryUsed: monthlySalary,
    cycleDays,
    perDayAmount,
    deductionAmount,
    earnedAmount,
    thisCycleAdvances,
    carriedForwardAdvanceIn,
    advanceDeducted,
    carriedForwardAdvanceOut,
    borrowRecoveryDeducted,
    adjustmentsAmount,
    netPayable,
  };
}

/**
 * Generates next sequential slip number: SLIP-YYYY-####
 */
export function generateSlipNumber(existingPayments: SalaryPayment[], year?: number): string {
  const targetYear = year || new Date().getFullYear();
  const prefix = `SLIP-${targetYear}-`;
  let maxSeq = 0;
  for (const p of existingPayments) {
    if (p.slipNumber && p.slipNumber.startsWith(prefix)) {
      const seqStr = p.slipNumber.slice(prefix.length);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

