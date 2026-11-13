/**
 * Staff & Salary building blocks: cycle attendance grid with a day popup,
 * summary tiles, salary card, the Advances & Borrows box and Manage Shifts.
 */
import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Check, Clock, Edit2, Plus, Save, Trash2, X, Moon, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AttendanceRecord, BorrowRecord, Employee, SalaryAdvance, SalaryAuditEntry, Shift } from '@/types';
import { NumberInput } from '@/components/ui/number-input';
import {
  AttendanceMark, SalaryCycle, addDays, formatDDMMYYYY, formatTime12h, isOvernightShift,
  normalizeAttendanceStatus, formatRs,
} from '@/utils/salaryCycleUtils';


const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayOfWeek = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

const MARK_STYLE: Record<AttendanceMark, string> = {
  Present: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
  Absent: 'bg-destructive/15 border-destructive/50 text-destructive',
  'Half Day': 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400',
};

// ====================================================================
// Day popup: Present / Absent / Half Day (keys P, A, H, Esc) + Unmark
// ====================================================================
const DayMarkPopup = ({
  dateStr, current, onMark, onClose,
}: {
  dateStr: string;
  current: AttendanceMark | null;
  onMark: (status: AttendanceMark | null) => void;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const map: Record<string, AttendanceMark> = { p: 'Present', a: 'Absent', h: 'Half Day' };
      if (k === 'escape') { e.preventDefault(); onClose(); }
      else if (map[k]) { e.preventDefault(); onMark(map[k]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMark, onClose]);

  const btn = (status: AttendanceMark, key: string, cls: string) => (
    <button
      type="button"
      autoFocus={status === (current || 'Present')}
      onClick={() => onMark(status)}
      className={`w-full h-16 rounded-xl text-lg font-bold flex items-center justify-between px-5 transition-colors shadow-sm ${cls} ${current === status ? 'ring-4 ring-primary/30' : ''}`}
    >
      <span>{status}</span>
      <kbd className="text-xs font-mono opacity-80 border border-current/40 rounded px-1.5 py-0.5">{key}</kbd>
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border w-80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground">{formatDDMMYYYY(dateStr)}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
        {btn('Present', 'P', 'bg-emerald-600 hover:bg-emerald-700 text-white')}
        {btn('Absent', 'A', 'bg-destructive hover:bg-destructive/90 text-destructive-foreground')}
        {btn('Half Day', 'H', 'bg-amber-500 hover:bg-amber-600 text-white')}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => onMark(null)}
            disabled={!current}
            className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-40 disabled:no-underline"
          >
            Unmark (back to default Present)
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// Attendance grid for one salary cycle (all its days)
// ====================================================================
export const CycleAttendanceGrid = ({
  employee, cycle, attendance, todayStr, onMark,
}: {
  employee: Employee;
  cycle: SalaryCycle;
  attendance: AttendanceRecord[];
  todayStr: string;
  onMark: (dateStr: string, status: AttendanceMark | null) => void;
}) => {
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Raw status per day for this employee and cycle (memoised).
  const marks = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attendance) {
      if (a.employeeId === employee.id && !a.deleted_at && a.date >= cycle.startDate && a.date <= cycle.endDate) {
        m.set(a.date, a.status);
      }
    }
    return m;
  }, [attendance, employee.id, cycle.startDate, cycle.endDate]);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = cycle.startDate; d <= cycle.endDate; d = addDays(d, 1)) list.push(d);
    return list;
  }, [cycle.startDate, cycle.endDate]);

  const leadingBlanks = dayOfWeek(cycle.startDate);
  const openStatus = openDay ? normalizeAttendanceStatus(marks.get(openDay)) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`blank-${i}`} />)}
        {days.map((dateStr, i) => {
          const raw = marks.get(dateStr);
          const status = normalizeAttendanceStatus(raw);
          const disabled = dateStr < employee.joiningDate || dateStr > todayStr;
          // Every day is a working day; an unmarked past/current day is Present by default.
          const isDefaultPresent = !status && !disabled;
          const [, m, d] = dateStr.split('-').map(Number);
          const showMonth = i === 0 || d === 1;
          const legacy = raw === 'Paid Leave' || raw === 'Unpaid Leave' ? raw : null;

          const style = status
            ? MARK_STYLE[status]
            : isDefaultPresent
              ? 'bg-emerald-500/5 border-dashed border-emerald-500/30 text-emerald-700/80 dark:text-emerald-400/80'
              : 'bg-card border-border text-foreground';

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => setOpenDay(dateStr)}
              title={disabled
                ? (dateStr > todayStr ? 'Future day' : 'Before joining')
                : `${formatDDMMYYYY(dateStr)}: ${status ? status : 'Present (default, not marked)'}`}
              className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${style} ${
                disabled ? 'opacity-35 cursor-not-allowed' : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
              } ${dateStr === todayStr ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
            >
              <span className="text-3xl font-bold leading-none">
                {d}
                {showMonth && <span className="text-[10px] font-semibold ml-1 align-top opacity-70">{MONTHS[m - 1]}</span>}
              </span>
              <span className="text-[11px] font-semibold mt-1">
                {status || (isDefaultPresent ? 'Present' : '')}
                {legacy && <span className="opacity-70"> ({legacy})</span>}
              </span>
            </button>
          );
        })}
      </div>

      {openDay && (
        <DayMarkPopup
          dateStr={openDay}
          current={openStatus}
          onMark={(st) => { onMark(openDay, st); setOpenDay(null); }}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
};

// ====================================================================
// Big summary tiles + salary card
// ====================================================================
export const AttendanceSummaryTiles = ({
  present, halfDays, absent,
}: { present: number; halfDays: number; absent: number }) => {
  const tile = (label: string, value: number, cls: string) => (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-xs uppercase font-bold text-muted-foreground">{label}</p>
      <p className={`text-4xl font-bold mt-1 ${cls}`}>{value}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-3">
      {tile('Present', present, 'text-emerald-600 dark:text-emerald-400')}
      {tile('Half Day', halfDays, 'text-amber-600 dark:text-amber-400')}
      {tile('Absent', absent, 'text-destructive')}
    </div>
  );
};

export const SalarySummaryCard = ({
  earned, deduction, advances, debtIn, borrow, payable, debtOut, isPaid, perDay,
}: {
  earned: number; deduction: number; advances: number; debtIn: number; borrow: number;
  payable: number; debtOut: number; isPaid: boolean; perDay: number;
}) => {
  const row = (label: string, value: string, cls = 'text-foreground') => (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-2">
      <div className="flex items-baseline justify-between">
        <h4 className="font-bold text-foreground">Salary</h4>
        <span className="text-[11px] text-muted-foreground">{formatRs(perDay)}/day · 30-day month</span>
      </div>
      {row('Attendance deduction', deduction > 0 ? `-${formatRs(deduction)}` : '₹0', deduction > 0 ? 'text-destructive' : 'text-foreground')}
      {row('Earned', formatRs(earned))}
      {row('Advances', advances > 0 ? `-${formatRs(advances)}` : '₹0')}
      {row('Debt brought in', debtIn > 0 ? `-${formatRs(debtIn)}` : '₹0', debtIn > 0 ? 'text-destructive' : 'text-foreground')}
      {row('Borrow recovery', borrow > 0 ? `-${formatRs(borrow)}` : (isPaid ? '₹0' : 'Chosen at payout'))}
      <div className="pt-3 mt-1 border-t border-border flex items-end justify-between">
        <span className="text-sm font-bold text-foreground">{isPaid ? 'Payable (paid)' : 'Payable'}</span>
        <span className={`text-4xl font-black ${payable < 0 ? 'text-destructive' : 'text-foreground'}`}>{formatRs(payable)}</span>
      </div>
      {payable < 0 && (
        <p className="text-xs text-destructive text-right">
          {isPaid ? `Paid ₹0 · Debt of ${formatRs(debtOut)} carried forward` : `On payout: ₹0 paid, ${formatRs(-payable)} carried as Debt`}
        </p>
      )}
    </div>
  );
};

// ====================================================================
// Advances & Borrows box
// ====================================================================
type Entry =
  | { type: 'advance'; rec: SalaryAdvance; date: string }
  | { type: 'borrow'; rec: BorrowRecord; date: string };

const BORROW_STATUS: Record<string, string> = {
  outstanding: 'Outstanding', partially_repaid: 'Partly repaid', settled: 'Settled', Voided: 'Voided',
};

export const AdvancesBorrowsBox = ({
  employee, cycle, cycleIsPaid, salaryAdvances, borrows, todayStr,
  addSalaryAdvance, updateSalaryAdvance, deleteSalaryAdvance, addBorrow, updateBorrow, deleteBorrow,
}: {
  employee: Employee;
  cycle: SalaryCycle;
  cycleIsPaid: boolean;
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  todayStr: string;
  addSalaryAdvance: (a: { employeeId: string; amount: number; date: string; reason?: string }) => void;
  updateSalaryAdvance: (id: string, u: Partial<SalaryAdvance>) => { success: boolean; error?: string };
  deleteSalaryAdvance: (id: string) => { success: boolean; error?: string };
  addBorrow: (b: { employeeId: string; amount: number; date: string; reason?: string }) => void;
  updateBorrow: (id: string, u: Partial<BorrowRecord>) => { success: boolean; error?: string };
  deleteBorrow: (id: string) => { success: boolean; error?: string };
}) => {
  const [mode, setMode] = useState<'advance' | 'borrow'>('advance');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<{ id: string; type: Entry['type']; amount: number; date: string; reason: string } | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const inCycle = (d: string) => d >= cycle.startDate && d <= cycle.endDate;
    const list: Entry[] = [
      ...salaryAdvances
        .filter(a => a.employeeId === employee.id && !a.deleted_at && a.kind !== 'debt' && inCycle(a.transactionDate || a.date))
        .map(a => ({ type: 'advance' as const, rec: a, date: a.transactionDate || a.date })),
      ...borrows
        .filter(b => b.employeeId === employee.id && !b.deleted_at && inCycle(b.transactionDate || b.date))
        .map(b => ({ type: 'borrow' as const, rec: b, date: b.transactionDate || b.date })),
    ];
    return list.sort((x, y) => x.date.localeCompare(y.date));
  }, [salaryAdvances, borrows, employee.id, cycle.startDate, cycle.endDate]);

  const cycleAdvancesTotal = entries
    .filter(e => e.type === 'advance' && e.rec.status !== 'Voided')
    .reduce((s, e) => s + e.rec.amount, 0);
  const borrowOutstanding = useMemo(() => borrows
    .filter(b => b.employeeId === employee.id && !b.deleted_at && b.status !== 'settled' && b.status !== 'Voided')
    .reduce((s, b) => s + Math.max(0, b.amount - (b.repaid_amount || 0)), 0), [borrows, employee.id]);

  const isEditable = (e: Entry) =>
    !cycleIsPaid && (e.type === 'advance' ? e.rec.status === 'Open' : e.rec.status === 'outstanding');

  const validDate = (d: string) => {
    if (!d) return 'Choose a date.';
    if (d < employee.joiningDate) return `Date can't be before joining (${formatDDMMYYYY(employee.joiningDate)}).`;
    if (d > todayStr) return "Date can't be in the future.";
    return null;
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!(amount > 0)) { toast.error('Enter an amount above 0.'); return; }
    const dateErr = validDate(date);
    if (dateErr) { toast.error(dateErr); return; }
    const payload = { employeeId: employee.id, amount, date, reason: reason.trim() || undefined };
    if (mode === 'advance') addSalaryAdvance(payload); else addBorrow(payload);
    toast.success(`${mode === 'advance' ? 'Advance' : 'Borrow'} of ${formatRs(amount)} added for ${formatDDMMYYYY(date)}`);
    setAmount(0);
    setReason('');
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!(editing.amount > 0)) { toast.error('Enter an amount above 0.'); return; }
    const dateErr = validDate(editing.date);
    if (dateErr) { toast.error(dateErr); return; }
    const updates = { amount: editing.amount, date: editing.date, transactionDate: editing.date, reason: editing.reason.trim() || undefined };
    const res = editing.type === 'advance' ? updateSalaryAdvance(editing.id, updates) : updateBorrow(editing.id, updates);
    if (res.success) { setEditing(null); toast.success('Updated'); } else toast.error(res.error || 'Could not update');
  };

  const remove = (e: Entry) => {
    if (!window.confirm(`Delete this ${e.type} of ${formatRs(e.rec.amount)} (${formatDDMMYYYY(e.date)})?`)) return;
    const res = e.type === 'advance' ? deleteSalaryAdvance(e.rec.id) : deleteBorrow(e.rec.id);
    if (res.success) toast.success('Deleted'); else toast.error(res.error || 'Could not delete');
  };

  const inputCls = 'px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-foreground">Advances & Borrows</h4>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm font-semibold">
          {(['advance', 'borrow'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            >
              {m === 'advance' ? 'Advance' : 'Borrow'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-12 gap-2">
        <NumberInput
          min="0"
          step="any"
          placeholder="Amount (₹)"
          value={amount || ''}
          onValueChange={setAmount}
          className={`${inputCls} col-span-3`}
        />
        <input type="date" value={date} max={todayStr} min={employee.joiningDate} onChange={e => setDate(e.target.value)} className={`${inputCls} col-span-3`} />
        <input type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className={`${inputCls} col-span-4`} />
        <button type="submit" className="col-span-2 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-bold transition-colors">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="flex gap-6 text-sm">
        <span className="text-muted-foreground">Cycle advances: <strong className="text-foreground">{formatRs(cycleAdvancesTotal)}</strong></span>
        <span className="text-muted-foreground">Borrow outstanding: <strong className="text-foreground">{formatRs(borrowOutstanding)}</strong></span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">No advances or borrows in this cycle.</td></tr>
            )}
            {entries.map(e => {
              const isEditing = editing?.id === e.rec.id;
              const status = e.type === 'advance' ? (e.rec.status || 'Open') : (BORROW_STATUS[e.rec.status] || e.rec.status);
              return (
                <tr key={`${e.type}-${e.rec.id}`} className="border-t border-border">
                  {isEditing && editing ? (
                    <>
                      <td className="px-2 py-1.5"><input type="date" value={editing.date} max={todayStr} min={employee.joiningDate} onChange={ev => setEditing({ ...editing, date: ev.target.value })} className={`${inputCls} w-full py-1`} /></td>
                      <td className="px-3 py-1.5 capitalize">{e.type}</td>
                      <td className="px-2 py-1.5"><NumberInput min="0" step="any" value={editing.amount} onValueChange={v => setEditing({ ...editing, amount: v })} className={`${inputCls} w-full py-1 text-right`} /></td>
                      <td className="px-2 py-1.5"><input type="text" value={editing.reason} onChange={ev => setEditing({ ...editing, reason: ev.target.value })} className={`${inputCls} w-full py-1`} /></td>
                      <td className="px-3 py-1.5 text-muted-foreground">{status}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-secondary rounded" title="Save"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded" title="Cancel"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono">{formatDDMMYYYY(e.date)}</td>
                      <td className="px-3 py-2 capitalize">{e.type}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatRs(e.rec.amount)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.rec.reason || '-'}</td>
                      <td className="px-3 py-2">{status}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-right">
                        {isEditable(e) && (
                          <>
                            <button
                              onClick={() => setEditing({ id: e.rec.id, type: e.type, amount: e.rec.amount, date: e.date, reason: e.rec.reason || '' })}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded" title="Edit"
                            ><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => remove(e)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ====================================================================
// Manage shifts (opened from the Add/Edit Staff shift field)
// ====================================================================
const shiftTimesLabel = (s?: { startTime?: string; endTime?: string } | null) =>
  s?.startTime && s?.endTime ? `${formatTime12h(s.startTime)} - ${formatTime12h(s.endTime)}` : '';

export const ManageShiftsModal = ({
  shifts, addShift, updateShift, deleteShift, onClose,
}: {
  shifts: Shift[];
  addShift: (s: Omit<Shift, 'id' | 'created_at' | 'updated_at'>) => Shift;
  updateShift: (id: string, u: Partial<Pick<Shift, 'name' | 'startTime' | 'endTime'>>) => { success: boolean; error?: string };
  deleteShift: (id: string) => { success: boolean; error?: string };
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState({ name: '', startTime: '09:00', endTime: '18:00' });
  const [editing, setEditing] = useState<{ id: string; name: string; startTime: string; endTime: string } | null>(null);
  const active = shifts.filter(s => !s.deleted_at);

  const check = (v: { name: string; startTime: string; endTime: string }) => {
    if (!v.name.trim()) return 'Enter a shift name.';
    if (!v.startTime || !v.endTime) return 'Enter a start and end time.';
    if (v.startTime === v.endTime) return 'Start and end time must differ.';
    return null;
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const err = check(draft);
    if (err) { toast.error(err); return; }
    addShift({ name: draft.name.trim(), startTime: draft.startTime, endTime: draft.endTime });
    toast.success(`Shift "${draft.name.trim()}" added`);
    setDraft({ name: '', startTime: '09:00', endTime: '18:00' });
  };

  const handleSave = () => {
    if (!editing) return;
    const err = check(editing);
    if (err) { toast.error(err); return; }
    const res = updateShift(editing.id, { name: editing.name, startTime: editing.startTime, endTime: editing.endTime });
    if (res.success) setEditing(null); else toast.error(res.error || 'Could not save shift');
  };

  const handleDelete = (s: Shift) => {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    const res = deleteShift(s.id);
    if (res.success) toast.success('Shift deleted'); else toast.error(res.error || 'Could not delete shift');
  };

  const inputCls = 'px-2.5 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-xl w-full border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2"><Clock className="w-5 h-5" /> Manage Shifts</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {active.length === 0 && <p className="text-xs text-muted-foreground">No shifts yet.</p>}
          {active.map(s => editing?.id === s.id ? (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-primary/40">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={`${inputCls} flex-1`} />
              <input type="time" value={editing.startTime} onChange={e => setEditing({ ...editing, startTime: e.target.value })} className={inputCls} />
              <input type="time" value={editing.endTime} onChange={e => setEditing({ ...editing, endTime: e.target.value })} className={inputCls} />
              <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-secondary rounded" title="Save"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(null)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded" title="Cancel"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
              <div>
                <p className="font-semibold text-sm text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {shiftTimesLabel(s) || 'No times set'}
                  {isOvernightShift(s.startTime, s.endTime) && <span className="inline-flex items-center gap-0.5 ml-1"><Moon className="w-3 h-3" /> overnight</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing({ id: s.id, name: s.name, startTime: s.startTime || '', endTime: s.endTime || '' })}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded" title="Edit"
                ><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(s)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-3 border-t border-border">
          <input placeholder="Shift name (e.g. Night)" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} flex-1`} />
          <input type="time" value={draft.startTime} onChange={e => setDraft({ ...draft, startTime: e.target.value })} className={inputCls} title="Start" />
          <input type="time" value={draft.endTime} onChange={e => setDraft({ ...draft, endTime: e.target.value })} className={inputCls} title="End (earlier than start = overnight)" />
          <button type="submit" className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-bold">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
        {isOvernightShift(draft.startTime, draft.endTime) && draft.startTime !== draft.endTime && (
          <p className="text-xs text-muted-foreground -mt-2">Ends the next morning: {shiftTimesLabel(draft)} (overnight).</p>
        )}
      </div>
    </div>
  );
};

// ====================================================================
// Owed by employee (final-settlement shortfall): Recovered / Written off
// ====================================================================
const AUDIT_LABEL: Record<SalaryAuditEntry['action'], string> = {
  owed_debt_created: 'Owed amount recorded',
  owed_debt_recovered: 'Recovered',
  owed_debt_written_off: 'Written off',
};

const formatStamp = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const OwedDebtRow = ({
  debt, onResolve,
}: {
  debt: SalaryAdvance;
  onResolve: (id: string, action: 'Recovered' | 'Written off', amount: number, reason: string) => { success: boolean; error?: string };
}) => {
  const remaining = Math.max(0, debt.amount - (debt.deducted_amount || 0));
  const [amount, setAmount] = useState(remaining);
  const [reason, setReason] = useState('');
  const isOpen = debt.status === 'Open';

  const act = (action: 'Recovered' | 'Written off') => {
    if (!reason.trim()) { toast.error('Enter a reason first.'); return; }
    if (action === 'Written off' && !window.confirm(`Write off ${formatRs(remaining)}? This is recorded in the audit log and cannot be undone.`)) return;
    const res = onResolve(debt.id, action, action === 'Recovered' ? amount : remaining, reason);
    if (res.success) {
      toast.success(action === 'Recovered' ? `Recovered ${formatRs(amount)}` : `Written off ${formatRs(remaining)}`);
      setReason('');
    } else {
      toast.error(res.error || 'Could not save');
    }
  };

  const inputCls = 'px-2.5 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="p-3 rounded-lg border border-border bg-background space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{debt.reason || 'Owed by employee'}</p>
          <p className="text-xs text-muted-foreground">
            Recorded {formatDDMMYYYY(debt.transactionDate || debt.date)} · Original {formatRs(debt.amount)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${isOpen ? 'text-destructive' : 'text-muted-foreground'}`}>{formatRs(isOpen ? remaining : 0)}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">{isOpen ? 'Still owed' : debt.status}</p>
        </div>
      </div>

      {(debt.resolutions || []).length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 border-t border-border pt-2">
          {(debt.resolutions || []).map((r, i) => (
            <li key={i}>
              {formatStamp(r.at)} · <strong className="text-foreground">{r.type}</strong> {formatRs(r.amount)} · {r.reason} · by {r.by}
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <NumberInput
            min="0"
            step="any"
            value={amount}
            onValueChange={setAmount}
            className={`${inputCls} w-28 text-right`}
            title="Amount recovered"
          />
          <input
            type="text"
            placeholder="Reason (required)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={`${inputCls} flex-1 min-w-[12rem]`}
          />
          <button type="button" onClick={() => act('Recovered')} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            Recovered
          </button>
          <button type="button" onClick={() => act('Written off')} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-destructive/40 text-destructive hover:bg-destructive/10">
            Written off
          </button>
        </div>
      )}
    </div>
  );
};

export const OwedByEmployeeCard = ({
  debts, auditLog, onResolve,
}: {
  debts: SalaryAdvance[];
  auditLog: SalaryAuditEntry[];
  onResolve: (id: string, action: 'Recovered' | 'Written off', amount: number, reason: string) => { success: boolean; error?: string };
}) => {
  const openTotal = debts
    .filter(d => d.status === 'Open')
    .reduce((s, d) => s + Math.max(0, d.amount - (d.deducted_amount || 0)), 0);

  return (
    <div className="bg-card border-2 border-destructive/40 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" /> Owed by employee
        </h4>
        <span className={`text-lg font-bold ${openTotal > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {openTotal > 0 ? `${formatRs(openTotal)} open` : 'Nothing open'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Advances and debt that exceeded the final settlement. It stays open until it is recovered or written off, each with a reason.
      </p>
      {debts.map(d => <OwedDebtRow key={d.id} debt={d} onResolve={onResolve} />)}

      {auditLog.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">Audit log ({auditLog.length})</summary>
          <table className="w-full mt-2">
            <tbody>
              {[...auditLog].sort((a, b) => b.at.localeCompare(a.at)).map(e => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-1 pr-2 whitespace-nowrap font-mono">{formatStamp(e.at)}</td>
                  <td className="py-1 pr-2 font-semibold text-foreground">{AUDIT_LABEL[e.action]}</td>
                  <td className="py-1 pr-2 text-right">{formatRs(e.amount)}</td>
                  <td className="py-1 pr-2 text-right text-muted-foreground">bal. {formatRs(e.balanceAfter)}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{e.reason || '-'}</td>
                  <td className="py-1 text-muted-foreground">{e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
};
