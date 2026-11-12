import { BookingRateSnapshot, RateMode, Room, RoomModeRates } from '@/types';

/** The built-in mode. Its rate is always `Room.rent`; it can be renamed but not deleted. */
export const NORMAL_RATE_MODE_ID = 'normal';

export const DEFAULT_RATE_MODES: RateMode[] = [
  { id: NORMAL_RATE_MODE_ID, name: 'Normal' },
  { id: 'summer', name: 'Summer' },
  { id: 'diwali', name: 'Diwali' },
  { id: 'navratri', name: 'Navratri' },
];

interface RateState {
  rooms: Room[];
  rateModes?: RateMode[];
  activeRateModeId?: string;
  roomModeRates?: RoomModeRates;
  bookingRateSnapshots?: Record<string, BookingRateSnapshot>;
}

const isValidRate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** The mode currently used for new bookings (falls back to Normal if the stored id is stale). */
export function getActiveRateMode(state: RateState): RateMode {
  const modes = state.rateModes && state.rateModes.length > 0 ? state.rateModes : DEFAULT_RATE_MODES;
  return modes.find((m) => m.id === state.activeRateModeId) || modes.find((m) => m.id === NORMAL_RATE_MODE_ID) || modes[0];
}

/** A room's explicitly stored rate for a mode, or undefined when it inherits the Normal rate. */
export function getExplicitModeRate(roomNo: string, modeId: string, roomModeRates?: RoomModeRates): number | undefined {
  if (modeId === NORMAL_RATE_MODE_ID) return undefined;
  const rate = roomModeRates?.[modeId]?.[roomNo];
  return isValidRate(rate) ? rate : undefined;
}

/** A room's per-night rate in a given mode. Modes without their own rate use the Normal rate. */
export function getRoomRateForMode(room: Room | undefined, modeId: string, roomModeRates?: RoomModeRates): number {
  if (!room) return 0;
  return getExplicitModeRate(room.roomNo, modeId, roomModeRates) ?? (Number(room.rent) || 0);
}

/** A room's per-night rate in the currently active mode — what a NEW booking will be charged. */
export function getActiveRoomRate(room: Room | undefined, state: RateState): number {
  return getRoomRateForMode(room, getActiveRateMode(state).id, state.roomModeRates);
}

/**
 * Per-night rate of one room for an EXISTING booking or history record.
 * Uses the rate locked in when the booking was created. Records without a
 * snapshot fall back to the room's Normal rate — never the active mode — so
 * switching modes cannot change them.
 */
export function getBookingRoomRate(bookingId: string | undefined, roomNo: string, state: RateState): number {
  const locked = bookingId ? state.bookingRateSnapshots?.[bookingId]?.rates?.[roomNo] : undefined;
  if (typeof locked === 'number' && Number.isFinite(locked)) return locked;
  const room = state.rooms.find((r) => r.roomNo === roomNo);
  return Number(room?.rent) || 0;
}

/** Sum of the locked per-night rates of all rooms in a booking. */
export function getBookingDailyRate(bookingId: string | undefined, roomNos: string[] | undefined, state: RateState): number {
  return (roomNos || []).reduce((sum, rNo) => sum + getBookingRoomRate(bookingId, rNo, state), 0);
}

/** Snapshot of the given rooms' rates in one mode, to lock into a booking. */
export function buildRateSnapshot(roomNos: string[], mode: RateMode, state: RateState): BookingRateSnapshot {
  const rates: Record<string, number> = {};
  for (const rNo of roomNos || []) {
    const room = state.rooms.find((r) => r.roomNo === rNo);
    if (room) rates[rNo] = getRoomRateForMode(room, mode.id, state.roomModeRates);
  }
  return { modeId: mode.id, modeName: mode.name, rates, created_at: new Date().toISOString() };
}
