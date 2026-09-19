import React, { useState, useMemo } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Booking } from '@/types';
import SearchBar from '@/mobile/components/SearchBar';
import SegmentedToggle from '@/mobile/components/SegmentedToggle';
import BillingDetailBottomSheet from '@/mobile/components/BillingDetailBottomSheet';
import EmptyState from '@/mobile/components/EmptyState';
import { CalendarCheck, Receipt, Eye } from 'lucide-react';
import { pushMobileBookingToCloud } from '@/mobile/lib/mobileSyncActions';

const BillingMobile: React.FC = () => {
  const bookings = useMobileStore((s) => s.bookings);
  const convertReservationToCheckIn = useMobileStore((s) => s.convertReservationToCheckIn);
  const setSection = useMobileStore((s) => s.setSection);
  const updateBooking = useMobileStore((s) => s.updateBooking);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFuture, setShowFuture] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Filter Active vs Future
  const targetGuests = useMemo(() => {
    return showFuture 
      ? bookings.filter(b => b.isReservation)
      : bookings.filter(b => !b.isReservation);
  }, [bookings, showFuture]);

  // Apply text search
  const filteredGuests = useMemo(() => {
    if (!searchTerm) return targetGuests;
    const term = searchTerm.toLowerCase();
    return targetGuests.filter(b => 
      b.guestName.toLowerCase().includes(term) ||
      b.mobile.includes(term) ||
      b.roomNos.some(room => room.toLowerCase().includes(term))
    );
  }, [targetGuests, searchTerm]);

  const handleCheckIn = async (booking: Booking) => {
    if (window.confirm(`Convert reservation to Check-In for ${booking.guestName}?`)) {
      convertReservationToCheckIn(booking.id);
      
      // Update cloud sync (optimistic local was handled above)
      const updated = { ...booking, isReservation: false };
      await pushMobileBookingToCloud(updated);
    }
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Search & Toggle */}
      <div className="bg-card p-3 rounded-xl border flex flex-col gap-3">
        <SearchBar 
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by guest, mobile, or room..."
        />
        
        <SegmentedToggle
          options={[
            { id: 'active', label: 'Active Guests' },
            { id: 'future', label: 'Reservations' }
          ]}
          activeId={showFuture ? 'future' : 'active'}
          onChange={(id) => setShowFuture(id === 'future')}
        />
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filteredGuests.length === 0 ? (
          <EmptyState
            title={showFuture ? 'No upcoming reservations' : 'No active guests'}
            description={searchTerm ? 'No matches found for your search.' : undefined}
          />
        ) : (
          filteredGuests.map(booking => (
            <div key={booking.id} className="bg-card border rounded-xl p-4 active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-foreground text-sm leading-tight">{booking.guestName}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{booking.mobile}</p>
                </div>
                <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-black">
                  {booking.roomNos.join(', ')}
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4 pt-3 border-t border-border">
                <div className="text-xs">
                  <span className="text-muted-foreground block mb-0.5">Advance Paid</span>
                  <span className="font-bold text-status-available">₹{booking.advance || 0}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => alert('Detailed view coming in next update!')}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary text-foreground active:scale-95 transition-transform"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  {showFuture ? (
                    <button
                      onClick={() => handleCheckIn(booking)}
                      className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-accent text-accent-foreground font-bold text-xs active:scale-95 transition-transform shadow-sm"
                    >
                      <CalendarCheck className="w-4 h-4" /> Check In
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-bold text-xs active:scale-95 transition-transform shadow-sm"
                    >
                      <Receipt className="w-4 h-4" /> Checkout
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Checkout Bottom Sheet */}
      <BillingDetailBottomSheet
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
};

export default BillingMobile;
