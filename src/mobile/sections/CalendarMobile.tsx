import React, { useState, useMemo } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Booking } from '@/types';
import { ChevronLeft, ChevronRight, X, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import BottomSheet from '@/mobile/components/BottomSheet';
import BillingDetailBottomSheet from '@/mobile/components/BillingDetailBottomSheet';
import { pushMobileBookingToCloud } from '@/mobile/lib/mobileSyncActions';

const CalendarMobile: React.FC = () => {
  const bookings = useMobileStore((s) => s.bookings);
  const convertReservationToCheckIn = useMobileStore((s) => s.convertReservationToCheckIn);
  const setSection = useMobileStore((s) => s.setSection);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: string, bookings: Booking[] } | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthName = new Date(year, month).toLocaleString('default', { month: 'short', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const getBookingsForDate = (dateStr: string) => {
    return bookings.filter((b) => {
      const start = normalizeToDayStr(b.checkIn);
      const end = getCheckoutDayStr(b.checkIn, b.days || 1);
      return dateStr >= start && dateStr < end;
    });
  };

  const handleCellClick = (dateStr: string, dayBookings: Booking[]) => {
    if (dayBookings.length > 0) {
      setSelectedDayBookings({ date: dateStr, bookings: dayBookings });
    } else {
      // Navigate to registration for empty dates
      // Future enhancement: pass selected date to registration form
      setSection('registration');
    }
  };

  const handleCheckIn = async (booking: Booking) => {
    if (window.confirm(`Convert reservation to Check-In for ${booking.guestName}?`)) {
      convertReservationToCheckIn(booking.id);
      setSelectedDayBookings(null);
      
      const updated = { ...booking, isReservation: false };
      await pushMobileBookingToCloud(updated);
    }
  };

  const days = [];
  
  // Empty slots before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="opacity-50 border border-transparent" />);
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayBookings = getBookingsForDate(dateStr);
    const isToday = dateStr === new Date().toISOString().split('T')[0];

    const occupiedCount = dayBookings.filter(b => !b.isReservation).length;
    const reservedCount = dayBookings.filter(b => b.isReservation).length;

    days.push(
      <div
        key={d}
        onClick={() => handleCellClick(dateStr, dayBookings)}
        className={cn(
          'flex flex-col items-center justify-center p-1 min-h-[50px] border rounded-lg active:scale-95 transition-transform',
          isToday ? 'bg-primary/10 border-primary' : 'bg-card border-border'
        )}
      >
        <span className={cn('text-sm font-bold', isToday ? 'text-primary' : 'text-foreground')}>{d}</span>
        <div className="flex gap-1 mt-1">
          {occupiedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-status-occupied" />}
          {reservedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-status-reserved" />}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Header controls */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border">
        <button onClick={() => changeMonth(-1)} className="p-2 bg-secondary rounded-lg active:scale-95 m-touch-target flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h3 className="font-black text-base text-foreground uppercase tracking-widest">{monthName}</h3>
        <button onClick={() => changeMonth(1)} className="p-2 bg-secondary rounded-lg active:scale-95 m-touch-target flex items-center justify-center">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-card rounded-xl border p-2 shadow-sm">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-black text-muted-foreground uppercase">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
        
        <div className="flex items-center justify-center gap-5 mt-4 text-[10px] font-bold text-muted-foreground bg-secondary/30 py-2 rounded-lg">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-status-occupied" /> Occupied</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-status-reserved" /> Reserved</div>
        </div>
      </div>

      {/* Day Details Bottom Sheet */}
      <BottomSheet
        open={!!selectedDayBookings}
        onClose={() => setSelectedDayBookings(null)}
        title={selectedDayBookings ? `Bookings - ${new Date(selectedDayBookings.date).toLocaleDateString()}` : undefined}
      >
        <div className="space-y-3">
          {selectedDayBookings?.bookings.map((b) => (
            <div key={b.id} className="bg-background border rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-sm">{b.guestName}</h4>
                  <p className="text-[10px] text-muted-foreground">Rooms: {b.roomNos.join(', ')}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider", 
                  b.isReservation ? "bg-status-reserved/10 text-status-reserved" : "bg-status-occupied/10 text-status-occupied"
                )}>
                  {b.isReservation ? 'Reserved' : 'Occupied'}
                </span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                {b.isReservation ? (
                  <button 
                    onClick={() => handleCheckIn(b)} 
                    className="flex-1 flex justify-center items-center gap-1.5 bg-accent text-accent-foreground py-2 rounded-lg text-xs font-bold active:scale-95"
                  >
                    <CalendarCheck className="w-4 h-4" /> Check In
                  </button>
                ) : (
                  <button 
                    onClick={() => { setCheckoutBooking(b); setSelectedDayBookings(null); }} 
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold active:scale-95"
                  >
                    Checkout Flow
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Checkout Sheet */}
      <BillingDetailBottomSheet 
        booking={checkoutBooking} 
        onClose={() => setCheckoutBooking(null)} 
      />
    </div>
  );
};

export default CalendarMobile;
