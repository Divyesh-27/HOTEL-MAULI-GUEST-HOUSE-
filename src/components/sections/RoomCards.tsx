import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, LogIn, Receipt } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Booking, HistoryRecord, Room } from '@/types';
import GuestDetailsModal from '@/components/modals/GuestDetailsModal';
import { normalizeToDayStr } from '@/utils/availabilityUtils';
import { toLocalDateTimeString } from '@/utils/dateUtils';
import {
  RoomDayState, RoomDayStatus, addDays, addMonths, formatDayLabel, roomStatusForDay, todayStr,
} from '@/utils/roomDayStatus';

// Same category order as the Dashboard; any other categories follow in room order.
const CATEGORY_ORDER = ['AC', 'Air Cooled', 'Hall'];

const DRAG_THRESHOLD_PX = 60; // drag past this changes the day
const DRAG_START_PX = 10; // movement before a press counts as a drag (and not a click)
const WHEEL_STEP_PX = 40; // horizontal wheel distance for one day
const WHEEL_GESTURE_END_MS = 220; // quiet time that ends one wheel/trackpad gesture

const CARD_CLASS: Record<RoomDayState, string> = {
  free: 'bg-[hsl(var(--status-available)/0.1)] border-[hsl(var(--status-available)/0.3)]',
  reserved: 'room-card-reserved',
  occupied: 'room-card-occupied',
  maintenance: 'room-card-maintenance',
};
const STATUS_TOKEN: Record<RoomDayState, string> = {
  free: 'status-available',
  reserved: 'status-reserved',
  occupied: 'status-occupied',
  maintenance: 'status-maintenance',
};
const STATUS_LABEL: Record<RoomDayState, string> = {
  free: 'Free',
  reserved: 'Reserved',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
};

const isFormField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || !!el.closest('input, select, textarea'));

const isAnyModalOpen = () =>
  !!document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0');

type Selected = { booking: Booking | HistoryRecord; status: RoomDayStatus };

