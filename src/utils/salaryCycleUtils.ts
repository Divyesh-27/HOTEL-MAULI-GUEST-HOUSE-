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
  /** First cycle after a joining-date change (or cut short by a stored paid cycle): paid by days. */
  isTransition?: boolean;
}

export interface CycleAttendanceSummary {
  /** Marked Present + legacy Paid Leave + unmarked past/current days (present by default). */
  presentDays: number;
  /** Unmarked past/current days counted as Present (derived, never stored). */
  defaultPresentDays: number;
  absentDays: number;      // Absent (+ legacy Unpaid Leave)
  halfDays: number;
  /** absent + 0.5 x half days: the days the salary is reduced by */
  deductedDays: number;
  /** Legacy records in this cycle, already counted in present/absent above. */
  legacyPaidLeaveDays: number;
  legacyUnpaidLeaveDays: number;
  deductedDates: Array<{ date: string; type: 'Absent' | 'Half Day' | 'Unpaid Leave'; weight: number }>;
}

export interface CycleFinancialSummary {
  monthlySalary: number;
  salaryUsed: number;
  cycleDays: number;
  /** Always 30: a month counts as 30 days for pay, whatever the cycle length. */
  payBasisDays: number;
  perDayAmount: number;    // monthly / 30
  deductionAmount: number; // round2(monthly x deductedDays / 30), capped at monthly
  earnedAmount: number;    // salary - deduction
  thisCycleAdvances: number;
  /** Debt brought in (open advance/debt balances from earlier cycles). */
  carriedForwardAdvanceIn: number;
  /** Advances + debt brought in: all of it is settled against this payable. */
  advanceDeducted: number;
  /** New debt carried to the next cycle (= -payable when payable is negative). */
  carriedForwardAdvanceOut: number;
  borrowRecoveryDeducted: number;
  adjustmentsAmount: number;
  /** Signed payable. Negative means the employee owes the difference. */
  payable: number;
  /** Amount actually paid out: max(0, payable). */
  netPayable: number;
}

