import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { 
  Users, Check, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Lock, Unlock, DollarSign, Plus, Trash2, Edit2, 
  CheckCircle2, Clock, Search, ArrowRight, Printer, Download,
  AlertTriangle, RotateCcw, AlertCircle, FileText, Ban, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { 
  Employee, SalaryAdvance, BorrowRecord, SalaryPayment, StaffRole, Shift, 
  AttendanceRecord, SalaryDeductionLedgerItem, InvoiceSettings, SalaryAdjustment 
} from '@/types';
import { toLocalDateString } from '@/utils/dateUtils';
import { calculateSalarySlipData, generateSalarySlipHtml } from '@/utils/salarySlipUtils';
import { 
  SalaryCycle, generateEmployeeCycles, calculateCycleAttendance, 
  calculateCycleFinancials, formatDDMMYYYY, diffDaysInclusive 
} from '@/utils/salaryCycleUtils';

const Staff = () => {
  const {
    staffRoles,
    shifts,
    employees,
    attendance,
    salaryAdvances,
    borrows,
    salaryAdjustments,
    salaryPayments,
    salaryDeductionLedger,
    invoiceSettings,
    currentUser,
    appRoles,
    addEmployee,
    updateEmployee,
    softDeleteEmployee,
    markAttendance,
    markAllPresent,
    addSalaryAdvance,
    updateSalaryAdvance,
    deleteSalaryAdvance,
    addBorrow,
    updateBorrow,
    deleteBorrow,
    addSalaryAdjustment,
    deleteSalaryAdjustment,
    executeCyclePayout,
    reverseCyclePayout,
    finalSettlement,
  } = useStore(useShallow(state => ({
    staffRoles: state.staffRoles,
    shifts: state.shifts,
    employees: state.employees,
    attendance: state.attendance,
    salaryAdvances: state.salaryAdvances,
    borrows: state.borrows,
    salaryAdjustments: state.salaryAdjustments,
    salaryPayments: state.salaryPayments,
    salaryDeductionLedger: state.salaryDeductionLedger,
    invoiceSettings: state.invoiceSettings,
    currentUser: state.currentUser,
    appRoles: state.appRoles,
    addEmployee: state.addEmployee,
    updateEmployee: state.updateEmployee,
    softDeleteEmployee: state.softDeleteEmployee,
    markAttendance: state.markAttendance,
    markAllPresent: state.markAllPresent,
    addSalaryAdvance: state.addSalaryAdvance,
    updateSalaryAdvance: state.updateSalaryAdvance,
    deleteSalaryAdvance: state.deleteSalaryAdvance,
    addBorrow: state.addBorrow,
    updateBorrow: state.updateBorrow,
    deleteBorrow: state.deleteBorrow,
    addSalaryAdjustment: state.addSalaryAdjustment,
    deleteSalaryAdjustment: state.deleteSalaryAdjustment,
    executeCyclePayout: state.executeCyclePayout,
    reverseCyclePayout: state.reverseCyclePayout,
    finalSettlement: state.finalSettlement,
  })));

  // Today string
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

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

  // Employee Cycles & Active Cycle Selection
  const employeeCycles = useMemo(() => {
    if (!selectedEmployee) return [];
    return generateEmployeeCycles(selectedEmployee, todayStr, salaryPayments, attendance);
  }, [selectedEmployee, todayStr, salaryPayments, attendance]);

  const [selectedCycleIdx, setSelectedCycleIdx] = useState<number>(0);

  useEffect(() => {
    if (employeeCycles.length > 0) {
      // Find the first Due cycle, or fallback to the latest cycle
      const dueIdx = employeeCycles.findIndex(c => c.status === 'Due');
      if (dueIdx >= 0) {
        setSelectedCycleIdx(dueIdx);
      } else {
        setSelectedCycleIdx(employeeCycles.length - 1);
      }
    } else {
      setSelectedCycleIdx(0);
    }
  }, [selectedEmployee?.id, employeeCycles.length]);

  const selectedCycle = useMemo(() => {
    if (!employeeCycles.length) return null;
    return employeeCycles[selectedCycleIdx] || employeeCycles[employeeCycles.length - 1] || null;
  }, [employeeCycles, selectedCycleIdx]);

  // Sync calendar month with selected cycle start date
  useEffect(() => {
    if (selectedCycle) {
      const parts = selectedCycle.startDate.split('-').map(Number);
      setViewDate(new Date(parts[0], parts[1] - 1, 1));
      setSelectedDayStr(selectedCycle.startDate);
    }
  }, [selectedCycle?.id]);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [showReverseModal, setShowReverseModal] = useState<boolean>(false);
  const [paymentToReverse, setPaymentToReverse] = useState<SalaryPayment | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [showFinalSettlementModal, setShowFinalSettlementModal] = useState<boolean>(false);
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

  // Check vault status
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
          toast.success('Vault setup complete');
        } else {
          setVaultError(res.error || 'Failed to setup vault');
        }
      } else {
        const res = await window.electronAPI.vaultUnlock(vaultPassword);
        if (res.success) {
          setVaultPassword('');
          setShowVaultPrompt(false);
          await checkVaultStatus();
          toast.success('Vault unlocked');
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
      toast.info('Vault locked');
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

  // PRD Section 9: "Payable now" - sum of net for all Due cycles across active staff
  const totalPayableNow = useMemo(() => {
    return activeEmployees.reduce((total, emp) => {
      const empCycles = generateEmployeeCycles(emp, todayStr, salaryPayments, attendance);
      const dueCycles = empCycles.filter(c => c.status === 'Due');
      let empDueTotal = 0;
      for (const dc of dueCycles) {
        const attSummary = calculateCycleAttendance(emp, dc, attendance, todayStr);
        const cycleAdvs = salaryAdvances
          .filter(a => a.employeeId === emp.id && !a.deleted_at && (a.transactionDate || a.date) >= dc.startDate && (a.transactionDate || a.date) <= dc.endDate)
          .reduce((s, a) => s + (Number(a.amount) || 0), 0);
        
        const openAdjs = (salaryAdjustments || [])
          .filter(a => a.employeeId === emp.id && a.status === 'Open' && !a.deleted_at)
          .reduce((s, a) => s + Number(a.amount || 0), 0);

        const fin = calculateCycleFinancials(
          emp.monthlySalary,
          dc.cycleDays,
          attSummary.deductedDays,
          cycleAdvs,
          0,
          0,
          openAdjs
        );
        empDueTotal += fin.netPayable;
      }
      return total + empDueTotal;
    }, 0);
  }, [activeEmployees, todayStr, salaryPayments, attendance, salaryAdvances, salaryAdjustments]);

  // --- SELECTED EMPLOYEE & CYCLE CALCULATIONS ---
  const cycleAttendance = useMemo(() => {
    if (!selectedEmployee || !selectedCycle) return null;
    return calculateCycleAttendance(selectedEmployee, selectedCycle, attendance, todayStr);
  }, [selectedEmployee, selectedCycle, attendance, todayStr]);

  // Advances in selected cycle
  const cycleAdvances = useMemo(() => {
    if (!selectedEmployee || !selectedCycle) return [];
    return salaryAdvances.filter(a => {
      const d = a.transactionDate || a.date;
      return a.employeeId === selectedEmployee.id && !a.deleted_at && d >= selectedCycle.startDate && d <= selectedCycle.endDate;
    });
  }, [selectedEmployee, selectedCycle, salaryAdvances]);

  const cycleAdvancesTotal = useMemo(() => {
    return cycleAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [cycleAdvances]);

  // Prior open advances (carried forward)
  const priorAdvances = useMemo(() => {
    if (!selectedEmployee || !selectedCycle) return [];
    return salaryAdvances.filter(a => {
      const d = a.transactionDate || a.date;
      return a.employeeId === selectedEmployee.id && !a.deleted_at && d < selectedCycle.startDate && a.status === 'Open';
    });
  }, [selectedEmployee, selectedCycle, salaryAdvances]);

  const priorAdvancesTotal = useMemo(() => {
    return priorAdvances.reduce((sum, a) => sum + Math.max(0, a.amount - (a.deducted_amount || 0)), 0);
  }, [priorAdvances]);

  // Outstanding Borrows for employee
  const outstandingBorrows = useMemo(() => {
    if (!selectedEmployee) return [];
    return borrows.filter(b => b.employeeId === selectedEmployee.id && b.status !== 'settled' && !b.deleted_at);
  }, [selectedEmployee, borrows]);

  const totalOutstandingBorrows = useMemo(() => {
    return outstandingBorrows.reduce((sum, b) => sum + Math.max(0, b.amount - (b.repaid_amount || 0)), 0);
  }, [outstandingBorrows]);

  // Employee Adjustments
  const employeeAdjustments = useMemo(() => {
    if (!selectedEmployee) return [];
    return (salaryAdjustments || []).filter(a => a.employeeId === selectedEmployee.id && !a.deleted_at);
  }, [selectedEmployee, salaryAdjustments]);

  const openAdjustments = useMemo(() => {
    return employeeAdjustments.filter(a => a.status === 'Open');
  }, [employeeAdjustments]);

  const openAdjustmentsTotal = useMemo(() => {
    return openAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [openAdjustments]);

  // Financial summary for selected cycle
  const cycleFinancials = useMemo(() => {
    if (!selectedEmployee || !selectedCycle || !cycleAttendance) return null;
    return calculateCycleFinancials(
      selectedEmployee.monthlySalary,
      selectedCycle.cycleDays,
      cycleAttendance.deductedDays,
      cycleAdvancesTotal,
      priorAdvancesTotal,
      0, // borrow recovery requires explicit selection in payout modal
      openAdjustmentsTotal
    );
  }, [selectedEmployee, selectedCycle, cycleAttendance, cycleAdvancesTotal, priorAdvancesTotal, openAdjustmentsTotal]);

  // Calendar cells generation for viewDate month
  const daysInViewMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const calendarCells = useMemo(() => {
    const firstDayIdx = new Date(year, month, 1).getDay(); // 0 = Sunday
    const cells: Array<{ dayNumber: number; dateStr: string; isSunday: boolean } | null> = [];
    
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push(null);
    }
    
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

  // Toggle day attendance through: Present -> Absent -> Paid Leave -> Unpaid Leave -> Present
  const handleDayAttendanceToggle = (dateStr: string) => {
    if (!selectedEmployee) return;
    if (dateStr < selectedEmployee.joiningDate) {
      toast.error(`Cannot mark attendance before joining date (${formatDDMMYYYY(selectedEmployee.joiningDate)})`);
      return;
    }
    if (dateStr > todayStr) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const currentRecord = attendance.find(a => a.employeeId === selectedEmployee.id && a.date === dateStr && !a.deleted_at);
    const currentStatus = currentRecord?.status;

    let nextStatus: 'Present' | 'Absent' | 'Paid Leave' | 'Unpaid Leave';
    if (!currentStatus) {
      nextStatus = 'Present';
    } else if (currentStatus === 'Present') {
      nextStatus = 'Absent';
    } else if (currentStatus === 'Absent') {
      nextStatus = 'Paid Leave';
    } else if (currentStatus === 'Paid Leave') {
      nextStatus = 'Unpaid Leave';
    } else {
      nextStatus = 'Present';
    }

    markAttendance(selectedEmployee.id, dateStr, nextStatus);
  };

  // Day detail attendance status & transactions on selectedDayStr
  const selectedDayAttendanceStatus = useMemo(() => {
    if (!selectedEmployee) return null;
    return attendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDayStr && !a.deleted_at)?.status || null;
  }, [selectedEmployee, attendance, selectedDayStr]);

  const selectedDayAdvances = useMemo(() => {
    if (!selectedEmployee) return [];
    return salaryAdvances.filter(a => {
      const d = a.transactionDate || a.date;
      return a.employeeId === selectedEmployee.id && !a.deleted_at && d === selectedDayStr;
    });
  }, [selectedEmployee, salaryAdvances, selectedDayStr]);

  const selectedDayBorrows = useMemo(() => {
    if (!selectedEmployee) return [];
    return borrows.filter(b => {
      const d = b.transactionDate || b.date;
      return b.employeeId === selectedEmployee.id && !b.deleted_at && d === selectedDayStr;
    });
  }, [selectedEmployee, borrows, selectedDayStr]);

  // Range Check calculated stats
  const rangeCheckStats = useMemo(() => {
    if (!selectedEmployee || !rangeFrom || !rangeTo) {
      return { present: 0, absent: 0, paidLeave: 0, unpaidLeave: 0, advances: 0, borrows: 0 };
    }
    const empAtt = attendance.filter(a => a.employeeId === selectedEmployee.id && !a.deleted_at && a.date >= rangeFrom && a.date <= rangeTo);
    const present = empAtt.filter(a => a.status === 'Present').length;
    const absent = empAtt.filter(a => a.status === 'Absent').length;
    const paidLeave = empAtt.filter(a => a.status === 'Paid Leave').length;
    const unpaidLeave = empAtt.filter(a => a.status === 'Unpaid Leave').length;
    const advs = salaryAdvances
      .filter(a => a.employeeId === selectedEmployee.id && !a.deleted_at && (a.transactionDate || a.date) >= rangeFrom && (a.transactionDate || a.date) <= rangeTo)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const brws = borrows
      .filter(b => b.employeeId === selectedEmployee.id && !b.deleted_at && (b.transactionDate || b.date) >= rangeFrom && (b.transactionDate || b.date) <= rangeTo)
      .reduce((s, b) => s + (Number(b.amount) || 0), 0);
    return { present, absent, paidLeave, unpaidLeave, advances: advs, borrows: brws };
  }, [selectedEmployee, attendance, salaryAdvances, borrows, rangeFrom, rangeTo]);

  // Role & Shift display helpers
  const getRoleName = (roleId: string) => {
    return staffRoles.find(r => r.id === roleId)?.name || 'Staff';
  };

  const getShiftName = (shiftId?: string) => {
    if (!shiftId) return 'Regular';
    return shifts.find(s => s.id === shiftId)?.name || 'Regular';
  };

  // Check admin role
  const isAdmin = useMemo(() => {
    if (currentUser === 'master') return true;
    if (currentUser && typeof currentUser === 'object') {
      const r = appRoles.find(role => role.id === currentUser.roleId);
      return !!(r && (r.name.toLowerCase().includes('admin') || r.id === 'role-admin'));
    }
    return false;
  }, [currentUser, appRoles]);

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* ============================================================== */}
      {/* 1. TOP HEADER & STATS CARDS (Matching Dashboard)              */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Staff Management</h2>
          <p className="text-xs text-muted-foreground">Manage employees, daily attendance, advances, borrows, and cycle payouts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              markAllPresent(todayStr);
              toast.success(`Marked all active staff as Present for ${formatDDMMYYYY(todayStr)}`);
            }}
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

        {/* PRD Section 9: Top card "Payable now" */}
        <div className="stat-card hover:border-primary/50">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Payable Now</p>
              <p className="text-3xl font-bold text-foreground">₹{totalPayableNow.toLocaleString('en-IN')}</p>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Staff Members</h3>
                <p className="text-xs text-muted-foreground">{filteredEmployees.length} registered</p>
              </div>
              {/* Double plus bug fix: "Add Staff" instead of "+ Add Staff" */}
              <button
                onClick={() => {
                  setEditingEmployee(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff</span>
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

            {/* Employee List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No staff members found matching query.
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const isSelected = emp.id === selectedEmpId;
                  const empCycles = generateEmployeeCycles(emp, todayStr, salaryPayments, attendance);
                  const hasDue = empCycles.some(c => c.status === 'Due');

                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/40' 
                          : 'bg-card hover:bg-secondary/60 text-card-foreground border-border'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{emp.name}</span>
                          {hasDue && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-amber-400 text-black' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            }`}>
                              Due
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {getRoleName(emp.roleId)} &bull; ₹{emp.monthlySalary.toLocaleString('en-IN')}/mo
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <ArrowRight className={`w-4 h-4 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Local Encrypted ID Vault Card */}
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground border border-border flex items-center justify-center">
                  {vaultStatus.unlocked ? <Unlock className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-foreground">Aadhaar Vault</h4>
                  <p className="text-[10px] text-muted-foreground">
                    {vaultStatus.unlocked ? 'Unlocked (AES-256-GCM)' : (vaultStatus.initialized ? 'Locked' : 'Not setup')}
                  </p>
                </div>
              </div>

              <button
                type="button"
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
                        <span>Joined: {formatDDMMYYYY(selectedEmployee.joiningDate)}</span>
                      )}
                      {selectedEmployee.phone && (
                        <span>Phone: {selectedEmployee.phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
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
                      onClick={() => setShowAdvanceModal(true)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      title="Record an Advance for this staff member"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Advance</span>
                    </button>

                    <button
                      onClick={() => setShowBorrowModal(true)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      title="Record a Borrow for this staff member"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Borrow</span>
                    </button>

                    <button
                      onClick={() => setShowAdjustmentModal(true)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      title="Add a manual salary adjustment (+/-)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adjustment</span>
                    </button>

                    <button
                      onClick={() => setShowSalarySlipModal(true)}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-border"
                      title="Print or Export Salary Slip for this cycle"
                    >
                      <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Salary Slip</span>
                    </button>

                    {selectedCycle?.status === 'Paid' ? (
                      <button
                        onClick={() => {
                          if (!isAdmin) {
                            toast.error('Only Admin or Master can reverse salary payouts.');
                            return;
                          }
                          setPaymentToReverse(selectedCycle.payment || null);
                          setShowReverseModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        title="Reverse this paid payout"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reverse Payout</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowPayoutModal(true)}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
                        title="Execute salary payout for this cycle"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Payout Salary</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowFinalSettlementModal(true)}
                      className="flex items-center gap-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                      title="Final Settlement & Deactivate Staff"
                    >
                      <span>Final Settlement</span>
                    </button>
                  </div>
                </div>

                {/* PRD Section 1 & 9: SALARY CYCLE SWITCHER BAR */}
                {selectedCycle && (
                  <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs bg-secondary/20 p-3 rounded-xl border border-border">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">Salary Cycle:</span>
                      
                      <button
                        type="button"
                        disabled={selectedCycleIdx <= 0}
                        onClick={() => setSelectedCycleIdx(prev => Math.max(0, prev - 1))}
                        className="p-1 rounded-md border border-border bg-background hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Previous Cycle"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <select
                        value={selectedCycleIdx}
                        onChange={e => setSelectedCycleIdx(Number(e.target.value))}
                        className="bg-background border border-border px-2.5 py-1 rounded-lg font-semibold text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                      >
                        {employeeCycles.map((c, idx) => (
                          <option key={c.id} value={idx}>
                            Cycle #{c.cycleIndex + 1}: {formatDDMMYYYY(c.startDate)} to {formatDDMMYYYY(c.endDate)} ({c.status})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={selectedCycleIdx >= employeeCycles.length - 1}
                        onClick={() => setSelectedCycleIdx(prev => Math.min(employeeCycles.length - 1, prev + 1))}
                        className="p-1 rounded-md border border-border bg-background hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Next Cycle"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">
                        Next Payout: <strong>{formatDDMMYYYY(selectedCycle.nextPayoutDate)}</strong>
                      </span>

                      {/* Status Badges */}
                      {selectedCycle.status === 'Paid' && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Paid ({selectedCycle.payment?.slipNumber || 'PAID'})</span>
                        </span>
                      )}
                      {selectedCycle.status === 'Due' && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Due for Payout</span>
                        </span>
                      )}
                      {selectedCycle.status === 'Running' && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          Running
                        </span>
                      )}
                      {selectedCycle.status === 'Reversed' && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          Reversed
                        </span>
                      )}

                      {/* PRD Section 6: Badge if attendance changed after payout */}
                      {selectedCycle.hasAttendanceChangedAfter && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Changed after payout</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Date / Month Navigation Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
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

                  {/* PRD Section 9: Weekly Off Label cleanup (remove & Planning Notes) */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={showWeeklyOff}
                      onChange={e => setShowWeeklyOff(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-0"
                    />
                    <span>Show Weekly Off (Sun)</span>
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
                    const att = attendance.find(a => a.employeeId === selectedEmployee.id && a.date === cell.dateStr && !a.deleted_at)?.status;
                    const dayAdvances = salaryAdvances.filter(a => {
                      const d = a.transactionDate || a.date;
                      return a.employeeId === selectedEmployee.id && !a.deleted_at && d === cell.dateStr;
                    });
                    const dayAdvSum = dayAdvances.reduce((s, a) => s + (Number(a.amount) || 0), 0);

                    // Cycle markers
                    const isCycleStart = selectedCycle && cell.dateStr === selectedCycle.startDate;
                    const isCycleEnd = selectedCycle && cell.dateStr === selectedCycle.endDate;
                    const isInsideCycle = selectedCycle && cell.dateStr >= selectedCycle.startDate && cell.dateStr <= selectedCycle.endDate;
                    const isAllowedToMark = cell.dateStr >= selectedEmployee.joiningDate && cell.dateStr <= todayStr;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => {
                          setSelectedDayStr(cell.dateStr);
                          handleDayAttendanceToggle(cell.dateStr);
                        }}
                        className={`h-20 p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative ${
                          isSelectedDay
                            ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30'
                            : (isInsideCycle ? 'bg-card hover:bg-secondary/50 border-primary/40' : 'bg-card/70 hover:bg-secondary/40 border-border')
                        } ${!isAllowedToMark ? 'opacity-80' : ''}`}
                        title={!isAllowedToMark ? `Cannot mark before joining date or in future` : `Click to toggle attendance status for ${formatDDMMYYYY(cell.dateStr)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${
                            isSelectedDay ? 'text-primary-foreground' : (cell.isSunday ? 'text-destructive' : 'text-foreground')
                          }`}>
                            {cell.dayNumber}
                          </span>

                          <div className="flex items-center gap-1">
                            {/* PRD Section 9: Cycle Start / End Indicators */}
                            {isCycleStart && (
                              <span className={`text-[8px] font-bold px-1 rounded ${
                                isSelectedDay ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                              }`}>
                                Start
                              </span>
                            )}
                            {isCycleEnd && (
                              <span className={`text-[8px] font-bold px-1 rounded ${
                                isSelectedDay ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                              }`}>
                                End
                              </span>
                            )}

                            {/* Weekly off chip on Sundays */}
                            {showWeeklyOff && cell.isSunday && (
                              <span className={`text-[9px] font-semibold px-1 rounded ${
                                isSelectedDay ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                              }`}>
                                Off
                              </span>
                            )}

                            {/* Attendance Status Mark Pill */}
                            {att && (
                              <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] flex items-center justify-center ${
                                att === 'Present'
                                  ? (isSelectedDay ? 'bg-primary-foreground text-primary' : 'bg-emerald-600 text-white')
                                  : att === 'Absent'
                                  ? (isSelectedDay ? 'bg-primary-foreground text-destructive' : 'bg-destructive text-destructive-foreground')
                                  : att === 'Paid Leave'
                                  ? (isSelectedDay ? 'bg-primary-foreground text-blue-600' : 'bg-blue-600 text-white')
                                  : (isSelectedDay ? 'bg-primary-foreground text-amber-600' : 'bg-amber-600 text-white')
                              }`}>
                                {att === 'Present' ? 'P' : (att === 'Absent' ? 'A' : (att === 'Paid Leave' ? 'PL' : 'UL'))}
                              </span>
                            )}
                          </div>
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

                {/* Cycle Summary Strip */}
                {cycleAttendance && cycleFinancials && (
                  <div className="pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Present</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{cycleAttendance.presentDays}</p>
                    </div>
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Absent</p>
                      <p className="text-base font-bold text-destructive">{cycleAttendance.absentDays}</p>
                    </div>
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">Paid Leave</p>
                      <p className="text-base font-bold text-blue-600 dark:text-blue-400">{cycleAttendance.paidLeaveDays}</p>
                    </div>
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Unpaid Leave</p>
                      <p className="text-base font-bold text-amber-600 dark:text-amber-400">{cycleAttendance.unpaidLeaveDays}</p>
                    </div>
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cycle Advances</p>
                      <p className="text-base font-bold text-foreground">₹{cycleAdvancesTotal.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-secondary/40 border border-border p-2.5 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cycle Net</p>
                      <p className="text-base font-bold text-foreground">₹{cycleFinancials.netPayable.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}

                {/* PRD Section 9: Clean Formula Line (remove Sum parity badge) */}
                {selectedCycle && cycleFinancials && (
                  <div className="bg-secondary/30 border border-border p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium text-muted-foreground">
                      <span>Salary ₹{selectedEmployee.monthlySalary.toLocaleString('en-IN')}</span>
                      <span>-</span>
                      <span>Deductions ₹{cycleFinancials.deductionAmount.toLocaleString('en-IN')}</span>
                      <span>-</span>
                      <span>Advances ₹{cycleFinancials.advanceDeducted.toLocaleString('en-IN')}</span>
                      {openAdjustmentsTotal !== 0 && (
                        <>
                          <span>{openAdjustmentsTotal >= 0 ? '+' : '-'}</span>
                          <span>Adjustments ₹{Math.abs(openAdjustmentsTotal).toLocaleString('en-IN')}</span>
                        </>
                      )}
                      <span>=</span>
                      <span className="font-bold text-foreground">Net ₹{cycleFinancials.netPayable.toLocaleString('en-IN')}</span>
                    </div>

                    {selectedCycle.payment && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Paid on {formatDDMMYYYY(selectedCycle.payment.paid_on)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Day Detail Card & Range Check Card Grid                     */}
              {/* ------------------------------------------------------------ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Day Detail Card */}
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Day Details: {formatDDMMYYYY(selectedDayStr)}</h4>
                      <p className="text-xs text-muted-foreground">Attendance & transactions on selected date</p>
                    </div>

                    {/* PRD Section 2: 4 Attendance Status Buttons */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Present')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Present'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-secondary hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 border border-border'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Present</span>
                      </button>

                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Absent')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Absent'
                            ? 'bg-destructive text-destructive-foreground shadow-sm'
                            : 'bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-border'
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>Absent</span>
                      </button>

                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Paid Leave')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Paid Leave'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-secondary hover:bg-blue-500/20 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 border border-border'
                        }`}
                      >
                        <span>Paid Leave</span>
                      </button>

                      <button
                        onClick={() => markAttendance(selectedEmployee.id, selectedDayStr, 'Unpaid Leave')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                          selectedDayAttendanceStatus === 'Unpaid Leave'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-secondary hover:bg-amber-500/20 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 border border-border'
                        }`}
                      >
                        <span>Unpaid Leave</span>
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
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              Status: {adv.status || 'Open'}
                            </span>
                            {adv.status === 'Open' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this advance?')) {
                                    deleteSalaryAdvance(adv.id);
                                  }
                                }}
                                className="text-destructive hover:text-destructive/80 p-0.5"
                                title="Delete advance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Borrows on this Date */}
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
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              b.status === 'settled' 
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            }`}>
                              {b.status} (Repaid: ₹{b.repaid_amount || 0})
                            </span>
                            {b.status === 'outstanding' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this borrow entry?')) {
                                    deleteBorrow(b.id);
                                  }
                                }}
                                className="text-destructive hover:text-destructive/80 p-0.5"
                                title="Delete borrow"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Range Check Card */}
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Range Check</h4>
                    <p className="text-xs text-muted-foreground">Custom date range attendance & financial summary</p>
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
              <p className="text-xs text-muted-foreground">Select an employee from the left panel or click "Add Staff" to register a new employee.</p>
            </div>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* 3. MODALS                                                     */}
      {/* ============================================================== */}

      {/* ------------------------------------------------------------ */}
      {/* Payout Modal (PRD Section 5: Payout Flow)                    */}
      {/* ------------------------------------------------------------ */}
      {showPayoutModal && selectedEmployee && selectedCycle && cycleAttendance && (
        <CyclePayoutModal
          employee={selectedEmployee}
          cycle={selectedCycle}
          cycleAttendance={cycleAttendance}
          advancesInCycle={cycleAdvances}
          priorAdvances={priorAdvances}
          outstandingBorrows={outstandingBorrows}
          openAdjustments={openAdjustments}
          onClose={() => setShowPayoutModal(false)}
          onExecute={(payoutData) => {
            const res = executeCyclePayout(payoutData);
            if (res.success) {
              setShowPayoutModal(false);
              toast.success(`Salary payout recorded successfully (Slip #${res.slipNumber})`);
            } else {
              toast.error(res.error || 'Failed to record payout');
            }
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Reverse Payout Modal (PRD Section 6)                          */}
      {/* ------------------------------------------------------------ */}
      {showReverseModal && paymentToReverse && (
        <ReversePayoutModal
          payment={paymentToReverse}
          onClose={() => {
            setShowReverseModal(false);
            setPaymentToReverse(null);
          }}
          onConfirm={(reason) => {
            const res = reverseCyclePayout(paymentToReverse.id, reason);
            if (res.success) {
              setShowReverseModal(false);
              setPaymentToReverse(null);
              toast.success('Payout reversed successfully. Advances and borrows restored.');
            } else {
              toast.error(res.error || 'Failed to reverse payout');
            }
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Salary Adjustment Modal                                      */}
      {/* ------------------------------------------------------------ */}
      {showAdjustmentModal && selectedEmployee && (
        <RecordAdjustmentModal
          employee={selectedEmployee}
          cycle={selectedCycle}
          onClose={() => setShowAdjustmentModal(false)}
          onSave={(amount, reason) => {
            addSalaryAdjustment({
              employeeId: selectedEmployee.id,
              cycleId: selectedCycle?.id,
              amount,
              reason,
              type: 'manual',
            });
            setShowAdjustmentModal(false);
            toast.success('Salary adjustment recorded');
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Final Settlement Modal (PRD Section 7)                       */}
      {/* ------------------------------------------------------------ */}
      {showFinalSettlementModal && selectedEmployee && selectedCycle && cycleAttendance && (
        <FinalSettlementModal
          employee={selectedEmployee}
          cycle={selectedCycle}
          cycleAttendance={cycleAttendance}
          advancesInCycle={cycleAdvances}
          priorAdvances={priorAdvances}
          outstandingBorrows={outstandingBorrows}
          openAdjustments={openAdjustments}
          onClose={() => setShowFinalSettlementModal(false)}
          onExecute={(settlementData) => {
            const res = finalSettlement(selectedEmployee.id, settlementData);
            if (res.success) {
              setShowFinalSettlementModal(false);
              toast.success(`${selectedEmployee.name} settled and deactivated successfully.`);
            } else {
              toast.error(res.error || 'Failed to execute final settlement');
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
          salaryPayments={salaryPayments}
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
              toast.success('Staff record updated');
            } else {
              const newEmp = addEmployee(empData);
              targetId = newEmp.id;
              toast.success('Staff member registered');
            }

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
          cycles={employeeCycles}
          onClose={() => setShowAdvanceModal(false)}
          onSave={(amount, date, reason) => {
            addSalaryAdvance({
              employeeId: selectedEmployee.id,
              amount,
              date,
              reason
            });
            setShowAdvanceModal(false);
            toast.success('Advance recorded');
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
            toast.success('Borrow recorded');
          }}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* Salary Slip Modal (PRD Section 8)                            */}
      {/* ------------------------------------------------------------ */}
      {showSalarySlipModal && selectedEmployee && (
        <SalarySlipModal
          employee={selectedEmployee}
          cycles={employeeCycles}
          initialCycle={selectedCycle}
          staffRoles={staffRoles}
          shifts={shifts}
          attendance={attendance}
          salaryAdvances={salaryAdvances}
          borrows={borrows}
          salaryAdjustments={salaryAdjustments}
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

// ====================================================================
// SUB-COMPONENT: CyclePayoutModal (PRD Section 5)
// ====================================================================
interface CyclePayoutModalProps {
  employee: Employee;
  cycle: SalaryCycle;
  cycleAttendance: {
    presentDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    notMarkedDays: number;
    deductedDays: number;
    deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave' }>;
  };
  advancesInCycle: SalaryAdvance[];
  priorAdvances: SalaryAdvance[];
  outstandingBorrows: BorrowRecord[];
  openAdjustments: SalaryAdjustment[];
  onClose: () => void;
  onExecute: (payoutData: any) => void;
}

const CyclePayoutModal = ({
  employee,
  cycle,
  cycleAttendance,
  advancesInCycle,
  priorAdvances,
  outstandingBorrows,
  openAdjustments,
  onClose,
  onExecute
}: CyclePayoutModalProps) => {
  const monthlySalary = employee.monthlySalary;
  const cycleDays = cycle.cycleDays;
  const perDay = cycleDays > 0 ? Math.round((monthlySalary / cycleDays) * 100) / 100 : 0;

  // Deductions from attendance
  const attendanceDeductionPaise = cycleDays > 0 
    ? Math.round((monthlySalary * 100 * cycleAttendance.deductedDays) / cycleDays)
    : 0;
  const attendanceDeduction = attendanceDeductionPaise / 100;
  const earnedAmount = Math.max(0, monthlySalary - attendanceDeduction);

  // Advances to deduct (auto: current cycle + carried forward)
  const advancesThisCycleTotal = advancesInCycle.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const carriedForwardAdvanceIn = priorAdvances.reduce((s, a) => s + Math.max(0, a.amount - (a.deducted_amount || 0)), 0);
  const totalAdvancesAvailable = advancesThisCycleTotal + carriedForwardAdvanceIn;

  const advanceDeducted = Math.min(earnedAmount, totalAdvancesAvailable);
  const carriedForwardAdvanceOut = totalAdvancesAvailable - advanceDeducted;

  // Remaining payable before borrows and adjustments
  const remainingAfterAdvance = earnedAmount - advanceDeducted;

  // Selected borrow recoveries state (borrowId -> amount)
  const [borrowSelections, setBorrowSelections] = useState<Record<string, { selected: boolean; amount: number }>>(() => {
    const init: Record<string, { selected: boolean; amount: number }> = {};
    for (const b of outstandingBorrows) {
      const outstanding = Math.max(0, b.amount - (b.repaid_amount || 0));
      init[b.id] = { selected: false, amount: outstanding };
    }
    return init;
  });

  const totalBorrowSelected = useMemo(() => {
    let sum = 0;
    for (const b of outstandingBorrows) {
      const s = borrowSelections[b.id];
      if (s?.selected) {
        sum += Number(s.amount) || 0;
      }
    }
    return Math.min(remainingAfterAdvance, sum);
  }, [outstandingBorrows, borrowSelections, remainingAfterAdvance]);

  // Adjustments total
  const adjustmentsTotal = useMemo(() => {
    return openAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [openAdjustments]);

  // Net payable
  const netPayable = Math.max(0, remainingAfterAdvance - totalBorrowSelected + adjustmentsTotal);

  // Form inputs
  const [paidOn, setPaidOn] = useState<string>(() => toLocalDateString(new Date()));
  const [paymentRef, setPaymentRef] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // PRD Section 5: Unmarked days warning & confirmation
    if (cycleAttendance.notMarkedDays > 0) {
      const confirmed = window.confirm(
        `There are ${cycleAttendance.notMarkedDays} unmarked days in this cycle. Unmarked days are paid in full. Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    const borrowRecoveries = outstandingBorrows
      .filter(b => borrowSelections[b.id]?.selected && (Number(borrowSelections[b.id]?.amount) || 0) > 0)
      .map(b => ({
        borrowId: b.id,
        amount: Number(borrowSelections[b.id].amount),
        reason: b.reason
      }));

    const adjustmentsApplied = openAdjustments.map(a => ({
      id: a.id,
      amount: a.amount,
      reason: a.reason
    }));

    const deductedDates = cycleAttendance.deductedDates.map(d => ({
      date: d.date,
      type: d.type,
      amount: perDay
    }));

    onExecute({
      employeeId: employee.id,
      cycleStart: cycle.startDate,
      cycleEnd: cycle.endDate,
      cycleDays: cycle.cycleDays,
      salaryUsed: monthlySalary,
      perDay,
      gross: monthlySalary,
      presentDays: cycleAttendance.presentDays,
      absentDays: cycleAttendance.absentDays,
      paidLeaveDays: cycleAttendance.paidLeaveDays,
      unpaidLeaveDays: cycleAttendance.unpaidLeaveDays,
      notMarkedDays: cycleAttendance.notMarkedDays,
      deductedDates,
      attendanceDeduction,
      earnedAmount,
      advanceDeducted,
      carriedForwardAdvanceIn,
      carriedForwardAdvanceOut,
      borrowDeducted: totalBorrowSelected,
      borrowRecoveries,
      adjustmentsTotal,
      adjustmentsApplied,
      netPaid: netPayable,
      paidOn,
      paymentRef,
      note,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-xl w-full border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-base text-foreground">Salary Payout - {employee.name}</h3>
            <p className="text-xs text-muted-foreground">
              Cycle: {formatDDMMYYYY(cycle.startDate)} to {formatDDMMYYYY(cycle.endDate)} ({cycle.cycleDays} days)
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unmarked Days Warning Banner */}
        {cycleAttendance.notMarkedDays > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              <strong>{cycleAttendance.notMarkedDays} days</strong> are not marked in this cycle. Unmarked days are paid in full.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Earnings & Attendance breakdown */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center font-bold text-foreground">
              <span>Monthly Salary (Gross):</span>
              <span>₹{monthlySalary.toLocaleString('en-IN')} (₹{perDay}/day)</span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center py-2 border-y border-border/60">
              <div>
                <p className="text-muted-foreground text-[10px]">Present</p>
                <p className="font-bold text-emerald-600">{cycleAttendance.presentDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Absent</p>
                <p className="font-bold text-destructive">{cycleAttendance.absentDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Paid Leave</p>
                <p className="font-bold text-blue-600">{cycleAttendance.paidLeaveDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Unpaid Leave</p>
                <p className="font-bold text-amber-600">{cycleAttendance.unpaidLeaveDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Not Marked</p>
                <p className="font-bold text-foreground">{cycleAttendance.notMarkedDays}</p>
              </div>
            </div>

            <div className="flex justify-between text-muted-foreground pt-1">
              <span>Attendance Deduction ({cycleAttendance.deductedDays} days):</span>
              <span className="font-bold text-destructive">-₹{attendanceDeduction.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/60">
              <span>Earned Salary:</span>
              <span>₹{earnedAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Advances to deduct */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Advances Auto-Deducted:</span>
              <span className="font-bold text-destructive">-₹{advanceDeducted.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              This cycle: ₹{advancesThisCycleTotal.toLocaleString('en-IN')} &bull; Brought forward: ₹{carriedForwardAdvanceIn.toLocaleString('en-IN')}
              {carriedForwardAdvanceOut > 0 && ` &bull; Carried forward to next slip: ₹${carriedForwardAdvanceOut.toLocaleString('en-IN')}`}
            </p>
          </div>

          {/* Borrows to recover (optional selective checkbox) */}
          {outstandingBorrows.length > 0 && (
            <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Borrow Recovery (Select to deduct):</span>
                <span className="font-bold text-destructive">-₹{totalBorrowSelected.toLocaleString('en-IN')}</span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                {outstandingBorrows.map(b => {
                  const bal = Math.max(0, b.amount - (b.repaid_amount || 0));
                  const isChecked = borrowSelections[b.id]?.selected || false;
                  const amt = borrowSelections[b.id]?.amount ?? bal;

                  return (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            setBorrowSelections(prev => ({
                              ...prev,
                              [b.id]: { selected: e.target.checked, amount: prev[b.id]?.amount ?? bal }
                            }));
                          }}
                          className="rounded text-primary"
                        />
                        <span>
                          {formatDDMMYYYY(b.transactionDate || b.date)} &bull; Balance: ₹{bal.toLocaleString('en-IN')}
                          {b.reason && <span className="text-muted-foreground ml-1">({b.reason})</span>}
                        </span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="1"
                            max={bal}
                            value={amt}
                            onChange={e => {
                              const val = Math.min(bal, Math.max(0, parseFloat(e.target.value) || 0));
                              setBorrowSelections(prev => ({
                                ...prev,
                                [b.id]: { selected: true, amount: val }
                              }));
                            }}
                            className="w-20 px-1.5 py-0.5 bg-secondary border border-border rounded text-xs text-right font-bold text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Adjustments */}
          {openAdjustments.length > 0 && (
            <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-1 text-xs">
              <div className="flex justify-between items-center font-semibold text-foreground">
                <span>Pending Adjustments Applied:</span>
                <span className={adjustmentsTotal >= 0 ? 'text-emerald-600 font-bold' : 'text-destructive font-bold'}>
                  {adjustmentsTotal >= 0 ? `+₹${adjustmentsTotal}` : `-₹${Math.abs(adjustmentsTotal)}`}
                </span>
              </div>
              <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground">
                {openAdjustments.map(a => (
                  <div key={a.id} className="flex justify-between">
                    <span>{a.reason}</span>
                    <span className="font-semibold text-foreground">
                      {a.amount >= 0 ? `+₹${a.amount}` : `-₹${Math.abs(a.amount)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net Payable Highlight */}
          <div className="p-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider opacity-80">Net Payable</p>
              <p className="text-2xl font-black">₹{netPayable.toLocaleString('en-IN')}</p>
            </div>
            <DollarSign className="w-8 h-8 opacity-40" />
          </div>

          {/* Payment metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paidOn}
                onChange={e => setPaidOn(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Payment Reference</label>
              <input
                type="text"
                placeholder="Cash / UPI / Bank Transfer"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Cycle payout complete"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
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
              Confirm & Pay ₹{netPayable.toLocaleString('en-IN')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: ReversePayoutModal (PRD Section 6)
// ====================================================================
interface ReversePayoutModalProps {
  payment: SalaryPayment;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const ReversePayoutModal = ({ payment, onClose, onConfirm }: ReversePayoutModalProps) => {
  const [confirmedIntent, setConfirmedIntent] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Reversal reason is required');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-md w-full border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-base text-foreground">Reverse Salary Payout</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-secondary/30 rounded-xl border border-border text-xs space-y-1">
          <p><strong>Slip:</strong> {payment.slipNumber || 'Legacy Slip'}</p>
          <p><strong>Paid On:</strong> {formatDDMMYYYY(payment.paid_on)}</p>
          <p><strong>Net Amount:</strong> ₹{payment.net_paid.toLocaleString('en-IN')}</p>
        </div>

        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive space-y-1">
          <p className="font-bold">Important Notice:</p>
          <p>
            Reversing this payout will re-open all deducted advances (₹{payment.advance_deducted || 0}), restore borrow balances (₹{payment.borrow_deducted || 0}), release applied adjustments, and mark this salary slip as <strong>Reversed</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!confirmedIntent ? (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-foreground select-none">
                <input
                  type="checkbox"
                  checked={confirmedIntent}
                  onChange={e => setConfirmedIntent(e.target.checked)}
                  className="rounded text-destructive mt-0.5"
                />
                <span>I understand that this action re-opens transactions and cannot be undone.</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Reversal (Required) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Attendance mistake, employee overpaid, calculation error..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason.trim()}
                  className="px-4 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  Confirm Reversal
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: RecordAdjustmentModal
// ====================================================================
interface RecordAdjustmentModalProps {
  employee: Employee;
  cycle: SalaryCycle | null;
  onClose: () => void;
  onSave: (amount: number, reason: string) => void;
}

const RecordAdjustmentModal = ({ employee, cycle, onClose, onSave }: RecordAdjustmentModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [isCredit, setIsCredit] = useState<boolean>(true); // Credit (+) or Deduction (-)
  const [reason, setReason] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !reason.trim()) return;
    const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);
    onSave(finalAmount, reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-sm w-full border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-sm text-foreground">Add Adjustment: {employee.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCredit(true)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  isCredit 
                    ? 'bg-emerald-600 text-white border-emerald-600' 
                    : 'bg-secondary text-muted-foreground border-border'
                }`}
              >
                + Credit (Add to Pay)
              </button>
              <button
                type="button"
                onClick={() => setIsCredit(false)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  !isCredit 
                    ? 'bg-destructive text-white border-destructive' 
                    : 'bg-secondary text-muted-foreground border-border'
                }`}
              >
                - Deduction (Cut Pay)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Amount (₹) *</label>
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
            <label className="block text-xs font-semibold text-foreground mb-1">Reason (Required) *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Overtime bonus, damage fine, festival gift"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Save Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: FinalSettlementModal (PRD Section 7)
// ====================================================================
interface FinalSettlementModalProps {
  employee: Employee;
  cycle: SalaryCycle;
  cycleAttendance: {
    presentDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    notMarkedDays: number;
    deductedDays: number;
    deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave' }>;
  };
  advancesInCycle: SalaryAdvance[];
  priorAdvances: SalaryAdvance[];
  outstandingBorrows: BorrowRecord[];
  openAdjustments: SalaryAdjustment[];
  onClose: () => void;
  onExecute: (settlementData: any) => void;
}

const FinalSettlementModal = ({
  employee,
  cycle,
  cycleAttendance,
  advancesInCycle,
  priorAdvances,
  outstandingBorrows,
  openAdjustments,
  onClose,
  onExecute
}: FinalSettlementModalProps) => {
  const [lastWorkingDate, setLastWorkingDate] = useState<string>(() => toLocalDateString(new Date()));
  const [paidOn, setPaidOn] = useState<string>(() => toLocalDateString(new Date()));
  const [paymentRef, setPaymentRef] = useState<string>('Cash');
  const [note, setNote] = useState<string>('Final Settlement upon departure');

  // Days worked in final cycle
  const daysWorked = useMemo(() => {
    return Math.max(1, diffDaysInclusive(cycle.startDate, lastWorkingDate));
  }, [cycle.startDate, lastWorkingDate]);

  const cycleDays = cycle.cycleDays || 30;
  const perDay = cycleDays > 0 ? Math.round((employee.monthlySalary / cycleDays) * 100) / 100 : 0;

  // PRD Section 7: earned = perDay * (days worked - deducted days)
  const payableDays = Math.max(0, daysWorked - cycleAttendance.deductedDays);
  const earnedPaise = Math.round(perDay * 100 * payableDays);
  const earnedAmount = earnedPaise / 100;

  // Total advances
  const advancesTotal = advancesInCycle.reduce((s, a) => s + (Number(a.amount) || 0), 0) +
    priorAdvances.reduce((s, a) => s + Math.max(0, a.amount - (a.deducted_amount || 0)), 0);
  const advanceDeducted = Math.min(earnedAmount, advancesTotal);

  // Borrows
  const totalBorrows = outstandingBorrows.reduce((s, b) => s + Math.max(0, b.amount - (b.repaid_amount || 0)), 0);
  const remaining = earnedAmount - advanceDeducted;
  const borrowDeducted = Math.min(remaining, totalBorrows);

  // Adjustments
  const adjustmentsTotal = openAdjustments.reduce((s, a) => s + Number(a.amount || 0), 0);

  const netPayable = Math.max(0, remaining - borrowDeducted + adjustmentsTotal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conf = window.confirm(
      `Final settlement will deactivate ${employee.name} and finalize all payroll records. Proceed?`
    );
    if (!conf) return;

    onExecute({
      lastWorkingDate,
      cycleStart: cycle.startDate,
      cycleEnd: lastWorkingDate,
      cycleDays: daysWorked,
      salaryUsed: earnedAmount,
      perDay,
      gross: earnedAmount,
      presentDays: cycleAttendance.presentDays,
      absentDays: cycleAttendance.absentDays,
      paidLeaveDays: cycleAttendance.paidLeaveDays,
      unpaidLeaveDays: cycleAttendance.unpaidLeaveDays,
      notMarkedDays: cycleAttendance.notMarkedDays,
      deductedDates: cycleAttendance.deductedDates.map(d => ({ date: d.date, type: d.type, amount: perDay })),
      attendanceDeduction: Math.round(perDay * 100 * cycleAttendance.deductedDays) / 100,
      earnedAmount,
      advanceDeducted,
      carriedForwardAdvanceIn: 0,
      carriedForwardAdvanceOut: Math.max(0, advancesTotal - advanceDeducted),
      borrowDeducted,
      borrowRecoveries: outstandingBorrows.map(b => ({
        borrowId: b.id,
        amount: Math.min(borrowDeducted, Math.max(0, b.amount - (b.repaid_amount || 0))),
        reason: b.reason
      })),
      adjustmentsTotal,
      adjustmentsApplied: openAdjustments.map(a => ({ id: a.id, amount: a.amount, reason: a.reason })),
      netPaid: netPayable,
      paidOn,
      paymentRef,
      note,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-lg w-full border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Final Settlement: {employee.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Last Working Date *</label>
            <input
              type="date"
              required
              value={lastWorkingDate}
              onChange={e => setLastWorkingDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Days Worked in Final Cycle:</span>
              <strong>{daysWorked} days (from {formatDDMMYYYY(cycle.startDate)})</strong>
            </div>
            <div className="flex justify-between">
              <span>Per Day Rate:</span>
              <span>₹{perDay} / day</span>
            </div>
            <div className="flex justify-between">
              <span>Payable Days ({daysWorked} - {cycleAttendance.deductedDays} deducted):</span>
              <strong>{payableDays} days</strong>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/60 font-bold">
              <span>Prorated Earned:</span>
              <span>₹{earnedAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Advances Deducted:</span>
              <span>-₹{advanceDeducted.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Borrows Recovered:</span>
              <span>-₹{borrowDeducted.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Adjustments:</span>
              <span>{adjustmentsTotal >= 0 ? `+₹${adjustmentsTotal}` : `-₹${Math.abs(adjustmentsTotal)}`}</span>
            </div>
          </div>

          <div className="p-3 bg-primary text-primary-foreground rounded-xl flex items-center justify-between">
            <span className="font-bold text-xs uppercase">Net Final Settlement Pay</span>
            <span className="text-xl font-black">₹{netPayable.toLocaleString('en-IN')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-foreground mb-1">Paid On *</label>
              <input
                type="date"
                required
                value={paidOn}
                onChange={e => setPaidOn(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">Payment Method</label>
              <input
                type="text"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border hover:bg-secondary text-foreground rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-sm"
            >
              Confirm Settlement & Deactivate Staff
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====================================================================
// SUB-COMPONENT: AddEditEmployeeModal (PRD Section 1: Joining Date Lock)
// ====================================================================
interface AddEditEmployeeModalProps {
  employee: Employee | null;
  staffRoles: any[];
  shifts: any[];
  salaryPayments: SalaryPayment[];
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
  salaryPayments,
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
  
  // PRD Section 1: Joining date cannot be edited after first payout
  const isJoiningDateLocked = useMemo(() => {
    if (!employee) return false;
    return (salaryPayments || []).some(p => p.employeeId === employee.id && p.status === 'Paid' && !p.deleted_at);
  }, [employee, salaryPayments]);

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

    const cleanAadhaar = fullAadhaar.replace(/\s+/g, '');
    const aadhaarLast4 = cleanAadhaar.length >= 4 ? cleanAadhaar.slice(-4) : (employee?.aadhaarLast4 || undefined);

    const empData: Omit<Employee, 'id' | 'created_at' | 'updated_at'> = {
      name: name.trim(),
      roleId,
      shiftId,
      monthlySalary: Number(salary) || 0,
      joiningDate: isJoiningDateLocked && employee ? employee.joiningDate : joiningDate,
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
              <label className="block text-xs font-semibold text-foreground mb-1">
                Joining Date {isJoiningDateLocked && <span className="text-amber-600 font-normal">(Locked after payout)</span>}
              </label>
              <input
                type="date"
                disabled={isJoiningDateLocked}
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
                className={`w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent ${
                  isJoiningDateLocked ? 'opacity-60 cursor-not-allowed bg-secondary/50' : ''
                }`}
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
// SUB-COMPONENT: RecordAdvanceModal (PRD Section 4: Paid Cycle Warning)
// ====================================================================
interface RecordAdvanceModalProps {
  employee: Employee;
  defaultDate: string;
  cycles: SalaryCycle[];
  onClose: () => void;
  onSave: (amount: number, date: string, reason?: string) => void;
}

const RecordAdvanceModal = ({ employee, defaultDate, cycles, onClose, onSave }: RecordAdvanceModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(defaultDate);
  const [reason, setReason] = useState<string>('');

  const fallsInPaidCycle = useMemo(() => {
    return cycles.some(c => c.status === 'Paid' && date >= c.startDate && date <= c.endDate);
  }, [cycles, date]);

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

        {fallsInPaidCycle && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
            <strong>Paid Cycle Notice:</strong> This date falls in an already paid salary cycle. The advance will be recorded and automatically deducted as a late adjustment in the next payout.
          </div>
        )}

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
              <span className="text-[10px] text-muted-foreground italic">Prints on salary slip</span>
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Festival advance, emergency"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
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
              <span className="text-[10px] text-muted-foreground italic">Prints on salary slip</span>
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Medical loan, personal advance"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
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
// SUB-COMPONENT: SalarySlipModal (PRD Section 8)
// ====================================================================
interface SalarySlipModalProps {
  employee: Employee;
  cycles: SalaryCycle[];
  initialCycle: SalaryCycle | null;
  staffRoles: StaffRole[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  salaryAdjustments: SalaryAdjustment[];
  salaryPayments: SalaryPayment[];
  salaryDeductionLedger: SalaryDeductionLedgerItem[];
  invoiceSettings: InvoiceSettings;
  onClose: () => void;
}

const SalarySlipModal = ({
  employee,
  cycles,
  initialCycle,
  staffRoles,
  shifts,
  attendance,
  salaryAdvances,
  borrows,
  salaryAdjustments,
  salaryPayments,
  salaryDeductionLedger,
  invoiceSettings,
  onClose
}: SalarySlipModalProps) => {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    initialCycle?.id || (cycles[cycles.length - 1]?.id || '')
  );

  const activeCycle = useMemo(() => {
    return cycles.find(c => c.id === selectedCycleId) || cycles[cycles.length - 1] || null;
  }, [cycles, selectedCycleId]);

  const slipData = useMemo(() => {
    return calculateSalarySlipData({
      employee,
      cycle: activeCycle || undefined,
      staffRoles,
      shifts,
      attendance,
      salaryAdvances,
      borrows,
      salaryAdjustments,
      salaryPayments,
      salaryDeductionLedger,
      invoiceSettings
    });
  }, [employee, activeCycle, staffRoles, shifts, attendance, salaryAdvances, borrows, salaryAdjustments, salaryPayments, salaryDeductionLedger, invoiceSettings]);

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
      const cycleTag = activeCycle ? `${activeCycle.startDate}_to_${activeCycle.endDate}` : 'cycle';
      const defaultFilename = `Salary_Slip_${safeName}_${cycleTag}.pdf`;
      try {
        const res = await window.electronAPI.pdfSaveAs(defaultFilename, slipHtml);
        if (res.success) {
          toast.success(`Salary slip saved: ${res.filePath}`);
        } else if (!res.canceled) {
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
                  slipData.isReversed
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : (slipData.isPaid 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30')
                }`}>
                  {slipData.statusText}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Slip No: {slipData.slipNumber} &bull; Cycle: {slipData.cycleStartFormatted} to {slipData.cycleEndFormatted}
              </p>
            </div>
          </div>

          {/* Cycle selector and Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCycleId}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="bg-secondary text-xs font-semibold text-foreground px-2.5 py-1.5 rounded-lg border border-border focus:outline-none cursor-pointer"
            >
              {cycles.map((c, idx) => (
                <option key={c.id} value={c.id}>
                  Cycle #{c.cycleIndex + 1}: {formatDDMMYYYY(c.startDate)} to {formatDDMMYYYY(c.endDate)} ({c.status})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Print Salary Slip"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              className="flex items-center gap-1.5 bg-secondary border border-border hover:bg-secondary/80 text-secondary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Save as PDF (choose file location)"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors ml-1"
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

export default Staff;
