import React, { useState } from 'react';
import { Booking } from '@/types';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { generateUUID } from '@/lib/uuid';
import { pushMobileHistoryToCloud, deleteMobileBookingFromCloud, pushMobileRoomStatusToCloud } from '@/mobile/lib/mobileSyncActions';
import { calculateAccommodationGST } from '@/utils/gstUtils';
import { X, Receipt, Download, CreditCard, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillingDetailBottomSheetProps {
  booking: Booking | null;
  onClose: () => void;
}

const BillingDetailBottomSheet: React.FC<BillingDetailBottomSheetProps> = ({ booking, onClose }) => {
  const settings = useMobileStore((s) => s.invoiceSettings);
  const rooms = useMobileStore((s) => s.rooms);
  const addHistory = useMobileStore((s) => s.addHistory);
  const deleteBooking = useMobileStore((s) => s.deleteBooking);
  const updateRoomStatus = useMobileStore((s) => s.updateRoomStatus);

  const [payMode, setPayMode] = useState<string>('Cash');
  const [loading, setLoading] = useState(false);

  if (!booking) return null;

  const days = booking.days || 1;

  // Calculate totals
  const totalRent = booking.roomNos.reduce((sum, roomNo) => {
    const room = rooms.find(r => r.roomNo === roomNo);
    return sum + (room ? room.rent * days : 0);
  }, 0);

  const dailyRent = totalRent / days;
  const roomCount = booking.roomNos.length;

  const totalExtras = (booking.extras || []).reduce((sum, e) => sum + (e.amt || 0), 0);
  const subTotal = totalRent + totalExtras;
  const discount = booking.discount || 0;
  
  // Base rent calculation inside gstUtils already handles discount logic for rooms,
  // but extras are added separately or we just treat dailyRent as inclusive of extras for GST purpose if required. 
  // For simplicity, we just pass total equivalent daily rent.
  const effectiveDailyRent = (subTotal / days);

  const { totalGST, cgstAmount, sgstAmount, baseRent } = calculateAccommodationGST(
    effectiveDailyRent,
    days,
    discount,
    roomCount,
    settings
  );

  const grandTotal = baseRent + totalGST;
  const totalAdvance = booking.advance || 0;
  const balance = grandTotal - totalAdvance;

  const handleCheckout = async () => {
    if (!window.confirm(`Checkout ${booking.guestName} and clear rooms?`)) return;

    setLoading(true);
    try {
      const historyRecord = {
        ...booking,
        checkoutDate: new Date().toISOString(),
        finalAmount: grandTotal,
        totalPaid: grandTotal, // Assuming full payment on checkout for mobile flow
        payMode: payMode,
      };

      // 1. Save to local history
      addHistory(historyRecord);
      
      // 2. Push to Supabase history (upserts to bookings with status=COMPLETED)
      await pushMobileHistoryToCloud(historyRecord as any);

      // 3. Remove local active booking
      deleteBooking(booking.id);
      
      // 4. Note: pushMobileHistoryToCloud already updates the booking record, but 
      // if we want to ensure it's removed from active local sync immediately, we do delete.
      // But typically, we just mark status as COMPLETED. The `deleteBooking` handles local state.

      // 5. Mark rooms as 'cleaning'
      for (const roomNo of booking.roomNos) {
        updateRoomStatus(roomNo, 'cleaning');
        await pushMobileRoomStatusToCloud(roomNo, 'cleaning');
      }

      alert('Checkout completed successfully!');
      onClose();
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet-content">
        <div className="bottom-sheet-handle" />
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 pb-3 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground">Checkout & Bill</h3>
            <p className="text-xs text-muted-foreground">{booking.guestName} • {booking.roomNos.join(', ')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary active:scale-95 transition-all">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Bill Summary */}
          <div className="bg-secondary/30 rounded-xl p-4 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Total Rent ({booking.days} days)</span>
              <span className="text-sm font-bold">₹{totalRent.toFixed(2)}</span>
            </div>
            
            {totalExtras > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Extra Charges</span>
                <span className="text-sm font-bold">₹{totalExtras.toFixed(2)}</span>
              </div>
            )}
            
            {(booking.discount || 0) > 0 && (
              <div className="flex justify-between items-center mb-2 text-status-available">
                <span className="text-xs font-semibold">Discount</span>
                <span className="text-sm font-bold">-₹{booking.discount?.toFixed(2)}</span>
              </div>
            )}
            
            {totalGST > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">GST (CGST+SGST)</span>
                <span className="text-sm font-bold">₹{totalGST.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-border/50 my-2 pt-2 flex justify-between items-center">
              <span className="text-sm font-bold text-foreground">Grand Total</span>
              <span className="text-base font-black">₹{grandTotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-status-available">
              <span className="text-xs font-semibold">Advance Paid</span>
              <span className="text-sm font-bold">-₹{totalAdvance.toFixed(2)}</span>
            </div>

            <div className="border-t border-border/50 mt-2 pt-2 flex justify-between items-center">
              <span className="text-sm font-black text-destructive uppercase">Balance Due</span>
              <span className="text-xl font-black text-destructive">₹{balance.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Collection */}
          <div className="space-y-2">
            <label className="m-label">Payment Mode for Balance</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'UPI', 'Card'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setPayMode(mode)}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95",
                    payMode === mode 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-card text-foreground border-border"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-border bg-background grid grid-cols-2 gap-3">
          <button 
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-secondary text-foreground font-bold text-sm active:scale-95 transition-all"
            onClick={() => alert('Print feature uses desktop electron API. Coming to mobile soon!')}
          >
            <Download className="w-4 h-4" />
            Invoice
          </button>
          
          <button 
            onClick={handleCheckout}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-sm active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            <Receipt className="w-4 h-4" />
            {loading ? 'Processing...' : 'Checkout Now'}
          </button>
        </div>
      </div>
    </>
  );
};

export default BillingDetailBottomSheet;
