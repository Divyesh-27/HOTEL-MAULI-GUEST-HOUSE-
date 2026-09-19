import { useState, useEffect } from 'react';
import { X, Printer, Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Booking, HistoryRecord, AdvancePayment } from '@/types';
import mauliLogo from '@/assets/mauli-logo.png';
import { pushHistoryToCloud, deleteBookingFromCloud, pushRoomStatusToCloud } from '@/lib/syncActions';
import { calculateAccommodationGST, getHotelGSTIN } from '@/utils/gstUtils';
import { toLocalDateTimeString } from '@/components/modals/GuestDetailsModal';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';

import { useShallow } from 'zustand/react/shallow';

interface BillingModalProps {
  booking: Booking | HistoryRecord;
  onClose: () => void;
  mode?: 'checkout' | 'reprint';
}

const BillingModal = ({ booking, onClose, mode = 'checkout' }: BillingModalProps) => {
  const { rooms, removeBooking, addHistory, setRoomStatus, setSection, addAdvancePayment, invoiceSettings } = useStore(useShallow(state => ({
    rooms: state.rooms, removeBooking: state.removeBooking, addHistory: state.addHistory, setRoomStatus: state.setRoomStatus, setSection: state.setSection, addAdvancePayment: state.addAdvancePayment, invoiceSettings: state.invoiceSettings
  })));

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const gstEnabled = invoiceSettings ? invoiceSettings.gst_enabled : true;
  const showGstinFinal = invoiceSettings ? invoiceSettings.show_gstin_final : true;
  const showBreakupFinalSetting = invoiceSettings ? (invoiceSettings.show_breakup_final && gstEnabled) : true;

  const [enableGstInvoice, setEnableGstInvoice] = useState(booking.enableGstInvoice ?? gstEnabled);
  const showBreakupFinal = enableGstInvoice && showBreakupFinalSetting;

  const [showDiscountOnInvoice, setShowDiscountOnInvoice] = useState(booking.showDiscountOnInvoice ?? true);
  const [discountReason, setDiscountReason] = useState(booking.discountReason || booking.discountNote || 'Normal Discount');

  const [checkInTime, setCheckInTime] = useState(() => {
    return toLocalDateTimeString(booking.checkIn) || toLocalDateTimeString(new Date());
  });
  const [checkOutTime, setCheckOutTime] = useState(() => {
    if (mode === 'reprint' && (booking as any).checkoutDate) {
      return toLocalDateTimeString((booking as any).checkoutDate);
    }
    return toLocalDateTimeString(new Date());
  });
  const [days, setDays] = useState(booking.days || 1);

  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    amount: 0,
    payMode: 'Cash' as 'Cash' | 'UPI' | 'Card' | 'Other',
    note: '',
  });

  // --- CHECKBOX STATE ---
  const [showOtherPersons, setShowOtherPersons] = useState(false);

  const handleTimeChange = (type: 'in' | 'out', val: string) => {
    const newIn = type === 'in' ? val : checkInTime;
    const newOut = type === 'out' ? val : checkOutTime;
    if (type === 'in') setCheckInTime(val);
    else setCheckOutTime(val);

    const inDate = new Date(newIn);
    const outDate = new Date(newOut);
    if (!isNaN(inDate.getTime()) && !isNaN(outDate.getTime()) && outDate > inDate) {
      const diffTime = Math.abs(outDate.getTime() - inDate.getTime());
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      setDays(diffDays);
    }
  };

  // --- CALCULATION LOGIC ---
  let dailyRent = 0;
  booking.roomNos.forEach((rNo) => {
    const room = rooms.find((r) => r.roomNo === rNo);
    if (room) dailyRent += room.rent;
  });
  
  const originalRoomTotal = dailyRent * days;
  const netRoomTotal = Math.max(0, originalRoomTotal - booking.discount);
  const extrasTotal = booking.extras.reduce((sum, ex) => sum + ex.amt, 0);
  
  const rawGstInfo = (booking.gst_rate !== undefined && booking.total_gst !== undefined) ? {
    gstRate: booking.gst_rate,
    cgstRate: booking.gst_rate / 2,
    sgstRate: booking.gst_rate / 2,
    baseRent: netRoomTotal,
    cgstAmount: booking.cgst_amount || 0,
    sgstAmount: booking.sgst_amount || 0,
    totalGST: booking.total_gst || 0,
    grandTotal: booking.grand_total_with_gst || (netRoomTotal + (booking.total_gst || 0))
  } : calculateAccommodationGST(dailyRent, days, booking.discount, booking.roomNos.length);

  const gstInfo = enableGstInvoice ? rawGstInfo : {
    gstRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    baseRent: netRoomTotal,
    cgstAmount: 0,
    sgstAmount: 0,
    totalGST: 0,
    grandTotal: netRoomTotal
  };

  const totalAmount = gstInfo.grandTotal + extrasTotal;
  const totalAdvancePaid = booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || booking.advance;
  const remaining = totalAmount - totalAdvancePaid;

  const extrasLabel = booking.extras.length > 0 
    ? booking.extras.map(e => e.desc).join(' + ') 
    : 'Custom Charges';

  const handleAddAdvance = () => {
    if (newAdvance.amount <= 0) {
      alert('Please enter a valid advance amount.');
      return;
    }

    const receiptId = `ADV-${booking.billDate?.replace(/\//g, '') || new Date().toLocaleDateString().replace(/\//g, '')}-${booking.billNo}-${(booking.advancePayments?.length || 0) + 1}`;
    
    const payment: AdvancePayment = {
      receiptId,
      date: new Date().toISOString(),
      amount: newAdvance.amount,
      payMode: newAdvance.payMode,
      note: newAdvance.note || undefined,
    };

    addAdvancePayment(booking.id, payment);
    setNewAdvance({ amount: 0, payMode: 'Cash', note: '' });
    setShowAddAdvance(false);
  };

  const generateBillHTML = () => {
    return `
      <div style="width: 100%; max-width: 210mm; padding: 40px; font-family: Arial, sans-serif; font-size: 11pt; box-sizing: border-box; background: #fff;">
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body { margin: 0; padding: 0; background: white !important; }
          }
        </style>
        <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 30px;">
          <img src="${mauliLogo}" alt="Mauli Guest House" style="width: 120px; height: auto; margin: 0 auto 10px auto; display: block;" />
          <h1 style="font-size: 26pt; font-weight: bold; margin: 0; text-transform: uppercase;">Hotel Mauli Guest House</h1>
          <p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">Prop. J.R. Jaiswal</p>
          <p style="font-size: 11pt; margin: 2px 0 0 0; font-weight: bold;">Mobile: 9405694695</p>
          <p style="font-size: 11pt; margin: 2px 0 0 0; font-weight: bold;">Website: https://hotelmaulimahur.com/</p>
          <p style="font-size: 10pt; margin: 2px 0 0 0; color: #555;">T Point, Renuka Devi Road, Mahurgad, Dist. Nanded – 431721</p>
          ${(enableGstInvoice && showGstinFinal && gstEnabled) ? `<p style="font-size: 11pt; margin: 2px 0 0 0; font-weight: bold;">GSTIN: ${getHotelGSTIN()}</p>` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11pt; line-height: 1.6;">
          <div style="width: 55%;">
            <div><strong>Guest Name:</strong> ${booking.guestName || '-'}</div>
            ${booking.customerGstin && booking.customerGstin.trim() ? `<div><strong>GSTIN:</strong> ${booking.customerGstin.trim().toUpperCase()}</div>` : ''}
            <div><strong>Mobile:</strong> ${booking.mobile || '-'}</div>
            <div><strong>Address:</strong> ${booking.address}</div>
            ${booking.occupation ? `<div><strong>Occupation:</strong> ${booking.occupation}</div>` : ''}
            <div><strong>No. of Persons:</strong> ${booking.persons}</div>
            ${showOtherPersons && booking.otherPersons ? `
              <div style="margin-top: 5px; font-style: italic; font-size: 10pt;">
                <strong>Other Guests:</strong> ${booking.otherPersons}
              </div>
            ` : ''}
          </div>
          <div style="width: 40%; text-align: right;">
            <div><strong>Bill No:</strong> ${booking.billNo || booking.id.slice(-6)}</div>
            <div><strong>Date:</strong> ${formatDateDDMMYYYY(new Date(checkOutTime))}</div>
            <div><strong>Check-In:</strong> ${formatDateTimeDDMMYYYY(new Date(checkInTime))}</div>
            <div><strong>Check-Out:</strong> ${formatDateTimeDDMMYYYY(new Date(checkOutTime))}</div>
            <div><strong>Room No(s):</strong> ${booking.roomNos.join(', ')}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11pt;">
          <thead>
            <tr style="border-top: 2px solid black; border-bottom: 2px solid black;">
              <th style="text-align: left; padding: 10px 0;">Description</th>
              <th style="text-align: right; padding: 10px 0;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 0;">
                Room Rent (${booking.roomNos.map(r => `Room ${r}`).join(', ')}) - ${days} Night(s)
              </td>
              <td style="text-align: right; padding: 8px 0;">${originalRoomTotal.toFixed(2)}</td>
            </tr>
            ${(booking.discount > 0 && showDiscountOnInvoice) ? `
              <tr>
                <td style="padding: 8px 0; color: #d9534f;">
                  Discount (${discountReason})
                </td>
                <td style="text-align: right; padding: 8px 0; color: #d9534f;">
                  - ${booking.discount.toFixed(2)}
                </td>
              </tr>
            ` : ''}
            ${booking.extras.map((e) => `
              <tr>
                <td style="padding: 8px 0;">${e.desc}</td>
                <td style="text-align: right; padding: 8px 0;">${e.amt.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="width: 50%; margin-left: auto; font-size: 11pt; line-height: 1.8;">
          ${showBreakupFinal ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Base Room Rent:</span>
            <span>₹ ${(booking.discount > 0 && showDiscountOnInvoice) ? originalRoomTotal.toFixed(2) : gstInfo.baseRent.toFixed(2)}</span>
          </div>
          ${(booking.discount > 0 && showDiscountOnInvoice) ? `
          <div style="display: flex; justify-content: space-between; color: #d9534f;">
            <span>Discount (${discountReason}):</span>
            <span>(-) ₹ ${booking.discount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${extrasTotal > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>${extrasLabel}:</span>
            <span>+ ₹ ${extrasTotal.toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span>CGST (${gstInfo.cgstRate}%):</span>
            <span>₹ ${gstInfo.cgstAmount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>SGST (${gstInfo.sgstRate}%):</span>
            <span>₹ ${gstInfo.sgstAmount.toFixed(2)}</span>
          </div>
          <div style="border-top: 1px solid black; margin: 5px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Grand Total:</span>
            <span>₹ ${totalAmount.toFixed(2)}</span>
          </div>
          ` : `
          <div style="display: flex; justify-content: space-between;">
            <span>Room Charges:</span>
            <span>₹ ${(booking.discount > 0 && showDiscountOnInvoice) ? originalRoomTotal.toFixed(2) : netRoomTotal.toFixed(2)}</span>
          </div>
          ${(booking.discount > 0 && showDiscountOnInvoice) ? `
          <div style="display: flex; justify-content: space-between; color: #d9534f;">
            <span>Discount (${discountReason}):</span>
            <span>(-) ₹ ${booking.discount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${extrasTotal > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>${extrasLabel}:</span>
            <span>+ ₹ ${extrasTotal.toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="border-top: 1px solid black; margin: 5px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Total Amount:</span>
            <span>₹ ${totalAmount.toFixed(2)}</span>
          </div>
          `}
          <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Less: Advance Paid:</span>
              <span>(-) ₹ ${totalAdvancePaid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Remaining Paid:</span>
              <span>₹ ${remaining.toFixed(2)}</span>
            </div>
          </div>
          <div style="border-top: 2px solid black; margin-top: 8px; padding-top: 6px; display: flex; justify-content: space-between; font-size: 14pt; font-weight: bold;">
            <span>Final Total:</span>
            <span>₹ ${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-top: 60px; display: flex; justify-content: flex-end; font-size: 10pt; font-weight: bold;">
          <div style="text-align: center; border-top: 1px solid black; width: 150px; padding-top: 4px;">Manager Signature</div>
        </div>
        <div style="text-align: center; margin-top: 40px; font-size: 9pt; font-weight: 500;">
          THANK YOU FOR STAYING WITH US!
        </div>
      </div>
    `;
  };

  const printFinalBill = () => {
    // In reprint mode, only trigger print preview and close — NEVER mutate store, rooms, or sync queue
    if (mode === 'reprint') {
      const htmlContent = generateBillHTML();
      if ((window as any).electronAPI?.printPreview) {
        (window as any).electronAPI.printPreview(htmlContent);
      } else {
        const printArea = document.getElementById('printable-area');
        if (printArea) {
          printArea.innerHTML = htmlContent;
        } else {
          const newDiv = document.createElement('div');
          newDiv.id = 'printable-area';
          newDiv.style.display = 'none';
          document.body.appendChild(newDiv);
          newDiv.innerHTML = htmlContent;
        }
        window.print();
      }
      onClose();
      return;
    }

    if (remaining < 0) {
      alert('Error: Negative balance. Please check discount logic.');
      return;
    }
    if (!confirm(`Confirm payment of remaining ₹${remaining.toFixed(2)} and print final bill?`)) return;

    const validCheckOutDate = (checkOutTime && !isNaN(new Date(checkOutTime).getTime()))
      ? new Date(checkOutTime).toISOString()
      : new Date().toISOString();
    const validCheckInDate = (checkInTime && !isNaN(new Date(checkInTime).getTime()))
      ? new Date(checkInTime).toISOString()
      : new Date().toISOString();

    const historyRecord = {
      ...booking,
      checkIn: validCheckInDate,
      checkoutDate: validCheckOutDate,
      days: days,
      finalAmount: totalAmount,
      totalPaid: totalAmount,
      otherPersons: booking.otherPersons, // Ensure this is saved
      enableGstInvoice,
      showDiscountOnInvoice,
      discountReason,
      gst_rate: gstInfo.gstRate,
      cgst_amount: gstInfo.cgstAmount,
      sgst_amount: gstInfo.sgstAmount,
      total_gst: gstInfo.totalGST,
      grand_total_with_gst: totalAmount,
      invoiceHtml: generateBillHTML(),
    };

    addHistory(historyRecord);

    // Sync: push completed booking to cloud
    pushHistoryToCloud(historyRecord);

    booking.roomNos.forEach((r) => {
      setRoomStatus(r, 'cleaning');
      // Sync: push room status to cloud
      pushRoomStatusToCloud(r, 'cleaning');
    });
    removeBooking(booking.id);
    // Note: we don't deleteBookingFromCloud here because pushHistoryToCloud
    // already upserts the same local_id as COMPLETED, updating the existing row.

    // Print Logic
    const htmlContent = generateBillHTML();
    if ((window as any).electronAPI?.printPreview) {
      (window as any).electronAPI.printPreview(htmlContent);
    } else {
      const printArea = document.getElementById('printable-area');
      if (printArea) {
        printArea.innerHTML = htmlContent;
      } else {
         const newDiv = document.createElement('div');
         newDiv.id = 'printable-area';
         newDiv.style.display = 'none';
         document.body.appendChild(newDiv);
         newDiv.innerHTML = htmlContent;
      }
      window.print();
    }
    onClose();
    setSection('dashboard');
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-screen animate-scale-in">
        
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">{mode === 'reprint' ? 'Reprint Bill / Invoice' : 'Checkout & Billing'}</h3>
          <button onClick={onClose} className="hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Summary Box */}
          <div className="mb-6 p-4 bg-secondary/50 rounded border border-border text-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <p><strong>Guest:</strong> {booking.guestName}</p>
              <p><strong>Bill No:</strong> {booking.billNo || booking.id.slice(-6)}</p>
              <p><strong>Rooms:</strong> {booking.roomNos.join(', ')}</p>
              <div className="flex items-center gap-2">
                <strong>Stay Duration (Days):</strong>
                <input 
                  type="number" 
                  min="1" 
                  value={days} 
                  onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-0.5 border rounded bg-card text-foreground font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Check-In Time:</label>
                <input 
                  type="datetime-local" 
                  value={checkInTime} 
                  onChange={(e) => handleTimeChange('in', e.target.value)}
                  className="w-full px-2 py-1 border rounded bg-card text-foreground"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Check-Out Time:</label>
                <input 
                  type="datetime-local" 
                  value={checkOutTime} 
                  onChange={(e) => handleTimeChange('out', e.target.value)}
                  className="w-full px-2 py-1 border rounded bg-card text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Advance Payments List */}
          {(booking.advancePayments?.length || 0) > 0 && (
            <div className="mb-6 p-4 bg-status-available/10 rounded border border-status-available/30">
              <h4 className="font-bold text-sm mb-3">Advance Payment Details</h4>
              <div className="space-y-2 text-sm">
                {booking.advancePayments?.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-card rounded">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{p.receiptId}</span>
                      <p className="text-xs">{new Date(p.date).toLocaleDateString()} • {p.payMode}{p.note ? ` (${p.note})` : ''}</p>
                    </div>
                    <span className="font-mono font-bold text-status-available">₹{p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Advance Button (Only in Checkout mode) */}
          {mode !== 'reprint' && (!showAddAdvance ? (
            <button onClick={() => setShowAddAdvance(true)} className="mb-4 flex items-center gap-2 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Add More Advance Payment
            </button>
          ) : (
            <div className="mb-4 p-4 border border-primary/30 rounded bg-primary/5">
              <h4 className="font-bold text-sm mb-3">Add Advance Payment</h4>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="Amount" value={newAdvance.amount || ''} onChange={(e) => setNewAdvance({ ...newAdvance, amount: parseFloat(e.target.value) || 0 })} className="px-3 py-2 border rounded text-sm" />
                <select value={newAdvance.payMode} onChange={(e) => setNewAdvance({ ...newAdvance, payMode: e.target.value as any })} className="px-3 py-2 border rounded text-sm">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
                <input type="text" placeholder="Note" value={newAdvance.note} onChange={(e) => setNewAdvance({ ...newAdvance, note: e.target.value })} className="px-3 py-2 border rounded text-sm" />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleAddAdvance} className="px-4 py-2 bg-status-available text-white rounded text-sm font-bold hover:opacity-90">Save Advance</button>
                <button onClick={() => setShowAddAdvance(false)} className="px-4 py-2 bg-secondary rounded text-sm hover:bg-secondary/80">Cancel</button>
              </div>
            </div>
          ))}

          {/* Calculations */}
          <div className="border-t pt-4 space-y-1.5 text-sm">
            {showBreakupFinal ? (
              <>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Base Room Rent:</span>
                  <span className="font-mono">₹ {(booking.discount > 0 && showDiscountOnInvoice) ? originalRoomTotal.toFixed(2) : gstInfo.baseRent.toFixed(2)}</span>
                </div>
                {(booking.discount > 0 && showDiscountOnInvoice) && (
                  <div className="flex justify-between items-center text-destructive font-medium">
                    <span>Discount ({discountReason}):</span>
                    <span className="font-mono">(-) ₹ {booking.discount.toFixed(2)}</span>
                  </div>
                )}
                {extrasTotal > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{extrasLabel}:</span>
                    <span className="font-mono">+ ₹ {extrasTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>CGST ({gstInfo.cgstRate}%):</span>
                  <span className="font-mono">₹ {gstInfo.cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>SGST ({gstInfo.sgstRate}%):</span>
                  <span className="font-mono">₹ {gstInfo.sgstAmount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Room Charges:</span>
                  <span className="font-mono">₹ {(booking.discount > 0 && showDiscountOnInvoice) ? originalRoomTotal.toFixed(2) : netRoomTotal.toFixed(2)}</span>
                </div>
                {(booking.discount > 0 && showDiscountOnInvoice) && (
                  <div className="flex justify-between items-center text-destructive font-medium">
                    <span>Discount ({discountReason}):</span>
                    <span className="font-mono">(-) ₹ {booking.discount.toFixed(2)}</span>
                  </div>
                )}
                {extrasTotal > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{extrasLabel}:</span>
                    <span className="font-mono">+ ₹ {extrasTotal.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between items-center font-semibold text-foreground pt-1 border-t">
              <span>Grand Total:</span>
              <span className="font-mono">₹ {totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-status-available">
              <span>Total Advance Paid:</span>
              <span className="font-mono">(-) ₹ {totalAdvancePaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-bold text-xl text-foreground">Remaining Payable:</span>
              <span className="font-mono font-bold text-xl text-primary">₹ {remaining.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-secondary/50 border-t flex flex-col gap-3">
          
          {/* Invoice & Discount Options */}
          <div className="p-3 bg-card border border-border rounded space-y-2 text-sm">
            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Invoice & Display Options</h4>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={enableGstInvoice} 
                  onChange={(e) => setEnableGstInvoice(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                Enable GST Invoice
              </label>

              {booking.discount > 0 && (
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showDiscountOnInvoice} 
                    onChange={(e) => setShowDiscountOnInvoice(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  Show Discount on Bill
                </label>
              )}

              {booking.otherPersons && (
                <label className="flex items-center gap-2 font-semibold cursor-pointer text-amber-700">
                  <input 
                    type="checkbox" 
                    checked={showOtherPersons} 
                    onChange={(e) => setShowOtherPersons(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600"
                  />
                  Print Other Guests ({booking.otherPersons})
                </label>
              )}
            </div>

            {booking.discount > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground font-medium">Discount Reason:</span>
                <select 
                  value={discountReason} 
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="px-2 py-1 border rounded bg-card text-xs font-medium"
                >
                  <option value="Normal Discount">Normal Discount</option>
                  <option value="AC to Non AC Conversion">AC to Non AC Conversion</option>
                  <option value="Corporate Discount">Corporate Discount</option>
                  <option value="Long Stay Discount">Long Stay Discount</option>
                  <option value="Staff Discount">Staff Discount</option>
                  <option value="Custom / Other">Custom / Other</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 bg-card border border-border rounded hover:bg-secondary font-medium text-sm">Close</button>
             <button onClick={printFinalBill} className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-bold shadow-lg flex items-center gap-2">
               <Printer className="w-4 h-4" /> {mode === 'reprint' ? 'Print Bill' : 'Confirm & Print'}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BillingModal;