import { Room, Booking, RoomStatusType } from '@/types';
import { toLocalDateString } from '@/utils/dateUtils';

/**
 * Normalizes any date input (Date object, ISO string, or YYYY-MM-DD string)
 * to exact local date string `YYYY-MM-DD`.
 * Prevents timezone shifts, UTC offsets, midnight shifts, and DST issues.
 */
export function normalizeToDayStr(input: Date | string | undefined | null): string {
  return toLocalDateString(input);
}

/**
 * Calculates checkout day string given checkIn and duration in days.
 * E.g., checkIn = '2026-07-25', days = 1 -> '2026-07-26'.
 */
export function getCheckoutDayStr(checkInInput: Date | string, days: number = 1): string {
  const dayStr = normalizeToDayStr(checkInInput);
  const parts = dayStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    // Month is 0-indexed in Date constructor
    const d = new Date(parts[0], parts[1] - 1, parts[2] + (Number(days) || 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + (Number(days) || 1));
  return normalizeToDayStr(fallback);
}

/**
 * Checks if two date intervals overlap.
 * Rule: New Check-in < Existing Checkout AND New Checkout > Existing Check-in
 */
export function isDateOverlap(
  newCheckIn: Date | string,
  newDaysOrCheckout: number | string,
  existingCheckIn: Date | string,
  existingDaysOrCheckout: number | string
): boolean {
  const nIn = normalizeToDayStr(newCheckIn);
  const nOut = typeof newDaysOrCheckout === 'number'
    ? getCheckoutDayStr(newCheckIn, newDaysOrCheckout)
    : normalizeToDayStr(newDaysOrCheckout);

  const eIn = normalizeToDayStr(existingCheckIn);
  const eOut = typeof existingDaysOrCheckout === 'number'
    ? getCheckoutDayStr(existingCheckIn, existingDaysOrCheckout)
    : normalizeToDayStr(existingDaysOrCheckout);

  return nIn < eOut && nOut > eIn;
}

/**
 * Returns exact room status ('available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance')
 * on a target date (defaults to Today).
 */
export function getRoomStatusOnDate(
  roomNo: string,
  targetDate: Date | string,
  bookings: Booking[],
  roomStatus: Record<string, string | undefined>
): RoomStatusType {
  const targetStr = normalizeToDayStr(targetDate);
  const todayStr = normalizeToDayStr(new Date());

  // Check active bookings / reservations whose interval [checkIn, checkOut) covers targetDate
  for (const b of bookings) {
    if (!b.roomNos.includes(roomNo)) continue;
    const bIn = normalizeToDayStr(b.checkIn);
    const bOut = getCheckoutDayStr(b.checkIn, b.days || 1);

    if (targetStr >= bIn && targetStr < bOut) {
      if (b.isReservation) {
        return 'reserved';
      } else {
        return 'occupied';
      }
    }
  }

  // Check manual room status (maintenance or cleaning)
  if (roomStatus[roomNo]) {
    const st = String(roomStatus[roomNo]).toLowerCase();
    if (st === 'maintenance') {
      return 'maintenance';
    }
    if (st === 'cleaning' || st === 'dirty') {
      // Cleaning status applies to Today or future dates until cleared
      if (targetStr >= todayStr) {
        return 'cleaning';
      }
    }
  }

  return 'available';
}

/**
 * Returns available rooms for a requested check-in date and duration,
 * applying exact overlap detection.
 */
export function getAvailableRoomsForPeriod(
  rooms: Room[],
  bookings: Booking[],
  roomStatus: Record<string, string | undefined>,
  newCheckIn: Date | string,
  newDaysOrCheckout: number | string
): Room[] {
  const nIn = normalizeToDayStr(newCheckIn);
  const todayStr = normalizeToDayStr(new Date());

  return rooms.filter((room) => {
    if (roomStatus[room.roomNo]) {
      const st = String(roomStatus[room.roomNo]).toLowerCase();
      if (st === 'maintenance') return false;
      if (nIn === todayStr && (st === 'cleaning' || st === 'dirty')) return false;
    }

    for (const b of bookings) {
      if (!b.roomNos.includes(room.roomNo)) continue;
      if (isDateOverlap(newCheckIn, newDaysOrCheckout, b.checkIn, b.days || 1)) {
        return false;
      }
    }
    return true;
  });
}
