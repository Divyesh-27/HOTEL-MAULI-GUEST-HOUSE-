import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { 
  Users, UserPlus, Check, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Lock, Unlock, ShieldAlert, AlertCircle, DollarSign, Plus, Trash2, Edit2, 
  CheckCircle2, Clock, Search, ShieldCheck, ArrowRight, Upload, Image as ImageIcon,
  AlertTriangle, RotateCcw, Printer, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Employee, SalaryAdvance, BorrowRecord, SalaryPayment, StaffRole, Shift, AttendanceRecord, SalaryDeductionLedgerItem, InvoiceSettings } from '@/types';
import { toLocalDateString } from '@/utils/dateUtils';
import { calculateSalarySlipData, generateSalarySlipHtml } from '@/utils/salarySlipUtils';

const Staff = () => {
  const {
    staffRoles,
    shifts,
    employees,
    attendance,
    salaryAdvances,
    borrows,
    salaryPayments,
    salaryDeductionLedger,
    invoiceSettings,
    addEmployee,
    updateEmployee,
    softDeleteEmployee,
    markAttendance,
    markAllPresent,
    addSalaryAdvance,
    addBorrow,
    executePayout,
    voidPayout
  } = useStore(useShallow(state => ({
    staffRoles: state.staffRoles,
    shifts: state.shifts,
    employees: state.employees,
    attendance: state.attendance,
    salaryAdvances: state.salaryAdvances,
    borrows: state.borrows,
    salaryPayments: state.salaryPayments,
    salaryDeductionLedger: state.salaryDeductionLedger,
    invoiceSettings: state.invoiceSettings,
    addEmployee: state.addEmployee,
    updateEmployee: state.updateEmployee,
    softDeleteEmployee: state.softDeleteEmployee,
    markAttendance: state.markAttendance,
    markAllPresent: state.markAllPresent,
    addSalaryAdvance: state.addSalaryAdvance,
    addBorrow: state.addBorrow,
    executePayout: state.executePayout,
    voidPayout: state.voidPayout
  })));

  // Active filter & selection
  const [searchQuery, setSearchQuery] = useState('');
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'active' && !e.deleted_at);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeEmployees;
    return activeEmployees.filter(e => 
      e.name.toLowerCase().includes(q) || 
      (e.phone && e.phone.includes(q)) ||
      (e.aadhaarLast4 && e.aadhaarLast4.includes(q))
    );
  }, [activeEmployees, searchQuery]);

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  useEffect(() => {
    if (!selectedEmpId && activeEmployees.length > 0) {
      setSelectedEmpId(activeEmployees[0].id);
    } else if (selectedEmpId && !activeEmployees.some(e => e.id === selectedEmpId)) {
      setSelectedEmpId(activeEmployees[0]?.id || '');
    }
  }, [activeEmployees, selectedEmpId]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Today string
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  // Calendar Date State (selected month and selected day)
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => toLocalDateString(new Date()));
  const [showWeeklyOff, setShowWeeklyOff] = useState<boolean>(true);

  // Month identifiers
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed
  const currentMonthStr = useMemo(() => {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }, [year, month]);

  // Range Check state (defaults to 1st of month to today / end of month)
  const [rangeFrom, setRangeFrom] = useState<string>(() => `${currentMonthStr}-01`);
  const [rangeTo, setRangeTo] = useState<string>(() => todayStr);

  useEffect(() => {
    setRangeFrom(`${currentMonthStr}-01`);
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const endStr = `${currentMonthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;
    setRangeTo(todayStr > endStr ? endStr : (todayStr < `${currentMonthStr}-01` ? `${currentMonthStr}-01` : todayStr));
  }, [currentMonthStr, year, month, todayStr]);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<boolean>(false);
  const [showBorrowModal, setShowBorrowModal] = useState<boolean>(false);
  const [showSalarySlipModal, setShowSalarySlipModal] = useState<boolean>(false);

  // Vault state
  const [vaultStatus, setVaultStatus] = useState<{ initialized: boolean; unlocked: boolean; lockedUntil?: number }>({
    initialized: false,
    unlocked: false
  });
  const [showVaultPrompt, setShowVaultPrompt] = useState<boolean>(false);
  const [vaultPassword, setVaultPassword] = useState<string>('');
  const [vaultError, setVaultError] = useState<string>('');
  const [vaultLockoutSeconds, setVaultLockoutSeconds] = useState<number>(0);
  const [decryptedVaultData, setDecryptedVaultData] = useState<{ aadhaarNumber?: string; aadhaarImage?: string; photo?: string } | null>(null);

  // Check vault status on mount and when vault changes
  const checkVaultStatus = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.vaultStatus) {
      try {
        const res = await window.electronAPI.vaultStatus();
        setVaultStatus(res);
        if (res.lockedUntil && res.lockedUntil > Date.now()) {
          setVaultLockoutSeconds(Math.ceil((res.lockedUntil - Date.now()) / 1000));
        } else {
          setVaultLockoutSeconds(0);
        }
      } catch (err) {
        console.error('Error fetching vault status:', err);
      }
    }
  };

  useEffect(() => {
    checkVaultStatus();
    const interval = setInterval(checkVaultStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch employee decrypted vault data if unlocked
  useEffect(() => {
    let isMounted = true;
    const fetchVaultRecord = async () => {
      if (selectedEmpId && vaultStatus.unlocked && window.electronAPI?.vaultGet) {
        try {
          const res = await window.electronAPI.vaultGet(selectedEmpId);
          if (isMounted) {
            if (res.success && res.data) {
              setDecryptedVaultData(res.data);
            } else {
              setDecryptedVaultData(null);
            }
          }
        } catch (err) {
          if (isMounted) setDecryptedVaultData(null);
        }
      } else {
        if (isMounted) setDecryptedVaultData(null);
      }
    };
    fetchVaultRecord();
    return () => { isMounted = false; };
  }, [selectedEmpId, vaultStatus.unlocked]);

  // Handle Vault Unlock / Setup
  const handleUnlockOrSetupVault = async () => {
    if (!vaultPassword.trim() || !window.electronAPI) return;
    setVaultError('');
    try {
      if (!vaultStatus.initialized) {
        const res = await window.electronAPI.vaultSetup(vaultPassword);
        if (res.success) {
          setVaultPassword('');
          setShowVaultPrompt(false);
          await checkVaultStatus();
        } else {
          setVaultError(res.error || 'Failed to setup vault');
        }
      } else {
        const res = await window.electronAPI.vaultUnlock(vaultPassword);
        if (res.success) {
          setVaultPassword('');
          setShowVaultPrompt(false);
          await checkVaultStatus();
        } else {
          setVaultError(res.error || 'Incorrect vault password');
          if (res.lockedUntil) {
            setVaultLockoutSeconds(Math.ceil((res.lockedUntil - Date.now()) / 1000));
          }
        }
      }
    } catch (err: any) {
      setVaultError(err?.message || 'Vault operation failed');
    }
  };

  const handleLockVault = async () => {
    if (window.electronAPI?.vaultLock) {
      await window.electronAPI.vaultLock();
      setDecryptedVaultData(null);
      await checkVaultStatus();
    }
  };

  // --- TOP STATS BAR CALCULATIONS ---
  const presentTodayCount = useMemo(() => {
    return activeEmployees.filter(emp => 
      attendance.some(a => a.employeeId === emp.id && a.date === todayStr && a.status === 'Present')
    ).length;
  }, [activeEmployees, attendance, todayStr]);

  const absentTodayCount = useMemo(() => {
    return activeEmployees.filter(emp => 
      attendance.some(a => a.employeeId === emp.id && a.date === todayStr && a.status === 'Absent')
    ).length;
  }, [activeEmployees, attendance, todayStr]);

  const notMarkedTodayCount = useMemo(() => {
    return Math.max(0, activeEmployees.length - (presentTodayCount + absentTodayCount));
  }, [activeEmployees.length, presentTodayCount, absentTodayCount]);

  // Current Month Total Payable across all active staff
  const totalPayableThisMonth = useMemo(() => {
    return activeEmployees.reduce((sum, emp) => {
      const gross = emp.monthlySalary || 0;
      const advances = salaryAdvances
        .filter(a => a.employeeId === emp.id && a.date.startsWith(currentMonthStr))
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const activeBorrows = borrows
        .filter(b => b.employeeId === emp.id && b.status !== 'settled')
        .reduce((s, b) => s + Math.max(0, (Number(b.amount) || 0) - (Number(b.repaid_amount) || 0)), 0);
      const net = Math.max(0, gross - advances - activeBorrows);
      return sum + net;
    }, 0);
  }, [activeEmployees, salaryAdvances, borrows, currentMonthStr]);

  // --- SELECTED EMPLOYEE CALCULATIONS ---
  const empGrossSalary = selectedEmployee ? selectedEmployee.monthlySalary : 0;

  // Selected Month Attendance counts for selected employee
  const monthAttendance = useMemo(() => {
    if (!selectedEmployee) return [];
    return attendance.filter(a => a.employeeId === selectedEmployee.id && a.date.startsWith(currentMonthStr));
  }, [selectedEmployee, attendance, currentMonthStr]);

  const monthPresentCount = useMemo(() => {
    return monthAttendance.filter(a => a.status === 'Present').length;
  }, [monthAttendance]);

  const monthAbsentCount = useMemo(() => {
    return monthAttendance.filter(a => a.status === 'Absent').length;
  }, [monthAttendance]);

  const daysInViewMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const monthNotMarkedCount = useMemo(() => {
    return Math.max(0, daysInViewMonth - (monthPresentCount + monthAbsentCount));
  }, [daysInViewMonth, monthPresentCount, monthAbsentCount]);

  // Advances in selected month
  const monthAdvances = useMemo(() => {
    if (!selectedEmployee) return [];
    return salaryAdvances.filter(a => a.employeeId === selectedEmployee.id && a.date.startsWith(currentMonthStr));
  }, [selectedEmployee, salaryAdvances, currentMonthStr]);

  const monthAdvancesTotal = useMemo(() => {
    return monthAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [monthAdvances]);

  // All outstanding advances for employee (for payout modal)
  const totalOutstandingAdvances = useMemo(() => {
    if (!selectedEmployee) return 0;
    return salaryAdvances
      .filter(a => a.employeeId === selectedEmployee.id)
      .reduce((sum, a) => sum + Math.max(0, (Number(a.amount) || 0) - (Number(a.deducted_amount) || 0)), 0);
  }, [selectedEmployee, salaryAdvances]);

  // All outstanding borrows for employee
  const totalOutstandingBorrows = useMemo(() => {
    if (!selectedEmployee) return 0;
    return borrows
      .filter(b => b.employeeId === selectedEmployee.id && b.status !== 'settled')
      .reduce((sum, b) => sum + Math.max(0, (Number(b.amount) || 0) - (Number(b.repaid_amount) || 0)), 0);
  }, [selectedEmployee, borrows]);

  // Month Payable for selected employee
  const monthNetPayable = useMemo(() => {
    return Math.max(0, empGrossSalary - monthAdvancesTotal - totalOutstandingBorrows);
  }, [empGrossSalary, monthAdvancesTotal, totalOutstandingBorrows]);

  // Parity check verification
  const parityStatus = useMemo(() => {
    const rawNet = empGrossSalary - monthAdvancesTotal - totalOutstandingBorrows;
    const isCappedAtZero = rawNet < 0 && monthNetPayable === 0;
    const isExact = rawNet === monthNetPayable;
    return (isExact || isCappedAtZero) ? 'OK' : 'MISMATCH';
  }, [empGrossSalary, monthAdvancesTotal, totalOutstandingBorrows, monthNetPayable]);

  // Check if salary already paid for currentMonthStr
  const monthSalaryPayment = useMemo(() => {
    if (!selectedEmployee) return null;
    return salaryPayments.find(p => p.employeeId === selectedEmployee.id && p.month === currentMonthStr && !p.deleted_at) || null;
  }, [selectedEmployee, salaryPayments, currentMonthStr]);

  // Calendar cells generation
  const calendarCells = useMemo(() => {
    const firstDayIdx = new Date(year, month, 1).getDay(); // 0 = Sunday
    const cells: Array<{ dayNumber: number; dateStr: string; isSunday: boolean } | null> = [];
    
    // Empty slots before 1st of month
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push(null);
    }
    
    // Days 1..daysInViewMonth
    for (let d = 1; d <= daysInViewMonth; d++) {
      const dateStr = `${currentMonthStr}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      cells.push({
        dayNumber: d,
        dateStr,
        isSunday: dayOfWeek === 0
      });
    }
    return cells;
  }, [year, month, daysInViewMonth, currentMonthStr]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleGoToDate = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        setSelectedDayStr(val);
      }
    }
  };

  // Day detail attendance status & advances on selected day
  const selectedDayAttendanceStatus = useMemo(() => {
    if (!selectedEmployee) return null;
    return attendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDayStr)?.status || null;
  }, [selectedEmployee, attendance, selectedDayStr]);

  const selectedDayAdvances = useMemo(() => {
    if (!selectedEmployee) return [];
    return salaryAdvances.filter(a => a.employeeId === selectedEmployee.id && a.date === selectedDayStr);
  }, [selectedEmployee, salaryAdvances, selectedDayStr]);

  const selectedDayBorrows = useMemo(() => {
    if (!selectedEmployee) return [];
    return borrows.filter(b => b.employeeId === selectedEmployee.id && b.date === selectedDayStr);
  }, [selectedEmployee, borrows, selectedDayStr]);

  // Range Check calculated stats
  const rangeCheckStats = useMemo(() => {
    if (!selectedEmployee || !rangeFrom || !rangeTo) {
      return { present: 0, absent: 0, advances: 0, borrows: 0 };
    }
    const empAtt = attendance.filter(a => a.employeeId === selectedEmployee.id && a.date >= rangeFrom && a.date <= rangeTo);
    const present = empAtt.filter(a => a.status === 'Present').length;
    const absent = empAtt.filter(a => a.status === 'Absent').length;
    const advs = salaryAdvances
      .filter(a => a.employeeId === selectedEmployee.id && a.date >= rangeFrom && a.date <= rangeTo)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const brws = borrows
      .filter(b => b.employeeId === selectedEmployee.id && b.date >= rangeFrom && b.date <= rangeTo)
      .reduce((s, b) => s + (Number(b.amount) || 0), 0);
    return { present, absent, advances: advs, borrows: brws };
  }, [selectedEmployee, attendance, salaryAdvances, borrows, rangeFrom, rangeTo]);

  // Role & Shift display helpers
  const getRoleName = (roleId: string) => {
    return staffRoles.find(r => r.id === roleId)?.name || 'Staff';
  };

  const getShiftName = (shiftId?: string) => {
    if (!shiftId) return 'Regular';
    return shifts.find(s => s.id === shiftId)?.name || 'Regular';
  };

  // Delete staff confirmation
  const handleDeleteEmployee = (emp: Employee) => {
    const conf = window.confirm(`Are you sure you want to remove ${emp.name}? This will soft-delete their record and preserve historical payroll logs.`);
    if (conf) {
      softDeleteEmployee(emp.id);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* ============================================================== */}
      {/* 1. TOP HEADER & STATS CARDS (Matching Dashboard)              */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Staff Management</h2>
          <p className="text-xs text-muted-foreground">Manage employees, daily attendance, advances, borrows, and salary payouts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => markAllPresent(todayStr)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95"
            title="Mark all active staff members as Present for today"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>All Present</span>
          </button>
        </div>
      </div>

      {/* Top Stats Cards matching Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Staff</p>
              <p className="text-3xl font-bold text-foreground">{activeEmployees.length}</p>
            </div>
            <Users className="w-8 h-8 opacity-30 text-foreground" />
          </div>
        </div>

        <div className="stat-card hover:border-emerald-500/50">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Present Today</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{presentTodayCount}</p>
            </div>
            <Check className="w-8 h-8 opacity-30 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="stat-card hover:border-destructive/50">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Absent Today</p>
              <p className="text-3xl font-bold text-destructive">{absentTodayCount}</p>
            </div>
            <X className="w-8 h-8 opacity-30 text-destructive" />
          </div>
        </div>

        <div className="stat-card hover:border-amber-500/50">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Not Marked</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{notMarkedTodayCount}</p>
            </div>
            <Clock className="w-8 h-8 opacity-30 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Payable This Month</p>
              <p className="text-3xl font-bold text-foreground">₹{totalPayableThisMonth.toLocaleString('en-IN')}</p>
            </div>
            <DollarSign className="w-8 h-8 opacity-30 text-foreground" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN 2-COLUMN LAYOUT: LEFT STAFF LIST | RIGHT CALENDAR PNL */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ------------------------------------------------------------ */}
        {/* LEFT PANEL (4 cols): Staff Members List                      */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
            
            {/* Header with Add Staff button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Staff Members</h3>
                <p className="text-xs text-muted-foreground">{filteredEmployees.length} registered</p>
              </div>
              <button
                onClick={() => {
                  setEditingEmployee(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Staff</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
            </div>

            {/* Employee Cards List */}
            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 rounded-lg border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No staff members found.</p>
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const isSelected = emp.id === selectedEmpId;
                  const empTodayAtt = attendance.find(a => a.employeeId === emp.id && a.date === todayStr)?.status;

                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-accent/10 border-accent shadow-sm ring-1 ring-accent' 
                          : 'bg-background hover:bg-muted/40 border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground border border-border font-bold text-sm flex items-center justify-center shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-sm text-foreground leading-tight">{emp.name}</h4>
                              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                                {getRoleName(emp.roleId)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">₹{emp.monthlySalary.toLocaleString('en-IN')}/mo</span>
                              {emp.phone && <span>• {emp.phone}</span>}
                            </div>
                            {emp.aadhaarLast4 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                Aadhaar: •••• {emp.aadhaarLast4}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Soft Delete Trash Icon */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmployee(emp);
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Remove staff member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Attendance Row */}
                      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          empTodayAtt === 'Present' 
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : empTodayAtt === 'Absent'
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}>
                          {empTodayAtt ? empTodayAtt : 'Not marked'}
                        </span>

                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => markAttendance(emp.id, todayStr, 'Present')}
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                              empTodayAtt === 'Present'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-secondary hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 border border-border'
                            }`}
                            title="Mark Present"
                          >
                            P
                          </button>
                          <button
                            onClick={() => markAttendance(emp.id, todayStr, 'Absent')}
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                              empTodayAtt === 'Absent'
                                ? 'bg-destructive text-destructive-foreground shadow-sm'
                                : 'bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-border'
                            }`}
                            title="Mark Absent"
                          >
                            A
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Vault Security Indicator */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {vaultStatus.unlocked ? (
                  <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-foreground font-medium">
                  {vaultStatus.unlocked ? 'Vault Unlocked' : 'Vault Locked'}
                </span>
              </div>
              <button
                onClick={() => {
                  if (vaultStatus.unlocked) {
                    handleLockVault();
                  } else {
                    setVaultError('');
                    setShowVaultPrompt(true);
                  }
                }}
                className="text-xs font-semibold text-foreground underline hover:text-primary transition-colors"
              >
                {vaultStatus.unlocked ? 'Lock Now' : (vaultStatus.initialized ? 'Unlock Vault' : 'Setup Vault')}
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT PANEL (8 cols): Selected Employee & Calendar          */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEmployee ? (
            <>
              {/* Employee Detail Header Card */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-foreground">{selectedEmployee.name}</h2>
                      <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                        {getRoleName(selectedEmployee.roleId)}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/50 border border-border text-muted-foreground">
                        {getShiftName(selectedEmployee.shiftId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Salary: ₹{selectedEmployee.monthlySalary.toLocaleString('en-IN')}/mo
                      </span>
                      {selectedEmployee.joiningDate && (
                        <span>Joined: {selectedEmployee.joiningDate}</span>
                      )}
                      {selectedEmployee.phone && (
                        <span>Phone: {selectedEmployee.phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingEmployee(selectedEmployee);
                        setShowAddEditModal(true);
                      }}
                      className="flex items-center gap-1.5 border border-border hover:bg-secondary text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      onClick={() => setShowPayoutModal(true)}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Payout Salary</span>
                    </button>
                    <button
                      onClick={() => setShowSalarySlipModal(true)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border border-border"
                      title="Print or Export Monthly Salary Slip"
                    >
                      <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Print Salary Slip</span>
                    </button>
                  </div>
                </div>

                {/* Date / Month Selectors Bar */}
                <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-sm text-foreground px-2 min-w-[130px] text-center">
                      {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="ml-2 flex items-center gap-1.5">
                      <span className="text-muted-foreground">Go to date:</span>
                      <input
                        type="date"
                        value={selectedDayStr}
                        onChange={handleGoToDate}
                        className="px-2 py-1 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Weekly Off Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={showWeeklyOff}
                      onChange={e => setShowWeeklyOff(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-0"
                    />
                    <span>Show Weekly Off (Sun) & Planning Notes</span>
                  </label>
                </div>
              </div>

              {/* Calendar Grid (Sun-Sat) */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border">
                  <span className="text-destructive">Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-20 bg-muted/10 rounded-xl border border-dashed border-border/40" />;
                    }

                    const isSelectedDay = cell.dateStr === selectedDayStr;
                    const att = attendance.find(a => a.employeeId === selectedEmployee.id && a.date === cell.dateStr)?.status;
                    const dayAdvances = salaryAdvances.filter(a => a.employeeId === selectedEmployee.id && a.date === cell.dateStr);
                    const dayAdvSum = dayAdvances.reduce((s, a) => s + (Number(a.amount) || 0), 0);

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => setSelectedDayStr(cell.dateStr)}
                        className={`h-20 p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative ${
                          isSelectedDay
                            ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30'
                            : 'bg-card hover:bg-secondary/50 border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${
                            isSelectedDay ? 'text-primary-foreground' : (cell.isSunday ? 'text-destructive' : 'text-foreground')
                          }`}>
                            {cell.dayNumber}
                          </span>

                          {/* Weekly off chip on Sundays */}
                          {showWeeklyOff && cell.isSunday && (
                            <span className={`text-[9px] font-semibold px-1 rounded ${
                              isSelectedDay ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            }`}>
                              Off
                            </span>
                          )}

                          {/* Attendance Mark Pill */}
                          {att && (
                            <span className={`w-5 h-5 rounded-md font-bold text-[10px] flex items-center justify-center ${
                              att === 'Present'
                                ? (isSelectedDay ? 'bg-primary-foreground text-primary font-bold' : 'bg-emerald-600 text-white')
                                : (isSelectedDay ? 'bg-primary-foreground text-destructive font-bold' : 'bg-destructive text-destructive-foreground')
                            }`}>
                              {att === 'Present' ? 'P' : 'A'}
                            </span>
                          )}
                        </div>

                        {/* Advance on this date */}
                        {dayAdvSum > 0 && (
                          <div className={`mt-auto text-[9px] font-semibold px-1 py-0.5 rounded truncate text-center ${
                            isSelectedDay ? 'bg-primary-foreground/20 text-primary-foreground font-bold' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          }`}>
                            Adv: ₹{dayAdvSum}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Month Summary Strip */}
                <div className="pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Present</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{monthPresentCount}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Absent</p>
                    <p className="text-base font-bold text-destructive">{monthAbsentCount}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Not Marked</p>
                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">{monthNotMarkedCount}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adv This Month</p>
                    <p className="text-base font-bold text-foreground">₹{monthAdvancesTotal.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Borrow Outst.</p>
                    <p className="text-base font-bold text-foreground">₹{totalOutstandingBorrows.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Month Payable</p>
                    <p className="text-base font-bold text-foreground">₹{monthNetPayable.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Formula Line with Sum Parity Check */}
                <div className="bg-secondary/30 border border-border p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span>Gross ₹{empGrossSalary.toLocaleString('en-IN')}</span>
                    <span>-</span>
                    <span>Advances ₹{monthAdvancesTotal.toLocaleString('en-IN')}</span>
                    <span>-</span>
                    <span>Borrow ₹{totalOutstandingBorrows.toLocaleString('en-IN')}</span>
                    <span>=</span>
                    <span className="font-bold text-foreground">Net ₹{monthNetPayable.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {parityStatus === 'OK' ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>Sum parity: OK</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Parity check: MISMATCH</span>
                      </span>
                    )}

                    {monthSalaryPayment && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground border border-accent/30">
                        Paid on {monthSalaryPayment.paid_on}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Day Detail Card & Range Check Card Grid                     */}
              {/* ------------------------------------------------------------ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Day Detail Card */}
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Day Details: {selectedDayStr}</h4>
                      <p className="text-xs text-muted-foreground">Attendance & advances on selected date</p>
                    </div>

                    {/* Attendance status toggle for selected day */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Present')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Present'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-secondary hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 border border-border'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Present</span>
                      </button>
                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Absent')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Absent'
                            ? 'bg-destructive text-destructive-foreground shadow-sm'
                            : 'bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-border'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </button>
                    </div>
                  </div>

                  {/* Advances on this Date */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Advances on this Date:</span>
                      <button
                        onClick={() => setShowAdvanceModal(true)}
                        className="text-xs font-semibold text-primary hover:underline transition-colors"
                      >
                        + Record Advance
                      </button>
                    </div>

                    {selectedDayAdvances.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-secondary/20 p-2.5 rounded-lg border border-dashed border-border">
                        No advances recorded on this date.
                      </p>
                    ) : (
                      selectedDayAdvances.map(adv => (
                        <div key={adv.id} className="p-2.5 bg-secondary/30 rounded-lg border border-border flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-foreground">₹{adv.amount}</span>
                            {adv.reason && <span className="text-muted-foreground ml-2">({adv.reason})</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Deducted: ₹{adv.deducted_amount || 0}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Borrows on this Date & Button */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Borrows on this Date:</span>
                      <button
                        onClick={() => setShowBorrowModal(true)}
                        className="text-xs font-semibold text-primary hover:underline transition-colors"
                      >
                        + Record Borrow
                      </button>
                    </div>

                    {selectedDayBorrows.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-secondary/20 p-2.5 rounded-lg border border-dashed border-border">
                        No borrow entries on this date.
                      </p>
                    ) : (
                      selectedDayBorrows.map(b => (
                        <div key={b.id} className="p-2.5 bg-secondary/30 rounded-lg border border-border flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-foreground">₹{b.amount}</span>
                            {b.reason && <span className="text-muted-foreground ml-2">({b.reason})</span>}
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            b.status === 'settled' 
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}>
                            {b.status} (Repaid: ₹{b.repaid_amount || 0})
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Range Check Card */}
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Range Check</h4>
                    <p className="text-xs text-muted-foreground">Custom date range summary</p>
                  </div>

                  {/* Range date pickers */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">From Date</label>
                      <input
                        type="date"
                        value={rangeFrom}
                        onChange={e => setRangeFrom(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">To Date</label>
                      <input
                        type="date"
                        value={rangeTo}
                        onChange={e => setRangeTo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Range Result Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border text-center">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Present Days</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{rangeCheckStats.present}</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border text-center">
                      <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Absent Days</p>
                      <p className="text-lg font-bold text-destructive">{rangeCheckStats.absent}</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Advances in Range</p>
                      <p className="text-lg font-bold text-foreground">₹{rangeCheckStats.advances.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Borrows in Range</p>
                      <p className="text-lg font-bold text-foreground">₹{rangeCheckStats.borrows.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-card text-card-foreground rounded-xl p-12 shadow-sm border border-border text-center space-y-3">
              <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-bold text-foreground">No Staff Member Selected</h3>
              <p className="text-xs text-muted-foreground">Select an employee from the left panel or click "+ Add Staff" to register a new employee.</p>
            </div>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* 3. MODALS                                                     */}
      {/* ============================================================== */}

      {/* ------------------------------------------------------------ */}
      {/* Payout Modal                                                 */}
      {/* ------------------------------------------------------------ */}
      {showPayoutModal && selectedEmployee && (
        <PayoutModal
          employee={selectedEmployee}
          month={currentMonthStr}
          grossSalary={empGrossSalary}
          totalOutstandingAdvances={totalOutstandingAdvances}
          monthAdvancesTotal={monthAdvancesTotal}
          totalOutstandingBorrows={totalOutstandingBorrows}
          existingPayment={monthSalaryPayment}
          onClose={() => setShowPayoutModal(false)}
          onExecute={(payoutData) => {
            const res = executePayout(payoutData);
            if (res.success) {
              setShowPayoutModal(false);
            } else {
              alert(res.error || 'Failed to record payout');
            }
          }}
          onVoid={(paymentId) => {
            const conf = window.confirm('Voiding this payout will restore the deducted amounts back to outstanding advances and borrows. Proceed?');
            if (conf) {
              const res = voidPayout(paymentId);
              if (res.success) {
                setShowPayoutModal(false);
              } else {
                alert(res.error || 'Failed to void payout');
              }
            }
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Add / Edit Staff Modal (with Vault Integration)               */}
      {/* ------------------------------------------------------------ */}
      {showAddEditModal && (
        <AddEditEmployeeModal
          employee={editingEmployee}
          staffRoles={staffRoles}
          shifts={shifts}
          vaultStatus={vaultStatus}
          decryptedVaultData={decryptedVaultData}
          onOpenVault={() => {
            setVaultError('');
            setShowVaultPrompt(true);
          }}
          onClose={() => {
            setShowAddEditModal(false);
            setEditingEmployee(null);
          }}
          onSave={async (empData, sensitiveData) => {
            let targetId = editingEmployee ? editingEmployee.id : '';
            if (editingEmployee) {
              updateEmployee(editingEmployee.id, empData);
            } else {
              const newEmp = addEmployee(empData);
              targetId = newEmp.id;
            }

            // Save sensitive data to vault if unlocked & provided
            if (targetId && vaultStatus.unlocked && sensitiveData && window.electronAPI?.vaultSave) {
              try {
                await window.electronAPI.vaultSave(targetId, sensitiveData);
              } catch (err) {
                console.error('Error saving sensitive record to vault:', err);
              }
            }

            setShowAddEditModal(false);
            setEditingEmployee(null);
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Record Advance Modal                                         */}
      {/* ------------------------------------------------------------ */}
      {showAdvanceModal && selectedEmployee && (
        <RecordAdvanceModal
          employee={selectedEmployee}
          defaultDate={selectedDayStr}
          onClose={() => setShowAdvanceModal(false)}
          onSave={(amount, date, reason) => {
            addSalaryAdvance({
              employeeId: selectedEmployee.id,
              amount,
              date,
              reason
            });
            setShowAdvanceModal(false);
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Record Borrow Modal                                          */}
      {/* ------------------------------------------------------------ */}
      {showBorrowModal && selectedEmployee && (
        <RecordBorrowModal
          employee={selectedEmployee}
          defaultDate={selectedDayStr}
          onClose={() => setShowBorrowModal(false)}
          onSave={(amount, date, reason) => {
            addBorrow({
              employeeId: selectedEmployee.id,
              amount,
              date,
              reason
            });
            setShowBorrowModal(false);
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Salary Slip Modal                                            */}
      {/* ------------------------------------------------------------ */}
      {showSalarySlipModal && selectedEmployee && (
        <SalarySlipModal
          employee={selectedEmployee}
          initialMonth={currentMonthStr}
          staffRoles={staffRoles}
          shifts={shifts}
          attendance={attendance}
          salaryAdvances={salaryAdvances}
          borrows={borrows}
          salaryPayments={salaryPayments}
          salaryDeductionLedger={salaryDeductionLedger}
          invoiceSettings={invoiceSettings}
          onClose={() => setShowSalarySlipModal(false)}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Vault Password Dialog                                        */}
      {/* ------------------------------------------------------------ */}
      {showVaultPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-md w-full border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground border border-border flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-foreground">
                  {vaultStatus.initialized ? 'Unlock Aadhaar Vault' : 'Setup Master Vault Password'}
                </h3>
              </div>
              <button onClick={() => setShowVaultPrompt(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {vaultStatus.initialized
                ? 'Enter your master vault password to decrypt and view sensitive documents (Aadhaar number, photo proofs). Vault automatically locks after 5 minutes of inactivity.'
                : 'Create a strong master password to encrypt sensitive staff records with AES-256-GCM. Note: This password is never saved anywhere and cannot be recovered.'}
            </p>

            {vaultLockoutSeconds > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Rate limit lockout active. Please wait {vaultLockoutSeconds} seconds.</span>
              </div>
            )}

            {vaultError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{vaultError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {vaultStatus.initialized ? 'Master Vault Password' : 'New Master Vault Password'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={vaultPassword}
                  onChange={e => setVaultPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUnlockOrSetupVault()}
                  disabled={vaultLockoutSeconds > 0}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVaultPrompt(false)}
                  className="px-4 py-2 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUnlockOrSetupVault}
                  disabled={vaultLockoutSeconds > 0 || !vaultPassword.trim()}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {vaultStatus.initialized ? 'Unlock' : 'Initialize & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Staff;

// ====================================================================
// SUB-COMPONENT: PayoutModal
// ====================================================================
interface PayoutModalProps {
  employee: Employee;
  month: string;
  grossSalary: number;
  totalOutstandingAdvances: number;
  monthAdvancesTotal: number;
  totalOutstandingBorrows: number;
  existingPayment: SalaryPayment | null;
  onClose: () => void;
  onExecute: (payoutData: {
    employeeId: string;
    month: string;
    gross: number;
    advanceDeducted: number;
    borrowDeducted: number;
    netPaid: number;
    paidOn: string;
    paymentRef?: string;
    note?: string;
  }) => void;
  onVoid: (paymentId: string) => void;
}

const PayoutModal = ({
  employee,
  month,
  grossSalary,
  totalOutstandingAdvances,
  monthAdvancesTotal,
  totalOutstandingBorrows,
  existingPayment,
  onClose,
  onExecute,
  onVoid
}: PayoutModalProps) => {
  // Pre-filled deduction defaults:
  // 1. advances deducted first: min(totalOutstandingAdvances, grossSalary)
  // 2. borrow deducted: min(totalOutstandingBorrows, max(0, grossSalary - advDeduction))
  const initialAdvDeduction = Math.min(totalOutstandingAdvances, grossSalary);
  const initialBorrowDeduction = Math.min(totalOutstandingBorrows, Math.max(0, grossSalary - initialAdvDeduction));

  const [advanceDeducted, setAdvanceDeducted] = useState<number>(initialAdvDeduction);
  const [borrowDeducted, setBorrowDeducted] = useState<number>(initialBorrowDeduction);
  const [paymentRef, setPaymentRef] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');
  const [paidOn, setPaidOn] = useState<string>(() => toLocalDateString(new Date()));

  // Capped net calculation
  const calculatedNet = Math.max(0, grossSalary - advanceDeducted - borrowDeducted);

  const handleAdvanceChange = (val: number) => {
    const capped = Math.min(Math.max(0, val), totalOutstandingAdvances);
    setAdvanceDeducted(capped);
    // ensure borrow deduction + adv deduction doesn't exceed gross
    if (capped + borrowDeducted > grossSalary) {
      setBorrowDeducted(Math.max(0, grossSalary - capped));
    }
  };

  const handleBorrowChange = (val: number) => {
    const maxAvailable = Math.max(0, grossSalary - advanceDeducted);
    const capped = Math.min(Math.max(0, val), totalOutstandingBorrows, maxAvailable);
    setBorrowDeducted(capped);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute({
      employeeId: employee.id,
      month,
      gross: grossSalary,
      advanceDeducted,
      borrowDeducted,
      netPaid: calculatedNet,
      paidOn,
      paymentRef,
      note
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-lg w-full border border-border space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-base text-foreground">Salary Payout - {employee.name}</h3>
            <p className="text-xs text-muted-foreground">Month: {month}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {existingPayment ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Salary Already Paid for {month}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-foreground pt-2 border-t border-emerald-500/20">
                <p>Gross Salary: <span className="font-bold">₹{existingPayment.gross}</span></p>
                <p>Net Paid: <span className="font-bold">₹{existingPayment.net_paid}</span></p>
                <p>Advances Deducted: <span className="font-bold">₹{existingPayment.advance_deducted}</span></p>
                <p>Borrow Deducted: <span className="font-bold">₹{existingPayment.borrow_deducted}</span></p>
                <p>Paid On: <span className="font-bold">{existingPayment.paid_on}</span></p>
                {existingPayment.payment_ref && <p>Reference: <span className="font-bold">{existingPayment.payment_ref}</span></p>}
              </div>
              {existingPayment.note && (
                <p className="text-xs text-muted-foreground italic pt-1">Note: {existingPayment.note}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => onVoid(existingPayment.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-lg text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Void Payout & Restore Balances</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Overview cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase">Gross Salary</p>
                <p className="font-bold text-foreground text-sm">₹{grossSalary.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2.5 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase">Total Adv Outst.</p>
                <p className="font-bold text-foreground text-sm">₹{totalOutstandingAdvances.toLocaleString('en-IN')}</p>
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">(₹{monthAdvancesTotal} this mo)</span>
              </div>
              <div className="p-2.5 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase">Borrow Outst.</p>
                <p className="font-bold text-foreground text-sm">₹{totalOutstandingBorrows.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Editable Deduction Fields */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Advance to Deduct (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalOutstandingAdvances}
                    value={advanceDeducted}
                    onChange={e => handleAdvanceChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Max: ₹{totalOutstandingAdvances}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Borrow to Deduct (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalOutstandingBorrows}
                    value={borrowDeducted}
                    onChange={e => handleBorrowChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Max: ₹{totalOutstandingBorrows}</p>
                </div>
              </div>

              {/* Net Payable Result */}
              <div className="p-3 bg-secondary/50 rounded-xl border border-border flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Net Payable Amount:</span>
                <span className="text-lg font-black text-foreground">₹{calculatedNet.toLocaleString('en-IN')}</span>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paidOn}
                    onChange={e => setPaidOn(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Payment Method / Ref</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="Cash / UPI / Bank"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Month end payout"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                Confirm & Pay ₹{calculatedNet.toLocaleString('en-IN')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: AddEditEmployeeModal
// ====================================================================
interface AddEditEmployeeModalProps {
  employee: Employee | null;
  staffRoles: any[];
  shifts: any[];
  vaultStatus: { initialized: boolean; unlocked: boolean; lockedUntil?: number };
  decryptedVaultData: { aadhaarNumber?: string; aadhaarImage?: string; photo?: string } | null;
  onOpenVault: () => void;
  onClose: () => void;
  onSave: (
    empData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>,
    sensitiveData?: { aadhaarNumber?: string; aadhaarImage?: string; photo?: string }
  ) => void;
}

const AddEditEmployeeModal = ({
  employee,
  staffRoles,
  shifts,
  vaultStatus,
  decryptedVaultData,
  onOpenVault,
  onClose,
  onSave
}: AddEditEmployeeModalProps) => {
  const [name, setName] = useState(employee?.name || '');
  const [roleId, setRoleId] = useState(employee?.roleId || staffRoles[0]?.id || '');
  const [shiftId, setShiftId] = useState(employee?.shiftId || shifts[0]?.id || '');
  const [salary, setSalary] = useState<number>(employee?.monthlySalary || 5000);
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate || toLocalDateString(new Date()));
  const [phone, setPhone] = useState(employee?.phone || '');
  const [address, setAddress] = useState(employee?.address || '');
  
  // Sensitive Vault Fields
  const [fullAadhaar, setFullAadhaar] = useState<string>(decryptedVaultData?.aadhaarNumber || '');
  const [aadhaarImageBase64, setAadhaarImageBase64] = useState<string>(decryptedVaultData?.aadhaarImage || '');
  const [photoBase64, setPhotoBase64] = useState<string>(decryptedVaultData?.photo || '');

  useEffect(() => {
    if (decryptedVaultData) {
      if (decryptedVaultData.aadhaarNumber) setFullAadhaar(decryptedVaultData.aadhaarNumber);
      if (decryptedVaultData.aadhaarImage) setAadhaarImageBase64(decryptedVaultData.aadhaarImage);
      if (decryptedVaultData.photo) setPhotoBase64(decryptedVaultData.photo);
    }
  }, [decryptedVaultData]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Extract last 4 digits of Aadhaar if entered
    const cleanAadhaar = fullAadhaar.replace(/\s+/g, '');
    const aadhaarLast4 = cleanAadhaar.length >= 4 ? cleanAadhaar.slice(-4) : (employee?.aadhaarLast4 || undefined);

    const empData: Omit<Employee, 'id' | 'created_at' | 'updated_at'> = {
      name: name.trim(),
      roleId,
      shiftId,
      monthlySalary: Number(salary) || 0,
      joiningDate,
      status: 'active',
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      aadhaarLast4
    };

    const sensitiveData = {
      aadhaarNumber: fullAadhaar.trim() || undefined,
      aadhaarImage: aadhaarImageBase64 || undefined,
      photo: photoBase64 || undefined
    };

    onSave(empData, sensitiveData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-xl w-full border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">
            {employee ? 'Edit Staff Member' : 'Register New Staff Member'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bablu Kumar"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Monthly Salary (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={salary}
                onChange={e => setSalary(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Designation / Role *</label>
              <select
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {staffRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Shift</label>
              <select
                value={shiftId}
                onChange={e => setShiftId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Joining Date</label>
              <input
                type="date"
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Address / Permanent Location</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Village, Post, Dist, State"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* SENSITIVE LOCAL VAULT SECTION */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-bold text-foreground">Encrypted ID Vault (Local Disk AES-256-GCM)</h4>
              </div>
              <button
                type="button"
                onClick={onOpenVault}
                className="text-[11px] font-semibold text-primary underline hover:text-primary/80 transition-colors"
              >
                {vaultStatus.unlocked ? 'Vault Unlocked' : 'Unlock to view/edit'}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Full Aadhaar number and ID card image are encrypted locally and never transmitted to Supabase or the cloud.
            </p>

            {vaultStatus.unlocked ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Full Aadhaar Number (12 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={fullAadhaar}
                    onChange={e => setFullAadhaar(e.target.value)}
                    placeholder="1234 5678 9012"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Aadhaar Card Photo / PDF
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => handleFileUpload(e, setAadhaarImageBase64)}
                      className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-colors"
                    />
                    {aadhaarImageBase64 && (
                      <div className="mt-2">
                        <img
                          src={aadhaarImageBase64}
                          alt="Aadhaar Preview"
                          className="h-16 rounded border border-border object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Staff Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, setPhotoBase64)}
                      className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-colors"
                    />
                    {photoBase64 && (
                      <div className="mt-2">
                        <img
                          src={photoBase64}
                          alt="Photo Preview"
                          className="w-16 h-16 rounded-full border border-border object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-card rounded-lg border border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vault is currently locked.</span>
                <button
                  type="button"
                  onClick={onOpenVault}
                  className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Enter Master Password
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Save Staff Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: RecordAdvanceModal
// ====================================================================
interface RecordAdvanceModalProps {
  employee: Employee;
  defaultDate: string;
  onClose: () => void;
  onSave: (amount: number, date: string, reason?: string) => void;
}

const RecordAdvanceModal = ({ employee, defaultDate, onClose, onSave }: RecordAdvanceModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(defaultDate);
  const [reason, setReason] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    onSave(amount, date, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-sm w-full border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-sm text-foreground">Record Advance: {employee.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Advance Amount (₹) *</label>
            <input
              type="number"
              min="1"
              required
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 1000"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">Reason / Note</label>
              <span className="text-[10px] text-muted-foreground italic">Prints on monthly salary slip</span>
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Festival advance, emergency (prints on slip, defaults to '-')"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Suggested: Enter a brief reason for the employee's salary slip.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Save Advance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: RecordBorrowModal
// ====================================================================
interface RecordBorrowModalProps {
  employee: Employee;
  defaultDate: string;
  onClose: () => void;
  onSave: (amount: number, date: string, reason?: string) => void;
}

const RecordBorrowModal = ({ employee, defaultDate, onClose, onSave }: RecordBorrowModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(defaultDate);
  const [reason, setReason] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    onSave(amount, date, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-sm w-full border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-sm text-foreground">Record Borrow: {employee.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Borrow Amount (₹) *</label>
            <input
              type="number"
              min="1"
              required
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 500"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">Reason / Note</label>
              <span className="text-[10px] text-muted-foreground italic">Prints on monthly salary slip</span>
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Medical, personal loan (prints on slip, defaults to '-')"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Suggested: Enter a brief reason for the employee's salary slip.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Save Borrow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: SalarySlipModal
// ====================================================================
interface SalarySlipModalProps {
  employee: Employee;
  initialMonth: string; // YYYY-MM
  staffRoles: StaffRole[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  salaryPayments: SalaryPayment[];
  salaryDeductionLedger: SalaryDeductionLedgerItem[];
  invoiceSettings: InvoiceSettings;
  onClose: () => void;
}

const SalarySlipModal = ({
  employee,
  initialMonth,
  staffRoles,
  shifts,
  attendance,
  salaryAdvances,
  borrows,
  salaryPayments,
  salaryDeductionLedger,
  invoiceSettings,
  onClose
}: SalarySlipModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
  };

  const slipData = useMemo(() => {
    return calculateSalarySlipData({
      employee,
      month: selectedMonth,
      staffRoles,
      shifts,
      attendance,
      salaryAdvances,
      borrows,
      salaryPayments,
      salaryDeductionLedger,
      invoiceSettings
    });
  }, [employee, selectedMonth, staffRoles, shifts, attendance, salaryAdvances, borrows, salaryPayments, salaryDeductionLedger, invoiceSettings]);

  const slipHtml = useMemo(() => {
    return generateSalarySlipHtml(slipData);
  }, [slipData]);

  const handlePrint = async () => {
    if (window.electronAPI?.printPreview) {
      await window.electronAPI.printPreview(slipHtml);
    } else {
      window.print();
    }
  };

  const handleSavePdf = async () => {
    if (window.electronAPI?.pdfSaveAs) {
      const safeName = employee.name.replace(/\s+/g, '_');
      const defaultFilename = `Salary_Slip_${safeName}_${selectedMonth}.pdf`;
      try {
        const res = await window.electronAPI.pdfSaveAs(defaultFilename, slipHtml);
        if (res.success) {
          toast.success(`Salary slip saved: ${res.filePath}`);
        } else if (res.canceled) {
          // Dialog was canceled by user, no action needed
        } else {
          toast.error(res.error || 'Failed to save PDF');
        }
      } catch (err: any) {
        toast.error('Error saving PDF: ' + (err?.message || String(err)));
      }
    } else {
      toast.error('PDF export is available in Desktop application');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl shadow-2xl max-w-5xl w-full border border-border flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="bg-card px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground border border-border flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">Salary Slip: {employee.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  slipData.isPaid 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}>
                  {slipData.statusText}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">A4 Print Preview & PDF Export</p>
            </div>
          </div>

          {/* Month selector and Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-secondary/80 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground px-1 py-0.5 focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-secondary/80 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Print Salary Slip"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              className="flex items-center gap-1.5 bg-secondary border border-border hover:bg-secondary/80 text-secondary-foreground px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Save as PDF (choose file location)"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors ml-1"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable A4 Document Preview */}
        <div className="flex-1 bg-muted/60 dark:bg-muted/20 p-4 sm:p-6 overflow-y-auto flex justify-center">
          <div className="bg-white shadow-2xl rounded-sm w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 border border-neutral-300 text-black">
            <div dangerouslySetInnerHTML={{ __html: slipHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
};