const RoomCards = () => {
  const {
    rooms, bookings, history, roomStatus, roomCardsDate, setRoomCardsDate, setSection,
    setPrefilledRegistration, convertReservationToCheckIn, updateBooking, updateHistory,
  } = useStore(useShallow(state => ({
    rooms: state.rooms,
    bookings: state.bookings,
    history: state.history,
    roomStatus: state.roomStatus,
    roomCardsDate: state.roomCardsDate,
    setRoomCardsDate: state.setRoomCardsDate,
    setSection: state.setSection,
    setPrefilledRegistration: state.setPrefilledRegistration,
    convertReservationToCheckIn: state.convertReservationToCheckIn,
    updateBooking: state.updateBooking,
    updateHistory: state.updateHistory,
  })));

  const today = todayStr();
  const date = roomCardsDate || today;
  const [selected, setSelected] = useState<Selected | null>(null);

  // ---------- Navigation ----------
  const slideDir = useRef(0); // -1 = came from a later day, +1 = from an earlier day
  const goTo = (next: string) => {
    if (!next || next === date) return;
    slideDir.current = next > date ? 1 : -1;
    setRoomCardsDate(next);
  };
  const stepDay = (n: number) => goTo(addDays(date, n));
  const stepMonth = (n: number) => goTo(addMonths(date, n));
  const onMonthPicked = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    const [cy, cm] = date.split('-').map(Number);
    if (y && m) stepMonth((y * 12 + m) - (cy * 12 + cm));
  };

  // Keep the latest navigation function for listeners registered once.
  const stepDayRef = useRef(stepDay);
  const stepMonthRef = useRef(stepMonth);
  stepDayRef.current = stepDay;
  stepMonthRef.current = stepMonth;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ---------- Statuses (memoised; cheap for 25 rooms) ----------
  const statuses = useMemo(() => {
    // Coarse pre-filter so long history doesn't slow past days down;
    // roomStatusForDay makes the exact decision.
    const relevantHistory = date < today
      ? history.filter(h => normalizeToDayStr(h.checkIn) <= date && normalizeToDayStr(h.checkoutDate) >= date)
      : [];
    const map = new Map<string, RoomDayStatus>();
    for (const room of rooms) {
      map.set(room.roomNo, roomStatusForDay(room, date, bookings, relevantHistory, roomStatus));
    }
    return map;
  }, [rooms, date, today, bookings, history, roomStatus]);

  const counts = useMemo(() => {
    const c = { free: 0, reserved: 0, occupied: 0 };
    statuses.forEach(s => { if (s.state in c) c[s.state as keyof typeof c]++; });
    return c;
  }, [statuses]);

  const groups = useMemo(() => {
    const order = [...CATEGORY_ORDER];
    for (const r of rooms) if (!order.includes(r.category)) order.push(r.category);
    return order
      .map(cat => ({ cat, rooms: rooms.filter(r => r.category === cat) }))
      .filter(g => g.rooms.length > 0);
  }, [rooms]);

  // ---------- Card actions ----------
  const freeCardMode = (s: RoomDayStatus): 'reserve' | 'checkin' | null => {
    if (s.state !== 'free' || date < today) return null;
    if (date === today) return s.cleaning ? null : 'checkin';
    return 'reserve';
  };

  const handleCardClick = (room: Room, s: RoomDayStatus) => {
    if (s.state === 'reserved' || s.state === 'occupied') {
      if (s.booking) setSelected({ booking: s.booking, status: s });
      return;
    }
    const mode = freeCardMode(s);
    if (!mode) return;
    setPrefilledRegistration({
      roomNos: [room.roomNo],
      checkIn: mode === 'checkin' ? toLocalDateTimeString(new Date()) : `${date}T12:00`,
      isReservation: mode === 'reserve',
      returnTo: 'room-cards',
    });
    setSection('registration');
  };

  const closeModal = () => setSelected(null);

  const handleCheckIn = () => {
    if (!selected) return;
    const b = selected.booking;
    if (!window.confirm(`Convert reservation for ${b.guestName} to Check-In now?`)) return;
    convertReservationToCheckIn(b.id);
    closeModal();
  };

  const handleBill = () => {
    closeModal();
    setSection('billing');
  };

  const modalActions = (() => {
    if (!selected || selected.status.fromHistory) return null;
    const { state } = selected.status;
    if (state === 'reserved' && date === today && selected.booking.isReservation) {
      return (
        <button onClick={handleCheckIn} className="px-4 py-2 rounded font-bold shadow-sm text-white status-reserved hover:opacity-90 flex items-center gap-2">
          <LogIn className="w-4 h-4" /> Check In
        </button>
      );
    }
    if (state === 'occupied') {
      return (
        <button onClick={handleBill} className="px-4 py-2 rounded font-bold shadow-sm text-white status-occupied hover:opacity-90 flex items-center gap-2">
          <Receipt className="w-4 h-4" /> Bill / Checkout
        </button>
      );
    }
    return null;
  })();

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (selectedRef.current || isFormField(e.target) || isFormField(document.activeElement) || isAnyModalOpen()) return;
      const actions: Record<string, () => void> = {
        ArrowLeft: () => stepDayRef.current(-1),
        ArrowRight: () => stepDayRef.current(1),
        PageUp: () => stepMonthRef.current(-1),
        PageDown: () => stepMonthRef.current(1),
      };
      const act = actions[e.key];
      if (act) {
        e.preventDefault();
        act();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Wheel / trackpad: one day per gesture ----------
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let accum = 0;
    let locked = false;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scrolling: leave alone
      e.preventDefault(); // stop the browser's horizontal back/forward swipe
      if (selectedRef.current) return;
      if (!locked) {
        accum += e.deltaX;
        if (Math.abs(accum) >= WHEEL_STEP_PX) {
          stepDayRef.current(accum > 0 ? 1 : -1);
          locked = true; // ignore the rest of this gesture (incl. momentum)
        }
      }
      clearTimeout(endTimer);
      endTimer = setTimeout(() => { locked = false; accum = 0; }, WHEEL_GESTURE_END_MS);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(endTimer);
    };
  }, []);

  // ---------- Pointer drag (mouse + touch) ----------
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);

  const setGridOffset = (px: number) => {
    if (gridRef.current) gridRef.current.style.transform = px ? `translateX(${px}px)` : '';
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || isFormField(e.target) || selectedRef.current) return;
    suppressClick.current = false;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active && Math.abs(dx) > DRAG_START_PX && Math.abs(dx) > Math.abs(dy)) {
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.active) setGridOffset(Math.max(-90, Math.min(90, dx * 0.35)));
  };
  const endDrag = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.active) return;
    suppressClick.current = true; // a drag must never count as a card click
    setGridOffset(0);
    const dx = e.clientX - d.x;
    if (!cancelled && Math.abs(dx) > DRAG_THRESHOLD_PX) stepDayRef.current(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // ---------- Short slide animation on day change ----------
  useLayoutEffect(() => {
    const el = gridRef.current;
    const dir = slideDir.current;
    slideDir.current = 0;
    if (!el || !dir || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ transform: `translateX(${dir * 28}px)`, opacity: 0.35 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 170, easing: 'ease-out' }
    );
  }, [date]);

  // ---------- Render ----------
  const isToday = date === today;
  const isPast = date < today;

  return (
    <>
    <div
      ref={rootRef}
      className="animate-fade-in relative select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onClickCapture={onClickCapture}
    >
      {/* Header */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepDay(-1)}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
            title="Previous day (←)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-[9.5rem] text-center">
            <p className="font-bold text-lg text-foreground font-mono">{formatDayLabel(date)}</p>
            <p className="text-[11px] text-muted-foreground">
              {isToday ? 'Today' : isPast ? 'Past day' : 'Upcoming'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => stepDay(1)}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
            title="Next day (→)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={isToday}
            className="ml-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && goTo(e.target.value)}
              className="h-9 px-2 border rounded text-sm bg-background text-foreground"
            />
          </label>
          <input
            type="month"
            value={date.slice(0, 7)}
            onChange={(e) => e.target.value && onMonthPicked(e.target.value)}
            className="h-9 px-2 border rounded text-sm bg-background text-foreground"
            title="Month (PgUp / PgDn)"
          />
        </div>

        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm status-available" /> Free <span className="font-mono">{counts.free}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm status-reserved" /> Reserved <span className="font-mono">{counts.reserved}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm status-occupied" /> Occupied <span className="font-mono">{counts.occupied}</span></span>
        </div>
      </div>

      {/* Cards */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 overflow-hidden">
        <p className="text-[11px] text-muted-foreground mb-4">
          ← / → change day · PgUp / PgDn change month · swipe or drag sideways
        </p>

        <div ref={gridRef} className="space-y-6 will-change-transform">
          {rooms.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No rooms yet. Add rooms in Admin Controls.</p>
          )}
          {groups.map(({ cat, rooms: catRooms }) => (
            <div key={cat}>
              <h4 className="font-bold text-sm text-muted-foreground uppercase mb-3 border-b pb-1">{cat}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {catRooms.map((room) => {
                  const s = statuses.get(room.roomNo) || { state: 'free' as const };
                  const booked = s.state === 'reserved' || s.state === 'occupied';
                  const clickable = booked ? !!s.booking : freeCardMode(s) !== null;
                  const title = !clickable
                    ? s.state === 'maintenance'
                      ? 'Under maintenance'
                      : s.cleaning && isToday
                        ? 'Marked for cleaning — clear it on the Dashboard first'
                        : isPast ? 'Past day' : undefined
                    : booked
                      ? 'Open guest details'
                      : isToday ? 'Check in to this room' : 'Reserve this room';

                  return (
                    <button
                      type="button"
                      key={room.roomNo}
                      disabled={!clickable}
                      title={title}
                      onClick={() => handleCardClick(room, s)}
                      className={cn(
                        'room-card w-full',
                        CARD_CLASS[s.state],
                        clickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                      )}
                    >
                      <span className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', STATUS_TOKEN[s.state])} />
                      <p className="font-bold text-lg text-foreground">{room.roomNo}</p>
                      <p className="text-[10px] text-muted-foreground">{room.bedType}</p>
                      {booked && s.booking && (
                        <>
                          <p className="text-[11px] font-semibold text-foreground truncate w-full mt-1">{s.booking.guestName}</p>
                          {s.dayIndex !== undefined && s.nights !== undefined && (
                            <p className="text-[10px] text-muted-foreground">Day {s.dayIndex} of {s.nights}</p>
                          )}
                        </>
                      )}
                      <span className={cn('text-[9px] text-white px-1.5 rounded mt-1 font-bold uppercase', STATUS_TOKEN[s.state])}>
                        {STATUS_LABEL[s.state]}{s.cleaning ? ' · Cleaning' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

      {/* Outside the gesture area so drags/selection inside the modal never change the day */}
      {selected && (
        <GuestDetailsModal
          data={selected.booking}
          onClose={closeModal}
          onUpdate={(updated: Booking | HistoryRecord) => {
            if (selected.status.fromHistory) updateHistory(updated as HistoryRecord);
            else updateBooking(updated as Booking);
            closeModal();
          }}
          footerActions={modalActions}
        />
      )}
    </>
  );
};

export default RoomCards;
