import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Room, Booking, HistoryRecord, Staff, StaffLog, SectionType, AdvancePayment, InvoiceSettings, DEFAULT_INVOICE_SETTINGS, AppUser, AppRole, DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES, RoomHold } from '@/types';
import { getRoomStatusOnDate, normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import { toLocalDateString } from '@/utils/dateUtils';
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
  
  // Actions - Staff
  addStaff: (staff: Staff) => void;
  removeStaffByName: (name: string) => void;
  removeStaff: (index: number) => void;
  addStaffLog: (log: StaffLog) => void;
  
  // Actions - Admin
  addRoom: (room: Room) => void;
  updateRoom: (roomNo: string, updatedRoom: Room) => void;
  removeRoom: (index: number) => void;
  removeRoomByNo: (roomNo: string) => void;
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
      bookings: [],
      history: [],
      roomStatus: {},
      staff: [],
      staffLogs: [],
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
      logout: () => set({ isAuthenticated: false, currentUser: null, lastLoginTime: null }),
      
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
        return { bookings: [...state.bookings, stamped] };
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
        const stamped = {
          ...log,
          updated_at: new Date().toISOString(),
          source: 'desktop',
          version: (log.version || 0) + 1,
        };
        pushStaffLogToCloud(stamped, `${stamped.date}-${stamped.staff}-${stamped.type}`);
        const MAX_STAFF_LOGS = 500; // Retention cap: keep most recent 500 records to prevent unbounded growth
        return { staffLogs: [stamped, ...state.staffLogs].slice(0, MAX_STAFF_LOGS) };
      }),
      
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

        return {
          rooms: state.rooms.map((r) => r.roomNo === roomNo ? updatedRoom : r),
          bookings: updatedBookings,
          roomStatus: updatedRoomStatus,
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
        bookings: state.bookings,
        history: state.history,
        roomStatus: state.roomStatus,
        staff: state.staff,
        staffLogs: state.staffLogs,
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
          if (state.invoiceSettings && (!state.invoiceSettings.ac_to_non_ac_discount_rates || state.invoiceSettings.ac_to_non_ac_discount_rates.length === 0)) {
            state.invoiceSettings.ac_to_non_ac_discount_rates = DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES;
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