/**
 * Day-wise room status for the Room Cards view.
 *
 * Pure module: no React or store imports, so the mobile app can reuse it.
 * It does NOT define its own availability rule. Every "is this room booked on
 * this day?" question goes through getRoomStatusOnDate (availabilityUtils),
 * which blocks a stay of N days from check-in day D on D..D+N-1 and frees it
 * on D+N. Reservations block their whole stay and are never auto-released.
 */
import { Booking, HistoryRecord, Room } from '@/types';
import { getRoomStatusOnDate, normalizeToDayStr } from '@/utils/availabilityUtils';
import { toLocalDateString } from '@/utils/dateUtils';

export type RoomDayState = 'free' | 'reserved' | 'occupied' | 'maintenance';

export interface RoomDayStatus {
  state: RoomDayState;
  /** Booking (active) or history record (checked out) covering the day. */
  booking?: Booking | HistoryRecord;
  /** True when `booking` is a checked-out history record. */
  fromHistory?: boolean;
  /** 1-based day of the stay that `dateStr` falls on. */
  dayIndex?: number;
  /** Total nights of the stay. */
  nights?: number;
  /** Room is flagged for cleaning (shown as free; not bookable for a same-day check-in). */
  cleaning?: boolean;
}

type RoomStatusMap = Record<string, string | undefined>;

// ---------- Local calendar-day helpers (no toISOString, no UTC shifts) ----------

const parseDay = (dateStr: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** Today as local `YYYY-MM-DD`. */
export const todayStr = (): string => toLocalDateString();

/** Adds whole days to a local `YYYY-MM-DD` date. */
export function addDays(dateStr: string, n: number): string {
  const d = parseDay(dateStr);
  if (!d) return dateStr;
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Adds months, clamping the day to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(dateStr: string, n: number): string {
  const d = parseDay(dateStr);
  if (!d) return dateStr;
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toLocalDateString(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), lastDay)));
}

/** Whole calendar days from `a` to `b` (both local `YYYY-MM-DD`). */
export function daysBetween(a: string, b: string): number {
  const da = parseDay(a);
  const db = parseDay(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** `YYYY-MM-DD` -> `DD-MM-YYYY`. */
export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return y && m && d ? `${d}-${m}-${y}` : dateStr;
}

// ---------- Status ----------

/** Nights of a checked-out stay: check-in day to checkout day (at least 1). */
function historyNights(record: HistoryRecord): number {
  const inDay = normalizeToDayStr(record.checkIn);
  const outDay = normalizeToDayStr(record.checkoutDate);
  if (!inDay || !outDay) return Math.max(1, Number(record.days) || 1);
  return Math.max(1, daysBetween(inDay, outDay));
}

/** Runs the shared availability rule against a single booking. */
function coversDay(roomNo: string, dateStr: string, booking: Booking): boolean {
  return getRoomStatusOnDate(roomNo, dateStr, [booking], {}) !== 'available';
}

function stayInfo(checkIn: string, dateStr: string, nights: number) {
  return { dayIndex: daysBetween(normalizeToDayStr(checkIn), dateStr) + 1, nights };
}

/**
 * Status of one room on one local calendar day.
 * - Active bookings/reservations: via getRoomStatusOnDate (reserved | occupied).
 * - Past days: checked-out history records count as occupied (check-in to checkout).
 * - Manual maintenance -> maintenance; cleaning -> free with `cleaning: true`.
 */
export function roomStatusForDay(
  room: Pick<Room, 'roomNo'>,
  dateStr: string,
  bookings: Booking[],
  history: HistoryRecord[],
  roomStatus: RoomStatusMap
): RoomDayStatus {
  const status = getRoomStatusOnDate(room.roomNo, dateStr, bookings, roomStatus);

  if (status === 'reserved' || status === 'occupied') {
    const booking = bookings.find(b => b.roomNos.includes(room.roomNo) && coversDay(room.roomNo, dateStr, b));
    const nights = Math.max(1, Number(booking?.days) || 1);
    return { state: status, booking, ...(booking ? stayInfo(booking.checkIn, dateStr, nights) : {}) };
  }

  // Past days: who actually stayed (history is checked-out stays only).
  if (dateStr < todayStr()) {
    for (const record of history) {
      if (!record.roomNos?.includes(room.roomNo)) continue;
      const nights = historyNights(record);
      const asStay: Booking = { ...record, days: nights, isReservation: false };
      if (coversDay(room.roomNo, dateStr, asStay)) {
        return { state: 'occupied', booking: record, fromHistory: true, ...stayInfo(record.checkIn, dateStr, nights) };
      }
    }
  }

  if (status === 'maintenance') return { state: 'maintenance' };
  if (status === 'cleaning') return { state: 'free', cleaning: true };
  return { state: 'free' };
}

/**
 * First night of a new stay (check-in day, N nights) on which the room is
 * already reserved or occupied by an active booking, or null if none.
 * Uses the same rule as everything else, night by night.
 */
/** Message shown wherever a stay is refused for overlapping another booking. */
export function stayOverlapMessage(roomNo: string, conflictDay: string): string {
  return `Room ${roomNo} is already booked on ${formatDayLabel(conflictDay)}. This stay overlaps another booking — change the dates or choose another room.`;
}

export function findFirstConflictDate(
  roomNo: string,
  checkIn: string | Date,
  days: number,
  bookings: Booking[]
): string | null {
  const start = normalizeToDayStr(checkIn);
  if (!start) return null;
  const nights = Math.max(1, Math.floor(Number(days)) || 1);
  for (let i = 0; i < nights; i++) {
    const day = addDays(start, i);
    const st = getRoomStatusOnDate(roomNo, day, bookings, {});
    if (st === 'reserved' || st === 'occupied') return day;
  }
  return null;
}
