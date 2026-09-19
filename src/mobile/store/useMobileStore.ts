/**
 * Mobile Zustand Store — Android Companion App
 * 
 * Same state shape as desktop useStore but uses localStorage instead of Electron IPC.
 * All mutations set source='mobile'. Conflict resolution: server-wins (inverse of desktop).
 * Shared types, GST utils, and availability utils are imported directly from desktop code.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import {
  Room, Booking, HistoryRecord, Staff, StaffLog,
  SectionType, AdvancePayment, InvoiceSettings, DEFAULT_INVOICE_SETTINGS,
  RoomHold
} from '@/types';
import { getRoomStatusOnDate } from '@/utils/availabilityUtils';

// Mobile sections extend desktop sections
export type MobileSectionType = SectionType | 'more' | 'settings';

interface RoomStatus {
  [key: string]: 'cleaning' | 'maintenance';
}

interface BillCounter {
  date: string;
  count: number;
}

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'sync-failed' | 'reconnecting';

interface MobileStoreState {
  // Auth
  isAuthenticated: boolean;

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

  // UI
  currentSection: MobileSectionType;
  currentFilter: string;
  currentMonth: Date;
  dashboardDate: string | null; // null = today
  dashboardDateEnd: string | null; // for date range
  moreMenuOpen: boolean;

  // Sync
  syncStatus: SyncStatusType;
  lastSyncedAt: string | null;

  // Hydration
  _isHydrated: boolean;
  setHydrated: (state: boolean) => void;

  // Developer Mode
  isDeveloperMode: boolean;
  setDeveloperMode: (isDev: boolean) => void;

  // Actions - Auth
  setAuthenticated: (status: boolean) => void;
  logout: () => void;

  // Actions - Navigation
  setSection: (section: MobileSectionType) => void;
  setFilter: (filter: string) => void;
  setMonth: (date: Date) => void;
  setDashboardDate: (date: string | null, dateEnd?: string | null) => void;
  setMoreMenuOpen: (open: boolean) => void;

  // Actions - Sync
  setSyncStatus: (status: SyncStatusType) => void;
  setLastSyncedAt: (time: string | null) => void;

  // Actions - Bookings
  addBooking: (booking: Booking) => void;
  updateBooking: (updatedBooking: Booking) => void;
  removeBooking: (id: string) => void;
  convertReservationToCheckIn: (id: string) => void;
  addAdvancePayment: (bookingId: string, payment: AdvancePayment) => void;

  // Actions - History
  addHistory: (record: HistoryRecord) => void;
  updateHistory: (updatedRecord: HistoryRecord) => void;
  removeHistory: (id: string) => void;

  // Actions - Room Status
  setRoomStatus: (roomNo: string, status: 'cleaning' | 'maintenance' | null) => void;
  markCleaned: (roomNo: string) => void;

  // Actions - Rooms
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomNo: string, updatedRoom: Room) => void;
  removeRoom: (roomNo: string) => void;

  // Actions - Staff
  addStaff: (staff: Staff) => void;
  removeStaff: (name: string) => void;
  addStaffLog: (log: StaffLog) => void;

  // Actions - Admin
  addCustomBedType: (type: string) => void;
  removeCustomBedType: (type: string) => void;
  addCustomCategory: (category: string) => void;
  removeCustomCategory: (category: string) => void;
  updateInvoiceSettings: (settings: Partial<InvoiceSettings>) => void;
  setRoomHolds: (holds: RoomHold[]) => void;

  // Actions - Bill Number
  getNextBillNumber: () => { billNo: number; billDate: string };

  // Actions - Sync merge (incoming from Supabase Realtime)
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
    roomHolds?: RoomHold[];
  }) => void;

  // Computed
  getOccupiedRooms: () => string[];
  getReservedRooms: () => string[];
  getAvailableRooms: () => Room[];
  getRoomStatus: (roomNo: string) => 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
}

export const useMobileStore = create<MobileStoreState>()(
  persist(
    (set, get) => ({
      // Auth
      isAuthenticated: false,

      // Data
      rooms: [],
      bookings: [],
      history: [],
      roomStatus: {},
      staff: [],
      staffLogs: [],
      billCounter: { date: '', count: 0 },
      invoiceSettings: DEFAULT_INVOICE_SETTINGS,
      customBedTypes: ['Single Bed', 'Double Bed', 'Triple Bed', '4 Bed', '5 Bed', '6 Bed'],
      customCategories: ['AC', 'Air Cooled', 'Hall'],
      roomHolds: [],

      // UI
      currentSection: 'dashboard',
      currentFilter: 'all',
      currentMonth: new Date(),
      dashboardDate: null,
      dashboardDateEnd: null,
      moreMenuOpen: false,

      // Sync
      syncStatus: 'offline',
      lastSyncedAt: null,

      // Developer Mode
      isDeveloperMode: false,
      setDeveloperMode: (isDev) => set({ isDeveloperMode: isDev }),

      // Auth
      setAuthenticated: (status) => set({ isAuthenticated: status }),
      logout: () => set({ isAuthenticated: false, currentSection: 'dashboard' }),

      // Navigation
      setSection: (section) => set({ currentSection: section, moreMenuOpen: false }),
      setFilter: (filter) => set({ currentFilter: filter }),
      setMonth: (date) => set({ currentMonth: date }),
      setDashboardDate: (date, dateEnd = null) => set({ dashboardDate: date, dashboardDateEnd: dateEnd }),
      setMoreMenuOpen: (open) => set({ moreMenuOpen: open }),

      // Sync
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncedAt: (time) => set({ lastSyncedAt: time }),

      // Bookings
      addBooking: (booking) => set((state) => ({
        bookings: [...state.bookings, {
          ...booking,
          updated_at: new Date().toISOString(),
          source: 'mobile',
          version: (booking.version || 0) + 1,
        }],
      })),

      updateBooking: (updatedBooking) => set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === updatedBooking.id
            ? { ...updatedBooking, updated_at: new Date().toISOString(), source: 'mobile', version: (updatedBooking.version || 0) + 1 }
            : b
        ),
      })),

      removeBooking: (id) => set((state) => ({
        bookings: state.bookings.filter((b) => b.id !== id),
      })),

      convertReservationToCheckIn: (id) => set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === id
            ? { ...b, isReservation: false, checkIn: new Date().toISOString(), updated_at: new Date().toISOString(), source: 'mobile', version: (b.version || 0) + 1 }
            : b
        ),
      })),

      addAdvancePayment: (bookingId, payment) => set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === bookingId
            ? {
              ...b,
              advancePayments: [...b.advancePayments, payment],
              advance: b.advance + payment.amount,
              updated_at: new Date().toISOString(),
              source: 'mobile',
              version: (b.version || 0) + 1,
            }
            : b
        ),
      })),

      // History
      addHistory: (record) => set((state) => ({
        history: [{
          ...record,
          updated_at: new Date().toISOString(),
          source: 'mobile',
          version: (record.version || 0) + 1,
        }, ...state.history],
      })),

      updateHistory: (updatedRecord) => set((state) => ({
        history: state.history.map((h) =>
          h.id === updatedRecord.id
            ? { ...updatedRecord, updated_at: new Date().toISOString(), source: 'mobile', version: (updatedRecord.version || 0) + 1 }
            : h
        ),
      })),

      removeHistory: (id) => set((state) => ({
        history: state.history.filter((h) => h.id !== id),
      })),

      // Room Status
      setRoomStatus: (roomNo, status) => set((state) => {
        const newStatus = { ...state.roomStatus };
        if (status === null) {
          delete newStatus[roomNo];
        } else {
          newStatus[roomNo] = status;
        }
        return { roomStatus: newStatus };
      }),

      markCleaned: (roomNo) => set((state) => {
        const newStatus = { ...state.roomStatus };
        delete newStatus[roomNo];
        return { roomStatus: newStatus };
      }),

      // Rooms
      setRooms: (rooms) => set({ rooms }),
      addRoom: (room) => set((state) => ({
        rooms: [...state.rooms, { ...room, updated_at: new Date().toISOString(), source: 'mobile', version: (room.version || 0) + 1 }],
      })),
      updateRoom: (roomNo, updatedRoom) => set((state) => ({
        rooms: state.rooms.map((r) => r.roomNo === roomNo ? updatedRoom : r),
      })),
      removeRoom: (roomNo) => set((state) => ({
        rooms: state.rooms.filter((r) => r.roomNo !== roomNo),
      })),

      // Staff
      addStaff: (staff) => set((state) => ({
        staff: [...state.staff, { ...staff, updated_at: new Date().toISOString(), source: 'mobile', version: (staff.version || 0) + 1 }],
      })),
      removeStaff: (name) => set((state) => ({
        staff: state.staff.filter((s) => s.name !== name),
      })),
      addStaffLog: (log) => set((state) => ({
        staffLogs: [{ ...log, updated_at: new Date().toISOString(), source: 'mobile', version: (log.version || 0) + 1 }, ...state.staffLogs],
      })),

      // Admin
      addCustomBedType: (type) => set((state) => ({
        customBedTypes: state.customBedTypes.includes(type) ? state.customBedTypes : [...state.customBedTypes, type],
      })),
      removeCustomBedType: (type) => set((state) => ({
        customBedTypes: state.customBedTypes.filter((t) => t !== type),
      })),
      addCustomCategory: (category) => set((state) => ({
        customCategories: state.customCategories.includes(category) ? state.customCategories : [...state.customCategories, category],
      })),
      removeCustomCategory: (category) => set((state) => ({
        customCategories: state.customCategories.filter((c) => c !== category),
      })),
      updateInvoiceSettings: (settings) => set((state) => ({
        invoiceSettings: { ...state.invoiceSettings, ...settings, updated_at: new Date().toISOString() },
      })),

      setRoomHolds: (holds) => set({ roomHolds: holds }),

      // Bill Number
      getNextBillNumber: () => {
        const state = get();
        const today = new Date().toLocaleDateString();
        let newCount: number;
        if (state.billCounter.date === today) {
          newCount = state.billCounter.count + 1;
        } else {
          newCount = 1;
        }
        set({ billCounter: { date: today, count: newCount } });
        return { billNo: newCount, billDate: today };
      },

      // Sync merge — server-wins for mobile (opposite of desktop)
      mergeSyncedData: (data) => set((state) => {
        let updatedBookings = [...state.bookings];
        const updatedHistory = [...state.history];

        // History — merge with server-wins
        if (data.history && data.history.length > 0) {
          const completedIds = new Set(data.history.map((h) => h.id));
          updatedBookings = updatedBookings.filter((b) => !completedIds.has(b.id));

          data.history.forEach((newH) => {
            const idx = updatedHistory.findIndex((h) => h.id === newH.id);
            if (idx > -1) {
              // Server always wins on mobile
              updatedHistory[idx] = { ...updatedHistory[idx], ...newH };
            } else {
              updatedHistory.unshift(newH);
            }
          });
        }

        // Bookings
        if (data.bookings && data.bookings.length > 0) {
          data.bookings.forEach((newB) => {
            const idx = updatedBookings.findIndex((b) => b.id === newB.id);
            if (idx > -1) {
              // Server wins on mobile
              updatedBookings[idx] = { ...updatedBookings[idx], ...newB };
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
              updatedStaff[idx] = { ...updatedStaff[idx], ...newS };
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

        const updatedInvoiceSettings = data.invoiceSettings
          ? { ...state.invoiceSettings, ...data.invoiceSettings }
          : state.invoiceSettings;

        const updatedRooms = [...state.rooms];
        if (data.rooms && data.rooms.length > 0) {
          data.rooms.forEach((newR) => {
            const idx = updatedRooms.findIndex((r) => r.roomNo === newR.roomNo);
            if (idx > -1) {
              updatedRooms[idx] = { ...updatedRooms[idx], ...newR };
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
          roomHolds: data.roomHolds !== undefined ? data.roomHolds : state.roomHolds,
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
      name: 'mauli-mobile-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const { value } = await Preferences.get({ key: name });
          return value ?? null;
        },
        setItem: async (name: string, value: string) => {
          await Preferences.set({ key: name, value });
        },
        removeItem: async (name: string) => {
          await Preferences.remove({ key: name });
        },
      })),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
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
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