/** Rupee amount with the sign in front: -₹2,000 */
export const formatRs = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(Number(n) || 0).toLocaleString('en-IN')}`;

/** A month counts as 30 days for pay in every cycle. */
export const PAY_BASIS_DAYS = 30;

export type AttendanceMark = 'Present' | 'Absent' | 'Half Day';

/**
 * Legacy statuses mapped by money effect: Paid Leave = Present,
 * Unpaid Leave = Absent. Stored records are never rewritten.
 */
export function normalizeAttendanceStatus(status?: string | null): AttendanceMark | null {
  if (status === 'Present' || status === 'Paid Leave') return 'Present';
  if (status === 'Absent' || status === 'Unpaid Leave') return 'Absent';
  if (status === 'Half Day') return 'Half Day';
  return null;
}

/** Days of pay lost for one attendance status (Absent 1, Half Day 0.5, otherwise 0). */
export function attendanceWeight(status?: string | null): number {
  const n = normalizeAttendanceStatus(status);
  return n === 'Absent' ? 1 : n === 'Half Day' ? 0.5 : 0;
}

/** "22:00" -> "10:00 PM". Returns the input unchanged if it isn't HH:mm. */
export function formatTime12h(hhmm?: string | null): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** True when a shift ends on the next day (e.g. 10:00 PM - 6:00 AM). */
export function isOvernightShift(start?: string | null, end?: string | null): boolean {
  return !!start && !!end && end <= start;
}

/** "Night (10:00 PM - 6:00 AM, overnight)"; name only if no times. */
export function formatShiftLabel(shift?: { name: string; startTime?: string; endTime?: string } | null): string {
  if (!shift) return 'Regular';
  if (!shift.startTime || !shift.endTime) return shift.name;
  const overnight = isOvernightShift(shift.startTime, shift.endTime) ? ', overnight' : '';
  return `${shift.name} (${formatTime12h(shift.startTime)} - ${formatTime12h(shift.endTime)}${overnight})`;
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

/** Next date strictly after `afterDate` that falls on the joining day-of-month (clamped to month length). */
export function nextJoiningDayAfter(joiningDate: string, afterDate: string): string {
  const joinDay = parseYYYYMMDD(joiningDate).day;
  let { year, month } = parseYYYYMMDD(afterDate);
  for (let i = 0; i < 3; i++) {
    const candidate = formatYYYYMMDD(year, month, Math.min(joinDay, getDaysInMonth(year, month)));
    if (candidate > afterDate) return candidate;
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return addDays(afterDate, 1); // not reachable
}

/** True if `date` is a cycle boundary for this joining date (the joining date or its day-of-month, clamped). */
export function isJoiningDayBoundary(joiningDate: string, date: string): boolean {
  if (date === joiningDate) return true;
  const joinDay = parseYYYYMMDD(joiningDate).day;
  const { year, month, day } = parseYYYYMMDD(date);
  return day === Math.min(joinDay, getDaysInMonth(year, month));
}

/**
 * Gross salary for a cycle. A transition cycle (after a joining-date change)
 * is paid by days: min(monthly, round2(monthly x days / 30)).
 */
export function cycleGrossSalary(monthlySalary: number, cycle: Pick<SalaryCycle, 'cycleDays' | 'isTransition'>): number {
  if (!cycle.isTransition) return monthlySalary;
  const byDays = Math.round((Math.round(monthlySalary * 100) * cycle.cycleDays) / PAY_BASIS_DAYS) / 100;
  return Math.min(monthlySalary, byDays);
}

/** Paid snapshot vs current attendance, by money effect only (default-present days never count). */
function changedAfterPayout(
  employee: Employee,
  cycle: Pick<SalaryCycle, 'startDate' | 'endDate' | 'cycleDays'>,
  payment: SalaryPayment | null | undefined,
  attendanceRecords: AttendanceRecord[] | undefined,
  todayStr: string
): boolean {
  if (!payment || payment.status !== 'Paid' || !attendanceRecords || payment.absentDays === undefined) return false;
  const current = calculateCycleAttendance(employee, cycle, attendanceRecords, todayStr);
  // Older snapshots counted Unpaid Leave separately and had no half days.
  return (payment.absentDays + (payment.unpaidLeaveDays || 0)) !== current.absentDays ||
    (payment.halfDays || 0) !== current.halfDays;
}

/**
 * Generates all salary cycles for an employee from joiningDate up to today
 * (plus the active running cycle).
 *
 * With paid payouts that store their cycle dates, those payouts are fixed:
 * each paid cycle keeps its stored dates, and later cycles continue from the
 * day after the last paid cycle, following the (possibly changed) joining day.
 * A cycle that does not start on a joining-day boundary, or is cut short by a
 * stored paid cycle, is a transition cycle paid by days.
 * With no such payouts, cycles are generated exactly as before.
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

  const anchors = activePayments
    .filter(p => p.status !== 'Reversed' && p.cycleStart && p.cycleEnd)
    .sort((a, b) => (a.cycleStart as string).localeCompare(b.cycleStart as string));

  if (anchors.length > 0) {
    return generateAnchoredCycles(employee, todayStr, activePayments, anchors, attendanceRecords);
  }

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
      // Compare by money effect: older snapshots counted Unpaid Leave
      // separately and had no half days.
      if (
        matchedPayment.absentDays !== undefined &&
        ((matchedPayment.absentDays + (matchedPayment.unpaidLeaveDays || 0)) !== currentAttendance.absentDays ||
         (matchedPayment.halfDays || 0) !== currentAttendance.halfDays)
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

/** Cycle generation when paid payouts with stored dates exist (see generateEmployeeCycles). */
function generateAnchoredCycles(
  employee: Employee,
  todayStr: string,
  activePayments: SalaryPayment[],
  anchors: SalaryPayment[],
  attendanceRecords: AttendanceRecord[] | undefined
): SalaryCycle[] {
  const joiningDate = employee.joiningDate;
  const firstStart = anchors[0].cycleStart as string;
  let cursor = firstStart < joiningDate ? firstStart : joiningDate;
  // Former staff: nothing after their last working day
  const stopAfter = employee.status === 'inactive' && employee.lastWorkingDate ? employee.lastWorkingDate : null;

  const cycles: SalaryCycle[] = [];
  for (let k = 0; k <= 200; k++) {
    const stored = anchors.find(a => (a.cycleStart as string) <= cursor && cursor <= (a.cycleEnd as string));
    let startDate: string;
    let endDate: string;
    let payment: SalaryPayment | null = null;
    let isTransition = false;

    if (stored) {
      // Paid cycle: stored dates and numbers, never recomputed
      startDate = stored.cycleStart as string;
      endDate = stored.cycleEnd as string;
      payment = stored;
    } else {
      startDate = cursor;
      endDate = addDays(nextJoiningDayAfter(joiningDate, cursor), -1);
      const nextStored = anchors.find(a => (a.cycleStart as string) > cursor);
      let clipped = false;
      if (nextStored && endDate >= (nextStored.cycleStart as string)) {
        endDate = addDays(nextStored.cycleStart as string, -1);
        clipped = true;
      }
      isTransition = clipped || !isJoiningDayBoundary(joiningDate, startDate);
      // Reversed or legacy (month-only) payments, matched by their stored data
      payment = activePayments.find(p =>
        (p.cycleStart && p.cycleEnd) ? (p.cycleStart === startDate && p.cycleEnd === endDate) : p.month === startDate.slice(0, 7)
      ) || null;
    }

    const cycleDays = diffDaysInclusive(startDate, endDate);
    let status: SalaryCycle['status'];
    if (payment) status = payment.status === 'Reversed' ? 'Reversed' : 'Paid';
    else status = todayStr > endDate ? 'Due' : 'Running';

    cycles.push({
      id: `${employee.id}_cycle_${k}`,
      employeeId: employee.id,
      cycleIndex: k,
      startDate,
      endDate,
      nextPayoutDate: addDays(endDate, 1),
      cycleDays,
      status,
      paymentId: payment?.id || null,
      payment,
      hasAttendanceChangedAfter: changedAfterPayout(employee, { startDate, endDate, cycleDays }, payment, attendanceRecords, todayStr),
      isTransition: isTransition || !!payment?.isTransitionCycle,
    });

    if (todayStr <= endDate) break;
    cursor = addDays(endDate, 1);
    if (stopAfter && cursor > stopAfter) break;
  }
  return cycles;
}

/**
 * Calculates attendance counts for an employee within a cycle.
 * Every day is a working day (no weekly offs). Unmarked days from max(cycle
 * start, joining date) to min(cycle end, today) count as Present by default;
 * only explicitly marked Absent / Half Day reduce pay.
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
  let halfDays = 0;
  let legacyPaidLeaveDays = 0;
  let legacyUnpaidLeaveDays = 0;
  let defaultPresentDays = 0;
  const deductedDates: CycleAttendanceSummary['deductedDates'] = [];

  // Traverse all days in cycle
  let cur = cycle.startDate;
  while (cur <= cycle.endDate) {
    const raw = recordsMap.get(cur);
    const status = normalizeAttendanceStatus(raw);
    if (raw === 'Paid Leave') legacyPaidLeaveDays++;
    if (raw === 'Unpaid Leave') legacyUnpaidLeaveDays++;

    if (status === 'Present') {
      presentDays++;
    } else if (status === 'Absent') {
      absentDays++;
      deductedDates.push({ date: cur, type: raw === 'Unpaid Leave' ? 'Unpaid Leave' : 'Absent', weight: 1 });
    } else if (status === 'Half Day') {
      halfDays++;
      deductedDates.push({ date: cur, type: 'Half Day', weight: 0.5 });
    } else if (cur >= effectiveStart && cur <= effectiveEnd) {
      // Every day is a working day; an unmarked past/current day is Present by default.
      presentDays++;
      defaultPresentDays++;
    }

    cur = addDays(cur, 1);
  }

  return {
    presentDays,
    absentDays,
    halfDays,
    defaultPresentDays,
    deductedDays: absentDays + 0.5 * halfDays,
    legacyPaidLeaveDays,
    legacyUnpaidLeaveDays,
    deductedDates,
  };
}

/**
 * Salary for one cycle, in integer paise.
 *
 *   per-day   = monthly / 30 (every cycle, 28-31 days)
 *   deduction = round2(monthly x (absent + 0.5 x half) / 30), capped at monthly
 *   earned    = monthly - deduction
 *   payable   = earned - cycle advances - debt brought in +/- adjustments
 *   borrow recovery comes only out of a positive remainder, capped at it
 *   negative payable -> net paid 0, the shortfall is a new Debt
 */
export function calculateCycleFinancials(
  monthlySalary: number,
  cycleDays: number,
  deductedDays: number,
  thisCycleAdvances: number,
  debtBroughtIn: number,
  selectedBorrowRecovery: number,
  adjustmentsAmount: number,
  /** Gross for this cycle if not the monthly salary (transition cycle: paid by days). */
  cycleGross?: number
): CycleFinancialSummary {
  const toPaise = (n: number) => Math.round((Number(n) || 0) * 100);
  const salaryPaise = toPaise(monthlySalary);
  const grossPaise = cycleGross === undefined ? salaryPaise : toPaise(cycleGross);

  // Per-day and deductions always come from the monthly salary / 30
  const deductionPaise = Math.min(
    grossPaise,
    Math.max(0, Math.round((salaryPaise * (Number(deductedDays) || 0)) / PAY_BASIS_DAYS))
  );
  const earnedPaise = grossPaise - deductionPaise;

  const advPaise = toPaise(thisCycleAdvances);
  const debtInPaise = toPaise(debtBroughtIn);
  const adjPaise = toPaise(adjustmentsAmount);

  const beforeBorrowPaise = earnedPaise - advPaise - debtInPaise + adjPaise;
  const borrowPaise = Math.min(Math.max(0, toPaise(selectedBorrowRecovery)), Math.max(0, beforeBorrowPaise));
  const payablePaise = beforeBorrowPaise - borrowPaise;

  return {
    monthlySalary,
    salaryUsed: grossPaise / 100,
    cycleDays,
    payBasisDays: PAY_BASIS_DAYS,
    perDayAmount: Math.round(salaryPaise / PAY_BASIS_DAYS) / 100,
    deductionAmount: deductionPaise / 100,
    earnedAmount: earnedPaise / 100,
    thisCycleAdvances: advPaise / 100,
    carriedForwardAdvanceIn: debtInPaise / 100,
    advanceDeducted: (advPaise + debtInPaise) / 100,
    carriedForwardAdvanceOut: Math.max(0, -payablePaise) / 100,
    borrowRecoveryDeducted: borrowPaise / 100,
    adjustmentsAmount: adjPaise / 100,
    payable: payablePaise / 100,
    netPayable: Math.max(0, payablePaise) / 100,
  };
}

/** Remaining (not yet deducted) balance of an advance or debt record. */
const remainingOf = (a: SalaryAdvance) => Math.max(0, (Number(a.amount) || 0) - (Number(a.deducted_amount) || 0));

/**
 * What paying out an employee's Due cycles would actually pay, cycle by cycle
 * in order, exactly as the Payout window computes it:
 *   - debt brought in = open balances (advances / Debt records) dated before
 *     the first due cycle, then whatever each payout carries forward
 *   - cycle advances = non-debt, non-voided advances dated in that cycle
 *   - open adjustments are applied once, on the first payout
 *   - each cycle pays max(0, payable); borrow recovery is optional (0 here)
 */
export function projectDuePayouts(
  employee: Employee,
  dueCycles: Array<Pick<SalaryCycle, 'startDate' | 'endDate' | 'cycleDays' | 'cycleIndex' | 'isTransition'>>,
  attendance: AttendanceRecord[],
  salaryAdvances: SalaryAdvance[],
  openAdjustmentsTotal: number,
  todayStr?: string
): { total: number; cycles: Array<{ cycleIndex: number; debtIn: number; advances: number; payable: number; netPayable: number }> } {
  const sorted = [...dueCycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) return { total: 0, cycles: [] };

  const own = salaryAdvances.filter(a => a.employeeId === employee.id && !a.deleted_at);
  const dateOf = (a: SalaryAdvance) => a.transactionDate || a.date;

  let carried = own
    .filter(a => a.status === 'Open' && dateOf(a) < sorted[0].startDate)
    .reduce((s, a) => s + remainingOf(a), 0);

  let totalPaise = 0;
  const cycles = sorted.map((c, i) => {
    const att = calculateCycleAttendance(employee, c, attendance, todayStr);
    const advances = own
      .filter(a => a.kind !== 'debt' && a.status !== 'Voided' && dateOf(a) >= c.startDate && dateOf(a) <= c.endDate)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const fin = calculateCycleFinancials(
      employee.monthlySalary, c.cycleDays, att.deductedDays, advances, carried, 0, i === 0 ? openAdjustmentsTotal : 0,
      cycleGrossSalary(employee.monthlySalary, c)
    );
    totalPaise += Math.round(fin.netPayable * 100);
    const row = { cycleIndex: c.cycleIndex, debtIn: carried, advances, payable: fin.payable, netPayable: fin.netPayable };
    carried = fin.carriedForwardAdvanceOut;
    return row;
  });

  return { total: totalPaise / 100, cycles };
}

export interface FinalSettlementSummary {
  perDay: number;
  payableDays: number;
  earned: number;
  /** Advances + debt brought in: all netted against the settlement. */
  advanceDeducted: number;
  borrowDeducted: number;
  /** Signed result after borrows (negative = still owed). */
  payable: number;
  netPayable: number;
  /** Unrecovered amount the employee still owes (recorded as an open debt). */
  owedByEmployee: number;
}

/**
 * Final settlement: earned = per-day (monthly / 30) x (days worked - deducted days).
 * Advances and debt are netted in full; borrows are recovered only from a
 * positive remainder. If advances + debt exceed what was earned, nothing is
 * paid and the shortfall is owed by the employee — never silently forgiven.
 */
export function calculateFinalSettlement(
  monthlySalary: number,
  daysWorked: number,
  deductedDays: number,
  advancesAndDebt: number,
  outstandingBorrows: number,
  adjustmentsAmount: number
): FinalSettlementSummary {
  const toPaise = (n: number) => Math.round((Number(n) || 0) * 100);
  const perDayPaise = Math.round(toPaise(monthlySalary) / PAY_BASIS_DAYS);
  const payableDays = Math.max(0, (Number(daysWorked) || 0) - (Number(deductedDays) || 0));
  const earnedPaise = Math.round(perDayPaise * payableDays);
  const advPaise = toPaise(advancesAndDebt);
  const beforeBorrowPaise = earnedPaise - advPaise + toPaise(adjustmentsAmount);
  const borrowPaise = Math.min(Math.max(0, toPaise(outstandingBorrows)), Math.max(0, beforeBorrowPaise));
  const payablePaise = beforeBorrowPaise - borrowPaise;
  return {
    perDay: perDayPaise / 100,
    payableDays,
    earned: earnedPaise / 100,
    advanceDeducted: advPaise / 100,
    borrowDeducted: borrowPaise / 100,
    payable: payablePaise / 100,
    netPayable: Math.max(0, payablePaise) / 100,
    owedByEmployee: Math.max(0, -payablePaise) / 100,
  };
}

/**
 * Earliest attendance mark, advance or borrow of an employee dated before
 * `date` (voided and deleted records ignored), or null if there is none.
 * Used to refuse a joining date that would leave records before it.
 */
export function findRecordBeforeDate(
  employeeId: string,
  date: string,
  attendance: AttendanceRecord[],
  salaryAdvances: SalaryAdvance[],
  borrows: BorrowRecord[]
): { kind: 'Attendance' | 'Advance' | 'Borrow'; date: string; label: string } | null {
  const found: Array<{ kind: 'Attendance' | 'Advance' | 'Borrow'; date: string; label: string }> = [];
  for (const a of attendance) {
    if (a.employeeId === employeeId && !a.deleted_at && a.date < date) {
      found.push({ kind: 'Attendance', date: a.date, label: `Attendance (${a.status}) on ${formatDDMMYYYY(a.date)}` });
    }
  }
  for (const a of salaryAdvances) {
    const d = a.transactionDate || a.date;
    if (a.employeeId === employeeId && !a.deleted_at && a.status !== 'Voided' && d < date) {
      found.push({ kind: 'Advance', date: d, label: `${a.kind === 'debt' ? 'Debt' : 'Advance'} of ${formatRs(a.amount)} on ${formatDDMMYYYY(d)}` });
    }
  }
  for (const b of borrows) {
    const d = b.transactionDate || b.date;
    if (b.employeeId === employeeId && !b.deleted_at && b.status !== 'Voided' && d < date) {
      found.push({ kind: 'Borrow', date: d, label: `Borrow of ${formatRs(b.amount)} on ${formatDDMMYYYY(d)}` });
    }
  }
  found.sort((x, y) => x.date.localeCompare(y.date));
  return found[0] || null;
}

export interface JoiningDateChangeEffect {
  /** Unpaid cycles that exist only after the change. */
  created: Array<{ startDate: string; endDate: string; cycleDays: number; status: SalaryCycle['status']; isTransition: boolean; gross: number; addsToPayableNow: number }>;
  /** Unpaid cycles that disappear with the change. */
  replaced: Array<{ startDate: string; endDate: string; cycleDays: number; status: SalaryCycle['status'] }>;
  payableNowBefore: number;
  payableNowAfter: number;
  /** Former staff are not part of Payable Now. */
  inPayableNow: boolean;
  text: string;
}

/**
 * Exactly what changing the joining date does when payouts exist, for the
 * confirmation: cycles created and replaced (paid cycles never change), what
 * each new due cycle adds to Payable Now, and this employee's Payable Now
 * before and after (same projection as the top card). Null without payouts.
 */
export function describeJoiningDateChange(
  employee: Employee,
  newJoiningDate: string,
  payments: SalaryPayment[],
  attendance: AttendanceRecord[],
  salaryAdvances: SalaryAdvance[],
  openAdjustmentsTotal: number,
  todayStr?: string
): JoiningDateChangeEffect | null {
  const today = todayStr || toLocalDateString();
  const changed = { ...employee, joiningDate: newJoiningDate };
  const before = generateEmployeeCycles(employee, today, payments, attendance);
  const after = generateEmployeeCycles(changed, today, payments, attendance);
  const paid = after.filter(c => c.status === 'Paid');
  if (paid.length === 0) return null;

  const key = (c: SalaryCycle) => `${c.startDate}|${c.endDate}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  const inPayableNow = employee.status === 'active' && !employee.deleted_at;

  const project = (emp: Employee, cycles: SalaryCycle[]) =>
    projectDuePayouts(emp, cycles.filter(c => c.status === 'Due'), attendance, salaryAdvances, openAdjustmentsTotal, today);
  const projBefore = project(employee, before);
  const projAfter = project(changed, after);
  const payableNowBefore = inPayableNow ? projBefore.total : 0;
  const payableNowAfter = inPayableNow ? projAfter.total : 0;

  const created = after
    .filter(c => c.status !== 'Paid' && !beforeKeys.has(key(c)))
    .map(c => ({
      startDate: c.startDate,
      endDate: c.endDate,
      cycleDays: c.cycleDays,
      status: c.status,
      isTransition: !!c.isTransition,
      gross: cycleGrossSalary(employee.monthlySalary, c),
      addsToPayableNow: inPayableNow && c.status === 'Due'
        ? (projAfter.cycles.find(p => p.cycleIndex === c.cycleIndex)?.netPayable ?? 0)
        : 0,
    }));
  const replaced = before
    .filter(c => c.status !== 'Paid' && !afterKeys.has(key(c)))
    .map(c => ({ startDate: c.startDate, endDate: c.endDate, cycleDays: c.cycleDays, status: c.status }));

  const lastPaid = paid[paid.length - 1];
  const range = (c: { startDate: string; endDate: string; cycleDays: number }) =>
    `${formatDDMMYYYY(c.startDate)} to ${formatDDMMYYYY(c.endDate)} (${c.cycleDays} days)`;
  const lines: string[] = [
    `Paid cycles are not changed: ${paid.length} paid cycle${paid.length === 1 ? '' : 's'}, the last ending ${formatDDMMYYYY(lastPaid.endDate)}.`,
    '',
  ];
  if (created.length === 0) {
    lines.push('No new cycles are created.');
  } else {
    lines.push(`Cycles created (${created.length}):`);
    for (const c of created) {
      const kind = c.isTransition ? 'transition, paid by days' : 'normal';
      const effect = c.status === 'Due'
        ? (inPayableNow ? `adds ${formatRs(c.addsToPayableNow)} to Payable Now` : 'due (former staff, not in Payable Now)')
        : 'not due yet, adds nothing to Payable Now today';
      lines.push(`- ${range(c)}, ${kind}, gross ${formatRs(c.gross)}: ${effect}`);
    }
  }
  if (replaced.length > 0) {
    lines.push('', `Cycles replaced (${replaced.length}):`);
    for (const c of replaced) lines.push(`- ${range(c)}, was ${c.status}`);
  }
  lines.push('');
  if (inPayableNow) {
    const delta = Math.round((payableNowAfter - payableNowBefore) * 100) / 100;
    lines.push(`Payable Now for ${employee.name}: ${formatRs(payableNowBefore)} -> ${formatRs(payableNowAfter)} (${delta >= 0 ? '+' : ''}${formatRs(delta)}).`);
  } else {
    lines.push(`${employee.name} is former staff, so Payable Now does not change.`);
  }
  lines.push(`After that, cycles start on day ${parseYYYYMMDD(newJoiningDate).day} of each month (or the month's last day).`);

  return { created, replaced, payableNowBefore, payableNowAfter, inPayableNow, text: lines.join('\n') };
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

