import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { 
  Room, Booking, HistoryRecord, Staff, StaffLog, SectionType, AdvancePayment, 
  InvoiceSettings, DEFAULT_INVOICE_SETTINGS, AppUser, AppRole, 
  DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES, RoomHold,
  StaffRole, Shift, Employee, AttendanceRecord, SalaryAdvance, BorrowRecord, SalaryPayment,
  SalaryDeductionLedgerItem, SalaryAdjustment,
  RateMode, RoomModeRates, BookingRateSnapshot
} from '@/types';
import {
  NORMAL_RATE_MODE_ID, DEFAULT_RATE_MODES, getActiveRateMode, buildRateSnapshot
} from '@/utils/rateModeUtils';
import { generateUUID } from '@/lib/uuid';
import { getRoomStatusOnDate, normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import { toLocalDateString } from '@/utils/dateUtils';
import { generateEmployeeCycles, generateSlipNumber, formatDDMMYYYY } from '@/utils/salaryCycleUtils';
import {
  pushInvoiceSettingsToCloud,
  pushRoomToCloud,
  deleteRoomFromCloud,
  pushBookingToCloud,
  deleteBookingFromCloud,
  pushHistoryToCloud,
  pushRoomStatusToCloud,
  deleteRoomStatusFromCloud,
  pushStaffToCloud,
  deleteStaffFromCloud,
  pushStaffLogToCloud,
  pushCategoryToCloud,
  deleteCategoryFromCloud,
  pushBedTypeToCloud,
  deleteBedTypeFromCloud,
  pushAppUserToCloud,
  deleteAppUserFromCloud,
  pushAppRoleToCloud,
  deleteAppRoleFromCloud,
} from '@/lib/syncActions';

// --- ELECTRON STORAGE ADAPTER ---
const electronStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if ((window as any).electronAPI) {
      const data = await (window as any).electronAPI.get(name);
      return data ? JSON.stringify(data) : null;
    }
    return localStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if ((window as any).electronAPI) {
      await (window as any).electronAPI.set(name, JSON.parse(value));
    } else {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if ((window as any).electronAPI) {
      await (window as any).electronAPI.delete(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};
// --------------------------------

const defaultRooms: Room[] = [
  { roomNo: '201', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '202', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '203', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '204', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '205', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '206', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '207', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '208', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '209', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '210', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '211', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '212', category: 'AC', bedType: 'Double Bed', rent: 1600 },
  { roomNo: '218', category: 'AC', bedType: '4 Bed', rent: 2500 },
  { roomNo: '221', category: 'AC', bedType: '5 Bed', rent: 3500 },
  { roomNo: '222', category: 'AC', bedType: '4 Bed', rent: 2500 },
  { roomNo: '213', category: 'Air Cooled', bedType: '5 Bed', rent: 2500 },
  { roomNo: '214', category: 'Air Cooled', bedType: 'Double Bed', rent: 1500 },
  { roomNo: '216', category: 'Air Cooled', bedType: '4 Bed', rent: 2000 },
  { roomNo: '219', category: 'Air Cooled', bedType: '3 Bed', rent: 2000 },
  { roomNo: '220', category: 'Air Cooled', bedType: '5 Bed', rent: 2500 },
  { roomNo: '217', category: 'Hall', bedType: '9 Bed Hall (AC)', rent: 4000 },
  { roomNo: '215', category: 'Hall', bedType: '8 Bed Hall (Non-AC)', rent: 3500 },
  { roomNo: '223', category: 'Hall', bedType: '8 Bed Hall (Non-AC)', rent: 3500 },
  { roomNo: '224', category: 'Hall', bedType: '8 Bed Hall (Non-AC)', rent: 3500 },
];

export const DEFAULT_STAFF_ROLES: StaffRole[] = [
  { id: 'role-manager', name: 'Manager', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'role-receptionist', name: 'Receptionist', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'role-housekeeping', name: 'Housekeeping', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'role-cook', name: 'Cook / Chef', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'role-security', name: 'Security', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_SHIFTS: Shift[] = [
  { id: 'shift-morning', name: 'Morning Shift', startTime: '07:00', endTime: '15:00', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'shift-evening', name: 'Evening Shift', startTime: '15:00', endTime: '23:00', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'shift-night', name: 'Night Shift', startTime: '23:00', endTime: '07:00', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'shift-full', name: 'Full Day', startTime: '09:00', endTime: '21:00', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
];

interface RoomStatus {
  [key: string]: 'cleaning' | 'maintenance';
}

interface BillCounter {
  date: string;
  count: number;
}

interface StoreState {
  // Auth
  isAuthenticated: boolean;
  isDeveloperMode: boolean;
  currentUser: AppUser | 'master' | null;

  // Data
  rooms: Room[];
  bookings: Booking[];
  history: HistoryRecord[];
  roomStatus: RoomStatus;
  staff: Staff[];
  staffLogs: StaffLog[];
  billCounter: BillCounter;
  invoiceSettings: InvoiceSettings;
  customBedTypes: string[];
  customCategories: string[];
  roomHolds: RoomHold[];

  // Season / rate modes (Room.rent is the Normal rate)
  rateModes: RateMode[];
  activeRateModeId: string;
  roomModeRates: RoomModeRates;
  bookingRateSnapshots: Record<string, BookingRateSnapshot>;
  appUsers: AppUser[];
  appRoles: AppRole[];
  
  // UI
  currentSection: SectionType;
  currentFilter: string;
  currentMonth: Date;
  
  // Auth
  lastLoginTime: number | null;
  setAuthenticated: (status: boolean) => void;
  setCurrentUser: (user: AppUser | 'master' | null) => void;
  setDeveloperMode: (status: boolean) => void;
  logout: () => void;
  
  // Actions - Navigation
  setSection: (section: SectionType) => void;
  setFilter: (filter: string) => void;
  setMonth: (date: Date) => void;
  prefilledRegistration: Partial<Booking> | null;
  setPrefilledRegistration: (data: Partial<Booking> | null) => void;
  
  // Actions - Bookings
  addBooking: (booking: Booking) => void;
  updateBooking: (updatedBooking: Booking) => void;
  removeBooking: (id: string) => void;
  removeBookingById: (id: string) => void;
  convertReservationToCheckIn: (id: string) => void;
  addAdvancePayment: (bookingId: string, payment: AdvancePayment) => void;
  
  // Actions - History
  addHistory: (record: HistoryRecord) => void;
  updateHistory: (updatedRecord: HistoryRecord) => void; // <--- ADDED THIS
  removeHistory: (idOrIndex: string | number) => void;
  removeHistoryById: (id: string) => void;
  clearHistory: () => void;
  
  // Actions - Room Status
  setRoomStatus: (roomNo: string, status: 'cleaning' | 'maintenance' | null) => void;
  markCleaned: (roomNo: string) => void;
  
  // Actions - Staff (Legacy)
  addStaff: (staff: Staff) => void;
  removeStaffByName: (name: string) => void;
  removeStaff: (index: number) => void;
  addStaffLog: (log: StaffLog) => void;

  // Staff & Payroll State (Modern Relational Architecture)
  staffRoles: StaffRole[];
  shifts: Shift[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  salaryAdvances: SalaryAdvance[];
  borrows: BorrowRecord[];
  salaryAdjustments: SalaryAdjustment[];
  salaryPayments: SalaryPayment[];
  salaryDeductionLedger: SalaryDeductionLedgerItem[];

  // Actions - Staff & Payroll (Modern)
  addStaffRole: (name: string) => StaffRole;
  addShift: (shift: Omit<Shift, 'id' | 'created_at' | 'updated_at'>) => Shift;
  addEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  softDeleteEmployee: (id: string) => void;
  markAttendance: (employeeId: string, date: string, status: 'Present' | 'Absent' | 'Paid Leave' | 'Unpaid Leave') => void;
  markAllPresent: (date: string) => void;
  addSalaryAdvance: (advance: { employeeId: string; amount: number; date: string; reason?: string }) => void;
  updateSalaryAdvance: (id: string, updates: Partial<SalaryAdvance>) => { success: boolean; error?: string };
  deleteSalaryAdvance: (id: string) => { success: boolean; error?: string };
  addBorrow: (borrow: { employeeId: string; amount: number; date: string; reason?: string }) => void;
  updateBorrow: (id: string, updates: Partial<BorrowRecord>) => { success: boolean; error?: string };
  deleteBorrow: (id: string) => { success: boolean; error?: string };
  addSalaryAdjustment: (adjustment: { employeeId: string; amount: number; reason: string; cycleId?: string; type?: 'manual' | 'auto_attendance_change' | 'late_advance' }) => SalaryAdjustment;
  deleteSalaryAdjustment: (id: string) => { success: boolean; error?: string };
  executeCyclePayout: (payout: {
    employeeId: string;
    cycleStart: string;
    cycleEnd: string;
    cycleDays: number;
    salaryUsed: number;
    perDay: number;
    gross: number;
    presentDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    notMarkedDays: number;
    deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave'; amount: number }>;
    attendanceDeduction: number;
    earnedAmount: number;
    advanceDeducted: number;
    carriedForwardAdvanceIn: number;
    carriedForwardAdvanceOut: number;
    borrowDeducted: number;
    borrowRecoveries: Array<{ borrowId: string; amount: number; reason?: string }>;
    adjustmentsTotal: number;
    adjustmentsApplied: Array<{ id: string; amount: number; reason: string }>;
    netPaid: number;
    paidOn: string;
    paymentRef?: string;
    note?: string;
    isFinalSettlement?: boolean;
    lastWorkingDate?: string;
  }) => { success: boolean; paymentId?: string; slipNumber?: string; error?: string };
  reverseCyclePayout: (paymentId: string, reason: string) => { success: boolean; error?: string };
  finalSettlement: (employeeId: string, settlementData: {
    lastWorkingDate: string;
    cycleStart: string;
    cycleEnd: string;
    cycleDays: number;
    salaryUsed: number;
    perDay: number;
    gross: number;
    presentDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    notMarkedDays: number;
    deductedDates: Array<{ date: string; type: 'Absent' | 'Unpaid Leave'; amount: number }>;
    attendanceDeduction: number;
    earnedAmount: number;
    advanceDeducted: number;
    carriedForwardAdvanceIn: number;
    carriedForwardAdvanceOut: number;
    borrowDeducted: number;
    borrowRecoveries: Array<{ borrowId: string; amount: number; reason?: string }>;
    adjustmentsTotal: number;
    adjustmentsApplied: Array<{ id: string; amount: number; reason: string }>;
    netPaid: number;
    paidOn: string;
    paymentRef?: string;
    note?: string;
  }) => { success: boolean; paymentId?: string; error?: string };
  executePayout: (payout: { employeeId: string; month: string; gross: number; advanceDeducted: number; borrowDeducted: number; netPaid: number; paidOn: string; paymentRef?: string; note?: string }) => { success: boolean; error?: string };
  voidPayout: (paymentId: string) => { success: boolean; error?: string };
  
  // Actions - Admin
  addRoom: (room: Room) => void;
  updateRoom: (roomNo: string, updatedRoom: Room) => void;
  removeRoom: (index: number) => void;
  removeRoomByNo: (roomNo: string) => void;
  addRateMode: (name: string) => { success: boolean; error?: string; id?: string };
  renameRateMode: (id: string, name: string) => { success: boolean; error?: string };
  deleteRateMode: (id: string) => { success: boolean; error?: string };
  setActiveRateMode: (id: string) => void;
  /** Set (number) or clear (null = inherit Normal) rates of one non-Normal mode. */
  setRoomModeRates: (modeId: string, rates: Record<string, number | null>) => void;
  addCustomBedType: (type: string) => void;
  removeCustomBedType: (type: string) => void;
  addCustomCategory: (category: string) => void;
  removeCustomCategory: (category: string) => void;
  updateInvoiceSettings: (settings: Partial<InvoiceSettings>) => void;
  setRoomHolds: (holds: RoomHold[]) => void;
  
  // Actions - Users & Roles
  addAppUser: (user: AppUser) => void;
  updateAppUser: (id: string, user: AppUser) => void;
  deleteAppUser: (id: string) => void;
  addAppRole: (role: AppRole) => void;
  updateAppRole: (id: string, role: AppRole) => void;
  deleteAppRole: (id: string) => void;
  
  // Actions - Bill Number
  getNextBillNumber: () => { billNo: number; billDate: string };

  // Actions - Sync
  mergeSyncedData: (data: {
    bookings?: Booking[];
    history?: HistoryRecord[];
    roomStatus?: RoomStatus;
    staff?: Staff[];
    staffLogs?: StaffLog[];
    invoiceSettings?: InvoiceSettings;
    rooms?: Room[];
    customCategories?: string[];
    customBedTypes?: string[];
    appUsers?: AppUser[];
    appRoles?: AppRole[];
  }) => void;
  
  // Computed
  getOccupiedRooms: () => string[];
  getReservedRooms: () => string[];
  getAvailableRooms: () => Room[];
  getRoomStatus: (roomNo: string) => 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Auth Initial State
      isAuthenticated: false,
      isDeveloperMode: false,
      currentUser: null,
      lastLoginTime: null,

      // Initial Data
      rooms: defaultRooms,
      rateModes: DEFAULT_RATE_MODES,
      activeRateModeId: NORMAL_RATE_MODE_ID,
      roomModeRates: {},
      bookingRateSnapshots: {},
      bookings: [],
      history: [],
      roomStatus: {},
      staff: [],
      staffLogs: [],
      staffRoles: DEFAULT_STAFF_ROLES,
      shifts: DEFAULT_SHIFTS,
      employees: [],
      attendance: [],
      salaryAdvances: [],
      borrows: [],
      salaryAdjustments: [],
      salaryPayments: [],
      salaryDeductionLedger: [],
      billCounter: { date: '', count: 0 },
      invoiceSettings: DEFAULT_INVOICE_SETTINGS,
      customBedTypes: ['Single Bed', 'Double Bed', 'Triple Bed', '4 Bed', '5 Bed', '6 Bed'],
      customCategories: ['AC', 'Air Cooled', 'Hall', 'Suite', 'Deluxe', 'Dormitory', 'Family Room', 'VIP Room'],
      roomHolds: [],
      appUsers: [],
      appRoles: [
        { id: 'role-admin', name: 'Admin', permissions: ['dashboard', 'registration', 'billing', 'calendar', 'history', 'revenue', 'admin', 'staff'] },
        { id: 'role-manager', name: 'Manager', permissions: ['dashboard', 'registration', 'billing', 'calendar', 'history', 'revenue'] },
        { id: 'role-staff', name: 'Staff', permissions: ['dashboard', 'registration', 'billing', 'calendar'] }
      ],
      
      // UI State
      currentSection: 'dashboard',
      currentFilter: 'all',
      currentMonth: new Date(),
      
      // Auth
      setAuthenticated: (status) => set({ 
        isAuthenticated: status, 
        lastLoginTime: status ? Date.now() : null 
      }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setDeveloperMode: (status) => set({ isDeveloperMode: status }),
      logout: () => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.vaultLock) {
          (window as any).electronAPI.vaultLock().catch(console.error);
        }
        set({ isAuthenticated: false, currentUser: null, lastLoginTime: null });
      },
      
      // Navigation
      setSection: (section) => set({ currentSection: section }),
      setFilter: (filter) => set({ currentFilter: filter }),
      setMonth: (date) => set({ currentMonth: date }),
      prefilledRegistration: null,
      setPrefilledRegistration: (data) => set({ prefilledRegistration: data }),
      
      // Bookings
      addBooking: (booking) => set((state) => {
        const stamped = {
          ...booking,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (booking.version || 0) + 1,
        };
        pushBookingToCloud(stamped);

        // Lock in the per-night rates this booking is created with. Kept in a
        // separate local map (not on the booking) so sync echoes can't drop it
        // and later mode/rate changes never alter this booking's bill.
        const snapshots = state.bookingRateSnapshots || {};
        const bookingRateSnapshots = snapshots[stamped.id]
          ? snapshots
          : { ...snapshots, [stamped.id]: buildRateSnapshot(stamped.roomNos, getActiveRateMode(state), state) };

        return { bookings: [...state.bookings, stamped], bookingRateSnapshots };
      }),

      updateBooking: (updatedBooking) => set((state) => {
        const stamped = {
          ...updatedBooking,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (updatedBooking.version || 0) + 1,
        };
        pushBookingToCloud(stamped);
        return {
          bookings: state.bookings.map((b) => 
            b.id === stamped.id ? stamped : b
          )
        };
      }),
      
      removeBooking: (id) => set((state) => {
        deleteBookingFromCloud(id);
        return { bookings: state.bookings.filter((b) => b.id !== id) };
      }),
      
      removeBookingById: (id) => set((state) => {
        deleteBookingFromCloud(id);
        return { bookings: state.bookings.filter((b) => b.id !== id) };
      }),
      
      convertReservationToCheckIn: (id) => set((state) => {
        const updated = state.bookings.map((b) =>
          b.id === id
            ? {
                ...b,
                isReservation: false,
                checkIn: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                source: 'desktop',
                version: (b.version || 0) + 1,
              }
            : b
        );
        const changed = updated.find(b => b.id === id);
        if (changed) pushBookingToCloud(changed);
        return { bookings: updated };
      }),
      
      addAdvancePayment: (bookingId, payment) => set((state) => {
        const updated = state.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                advancePayments: [...b.advancePayments, payment],
                advance: b.advance + payment.amount,
                updated_at: new Date().toISOString(),
                source: 'desktop',
                version: (b.version || 0) + 1,
              }
            : b
        );
        const changed = updated.find(b => b.id === bookingId);
        if (changed) pushBookingToCloud(changed);
        return { bookings: updated };
      }),
      
      // History
      addHistory: (record) => set((state) => {
        const stamped = {
          ...record,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (record.version || 0) + 1,
        };
        pushHistoryToCloud(stamped);
        return { history: [stamped, ...state.history] };
      }),

      updateHistory: (updatedRecord) => set((state) => {
        const stamped = {
          ...updatedRecord,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (updatedRecord.version || 0) + 1,
        };
        pushHistoryToCloud(stamped);
        return {
          history: state.history.map((h) => 
            h.id === stamped.id ? stamped : h
          )
        };
      }),
      
      removeHistory: (idOrIndex) => set((state) => ({
        history: typeof idOrIndex === 'string'
          ? state.history.filter((h) => h.id !== idOrIndex)
          : state.history.filter((_, i) => i !== idOrIndex)
      })),

      removeHistoryById: (id) => set((state) => ({
        history: state.history.filter((h) => h.id !== id)
      })),
      
      clearHistory: () => set({ history: [] }),
      
      // Room Status
      setRoomStatus: (roomNo, status) => set((state) => {
        // Cross-validate manual room status changes against active bookings
        // Prevent marking a room "maintenance" while it has an active booking in progress
        const todayStr = normalizeToDayStr(new Date());
        const activeBooking = state.bookings.find(b => {
          if (!b.roomNos?.includes(roomNo)) return false;
          const bIn = normalizeToDayStr(b.checkIn);
          const bOut = getCheckoutDayStr(b.checkIn, b.days || 1);
          return todayStr >= bIn && todayStr < bOut;
        });

        if (activeBooking && status === 'maintenance') {
          console.warn(`[useStore] Cannot set Room ${roomNo} to maintenance: active ${activeBooking.isReservation ? 'reservation' : 'booking'} exists for ${activeBooking.guestName}.`);
          return state;
        }

        const newStatus = { ...state.roomStatus };
        if (status === null) {
          delete newStatus[roomNo];
          deleteRoomStatusFromCloud(roomNo);
        } else {
          newStatus[roomNo] = status;
          pushRoomStatusToCloud(roomNo, status);
        }
        return { roomStatus: newStatus };
      }),
      
      markCleaned: (roomNo) => set((state) => {
        const newStatus = { ...state.roomStatus };
        delete newStatus[roomNo];
        deleteRoomStatusFromCloud(roomNo);
        return { roomStatus: newStatus };
      }),
      
      // Staff
      addStaff: (staff) => set((state) => {
        const stamped = {
          ...staff,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (staff.version || 0) + 1,
        };
        pushStaffToCloud(stamped);
        return { staff: [...state.staff, stamped] };
      }),
      
      removeStaffByName: (name) => set((state) => {
        deleteStaffFromCloud(name);
        return { staff: state.staff.filter((s) => s.name !== name) };
      }),
      
      removeStaff: (index) => set((state) => {
        const st = state.staff[index];
        if (st) deleteStaffFromCloud(st.name);
        return { staff: state.staff.filter((_, i) => i !== index) };
      }),
      
      addStaffLog: (log) => set((state) => {
        const stamped: StaffLog = {
          ...log,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (log.version || 0) + 1,
        };
        pushStaffLogToCloud(stamped, `${stamped.date}-${stamped.staff}-${stamped.type}`);
        const MAX_STAFF_LOGS = 500; // Retention cap: keep most recent 500 records to prevent unbounded growth
        return { staffLogs: [stamped, ...state.staffLogs].slice(0, MAX_STAFF_LOGS) };
      }),

      // Actions - Staff & Payroll (Modern Relational Architecture)
      addStaffRole: (name: string) => {
        const newRole: StaffRole = {
          id: generateUUID(),
          name: name.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ staffRoles: [...state.staffRoles, newRole] }));
        return newRole;
      },

      addShift: (shiftData) => {
        const newShift: Shift = {
          ...shiftData,
          id: generateUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ shifts: [...state.shifts, newShift] }));
        return newShift;
      },

      addEmployee: (employeeData) => {
        const newEmployee: Employee = {
          ...employeeData,
          id: generateUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ employees: [...state.employees, newEmployee] }));
        return newEmployee;
      },

      updateEmployee: (id, updates) => set((state) => {
        const emp = state.employees.find((e) => e.id === id);
        if (!emp) return state;

        // PRD Section 1: Joining date can't be edited after the first payout
        let safeUpdates = { ...updates };
        if (updates.joiningDate && updates.joiningDate !== emp.joiningDate) {
          const hasPaidSlip = (state.salaryPayments || []).some(
            (p) => p.employeeId === id && p.status === 'Paid' && !p.deleted_at
          );
          if (hasPaidSlip) {
            console.warn('[useStore] Cannot edit joining date after first payout has been made.');
            safeUpdates.joiningDate = emp.joiningDate;
          }
        }

        return {
          employees: state.employees.map((e) =>
            e.id === id ? { ...e, ...safeUpdates, updated_at: new Date().toISOString() } : e
          ),
        };
      }),

      softDeleteEmployee: (id) => set((state) => ({
        employees: state.employees.map((emp) =>
          emp.id === id ? { ...emp, status: 'inactive', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } : emp
        ),
      })),

      markAttendance: (employeeId, date, status) => set((state) => {
        const emp = state.employees.find((e) => e.id === employeeId && !e.deleted_at);
        if (!emp) return state;

        // Bounds check: only past/current dates between joiningDate and today can be marked
        const todayStr = toLocalDateString();
        if (date < emp.joiningDate || date > todayStr) {
          console.warn(`[markAttendance] Date ${date} outside allowed range [${emp.joiningDate}, ${todayStr}]`);
          return state;
        }

        const now = new Date().toISOString();
        const existingIdx = state.attendance.findIndex((a) => a.employeeId === employeeId && a.date === date && !a.deleted_at);
        const oldStatus = existingIdx >= 0 ? state.attendance[existingIdx].status : null;

        // Check if date belongs to an already Paid cycle
        const cycles = generateEmployeeCycles(emp, todayStr, state.salaryPayments, state.attendance);
        const paidCycle = cycles.find((c) => c.status === 'Paid' && date >= c.startDate && date <= c.endDate && c.payment);

        let newAdjustments = state.salaryAdjustments || [];

        if (paidCycle && paidCycle.payment) {
          // PRD Section 6: Post-payout attendance changes auto-generate pending SalaryAdjustment
          const wasOldDeducted = (oldStatus === 'Absent' || oldStatus === 'Unpaid Leave');
          const isNewDeducted = (status === 'Absent' || status === 'Unpaid Leave');

          if (wasOldDeducted !== isNewDeducted) {
            const cycleDays = paidCycle.cycleDays || 30;
            const salaryUsed = paidCycle.payment.salaryUsed || emp.monthlySalary;
            const perDayPaise = Math.round((salaryUsed * 100) / cycleDays);

            // If formerly deducted and now present/paid leave -> employee is owed refund (+ amount)
            // If formerly not deducted and now absent/unpaid leave -> deduction (- amount)
            const diffPaise = wasOldDeducted && !isNewDeducted ? perDayPaise : -perDayPaise;
            const adjAmount = diffPaise / 100;

            const autoAdj: SalaryAdjustment = {
              id: generateUUID(),
              employeeId,
              cycleId: paidCycle.id,
              amount: adjAmount,
              reason: `Changed after payout: ${formatDDMMYYYY(date)} (${oldStatus || 'Unmarked'} -> ${status})`,
              type: 'auto_attendance_change',
              status: 'Open',
              created_at: now,
              updated_at: now,
              deleted_at: null,
            };
            newAdjustments = [...newAdjustments, autoAdj];
          }
        }

        let updatedAttendance = [...state.attendance];
        if (existingIdx >= 0) {
          updatedAttendance[existingIdx] = {
            ...updatedAttendance[existingIdx],
            status,
            updated_at: now,
          };
        } else {
          updatedAttendance.push({
            id: generateUUID(),
            employeeId,
            date,
            status,
            created_at: now,
            updated_at: now,
          });
        }

        return {
          attendance: updatedAttendance,
          salaryAdjustments: newAdjustments,
        };
      }),

      markAllPresent: (date) => set((state) => {
        const activeEmployees = state.employees.filter((emp) => emp.status === 'active' && !emp.deleted_at);
        const now = new Date().toISOString();
        const updatedAttendance = [...state.attendance];

        for (const emp of activeEmployees) {
          if (date < emp.joiningDate) continue;
          const idx = updatedAttendance.findIndex((a) => a.employeeId === emp.id && a.date === date && !a.deleted_at);
          if (idx >= 0) {
            updatedAttendance[idx] = {
              ...updatedAttendance[idx],
              status: 'Present',
              updated_at: now,
            };
          } else {
            updatedAttendance.push({
              id: generateUUID(),
              employeeId: emp.id,
              date,
              status: 'Present',
              created_at: now,
              updated_at: now,
            });
          }
        }
        return { attendance: updatedAttendance };
      }),

      addSalaryAdvance: (advance) => set((state) => {
        const emp = state.employees.find((e) => e.id === advance.employeeId);
        const now = new Date().toISOString();
        const advAmount = Number(advance.amount);

        // Check if date falls in an already paid cycle
        let isPaidCycle = false;
        let paidCycleInfo: any = null;
        if (emp) {
          const cycles = generateEmployeeCycles(emp, undefined, state.salaryPayments, state.attendance);
          paidCycleInfo = cycles.find((c) => c.status === 'Paid' && advance.date >= c.startDate && advance.date <= c.endDate);
          if (paidCycleInfo) {
            isPaidCycle = true;
          }
        }

        const newAdvance: SalaryAdvance = {
          id: generateUUID(),
          employeeId: advance.employeeId,
          amount: advAmount,
          deducted_amount: isPaidCycle ? advAmount : 0,
          date: advance.date,
          transactionDate: advance.date,
          status: isPaidCycle ? 'Settled' : 'Open',
          reason: advance.reason || undefined,
          created_at: now,
          updated_at: now,
        };

        let newAdjustments = state.salaryAdjustments || [];
        if (isPaidCycle) {
          // Late advance: cycle already paid, convert to late adjustment in next open cycle
          const lateAdj: SalaryAdjustment = {
            id: generateUUID(),
            employeeId: advance.employeeId,
            cycleId: paidCycleInfo?.id,
            amount: -advAmount, // Negative adjustment to deduct from salary
            reason: `Advance dated ${formatDDMMYYYY(advance.date)}, cycle already paid`,
            type: 'late_advance',
            status: 'Open',
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          newAdjustments = [...newAdjustments, lateAdj];
        }

        return {
          salaryAdvances: [...state.salaryAdvances, newAdvance],
          salaryAdjustments: newAdjustments,
        };
      }),

      updateSalaryAdvance: (id, updates) => {
        const state = get();
        const adv = state.salaryAdvances.find((a) => a.id === id && !a.deleted_at);
        if (!adv) return { success: false, error: 'Advance not found' };
        if (adv.status !== 'Open') {
          return { success: false, error: 'Cannot modify an advance that has already been settled or belongs to a paid cycle.' };
        }
        const now = new Date().toISOString();
        set({
          salaryAdvances: state.salaryAdvances.map((a) =>
            a.id === id ? { ...a, ...updates, updated_at: now } : a
          ),
        });
        return { success: true };
      },

      deleteSalaryAdvance: (id) => {
        const state = get();
        const adv = state.salaryAdvances.find((a) => a.id === id && !a.deleted_at);
        if (!adv) return { success: false, error: 'Advance not found' };
        if (adv.status !== 'Open') {
          return { success: false, error: 'Cannot delete an advance that has already been settled or belongs to a paid cycle.' };
        }
        const now = new Date().toISOString();
        set({
          salaryAdvances: state.salaryAdvances.map((a) =>
            a.id === id ? { ...a, deleted_at: now, updated_at: now } : a
          ),
        });
        return { success: true };
      },

      addBorrow: (borrow) => set((state) => {
        const now = new Date().toISOString();
        const newBorrow: BorrowRecord = {
          id: generateUUID(),
          employeeId: borrow.employeeId,
          amount: Number(borrow.amount),
          repaid_amount: 0,
          status: 'outstanding',
          date: borrow.date,
          transactionDate: borrow.date,
          reason: borrow.reason || undefined,
          created_at: now,
          updated_at: now,
        };
        return { borrows: [...state.borrows, newBorrow] };
      }),

      updateBorrow: (id, updates) => {
        const state = get();
        const b = state.borrows.find((item) => item.id === id && !item.deleted_at);
        if (!b) return { success: false, error: 'Borrow record not found' };
        if (b.status !== 'outstanding') {
          return { success: false, error: 'Cannot modify a borrow record that has repayments or has been settled.' };
        }
        const now = new Date().toISOString();
        set({
          borrows: state.borrows.map((item) =>
            item.id === id ? { ...item, ...updates, updated_at: now } : item
          ),
        });
        return { success: true };
      },

      deleteBorrow: (id) => {
        const state = get();
        const b = state.borrows.find((item) => item.id === id && !item.deleted_at);
        if (!b) return { success: false, error: 'Borrow record not found' };
        if (b.status !== 'outstanding') {
          return { success: false, error: 'Cannot delete a borrow record that has repayments or has been settled.' };
        }
        const now = new Date().toISOString();
        set({
          borrows: state.borrows.map((item) =>
            item.id === id ? { ...item, deleted_at: now, updated_at: now } : item
          ),
        });
        return { success: true };
      },

      addSalaryAdjustment: (adj) => {
        const now = new Date().toISOString();
        const newAdj: SalaryAdjustment = {
          id: generateUUID(),
          employeeId: adj.employeeId,
          cycleId: adj.cycleId,
          amount: Number(adj.amount),
          reason: adj.reason,
          type: adj.type || 'manual',
          status: 'Open',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        set((state) => ({
          salaryAdjustments: [...(state.salaryAdjustments || []), newAdj],
        }));
        return newAdj;
      },

      deleteSalaryAdjustment: (id) => {
        const state = get();
        const adj = (state.salaryAdjustments || []).find((a) => a.id === id && !a.deleted_at);
        if (!adj) return { success: false, error: 'Adjustment not found' };
        if (adj.status !== 'Open') {
          return { success: false, error: 'Cannot delete an adjustment that has already been applied.' };
        }
        const now = new Date().toISOString();
        set({
          salaryAdjustments: (state.salaryAdjustments || []).map((a) =>
            a.id === id ? { ...a, deleted_at: now, updated_at: now } : a
          ),
        });
        return { success: true };
      },

      executeCyclePayout: (payout) => {
        const state = get();
        const now = new Date().toISOString();
        const paymentId = generateUUID();
        const slipNumber = generateSlipNumber(state.salaryPayments || []);

        // 1. Mark advances as Settled
        const updatedAdvances = (state.salaryAdvances || []).map((adv) => {
          if (adv.employeeId === payout.employeeId && !adv.deleted_at && adv.status === 'Open') {
            if (adv.date <= payout.cycleEnd) {
              return {
                ...adv,
                status: 'Settled' as const,
                payoutId: paymentId,
                deducted_amount: adv.amount,
                updated_at: now,
              };
            }
          }
          return adv;
        });

        // 2. Apply borrow recoveries
        const recoveryMap = new Map<string, number>();
        for (const rec of payout.borrowRecoveries || []) {
          recoveryMap.set(rec.borrowId, (recoveryMap.get(rec.borrowId) || 0) + Number(rec.amount || 0));
        }

        const newLedgerItems: SalaryDeductionLedgerItem[] = [];
        const updatedBorrows = (state.borrows || []).map((b) => {
          const recAmount = recoveryMap.get(b.id);
          if (recAmount && recAmount > 0) {
            const newRepaid = (b.repaid_amount || 0) + recAmount;
            const newStatus: 'outstanding' | 'partially_repaid' | 'settled' =
              newRepaid >= b.amount ? 'settled' : 'partially_repaid';
            newLedgerItems.push({
              id: generateUUID(),
              salaryPaymentId: paymentId,
              targetType: 'borrow',
              targetId: b.id,
              amount: recAmount,
              created_at: now,
              updated_at: now,
              deleted_at: null,
            });
            return {
              ...b,
              repaid_amount: newRepaid,
              status: newStatus,
              payoutId: paymentId,
              updated_at: now,
            };
          }
          return b;
        });

        // 3. Apply adjustments
        const appliedAdjIds = new Set((payout.adjustmentsApplied || []).map((a) => a.id));
        const updatedAdjustments = (state.salaryAdjustments || []).map((adj) => {
          if (appliedAdjIds.has(adj.id)) {
            return {
              ...adj,
              status: 'Applied' as const,
              payoutId: paymentId,
              updated_at: now,
            };
          }
          return adj;
        });

        // 4. Create immutable SalaryPayment record
        const newPayment: SalaryPayment = {
          id: paymentId,
          employeeId: payout.employeeId,
          month: payout.cycleStart.slice(0, 7),
          slipNumber,
          cycleStart: payout.cycleStart,
          cycleEnd: payout.cycleEnd,
          cycleDays: payout.cycleDays,
          salaryUsed: payout.salaryUsed,
          perDay: payout.perDay,
          gross: Number(payout.gross),
          presentDays: payout.presentDays,
          absentDays: payout.absentDays,
          paidLeaveDays: payout.paidLeaveDays,
          unpaidLeaveDays: payout.unpaidLeaveDays,
          notMarkedDays: payout.notMarkedDays,
          deductedDates: payout.deductedDates,
          attendanceDeduction: Number(payout.attendanceDeduction || 0),
          earnedAmount: Number(payout.earnedAmount || 0),
          advance_deducted: Number(payout.advanceDeducted || 0),
          carriedForwardAdvanceIn: Number(payout.carriedForwardAdvanceIn || 0),
          carriedForwardAdvanceOut: Number(payout.carriedForwardAdvanceOut || 0),
          borrow_deducted: Number(payout.borrowDeducted || 0),
          borrowRecoveries: payout.borrowRecoveries,
          adjustmentsTotal: Number(payout.adjustmentsTotal || 0),
          adjustmentsApplied: payout.adjustmentsApplied,
          net_paid: Number(payout.netPaid),
          paid_on: payout.paidOn,
          payment_ref: payout.paymentRef || undefined,
          note: payout.note || undefined,
          status: 'Paid',
          isLegacy: false,
          isFinalSettlement: !!payout.isFinalSettlement,
          lastWorkingDate: payout.lastWorkingDate,
          created_at: now,
          updated_at: now,
        };

        // 5. If final settlement, update employee status to inactive
        let updatedEmployees = state.employees;
        if (payout.isFinalSettlement) {
          updatedEmployees = state.employees.map((emp) =>
            emp.id === payout.employeeId
              ? {
                  ...emp,
                  status: 'inactive' as const,
                  lastWorkingDate: payout.lastWorkingDate || payout.cycleEnd,
                  updated_at: now,
                }
              : emp
          );
        }

        set({
          employees: updatedEmployees,
          salaryAdvances: updatedAdvances,
          borrows: updatedBorrows,
          salaryAdjustments: updatedAdjustments,
          salaryPayments: [...(state.salaryPayments || []), newPayment],
          salaryDeductionLedger: [...(state.salaryDeductionLedger || []), ...newLedgerItems],
        });

        return { success: true, paymentId, slipNumber };
      },

      reverseCyclePayout: (paymentId, reason) => {
        const state = get();
        // Permission check: reverse requires admin or master role
        const currentUser = state.currentUser;
        const userRole = currentUser && typeof currentUser === 'object'
          ? (state.appRoles || []).find((r) => r.id === currentUser.roleId)
          : null;
        const isAdmin = currentUser === 'master' || (userRole && (userRole.name.toLowerCase().includes('admin') || userRole.id === 'role-admin'));
        if (!isAdmin) {
          return { success: false, error: 'Only Admin or Master can reverse salary payouts.' };
        }

        const payment = (state.salaryPayments || []).find((p) => p.id === paymentId && !p.deleted_at);
        if (!payment) {
          return { success: false, error: 'Payment not found' };
        }
        if (payment.status === 'Reversed') {
          return { success: false, error: 'Payment has already been reversed.' };
        }

        const now = new Date().toISOString();

        // 1. Mark payment as Reversed
        const updatedPayments = (state.salaryPayments || []).map((p) =>
          p.id === paymentId
            ? {
                ...p,
                status: 'Reversed' as const,
                reversed_at: now,
                reversed_reason: reason || 'Reversed by admin',
                updated_at: now,
              }
            : p
        );

        // 2. Re-open advances settled by this payout
        const updatedAdvances = (state.salaryAdvances || []).map((adv) => {
          if (adv.payoutId === paymentId) {
            return {
              ...adv,
              status: 'Open' as const,
              payoutId: null,
              deducted_amount: 0,
              updated_at: now,
            };
          }
          return adv;
        });

        // 3. Reverse borrow recoveries applied in this payout
        const recoveryMap = new Map<string, number>();
        for (const rec of payment.borrowRecoveries || []) {
          recoveryMap.set(rec.borrowId, (recoveryMap.get(rec.borrowId) || 0) + Number(rec.amount || 0));
        }

        const updatedBorrows = (state.borrows || []).map((b) => {
          const recAmount = recoveryMap.get(b.id);
          if (recAmount && recAmount > 0) {
            const newRepaid = Math.max(0, (b.repaid_amount || 0) - recAmount);
            const newStatus: 'outstanding' | 'partially_repaid' | 'settled' =
              newRepaid >= b.amount ? 'settled' : (newRepaid > 0 ? 'partially_repaid' : 'outstanding');
            return {
              ...b,
              repaid_amount: newRepaid,
              status: newStatus,
              payoutId: null,
              updated_at: now,
            };
          }
          return b;
        });

        // 4. Re-open adjustments applied in this payout
        const updatedAdjustments = (state.salaryAdjustments || []).map((adj) => {
          if (adj.payoutId === paymentId) {
            return {
              ...adj,
              status: 'Open' as const,
              payoutId: null,
              updated_at: now,
            };
          }
          return adj;
        });

        // 5. Mark ledger items as deleted
        const updatedLedger = (state.salaryDeductionLedger || []).map((l) =>
          l.salaryPaymentId === paymentId ? { ...l, deleted_at: now, updated_at: now } : l
        );

        set({
          salaryPayments: updatedPayments,
          salaryAdvances: updatedAdvances,
          borrows: updatedBorrows,
          salaryAdjustments: updatedAdjustments,
          salaryDeductionLedger: updatedLedger,
        });

        return { success: true };
      },

      finalSettlement: (employeeId, settlementData) => {
        return get().executeCyclePayout({
          ...settlementData,
          employeeId,
          isFinalSettlement: true,
        });
      },

      executePayout: (payout) => {
        const state = get();
        // 1. One payout per employee per month
        const existing = state.salaryPayments.find(
          (p) => p.employeeId === payout.employeeId && p.month === payout.month && !p.deleted_at
        );
        if (existing) {
          return { success: false, error: `Salary already paid for ${payout.month} on ${existing.paid_on}` };
        }

        const now = new Date().toISOString();
        const paymentId = generateUUID();
        let remainingAdvanceDeduction = Number(payout.advanceDeducted) || 0;
        let remainingBorrowDeduction = Number(payout.borrowDeducted) || 0;

        const newLedgerItems: SalaryDeductionLedgerItem[] = [];

        // Update salary advances (FIFO order: oldest created_at first) and record ledger
        const updatedAdvances = [...state.salaryAdvances]
          .sort((a, b) => (a.created_at || a.date).localeCompare(b.created_at || b.date))
          .map((adv) => {
            if (adv.employeeId === payout.employeeId && remainingAdvanceDeduction > 0) {
              const outstanding = adv.amount - (adv.deducted_amount || 0);
              if (outstanding > 0) {
                const apply = Math.min(outstanding, remainingAdvanceDeduction);
                remainingAdvanceDeduction -= apply;
                newLedgerItems.push({
                  id: generateUUID(),
                  salaryPaymentId: paymentId,
                  targetType: 'advance',
                  targetId: adv.id,
                  amount: apply,
                  created_at: now,
                  updated_at: now,
                  deleted_at: null,
                });
                return {
                  ...adv,
                  deducted_amount: (adv.deducted_amount || 0) + apply,
                  updated_at: now,
                };
              }
            }
            return adv;
          });

        // Update borrows (FIFO order: oldest created_at first) and record ledger
        const updatedBorrows = [...state.borrows]
          .sort((a, b) => (a.created_at || a.date).localeCompare(b.created_at || b.date))
          .map((b) => {
            if (b.employeeId === payout.employeeId && remainingBorrowDeduction > 0) {
              const outstanding = b.amount - (b.repaid_amount || 0);
              if (outstanding > 0) {
                const apply = Math.min(outstanding, remainingBorrowDeduction);
                remainingBorrowDeduction -= apply;
                newLedgerItems.push({
                  id: generateUUID(),
                  salaryPaymentId: paymentId,
                  targetType: 'borrow',
                  targetId: b.id,
                  amount: apply,
                  created_at: now,
                  updated_at: now,
                  deleted_at: null,
                });
                const newRepaid = (b.repaid_amount || 0) + apply;
                const newStatus: 'outstanding' | 'partially_repaid' | 'settled' =
                  newRepaid >= b.amount ? 'settled' : (newRepaid > 0 ? 'partially_repaid' : 'outstanding');
                return {
                  ...b,
                  repaid_amount: newRepaid,
                  status: newStatus,
                  updated_at: now,
                };
              }
            }
            return b;
          });

        const newPayment: SalaryPayment = {
          id: paymentId,
          employeeId: payout.employeeId,
          month: payout.month,
          gross: Number(payout.gross),
          advance_deducted: Number(payout.advanceDeducted) || 0,
          borrow_deducted: Number(payout.borrowDeducted) || 0,
          net_paid: Number(payout.netPaid),
          paid_on: payout.paidOn,
          payment_ref: payout.paymentRef || undefined,
          note: payout.note || undefined,
          created_at: now,
          updated_at: now,
        };

        set({
          salaryAdvances: updatedAdvances,
          borrows: updatedBorrows,
          salaryPayments: [...state.salaryPayments, newPayment],
          salaryDeductionLedger: [...(state.salaryDeductionLedger || []), ...newLedgerItems],
        });

        return { success: true };
      },

      voidPayout: (paymentId) => {
        const state = get();
        const payment = state.salaryPayments.find((p) => p.id === paymentId && !p.deleted_at);
        if (!payment) {
          return { success: false, error: 'Payment not found or already voided' };
        }

        const now = new Date().toISOString();
        const activeLedger = (state.salaryDeductionLedger || []).filter(
          (l) => l.salaryPaymentId === paymentId && !l.deleted_at
        );

        let updatedAdvances = state.salaryAdvances;
        let updatedBorrows = state.borrows;

        if (activeLedger.length > 0) {
          // Precise reversal via deduction ledger
          const advanceDeductMap = new Map<string, number>();
          const borrowDeductMap = new Map<string, number>();

          for (const item of activeLedger) {
            if (item.targetType === 'advance') {
              advanceDeductMap.set(item.targetId, (advanceDeductMap.get(item.targetId) || 0) + item.amount);
            } else if (item.targetType === 'borrow') {
              borrowDeductMap.set(item.targetId, (borrowDeductMap.get(item.targetId) || 0) + item.amount);
            }
          }

          updatedAdvances = state.salaryAdvances.map((adv) => {
            const rev = advanceDeductMap.get(adv.id);
            if (rev && rev > 0) {
              return {
                ...adv,
                deducted_amount: Math.max(0, (adv.deducted_amount || 0) - rev),
                updated_at: now,
              };
            }
            return adv;
          });

          updatedBorrows = state.borrows.map((b) => {
            const rev = borrowDeductMap.get(b.id);
            if (rev && rev > 0) {
              const newRepaid = Math.max(0, (b.repaid_amount || 0) - rev);
              const newStatus: 'outstanding' | 'partially_repaid' | 'settled' =
                newRepaid >= b.amount ? 'settled' : (newRepaid > 0 ? 'partially_repaid' : 'outstanding');
              return {
                ...b,
                repaid_amount: newRepaid,
                status: newStatus,
                updated_at: now,
              };
            }
            return b;
          });
        } else {
          // Legacy fallback restoration for payments made before ledger existed
          let restoreAdvance = payment.advance_deducted || 0;
          let restoreBorrow = payment.borrow_deducted || 0;

          const sortedAdvances = [...state.salaryAdvances].sort((a, b) =>
            (b.created_at || b.date).localeCompare(a.created_at || a.date)
          );
          updatedAdvances = sortedAdvances.map((adv) => {
            if (adv.employeeId === payment.employeeId && restoreAdvance > 0) {
              const currentDeducted = adv.deducted_amount || 0;
              if (currentDeducted > 0) {
                const unapply = Math.min(currentDeducted, restoreAdvance);
                restoreAdvance -= unapply;
                return {
                  ...adv,
                  deducted_amount: currentDeducted - unapply,
                  updated_at: now,
                };
              }
            }
            return adv;
          });

          const sortedBorrows = [...state.borrows].sort((a, b) =>
            (b.created_at || b.date).localeCompare(a.created_at || a.date)
          );
          updatedBorrows = sortedBorrows.map((b) => {
            if (b.employeeId === payment.employeeId && restoreBorrow > 0) {
              const currentRepaid = b.repaid_amount || 0;
              if (currentRepaid > 0) {
                const unapply = Math.min(currentRepaid, restoreBorrow);
                restoreBorrow -= unapply;
                const newRepaid = currentRepaid - unapply;
                const newStatus: 'outstanding' | 'partially_repaid' | 'settled' =
                  newRepaid >= b.amount ? 'settled' : (newRepaid > 0 ? 'partially_repaid' : 'outstanding');
                return {
                  ...b,
                  repaid_amount: newRepaid,
                  status: newStatus,
                  updated_at: now,
                };
              }
            }
            return b;
          });
        }

        const updatedPayments = state.salaryPayments.map((p) =>
          p.id === paymentId ? { ...p, deleted_at: now, updated_at: now } : p
        );

        const updatedLedger = (state.salaryDeductionLedger || []).map((l) =>
          l.salaryPaymentId === paymentId && !l.deleted_at
            ? { ...l, deleted_at: now, updated_at: now }
            : l
        );

        set({
          salaryAdvances: updatedAdvances,
          borrows: updatedBorrows,
          salaryPayments: updatedPayments,
          salaryDeductionLedger: updatedLedger,
        });

        return { success: true };
      },
      
      // Admin
      addRoom: (room) => set((state) => {
        const trimmedNo = room.roomNo.trim();
        const exists = state.rooms.some(r => r.roomNo.trim().toLowerCase() === trimmedNo.toLowerCase());
        if (exists) {
          console.warn(`[useStore] Room "${trimmedNo}" already exists. Skipping duplicate add.`);
          return state;
        }
        const stamped = {
          ...room,
          roomNo: trimmedNo,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (room.version || 0) + 1,
        };
        pushRoomToCloud(stamped);
        return { rooms: [...state.rooms, stamped] };
      }),

      updateRoom: (roomNo, updatedRoom) => set((state) => {
        pushRoomToCloud(updatedRoom);
        if (roomNo !== updatedRoom.roomNo) {
          deleteRoomFromCloud(roomNo);
        }

        const updatedBookings = state.bookings.map((b) => {
          if (b.roomNos.includes(roomNo)) {
            return {
              ...b,
              roomNos: b.roomNos.map((rNo) => (rNo === roomNo ? updatedRoom.roomNo : rNo)),
            };
          }
          return b;
        });

        const updatedRoomStatus = { ...state.roomStatus };
        if (roomNo !== updatedRoom.roomNo && updatedRoomStatus[roomNo]) {
          updatedRoomStatus[updatedRoom.roomNo] = updatedRoomStatus[roomNo];
          delete updatedRoomStatus[roomNo];
        }

        let roomModeRates = state.roomModeRates || {};
        let bookingRateSnapshots = state.bookingRateSnapshots || {};
        if (roomNo !== updatedRoom.roomNo) {
          const renameKey = <T,>(map: Record<string, T>): Record<string, T> => {
            if (!(roomNo in map)) return map;
            const { [roomNo]: value, ...rest } = map;
            return { ...rest, [updatedRoom.roomNo]: value };
          };
          roomModeRates = Object.fromEntries(
            Object.entries(roomModeRates).map(([modeId, rates]) => [modeId, renameKey(rates)])
          );
          bookingRateSnapshots = Object.fromEntries(
            Object.entries(bookingRateSnapshots).map(([id, snap]) => [id, { ...snap, rates: renameKey(snap.rates || {}) }])
          );
        }

        return {
          rooms: state.rooms.map((r) => r.roomNo === roomNo ? updatedRoom : r),
          bookings: updatedBookings,
          roomStatus: updatedRoomStatus,
          roomModeRates,
          bookingRateSnapshots,
        };
      }),
      
      removeRoom: (index) => set((state) => {
        const room = state.rooms[index];
        if (room) deleteRoomFromCloud(room.roomNo);
        return { rooms: state.rooms.filter((_, i) => i !== index) };
      }),

      removeRoomByNo: (roomNo) => set((state) => {
        deleteRoomFromCloud(roomNo);
        return { rooms: state.rooms.filter((r) => r.roomNo !== roomNo) };
      }),

      // --- Season / rate modes ---
      addRateMode: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return { success: false, error: 'Mode name cannot be empty.' };
        const modes = get().rateModes || DEFAULT_RATE_MODES;
        if (modes.some((m) => m.name.trim().toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `A mode named "${trimmed}" already exists.` };
        }
        const id = `mode-${generateUUID()}`;
        set({ rateModes: [...modes, { id, name: trimmed }] });
        return { success: true, id };
      },

      renameRateMode: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return { success: false, error: 'Mode name cannot be empty.' };
        const modes = get().rateModes || DEFAULT_RATE_MODES;
        if (modes.some((m) => m.id !== id && m.name.trim().toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `A mode named "${trimmed}" already exists.` };
        }
        // Existing bookings keep the mode name they were created under.
        set({ rateModes: modes.map((m) => (m.id === id ? { ...m, name: trimmed } : m)) });
        return { success: true };
      },

      deleteRateMode: (id) => {
        if (id === NORMAL_RATE_MODE_ID) return { success: false, error: 'The Normal mode cannot be deleted.' };
        const state = get();
        if (state.activeRateModeId === id) {
          return { success: false, error: 'This mode is active. Switch to another mode before deleting it.' };
        }
        const { [id]: _removed, ...remainingRates } = state.roomModeRates || {};
        // Booking snapshots are untouched: they hold their own rates and mode name.
        set({
          rateModes: (state.rateModes || DEFAULT_RATE_MODES).filter((m) => m.id !== id),
          roomModeRates: remainingRates,
        });
        return { success: true };
      },

      setActiveRateMode: (id) => set((state) => {
        const exists = (state.rateModes || DEFAULT_RATE_MODES).some((m) => m.id === id);
        return exists ? { activeRateModeId: id } : state;
      }),

      setRoomModeRates: (modeId, rates) => set((state) => {
        if (modeId === NORMAL_RATE_MODE_ID) return state; // Normal rates are Room.rent (use updateRoom)
        const next = { ...((state.roomModeRates || {})[modeId] || {}) };
        for (const [roomNo, rate] of Object.entries(rates)) {
          if (rate === null || !Number.isFinite(rate) || rate <= 0) delete next[roomNo];
          else next[roomNo] = rate;
        }
        return { roomModeRates: { ...(state.roomModeRates || {}), [modeId]: next } };
      }),

      addCustomBedType: (type) => set((state) => {
        pushBedTypeToCloud(type);
        return {
          customBedTypes: state.customBedTypes.includes(type) ? state.customBedTypes : [...state.customBedTypes, type]
        };
      }),

      removeCustomBedType: (type) => set((state) => {
        deleteBedTypeFromCloud(type);
        return { customBedTypes: state.customBedTypes.filter((t) => t !== type) };
      }),

      addCustomCategory: (category) => set((state) => {
        pushCategoryToCloud(category);
        return {
          customCategories: state.customCategories.includes(category) ? state.customCategories : [...state.customCategories, category]
        };
      }),

      removeCustomCategory: (category) => set((state) => {
        deleteCategoryFromCloud(category);
        return { customCategories: state.customCategories.filter((c) => c !== category) };
      }),

      updateInvoiceSettings: (settings) => set((state) => {
        const newSettings = { ...state.invoiceSettings, ...settings, updated_at: new Date().toISOString() };
        pushInvoiceSettingsToCloud(newSettings);
        return { invoiceSettings: newSettings };
      }),

      setRoomHolds: (holds) => set({ roomHolds: holds }),
      
      // Users & Roles
      addAppUser: (user) => set((state) => {
        const stamped = {
          ...user,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (user.version || 0) + 1,
        };
        pushAppUserToCloud(stamped);
        return { appUsers: [...state.appUsers, stamped] };
      }),
      updateAppUser: (id, user) => set((state) => {
        pushAppUserToCloud(user);
        return {
          appUsers: state.appUsers.map((u) => u.id === id ? user : u),
        };
      }),
      deleteAppUser: (id) => set((state) => {
        deleteAppUserFromCloud(id);
        return { appUsers: state.appUsers.filter((u) => u.id !== id) };
      }),
      addAppRole: (role) => set((state) => {
        const stamped = {
          ...role,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (role.version || 0) + 1,
        };
        pushAppRoleToCloud(stamped);
        return { appRoles: [...state.appRoles, stamped] };
      }),
      updateAppRole: (id, role) => set((state) => {
        pushAppRoleToCloud(role);
        return {
          appRoles: state.appRoles.map((r) => r.id === id ? role : r),
        };
      }),
      deleteAppRole: (id) => set((state) => {
        deleteAppRoleFromCloud(id);
        return { appRoles: state.appRoles.filter((r) => r.id !== id) };
      }),
      
      // Bill Number
      getNextBillNumber: () => {
        const state = get();
        const today = toLocalDateString(new Date());
        
        let newCount: number;
        if (state.billCounter.date === today) {
          newCount = state.billCounter.count + 1;
        } else {
          newCount = 1;
        }
        
        set({ billCounter: { date: today, count: newCount } });
        return { billNo: newCount, billDate: today };
      },

      mergeSyncedData: (data) => set((state) => {
        let updatedBookings = [...state.bookings];
        const updatedHistory = [...state.history];

        if (data.history && data.history.length > 0) {
          const completedIds = new Set(data.history.map((h) => h.id));
          // Remove any completed bookings from active bookings list
          updatedBookings = updatedBookings.filter((b) => !completedIds.has(b.id));

          data.history.forEach((newH) => {
            const idx = updatedHistory.findIndex((h) => h.id === newH.id);
            if (idx > -1) {
              const existing = updatedHistory[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newH.updated_at ? new Date(newH.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newH.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newH.source !== 'desktop') {
                // Desktop is master and dominates! Re-push master record to overwrite stale cloud state
                pushHistoryToCloud(existing);
                return;
              }
              updatedHistory[idx] = { ...existing, ...newH };
            } else {
              updatedHistory.unshift(newH);
            }
          });
        }

        if (data.bookings && data.bookings.length > 0) {
          data.bookings.forEach((newB) => {
            const idx = updatedBookings.findIndex((b) => b.id === newB.id);
            if (idx > -1) {
              const existing = updatedBookings[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newB.updated_at ? new Date(newB.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newB.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newB.source !== 'desktop') {
                // Desktop is master and dominates! Re-push master record to overwrite stale cloud state
                pushBookingToCloud(existing);
                return;
              }
              updatedBookings[idx] = { ...existing, ...newB };
            } else {
              updatedBookings.push(newB);
            }
          });
        }

        const updatedRoomStatus = { ...state.roomStatus, ...data.roomStatus };

        const updatedStaff = [...state.staff];
        if (data.staff) {
          data.staff.forEach((newS) => {
            const idx = updatedStaff.findIndex((s) => s.name === newS.name);
            if (idx > -1) {
              const existing = updatedStaff[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newS.updated_at ? new Date(newS.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newS.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newS.source !== 'desktop') {
                pushStaffToCloud(existing);
                return;
              }
              updatedStaff[idx] = { ...existing, ...newS };
            } else {
              updatedStaff.push(newS);
            }
          });
        }

        const updatedStaffLogs = [...state.staffLogs];
        if (data.staffLogs) {
          data.staffLogs.forEach((newL) => {
            const exists = updatedStaffLogs.some(
              (l) => l.date === newL.date && l.staff === newL.staff && l.msg === newL.msg
            );
            if (!exists) {
              updatedStaffLogs.unshift(newL);
            }
          });
        }

        const updatedInvoiceSettings = data.invoiceSettings ? { ...state.invoiceSettings, ...data.invoiceSettings } : state.invoiceSettings;

        const updatedRooms = [...state.rooms];
        if (data.rooms && data.rooms.length > 0) {
          data.rooms.forEach((newR) => {
            const idx = updatedRooms.findIndex((r) => r.roomNo === newR.roomNo);
            if (idx > -1) {
              const existing = updatedRooms[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newR.updated_at ? new Date(newR.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newR.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newR.source !== 'desktop') {
                pushRoomToCloud(existing);
                return;
              }
              updatedRooms[idx] = { ...existing, ...newR };
            } else {
              updatedRooms.push(newR);
            }
          });
        }

        const updatedCategories = data.customCategories
          ? Array.from(new Set([...state.customCategories, ...data.customCategories]))
          : state.customCategories;

        const updatedBedTypes = data.customBedTypes
          ? Array.from(new Set([...state.customBedTypes, ...data.customBedTypes]))
          : state.customBedTypes;

        const updatedAppUsers = [...state.appUsers];
        if (data.appUsers) {
          data.appUsers.forEach((newU) => {
            const idx = updatedAppUsers.findIndex((u) => u.id === newU.id);
            if (idx > -1) {
              const existing = updatedAppUsers[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newU.updated_at ? new Date(newU.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newU.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newU.source !== 'desktop') {
                pushAppUserToCloud(existing);
                return;
              }
              updatedAppUsers[idx] = { ...existing, ...newU };
            } else {
              updatedAppUsers.push(newU);
            }
          });
        }

        const updatedAppRoles = [...state.appRoles];
        if (data.appRoles) {
          data.appRoles.forEach((newR) => {
            const idx = updatedAppRoles.findIndex((r) => r.id === newR.id);
            if (idx > -1) {
              const existing = updatedAppRoles[idx];
              const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
              const remoteTime = newR.updated_at ? new Date(newR.updated_at).getTime() : 0;
              const isRemoteNewer = remoteTime > existingTime || (newR.version || 0) > (existing.version || 0);

              if (existing.source === 'desktop' && !isRemoteNewer && newR.source !== 'desktop') {
                pushAppRoleToCloud(existing);
                return;
              }
              updatedAppRoles[idx] = { ...existing, ...newR };
            } else {
              updatedAppRoles.push(newR);
            }
          });
        }

        return {
          bookings: updatedBookings,
          history: updatedHistory,
          roomStatus: updatedRoomStatus,
          staff: updatedStaff,
          staffLogs: updatedStaffLogs,
          invoiceSettings: updatedInvoiceSettings,
          rooms: data.rooms ? updatedRooms : state.rooms,
          customCategories: updatedCategories,
          customBedTypes: updatedBedTypes,
          appUsers: updatedAppUsers,
          appRoles: updatedAppRoles,
        };
      }),
      
      // Computed
      getOccupiedRooms: () => {
        const { rooms, bookings, roomStatus } = get();
        const today = new Date();
        return rooms
          .filter((r) => getRoomStatusOnDate(r.roomNo, today, bookings, roomStatus) === 'occupied')
          .map((r) => r.roomNo);
      },
      
      getReservedRooms: () => {
        const { rooms, bookings, roomStatus } = get();
        const today = new Date();
        return rooms
          .filter((r) => getRoomStatusOnDate(r.roomNo, today, bookings, roomStatus) === 'reserved')
          .map((r) => r.roomNo);
      },
      
      getAvailableRooms: () => {
        const { rooms, bookings, roomStatus } = get();
        const today = new Date();
        return rooms.filter(
          (r) => getRoomStatusOnDate(r.roomNo, today, bookings, roomStatus) === 'available'
        );
      },
      
      getRoomStatus: (roomNo) => {
        const { bookings, roomStatus } = get();
        return getRoomStatusOnDate(roomNo, new Date(), bookings, roomStatus);
      },
    }),
    {
      name: 'mauli-guest-house-storage',
      storage: createJSONStorage(() => electronStorage), 
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isDeveloperMode: state.isDeveloperMode,
        lastLoginTime: state.lastLoginTime,
        rooms: state.rooms,
        rateModes: state.rateModes,
        activeRateModeId: state.activeRateModeId,
        roomModeRates: state.roomModeRates,
        bookingRateSnapshots: state.bookingRateSnapshots,
        bookings: state.bookings,
        history: state.history,
        roomStatus: state.roomStatus,
        staff: state.staff,
        staffLogs: state.staffLogs,
        staffRoles: state.staffRoles,
        shifts: state.shifts,
        employees: state.employees,
        attendance: state.attendance,
        salaryAdvances: state.salaryAdvances,
        borrows: state.borrows,
        salaryAdjustments: state.salaryAdjustments,
        salaryPayments: state.salaryPayments,
        salaryDeductionLedger: state.salaryDeductionLedger,
        billCounter: state.billCounter,
        invoiceSettings: state.invoiceSettings,
        customBedTypes: state.customBedTypes,
        customCategories: state.customCategories,
        appUsers: state.appUsers,
        appRoles: state.appRoles,
        currentUser: state.currentUser,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Pre-migration DB auto-backup
          if (typeof window !== 'undefined' && (window as any).electronAPI?.backup) {
            (window as any).electronAPI.backup().catch((err: any) =>
              console.warn('[Backup] Auto-backup before migration warning:', err)
            );
          }

          if (state.invoiceSettings && (!state.invoiceSettings.ac_to_non_ac_discount_rates || state.invoiceSettings.ac_to_non_ac_discount_rates.length === 0)) {
            state.invoiceSettings.ac_to_non_ac_discount_rates = DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES;
          }

          // --- Season / rate modes (additive migration, no data is changed) ---
          // Existing Room.rent values ARE the Normal rates; other modes start
          // with no rates of their own and inherit Normal until edited.
          if (!Array.isArray(state.rateModes) || state.rateModes.length === 0) {
            state.rateModes = DEFAULT_RATE_MODES;
          }
          if (!state.rateModes.some((m) => m.id === NORMAL_RATE_MODE_ID)) {
            state.rateModes = [DEFAULT_RATE_MODES[0], ...state.rateModes];
          }
          if (!state.roomModeRates) state.roomModeRates = {};
          if (!state.rateModes.some((m) => m.id === state.activeRateModeId)) {
            state.activeRateModeId = NORMAL_RATE_MODE_ID;
          }
          // Bookings/history created before this feature (or received from the
          // cloud) have no locked rates: freeze them at the current Normal rate
          // so later rate or mode changes can't alter their bills.
          {
            const snapshots = { ...(state.bookingRateSnapshots || {}) };
            const normalMode = state.rateModes.find((m) => m.id === NORMAL_RATE_MODE_ID) || DEFAULT_RATE_MODES[0];
            const freezeState = { rooms: state.rooms || [], roomModeRates: {} };
            for (const record of [...(state.bookings || []), ...(state.history || [])]) {
              if (record?.id && !snapshots[record.id]) {
                snapshots[record.id] = buildRateSnapshot(record.roomNos || [], normalMode, freezeState);
              }
            }
            state.bookingRateSnapshots = snapshots;
          }

          // Ensure modern staff collections exist
          if (!state.staffRoles || state.staffRoles.length === 0) {
            state.staffRoles = DEFAULT_STAFF_ROLES;
          }
          if (!state.shifts || state.shifts.length === 0) {
            state.shifts = DEFAULT_SHIFTS;
          }
          if (!state.employees) {
            state.employees = [];
          }
          if (!state.attendance) {
            state.attendance = [];
          }
          if (!state.salaryAdvances) {
            state.salaryAdvances = [];
          }
          if (!state.borrows) {
            state.borrows = [];
          }
          if (!state.salaryAdjustments) {
            state.salaryAdjustments = [];
          }
          if (!state.salaryPayments) {
            state.salaryPayments = [];
          }
          if (!state.salaryDeductionLedger) {
            state.salaryDeductionLedger = [];
          }

          // Auto-migrate legacy staff if any existed
          if (state.staff && state.staff.length > 0 && state.employees.length === 0) {
            console.log('[useStore] Migrating legacy staff to modern employees table...', state.staff);
            state.employees = state.staff.map((s: any, idx: number) => ({
              id: generateUUID(),
              name: s.name || `Staff ${idx + 1}`,
              roleId: state.staffRoles[2]?.id || 'role-housekeeping',
              shiftId: state.shifts[0]?.id || 'shift-morning',
              monthlySalary: s.salary || 5000,
              joiningDate: s.joiningDate || '2026-04-24',
              status: 'active' as const,
              phone: s.phone || '',
              address: s.address || '',
              aadhaarLast4: s.aadhaar ? String(s.aadhaar).slice(-4) : undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null
            }));
          }

          // Safe normalize step: maps any old snake_case keys from previously saved state
          // to canonical TypeScript schema. Safe to run multiple times without data loss.
          if (Array.isArray(state.employees)) {
            state.employees = state.employees.map((emp: any) => ({
              id: emp.id || generateUUID(),
              name: emp.name || '',
              roleId: emp.roleId || emp.role_id || state.staffRoles?.[0]?.id || 'role-housekeeping',
              shiftId: emp.shiftId || emp.shift_id || state.shifts?.[0]?.id || 'shift-morning',
              monthlySalary: Number(emp.monthlySalary ?? emp.monthly_salary ?? emp.salary ?? 5000),
              joiningDate: emp.joiningDate || emp.joining_date || '2026-04-24',
              status: (emp.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
              phone: emp.phone || undefined,
              address: emp.address || undefined,
              aadhaarLast4: emp.aadhaarLast4 || emp.aadhaar_last4 || (emp.aadhaar ? String(emp.aadhaar).slice(-4) : undefined),
              created_at: emp.created_at || new Date().toISOString(),
              updated_at: emp.updated_at || new Date().toISOString(),
              deleted_at: emp.deleted_at || null,
            }));
          }

          if (Array.isArray(state.attendance)) {
            state.attendance = state.attendance.map((att: any) => ({
              id: att.id || generateUUID(),
              employeeId: att.employeeId || att.employee_id,
              date: att.date,
              status: att.status,
              created_at: att.created_at || new Date().toISOString(),
              updated_at: att.updated_at || new Date().toISOString(),
              deleted_at: att.deleted_at || null,
            }));
          }

          if (Array.isArray(state.salaryAdvances)) {
            state.salaryAdvances = state.salaryAdvances.map((adv: any) => ({
              id: adv.id || generateUUID(),
              employeeId: adv.employeeId || adv.employee_id,
              amount: Number(adv.amount || 0),
              deducted_amount: Number(adv.deducted_amount ?? adv.deductedAmount ?? 0),
              date: adv.date,
              transactionDate: adv.transactionDate || adv.date,
              status: adv.status || (Number(adv.deducted_amount ?? adv.deductedAmount ?? 0) >= Number(adv.amount || 0) && Number(adv.amount || 0) > 0 ? 'Settled' : 'Open'),
              payoutId: adv.payoutId || null,
              reason: adv.reason || undefined,
              created_at: adv.created_at || new Date().toISOString(),
              updated_at: adv.updated_at || new Date().toISOString(),
              deleted_at: adv.deleted_at || null,
            }));
          }

          if (Array.isArray(state.borrows)) {
            state.borrows = state.borrows.map((b: any) => {
              const amount = Number(b.amount || 0);
              const repaid = Number(b.repaid_amount ?? b.repaidAmount ?? 0);
              let status: 'outstanding' | 'partially_repaid' | 'settled' = 'outstanding';
              if (repaid >= amount && amount > 0) {
                status = 'settled';
              } else if (repaid > 0) {
                status = 'partially_repaid';
              } else if (b.status === 'settled') {
                status = 'settled';
              }
              return {
                id: b.id || generateUUID(),
                employeeId: b.employeeId || b.employee_id,
                amount,
                repaid_amount: repaid,
                status,
                date: b.date,
                transactionDate: b.transactionDate || b.date,
                payoutId: b.payoutId || null,
                reason: b.reason || undefined,
                created_at: b.created_at || new Date().toISOString(),
                updated_at: b.updated_at || new Date().toISOString(),
                deleted_at: b.deleted_at || null,
              };
            });
          }

          if (Array.isArray(state.salaryAdjustments)) {
            state.salaryAdjustments = state.salaryAdjustments.map((adj: any) => ({
              id: adj.id || generateUUID(),
              employeeId: adj.employeeId || adj.employee_id,
              cycleId: adj.cycleId || adj.cycle_id,
              amount: Number(adj.amount || 0),
              reason: adj.reason || '',
              type: adj.type || 'manual',
              status: adj.status || 'Open',
              payoutId: adj.payoutId || null,
              created_at: adj.created_at || new Date().toISOString(),
              updated_at: adj.updated_at || new Date().toISOString(),
              deleted_at: adj.deleted_at || null,
            }));
          }

          if (Array.isArray(state.salaryPayments)) {
            state.salaryPayments = state.salaryPayments.map((p: any) => ({
              id: p.id || generateUUID(),
              employeeId: p.employeeId || p.employee_id,
              month: p.month,
              slipNumber: p.slipNumber,
              cycleStart: p.cycleStart,
              cycleEnd: p.cycleEnd,
              cycleDays: p.cycleDays,
              salaryUsed: p.salaryUsed,
              perDay: p.perDay,
              gross: Number(p.gross || 0),
              presentDays: p.presentDays,
              absentDays: p.absentDays,
              paidLeaveDays: p.paidLeaveDays,
              unpaidLeaveDays: p.unpaidLeaveDays,
              notMarkedDays: p.notMarkedDays,
              deductedDates: p.deductedDates,
              attendanceDeduction: p.attendanceDeduction,
              earnedAmount: p.earnedAmount,
              advance_deducted: Number(p.advance_deducted ?? p.advanceDeducted ?? 0),
              carriedForwardAdvanceIn: p.carriedForwardAdvanceIn,
              carriedForwardAdvanceOut: p.carriedForwardAdvanceOut,
              borrow_deducted: Number(p.borrow_deducted ?? p.borrowDeducted ?? 0),
              borrowRecoveries: p.borrowRecoveries,
              adjustmentsTotal: p.adjustmentsTotal,
              adjustmentsApplied: p.adjustmentsApplied,
              net_paid: Number(p.net_paid ?? p.netPaid ?? 0),
              paid_on: p.paid_on || p.paidOn,
              payment_ref: p.payment_ref || p.paymentRef || undefined,
              note: p.note || undefined,
              status: p.status || 'Paid',
              reversed_at: p.reversed_at || null,
              reversed_reason: p.reversed_reason || null,
              isLegacy: p.isLegacy ?? (!p.cycleStart),
              isFinalSettlement: p.isFinalSettlement ?? false,
              lastWorkingDate: p.lastWorkingDate,
              created_at: p.created_at || new Date().toISOString(),
              updated_at: p.updated_at || new Date().toISOString(),
              deleted_at: p.deleted_at || null,
            }));
          }

          if (Array.isArray(state.salaryDeductionLedger)) {
            state.salaryDeductionLedger = state.salaryDeductionLedger.map((l: any) => ({
              id: l.id || generateUUID(),
              salaryPaymentId: l.salaryPaymentId || l.salary_payment_id,
              targetType: (l.targetType || l.target_type || 'advance') as 'advance' | 'borrow',
              targetId: l.targetId || l.target_id,
              amount: Number(l.amount || 0),
              created_at: l.created_at || new Date().toISOString(),
              updated_at: l.updated_at || new Date().toISOString(),
              deleted_at: l.deleted_at || null,
            }));
          }

          // If employees is still empty, seed "bablu" as requested
          if (state.employees.length === 0) {
            state.employees = [
              {
                id: generateUUID(),
                name: 'bablu',
                roleId: state.staffRoles.find((r: StaffRole) => r.name.toLowerCase().includes('house'))?.id || state.staffRoles[0]?.id || 'role-housekeeping',
                shiftId: state.shifts[0]?.id || 'shift-morning',
                monthlySalary: 5000,
                joiningDate: '2026-04-24',
                status: 'active',
                phone: '',
                address: '',
                aadhaarLast4: '4321',
                created_at: '2026-04-24T00:00:00.000Z',
                updated_at: new Date().toISOString(),
                deleted_at: null
              }
            ];
          }

          if (state.isAuthenticated) {
            const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours expiry
            const now = Date.now();
            if (!state.lastLoginTime || (now - state.lastLoginTime > SESSION_MAX_AGE_MS)) {
              console.warn('[Session] Session expired (over 24h) or missing timestamp, requiring re-login.');
              state.isAuthenticated = false;
              state.currentUser = null;
              state.lastLoginTime = null;
            }
          }
        }
      },
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__useStore = useStore;
}


if (typeof window !== 'undefined') {
  (window as any).__useStore = useStore;
}