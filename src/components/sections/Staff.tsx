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
import { NumberInput } from '@/components/ui/number-input';
import { 
  SalaryCycle, generateEmployeeCycles, calculateCycleAttendance, 
  calculateCycleFinancials, formatDDMMYYYY, diffDaysInclusive,
  CycleAttendanceSummary, AttendanceMark, PAY_BASIS_DAYS, normalizeAttendanceStatus, formatShiftLabel, formatRs
} from '@/utils/salaryCycleUtils';
import {
  CycleAttendanceGrid, AttendanceSummaryTiles, SalarySummaryCard, AdvancesBorrowsBox, ManageShiftsModal
} from './StaffPanels';

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
    addShift,
    updateShift,
    deleteShift,
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
    addShift: state.addShift,
    updateShift: state.updateShift,
    deleteShift: state.deleteShift,
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

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [showReverseModal, setShowReverseModal] = useState<boolean>(false);
  const [paymentToReverse, setPaymentToReverse] = useState<SalaryPayment | null>(null);
  const [showFinalSettlementModal, setShowFinalSettlementModal] = useState<boolean>(false);
  const [showShiftsModal, setShowShiftsModal] = useState<boolean>(false);
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

  // --- TODAY'S STATS ---
  const todayCounts = useMemo(() => {
    const byEmp = new Map<string, string>();
    for (const a of attendance) {
      if (a.date === todayStr && !a.deleted_at) byEmp.set(a.employeeId, a.status);
    }
    let present = 0, halfDay = 0, absent = 0, notMarked = 0;
    for (const emp of activeEmployees) {
      const st = normalizeAttendanceStatus(byEmp.get(emp.id));
      if (st === 'Present') present++;
      else if (st === 'Half Day') halfDay++;
      else if (st === 'Absent') absent++;
      else if (todayStr >= emp.joiningDate) notMarked++;
    }
    return { present, halfDay, absent, notMarked };
  }, [activeEmployees, attendance, todayStr]);

  // "Payable now" and which employees have a Due cycle (one cycle pass per employee)
  const { totalPayableNow, dueEmployeeIds } = useMemo(() => {
    let total = 0;
    const due = new Set<string>();
    for (const emp of activeEmployees) {
      const dueCycles = generateEmployeeCycles(emp, todayStr, salaryPayments, attendance).filter(c => c.status === 'Due');
      if (dueCycles.length > 0) due.add(emp.id);
      for (const dc of dueCycles) {
        const att = calculateCycleAttendance(emp, dc, attendance, todayStr);
        const cycleAdvs = salaryAdvances
          .filter(a => a.employeeId === emp.id && !a.deleted_at && a.kind !== 'debt' && a.status !== 'Voided'
            && (a.transactionDate || a.date) >= dc.startDate && (a.transactionDate || a.date) <= dc.endDate)
          .reduce((s, a) => s + (Number(a.amount) || 0), 0);
        const openAdjs = (salaryAdjustments || [])
          .filter(a => a.employeeId === emp.id && a.status === 'Open' && !a.deleted_at)
          .reduce((s, a) => s + Number(a.amount || 0), 0);
        total += calculateCycleFinancials(emp.monthlySalary, dc.cycleDays, att.deductedDays, cycleAdvs, 0, 0, openAdjs).netPayable;
      }
    }
    return { totalPayableNow: Math.round(total * 100) / 100, dueEmployeeIds: due };
  }, [activeEmployees, todayStr, salaryPayments, attendance, salaryAdvances, salaryAdjustments]);

  const activeShifts = useMemo(() => shifts.filter(s => !s.deleted_at), [shifts]);

  // --- SELECTED EMPLOYEE & CYCLE ---
  const cycleAttendance = useMemo(() => {
    if (!selectedEmployee || !selectedCycle) return null;
    return calculateCycleAttendance(selectedEmployee, selectedCycle, attendance, todayStr);
  }, [selectedEmployee, selectedCycle, attendance, todayStr]);

  // Advances in the selected cycle (Debt records are not advances)
  const cycleAdvances = useMemo(() => {
    if (!selectedEmployee || !selectedCycle) return [];
    return salaryAdvances.filter(a => {
      const d = a.transactionDate || a.date;
      return a.employeeId === selectedEmployee.id && !a.deleted_at && a.kind !== 'debt' && a.status !== 'Voided'
        && d >= selectedCycle.startDate && d <= selectedCycle.endDate;
    });
  }, [selectedEmployee, selectedCycle, salaryAdvances]);

  const cycleAdvancesTotal = useMemo(() => cycleAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0), [cycleAdvances]);

  // Debt brought in: open balances from earlier cycles (the existing carry-forward, incl. Debt records)
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

  // Outstanding borrows for employee
  const outstandingBorrows = useMemo(() => {
    if (!selectedEmployee) return [];
    return borrows.filter(b => b.employeeId === selectedEmployee.id && b.status !== 'settled' && b.status !== 'Voided' && !b.deleted_at);
  }, [selectedEmployee, borrows]);

  const openAdjustments = useMemo(() => {
    if (!selectedEmployee) return [];
    return (salaryAdjustments || []).filter(a => a.employeeId === selectedEmployee.id && !a.deleted_at && a.status === 'Open');
  }, [selectedEmployee, salaryAdjustments]);

  const openAdjustmentsTotal = useMemo(() => openAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0), [openAdjustments]);

  // Debt still owed (open Debt records), shown as a badge on the employee header
  const employeeDebt = useMemo(() => {
    if (!selectedEmployee) return 0;
    return salaryAdvances
      .filter(a => a.employeeId === selectedEmployee.id && a.kind === 'debt' && a.status === 'Open' && !a.deleted_at)
      .reduce((sum, a) => sum + Math.max(0, a.amount - (a.deducted_amount || 0)), 0);
  }, [selectedEmployee, salaryAdvances]);

  // Salary figures for the selected cycle: the paid snapshot for paid cycles, live otherwise
  const salaryView = useMemo(() => {
    if (!selectedEmployee || !selectedCycle || !cycleAttendance) return null;
    const p = selectedCycle.status === 'Paid' ? selectedCycle.payment : null;
    if (p) {
      const debtIn = (p.debtInLines || []).reduce((s, l) => s + l.amount, 0);
      return {
        isPaid: true,
        perDay: p.perDay || 0,
        deduction: p.attendanceDeduction || 0,
        earned: p.earnedAmount ?? p.gross,
        advances: Math.max(0, (p.advance_deducted || 0) - debtIn),
        debtIn,
        borrow: p.borrow_deducted || 0,
        payable: p.payableAmount ?? p.net_paid,
        debtOut: p.payBasisDays ? Number(p.carriedForwardAdvanceOut || 0) : 0,
      };
    }
    const fin = calculateCycleFinancials(
      selectedEmployee.monthlySalary,
      selectedCycle.cycleDays,
      cycleAttendance.deductedDays,
      cycleAdvancesTotal,
      priorAdvancesTotal,
      0, // borrow recovery is chosen in the payout window
      openAdjustmentsTotal
    );
    return {
      isPaid: false,
      perDay: fin.perDayAmount,
      deduction: fin.deductionAmount,
      earned: fin.earnedAmount,
      advances: fin.thisCycleAdvances,
      debtIn: fin.carriedForwardAdvanceIn,
      borrow: 0,
      payable: fin.payable,
      debtOut: fin.carriedForwardAdvanceOut,
    };
  }, [selectedEmployee, selectedCycle, cycleAttendance, cycleAdvancesTotal, priorAdvancesTotal, openAdjustmentsTotal]);

  // Mark / unmark one day from the attendance grid popup
  const handleMarkDay = (dateStr: string, status: AttendanceMark | null) => {
    if (!selectedEmployee) return;
    if (dateStr < selectedEmployee.joiningDate || dateStr > todayStr) {
      toast.error('Only days from joining up to today can be marked.');
      return;
    }
    markAttendance(selectedEmployee.id, dateStr, status);
    if (selectedCycle?.status === 'Paid') {
      toast.info('This cycle is already paid: any change in pay is added as an adjustment to the next payout.');
    }
  };

  // All Present: only employees still unmarked today, after confirming the count
  const handleAllPresent = () => {
    const count = activeEmployees.filter(e =>
      todayStr >= e.joiningDate && !attendance.some(a => a.employeeId === e.id && a.date === todayStr && !a.deleted_at)
    ).length;
    if (count === 0) {
      toast.info(`Everyone is already marked for ${formatDDMMYYYY(todayStr)}.`);
      return;
    }
    if (!window.confirm(`Mark ${count} unmarked staff member${count === 1 ? '' : 's'} as Present for ${formatDDMMYYYY(todayStr)}?`)) return;
    const marked = markAllPresent(todayStr);
    toast.success(`Marked ${marked} as Present for ${formatDDMMYYYY(todayStr)}`);
  };

  // Role & Shift display helpers
  const getRoleName = (roleId: string) => {
    return staffRoles.find(r => r.id === roleId)?.name || 'Staff';
  };

  const getShiftName = (shiftId?: string) => {
    if (!shiftId) return 'Regular';
    return formatShiftLabel(shifts.find(s => s.id === shiftId));
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
      {/* 1. TODAY'S STATS + ALL PRESENT                                 */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
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
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {todayCounts.present}
                  {todayCounts.halfDay > 0 && <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 ml-2">+{todayCounts.halfDay} half</span>}
                </p>
              </div>
              <Check className="w-8 h-8 opacity-30 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          <div className="stat-card hover:border-destructive/50">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Absent Today</p>
                <p className="text-3xl font-bold text-destructive">{todayCounts.absent}</p>
              </div>
              <X className="w-8 h-8 opacity-30 text-destructive" />
            </div>
          </div>

          <div className="stat-card hover:border-amber-500/50">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Not Marked</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{todayCounts.notMarked}</p>
              </div>
              <Clock className="w-8 h-8 opacity-30 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

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

        <button
          onClick={handleAllPresent}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
          title="Mark every staff member still unmarked today as Present"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>All Present</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN 2-COLUMN LAYOUT: LEFT STAFF LIST | RIGHT CALENDAR PNL */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ------------------------------------------------------------ */}
        {/* LEFT PANEL (4 cols): Staff Members List                      */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
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
                  const hasDue = dueEmployeeIds.has(emp.id);

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
        {/* RIGHT PANEL: selected employee, cycle attendance, salary      */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {selectedEmployee ? (
            <>
              {/* Employee Detail Header Card */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5">
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
                      {employeeDebt > 0 && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30" title="Debt carried forward from earlier payouts">
                          Debt: {formatRs(employeeDebt)}
                        </span>
                      )}
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

              </div>

              {/* Attendance for the selected salary cycle */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-5 space-y-4">
                {/* PRD Section 1 & 9: SALARY CYCLE SWITCHER BAR */}
                {selectedCycle && (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-secondary/20 p-3 rounded-xl border border-border">
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

                {selectedCycle && (
                  <CycleAttendanceGrid
                    employee={selectedEmployee}
                    cycle={selectedCycle}
                    attendance={attendance}
                    todayStr={todayStr}
                    onMark={handleMarkDay}
                  />
                )}
              </div>

              {/* Summary row */}
              {cycleAttendance && salaryView && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch">
                  <div className="xl:col-span-3">
                    <AttendanceSummaryTiles
                      present={cycleAttendance.presentDays}
                      halfDays={cycleAttendance.halfDays}
                      absent={cycleAttendance.absentDays}
                      notMarked={cycleAttendance.notMarkedDays}
                    />
                  </div>
                  <div className="xl:col-span-2">
                    <SalarySummaryCard
                      earned={salaryView.earned}
                      deduction={salaryView.deduction}
                      advances={salaryView.advances}
                      debtIn={salaryView.debtIn}
                      borrow={salaryView.borrow}
                      payable={salaryView.payable}
                      debtOut={salaryView.debtOut}
                      isPaid={salaryView.isPaid}
                      perDay={salaryView.perDay}
                    />
                  </div>
                </div>
              )}

              {selectedCycle && (
                <AdvancesBorrowsBox
                  employee={selectedEmployee}
                  cycle={selectedCycle}
                  cycleIsPaid={selectedCycle.status === 'Paid'}
                  salaryAdvances={salaryAdvances}
                  borrows={borrows}
                  todayStr={todayStr}
                  addSalaryAdvance={addSalaryAdvance}
                  updateSalaryAdvance={updateSalaryAdvance}
                  deleteSalaryAdvance={deleteSalaryAdvance}
                  addBorrow={addBorrow}
                  updateBorrow={updateBorrow}
                  deleteBorrow={deleteBorrow}
                />
              )}
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
          onAddAdjustment={(amount, reason) => {
            addSalaryAdjustment({ employeeId: selectedEmployee.id, cycleId: selectedCycle.id, amount, reason, type: 'manual' });
            toast.success('Adjustment added');
          }}
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
          shifts={activeShifts}
          onManageShifts={() => setShowShiftsModal(true)}
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

      {/* Manage Shifts (opened from the Add/Edit Staff shift field) */}
      {showShiftsModal && (
        <ManageShiftsModal
          shifts={shifts}
          addShift={addShift}
          updateShift={updateShift}
          deleteShift={deleteShift}
          onClose={() => setShowShiftsModal(false)}
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
  cycleAttendance: CycleAttendanceSummary;
  advancesInCycle: SalaryAdvance[];
  /** Open balances from earlier cycles: the Debt brought in. */
  priorAdvances: SalaryAdvance[];
  outstandingBorrows: BorrowRecord[];
  openAdjustments: SalaryAdjustment[];
  onAddAdjustment: (amount: number, reason: string) => void;
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
  onAddAdjustment,
  onClose,
  onExecute
}: CyclePayoutModalProps) => {
  const monthlySalary = employee.monthlySalary;

  const advancesThisCycleTotal = advancesInCycle.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // Debt brought in, line by line ("Debt carried forward from cycle #N")
  const debtInLines = priorAdvances
    .map(a => ({
      id: a.id,
      label: a.kind === 'debt'
        ? (a.reason || 'Debt carried forward')
        : 'Advance brought forward (' + formatDDMMYYYY(a.transactionDate || a.date) + ')',
      amount: Math.max(0, a.amount - (a.deducted_amount || 0)),
    }))
    .filter(l => l.amount > 0);
  const debtInTotal = debtInLines.reduce((s, l) => s + l.amount, 0);

  // Selected borrow recoveries (borrowId -> amount)
  const [borrowSelections, setBorrowSelections] = useState<Record<string, { selected: boolean; amount: number }>>(() => {
    const init: Record<string, { selected: boolean; amount: number }> = {};
    for (const b of outstandingBorrows) {
      init[b.id] = { selected: false, amount: Math.max(0, b.amount - (b.repaid_amount || 0)) };
    }
    return init;
  });

  const requestedBorrow = outstandingBorrows.reduce((sum, b) => {
    const s = borrowSelections[b.id];
    return s?.selected ? sum + (Number(s.amount) || 0) : sum;
  }, 0);

  const adjustmentsTotal = openAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  // payable = earned - advances - debt in +/- adjustments, then borrow from a positive remainder
  const fin = calculateCycleFinancials(
    monthlySalary,
    cycle.cycleDays,
    cycleAttendance.deductedDays,
    advancesThisCycleTotal,
    debtInTotal,
    requestedBorrow,
    adjustmentsTotal
  );
  const totalBorrowSelected = fin.borrowRecoveryDeducted;
  const netPayable = fin.netPayable;

  // Inline adjustment (kept inside the payout window)
  const [adjAmount, setAdjAmount] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const addAdjustment = () => {
    if (!adjAmount) { toast.error('Enter an amount (use a minus sign for a deduction).'); return; }
    if (!adjReason.trim()) { toast.error('Enter a reason.'); return; }
    onAddAdjustment(adjAmount, adjReason.trim());
    setAdjAmount(0);
    setAdjReason('');
  };

  const [paidOn, setPaidOn] = useState<string>(() => toLocalDateString(new Date()));
  const [paymentRef, setPaymentRef] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cycleAttendance.notMarkedDays > 0) {
      const confirmed = window.confirm(
        `There are ${cycleAttendance.notMarkedDays} unmarked days in this cycle. Unmarked days are paid in full. Do you want to proceed?`
      );
      if (!confirmed) return;
    }
    if (fin.carriedForwardAdvanceOut > 0) {
      const confirmed = window.confirm(
        `Payable is ${formatRs(fin.payable)}. ₹0 will be paid and ${formatRs(fin.carriedForwardAdvanceOut)} will be carried as Debt to the next cycle. Continue?`
      );
      if (!confirmed) return;
    }

    // Allocate the (capped) recovery across the selected borrows in order
    let remainingRecovery = totalBorrowSelected;
    const borrowRecoveries = outstandingBorrows
      .filter(b => borrowSelections[b.id]?.selected && (Number(borrowSelections[b.id]?.amount) || 0) > 0)
      .map(b => {
        const amount = Math.min(Number(borrowSelections[b.id].amount) || 0, remainingRecovery);
        remainingRecovery = Math.round((remainingRecovery - amount) * 100) / 100;
        return { borrowId: b.id, amount, reason: b.reason };
      })
      .filter(r => r.amount > 0);

    onExecute({
      employeeId: employee.id,
      cycleIndex: cycle.cycleIndex,
      cycleStart: cycle.startDate,
      cycleEnd: cycle.endDate,
      cycleDays: cycle.cycleDays,
      salaryUsed: monthlySalary,
      perDay: fin.perDayAmount,
      payBasisDays: fin.payBasisDays,
      gross: monthlySalary,
      presentDays: cycleAttendance.presentDays,
      absentDays: cycleAttendance.absentDays,
      halfDays: cycleAttendance.halfDays,
      paidLeaveDays: 0, // legacy leave is counted as Present / Absent
      unpaidLeaveDays: 0,
      notMarkedDays: cycleAttendance.notMarkedDays,
      deductedDates: cycleAttendance.deductedDates.map(d => ({
        date: d.date,
        type: d.type,
        amount: Math.round(fin.perDayAmount * d.weight * 100) / 100,
      })),
      attendanceDeduction: fin.deductionAmount,
      earnedAmount: fin.earnedAmount,
      advanceDeducted: fin.advanceDeducted,
      carriedForwardAdvanceIn: debtInTotal,
      carriedForwardAdvanceOut: fin.carriedForwardAdvanceOut,
      debtInLines,
      payableAmount: fin.payable,
      borrowDeducted: totalBorrowSelected,
      borrowRecoveries,
      adjustmentsTotal,
      adjustmentsApplied: openAdjustments.map(a => ({ id: a.id, amount: a.amount, reason: a.reason })),
      netPaid: netPayable,
      paidOn,
      paymentRef,
      note,
    });
  };

  const inputCls = 'px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl max-w-xl w-full border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-base text-foreground">Salary Payout - {employee.name}</h3>
            <p className="text-xs text-muted-foreground">
              Cycle #{cycle.cycleIndex + 1}: {formatDDMMYYYY(cycle.startDate)} to {formatDDMMYYYY(cycle.endDate)} ({cycle.cycleDays} days)
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {cycleAttendance.notMarkedDays > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              <strong>{cycleAttendance.notMarkedDays} days</strong> are not marked in this cycle. Unmarked days are paid in full.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Earnings & attendance */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center font-bold text-foreground">
              <span>Monthly Salary (Gross):</span>
              <span>{formatRs(monthlySalary)} ({formatRs(fin.perDayAmount)}/day, 30-day month)</span>
            </div>

            <div className="grid grid-cols-4 gap-1 text-center py-2 border-y border-border/60">
              <div>
                <p className="text-muted-foreground text-[10px]">Present</p>
                <p className="font-bold text-emerald-600">{cycleAttendance.presentDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Absent</p>
                <p className="font-bold text-destructive">{cycleAttendance.absentDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Half Day</p>
                <p className="font-bold text-amber-600">{cycleAttendance.halfDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Not Marked</p>
                <p className="font-bold text-foreground">{cycleAttendance.notMarkedDays}</p>
              </div>
            </div>

            <div className="flex justify-between text-muted-foreground pt-1">
              <span>Attendance Deduction ({cycleAttendance.deductedDays} days):</span>
              <span className="font-bold text-destructive">-{formatRs(fin.deductionAmount)}</span>
            </div>

            <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/60">
              <span>Earned Salary:</span>
              <span>{formatRs(fin.earnedAmount)}</span>
            </div>
          </div>

          {/* Advances & debt brought in */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Advances (this cycle):</span>
              <span className="font-bold text-destructive">-{formatRs(advancesThisCycleTotal)}</span>
            </div>
            {debtInLines.map(l => (
              <div key={l.id} className="flex justify-between items-center">
                <span className="text-foreground">{l.label}:</span>
                <span className="font-bold text-destructive">-{formatRs(l.amount)}</span>
              </div>
            ))}
          </div>

          {/* Adjustments (+/-), with an inline add form */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center font-semibold text-foreground">
              <span>Adjustments:</span>
              <span className={adjustmentsTotal >= 0 ? 'text-emerald-600 font-bold' : 'text-destructive font-bold'}>
                {adjustmentsTotal >= 0 ? '+' : ''}{formatRs(adjustmentsTotal)}
              </span>
            </div>
            {openAdjustments.map(a => (
              <div key={a.id} className="flex justify-between text-[11px] text-muted-foreground">
                <span>{a.reason}</span>
                <span className="font-semibold text-foreground">{a.amount >= 0 ? '+' : ''}{formatRs(a.amount)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <NumberInput
                step="any"
                placeholder="+/- amount"
                value={adjAmount || ''}
                onValueChange={setAdjAmount}
                className={`${inputCls} w-28`}
              />
              <input
                type="text"
                placeholder="Reason"
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button type="button" onClick={addAdjustment} className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg font-semibold text-foreground">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Borrows to recover (only from a positive remainder) */}
          {outstandingBorrows.length > 0 && (
            <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Borrow Recovery (select to deduct):</span>
                <span className="font-bold text-destructive">-{formatRs(totalBorrowSelected)}</span>
              </div>
              {requestedBorrow > totalBorrowSelected && (
                <p className="text-[10px] text-muted-foreground">Recovery is limited to what is left after advances and debt ({formatRs(totalBorrowSelected)}).</p>
              )}

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
                          {formatDDMMYYYY(b.transactionDate || b.date)} &bull; Balance: {formatRs(bal)}
                          {b.reason && <span className="text-muted-foreground ml-1">({b.reason})</span>}
                        </span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">₹</span>
                          <NumberInput
                            min="1"
                            max={bal}
                            step="any"
                            value={amt}
                            onValueChange={val => {
                              setBorrowSelections(prev => ({ ...prev, [b.id]: { selected: true, amount: val } }));
                            }}
                            onBlur={() => {
                              setBorrowSelections(prev => ({
                                ...prev,
                                [b.id]: { selected: true, amount: Math.min(bal, Math.max(0, Number(prev[b.id]?.amount) || 0)) }
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

          {/* Payable */}
          <div className="p-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider opacity-80">Payable</p>
              <p className={`text-2xl font-black ${fin.payable < 0 ? 'text-red-300' : ''}`}>{formatRs(fin.payable)}</p>
              {fin.carriedForwardAdvanceOut > 0 && (
                <p className="text-xs opacity-90 mt-0.5">₹0 paid · {formatRs(fin.carriedForwardAdvanceOut)} carried as Debt to the next cycle</p>
              )}
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
              Confirm & Pay {formatRs(netPayable)}
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
// SUB-COMPONENT: FinalSettlementModal (PRD Section 7)
// ====================================================================
interface FinalSettlementModalProps {
  employee: Employee;
  cycle: SalaryCycle;
  cycleAttendance: CycleAttendanceSummary;
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

  // 30-day month basis for every cycle
  const perDay = Math.round((employee.monthlySalary / PAY_BASIS_DAYS) * 100) / 100;

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
      halfDays: cycleAttendance.halfDays,
      paidLeaveDays: 0, // legacy leave is counted as Present / Absent
      unpaidLeaveDays: 0,
      payBasisDays: PAY_BASIS_DAYS,
      notMarkedDays: cycleAttendance.notMarkedDays,
      deductedDates: cycleAttendance.deductedDates.map(d => ({ date: d.date, type: d.type, amount: Math.round(perDay * d.weight * 100) / 100 })),
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
  onManageShifts: () => void;
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
  onManageShifts,
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
              <NumberInput
                required
                min="0"
                value={salary}
                step="any"
                onValueChange={(v) => setSalary(v)}
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
              <label className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <span>Shift</span>
                <button type="button" onClick={onManageShifts} className="text-[11px] font-semibold text-primary underline hover:no-underline">Manage shifts</button>
              </label>
              <select
                value={shiftId}
                onChange={e => setShiftId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>
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
