import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Users, CalendarDays, Receipt } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Booking } from '@/types';
import { cn } from '@/lib/utils';
import { normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import { toLocalDateString } from '@/utils/dateUtils';
import BillingModal from './BillingModal'; // We can reuse BillingModal here!

import { useShallow } from 'zustand/react/shallow';

const Calendar = () => {
  const { bookings, currentMonth, setMonth, convertReservationToCheckIn, setSection } = useStore(useShallow(state => ({
    bookings: state.bookings,
    currentMonth: state.currentMonth,
    setMonth: state.setMonth,
    convertReservationToCheckIn: state.convertReservationToCheckIn,
    setSection: state.setSection
  })));
  const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: string, bookings: Booking[] } | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null); // For handling checkouts

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setMonth(newDate);
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
      setSection('registration');
    }
  };

  const handleCheckIn = (id: string, guestName: string) => {
    if (confirm(`Convert reservation for ${guestName} to Check-In now?`)) {
      convertReservationToCheckIn(id);
      setSelectedDayBookings(null);
    }
  };

  const days = [];
  
  // Empty cells for days before first day of month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="bg-secondary/10 border-r border-b border-border opacity-50" />);
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayBookings = getBookingsForDate(dateStr);
    const isToday = dateStr === toLocalDateString(new Date());

    // Counts
    const occupiedCount = dayBookings.filter(b => !b.isReservation).length;
    const reservedCount = dayBookings.filter(b => b.isReservation).length;
    const isEmpty = dayBookings.length === 0;

    days.push(
      <div
        key={d}
        onClick={() => handleCellClick(dateStr, dayBookings)}
        className={cn(
          'calendar-day group relative flex flex-col p-2 min-h-[120px] transition-all cursor-pointer border-r border-b border-border',
          isToday ? 'bg-primary/5' : 'bg-card hover:bg-secondary/50',
          'hover:shadow-inner hover:border-accent z-10'
        )}
      >
        {/* Date Number - Top Left */}
        <div className={cn(
          'text-left text-sm font-bold mb-2',
          isToday ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground transition-colors'
        )}>
          {d}
        </div>
        
        {/* Indicators */}
        <div className="flex flex-col gap-1.5 flex-1">
          {occupiedCount > 0 && (
            <div className="flex justify-between items-center bg-status-occupied/10 border border-status-occupied/20 text-status-occupied rounded px-1.5 py-0.5 text-[10px] font-bold">
              <span>Occupied</span>
              <span>{occupiedCount}</span>
            </div>
          )}
          {reservedCount > 0 && (
            <div className="flex justify-between items-center bg-status-reserved/10 border border-status-reserved/20 text-status-reserved rounded px-1.5 py-0.5 text-[10px] font-bold">
              <span>Reserved</span>
              <span>{reservedCount}</span>
            </div>
          )}
        </div>

        {/* Hover Plus Button */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/40 backdrop-blur-[1px]">
            <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-2xl text-foreground tracking-tight">{monthName}</h3>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setSection('registration')}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Booking
            </button>
            <div className="flex bg-secondary rounded-md border border-border p-1">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1 rounded hover:bg-background transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="p-1 rounded hover:bg-background transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mb-4 text-xs font-medium text-muted-foreground border-b border-border pb-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-status-occupied rounded-[3px]" /> Occupied
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-status-reserved rounded-[3px]" /> Reserved
          </span>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0 text-left font-bold text-muted-foreground text-xs uppercase tracking-wider mb-2 pl-2">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0 bg-card border-t border-l border-border rounded-lg overflow-hidden shadow-sm">
          {days}
        </div>
      </div>

      {/* Date Listings Modal */}
      {selectedDayBookings && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDayBookings(null)}
        >
          <div 
            className="bg-card rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in border border-border flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-secondary flex justify-between items-center border-b border-border">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-foreground">
                  Bookings for {new Date(selectedDayBookings.date).toLocaleDateString()}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDayBookings(null)} 
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-bold sticky top-0">
                  <tr>
                    <th className="px-6 py-3 border-b border-border">Guest Name</th>
                    <th className="px-6 py-3 border-b border-border">Rooms</th>
                    <th className="px-6 py-3 border-b border-border">Type</th>
                    <th className="px-6 py-3 border-b border-border text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {selectedDayBookings.bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-secondary/30 transition-colors group">
                      <td className="px-6 py-4 font-bold text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" /> {b.guestName}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono bg-secondary px-2 py-1 rounded text-xs border border-border">
                          {b.roomNos.join(', ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {b.isReservation ? (
                          <span className="text-status-reserved font-bold text-xs uppercase bg-status-reserved/10 px-2 py-1 rounded">Reservation</span>
                        ) : (
                          <span className="text-status-occupied font-bold text-xs uppercase bg-status-occupied/10 px-2 py-1 rounded">Active Stay</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {b.isReservation ? (
                          <button
                            onClick={() => handleCheckIn(b.id, b.guestName)}
                            className="bg-status-reserved text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-status-reserved/90 shadow transition-all hover:scale-105"
                          >
                            Check In
                          </button>
                        ) : (
                          <button
                            onClick={() => setCheckoutBooking(b)}
                            className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded text-xs font-bold hover:bg-destructive/90 shadow transition-all hover:scale-105 flex items-center justify-end ml-auto gap-1"
                          >
                            <Receipt className="w-3 h-3" /> Check Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-secondary/50 flex justify-end gap-3 border-t border-border">
              <button
                onClick={() => setSelectedDayBookings(null)}
                className="px-6 py-2 bg-card border border-border rounded hover:bg-secondary text-foreground font-bold text-sm transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal Overlay utilizing existing component */}
      {checkoutBooking && (
        <BillingModal 
           booking={checkoutBooking} 
           onClose={() => {
              setCheckoutBooking(null);
              setSelectedDayBookings(null); 
           }} 
        />
      )}
    </div>
  );
};

export default Calendar;
