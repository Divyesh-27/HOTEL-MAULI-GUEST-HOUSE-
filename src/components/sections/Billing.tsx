import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Booking } from '@/types';
import BillingModal from './BillingModal';
import GuestDetailsModal from '@/components/modals/GuestDetailsModal';
import { Search, Eye, Receipt, FileText } from 'lucide-react';
import { saveInvoicePDFSilent } from '@/utils/pdfUtils';

import { useShallow } from 'zustand/react/shallow';

const Billing = () => {
  const { bookings, convertReservationToCheckIn, updateBooking } = useStore(useShallow(state => ({
    bookings: state.bookings,
    convertReservationToCheckIn: state.convertReservationToCheckIn,
    updateBooking: state.updateBooking
  })));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewDetails, setViewDetails] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFuture, setShowFuture] = useState(false);

  const targetGuests = showFuture 
    ? bookings.filter(b => b.isReservation)
    : bookings.filter(b => !b.isReservation);

  // Search Logic
  const filteredGuests = targetGuests.filter(booking => {
    const term = searchTerm.toLowerCase();
    return (
      booking.guestName.toLowerCase().includes(term) ||
      booking.mobile.includes(term) ||
      booking.roomNos.some(room => room.toLowerCase().includes(term))
    );
  });

  const handleCheckIn = (booking: Booking) => {
    if (confirm(`Convert reservation for ${booking.guestName} to Check-In now?`)) {
      convertReservationToCheckIn(booking.id);
    }
  };

  // Logic to handle updates from the GuestDetailsModal
  const handleUpdateGuest = (updatedData: Booking) => {
    if (updateBooking) {
      updateBooking(updatedData);
      setViewDetails(updatedData); // Update the local view so the modal shows new info
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Search Bar & Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="flex items-center space-x-2 w-full sm:w-1/2">
          <Search className="text-muted-foreground w-5 h-5" />
        <input
          type="text"
          placeholder="Search by Guest Name, Mobile, or Room No..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
        />
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${!showFuture ? 'text-primary' : 'text-muted-foreground'}`}>Active</span>
          <button 
            onClick={() => setShowFuture(!showFuture)}
            className="w-12 h-6 rounded-full bg-secondary border border-border relative flex items-center transition-colors hover:bg-secondary/80 focus:outline-none"
          >
            <div className={`w-4 h-4 rounded-full bg-primary absolute transition-transform ${showFuture ? 'transform translate-x-7' : 'transform translate-x-1'}`} />
          </button>
          <span className={`text-sm font-bold ${showFuture ? 'text-primary' : 'text-muted-foreground'}`}>Future</span>
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/50">
          <h3 className="font-bold text-lg text-foreground">Guest List & Billing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-secondary text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Room No.</th>
                <th className="px-6 py-4">Guest Name</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4">Check-In</th>
                <th className="px-6 py-4">Advance</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm font-medium">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    {searchTerm ? 'No guests found.' : showFuture ? 'No future reservations.' : 'No checked-in guests currently.'}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((booking) => (
                  <tr key={booking.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{booking.roomNos.join(', ')}</td>
                    <td className="px-6 py-4">{booking.guestName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{booking.mobile}</td>
                    <td className="px-6 py-4 text-xs">{new Date(booking.checkIn).toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-status-available">₹{booking.advance}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {/* Details Button */}
                        <button
                          onClick={() => setViewDetails(booking)}
                          className="bg-secondary text-foreground p-2 rounded hover:bg-secondary/80 border border-border transition-all flex items-center gap-1 text-xs font-bold"
                          title="View Full Details"
                        >
                          <Eye className="w-3 h-3" /> Details
                        </button>
                        {/* Actions */}
                        {showFuture ? (
                          <button
                            onClick={() => handleCheckIn(booking)}
                            className="bg-accent text-accent-foreground px-3 py-2 rounded text-xs font-bold hover:bg-accent/90 shadow transition-all hover:scale-105"
                          >
                            Check In
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setSelectedBooking({ ...booking, enableGstInvoice: true })}
                              className="bg-primary text-primary-foreground px-3 py-2 rounded text-xs font-bold hover:bg-primary/90 shadow transition-all hover:scale-105 flex items-center gap-1"
                            >
                              GST Bill
                            </button>
                            <button
                              onClick={() => saveInvoicePDFSilent(booking, false)}
                              className="bg-secondary text-secondary-foreground border border-border px-3 py-2 rounded text-xs font-bold hover:bg-secondary/80 shadow transition-all hover:scale-105 flex items-center gap-1"
                              title="Generate PDF"
                            >
                              <FileText className="w-3 h-3" /> PDF
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal with Edit Capability */}
      {viewDetails && (
        <GuestDetailsModal 
          data={viewDetails} 
          onClose={() => setViewDetails(null)} 
          onUpdate={handleUpdateGuest} // <--- Connected the update logic here
        />
      )}

      {/* Billing Modal */}
      {selectedBooking && (
        <BillingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
};

export default Billing;