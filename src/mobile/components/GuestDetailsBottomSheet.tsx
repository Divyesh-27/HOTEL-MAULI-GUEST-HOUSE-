import React from 'react';
import { Booking, HistoryRecord } from '@/types';
import BottomSheet from '@/mobile/components/BottomSheet';
import { X, Calendar, Phone, CreditCard, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestDetailsBottomSheetProps {
  data: Booking | HistoryRecord | null;
  onClose: () => void;
  isHistory?: boolean;
}

const GuestDetailsBottomSheet: React.FC<GuestDetailsBottomSheetProps> = ({ data, onClose, isHistory = false }) => {
  if (!data) return null;

  return (
    <BottomSheet open={!!data} onClose={onClose} title="Guest Details">
      <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto">
        {/* Top Info */}
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-xl font-extrabold text-foreground leading-tight">{data.guestName}</h4>
            <div className="flex items-center gap-1.5 text-muted-foreground mt-1 text-xs font-medium">
              <Phone className="w-3.5 h-3.5" />
              <span>{data.mobile}</span>
            </div>
          </div>
          
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            isHistory 
              ? "bg-secondary text-foreground" 
              : data.isReservation 
                ? "bg-status-reserved/10 text-status-reserved"
                : "bg-status-occupied/10 text-status-occupied"
          )}>
            {isHistory ? 'Checked Out' : data.isReservation ? 'Reserved' : 'Occupied'}
          </div>
        </div>

        {/* Stay Info Card */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-border">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-foreground">
            <Calendar className="w-4 h-4 text-primary" /> Stay Details
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Check-In</span>
              <span className="font-semibold">{new Date(data.checkIn).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Check-Out</span>
              <span className="font-semibold">
                {isHistory && (data as HistoryRecord).checkoutDate
                  ? new Date((data as HistoryRecord).checkoutDate!).toLocaleString()
                  : 'Pending'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Rooms</span>
              <span className="font-semibold">{data.roomNos.join(', ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Persons</span>
              <span className="font-semibold">{data.persons}</span>
            </div>
          </div>
        </div>

        {/* Financial Info Card */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-border">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-foreground">
            <CreditCard className="w-4 h-4 text-primary" /> Payment & Billing
          </div>
          
          <div className="space-y-2 text-xs">
            {isHistory ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Billed</span>
                  <span className="font-bold">₹{(data as HistoryRecord).finalAmount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="font-bold text-status-available">₹{(data as HistoryRecord).totalPaid || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Mode</span>
                  <span className="font-semibold">{data.payMode || 'Cash'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Paid</span>
                  <span className="font-bold text-status-available">₹{data.advance || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount Applied</span>
                  <span className="font-bold text-destructive">₹{data.discount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Payment Mode</span>
                  <span className="font-semibold">
                    {data.advancePayments && data.advancePayments.length > 0 
                      ? data.advancePayments[0].payMode 
                      : data.payMode || 'Cash'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Address & Travel */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-border">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-foreground">
            <Clock className="w-4 h-4 text-primary" /> Additional Info
          </div>
          
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Address</span>
              <span className="font-semibold">{data.address}</span>
            </div>
            
            {(data.coming || data.going) && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Coming From</span>
                  <span className="font-semibold">{data.coming || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Going To</span>
                  <span className="font-semibold">{data.going || '-'}</span>
                </div>
              </div>
            )}
            
            {data.carNo && (
              <div className="pt-1">
                <span className="text-muted-foreground block mb-0.5">Vehicle</span>
                <span className="font-semibold uppercase">{data.carNo} {data.carModel ? `(${data.carModel})` : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Identity & Signature Proofs (if available) */}
        {(data.identityProofUrl || data.digitalSignatureUrl) && (
          <div className="grid grid-cols-2 gap-3">
            {data.identityProofUrl && (
              <div className="border rounded-xl p-2 bg-card">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">ID Proof</span>
                <img src={data.identityProofUrl} alt="ID Proof" className="w-full h-16 object-cover rounded-lg" />
              </div>
            )}
            {data.digitalSignatureUrl && (
              <div className="border rounded-xl p-2 bg-card">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Signature</span>
                <img src={data.digitalSignatureUrl} alt="Signature" className="w-full h-16 object-contain rounded-lg bg-white" />
              </div>
            )}
          </div>
        )}

      </div>
    </BottomSheet>
  );
};

export default GuestDetailsBottomSheet;
