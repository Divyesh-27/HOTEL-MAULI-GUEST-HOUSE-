import React, { useState, FormEvent, useRef, useMemo } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Booking, AdvancePayment } from '@/types';
import { generateUUID } from '@/lib/uuid';
import { pushMobileBookingToCloud, uploadBase64ToStorage } from '@/mobile/lib/mobileSyncActions';
import { createRoomHold, releaseRoomHold } from '@/lib/supabaseBridge';
import { getAvailableRoomsForPeriod } from '@/utils/availabilityUtils';
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

// UI Components
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mobile Components
import CameraCaptureUpload from '@/mobile/components/CameraCaptureUpload';
import SignaturePad, { SignaturePadRef } from '@/mobile/components/SignaturePad';
import RoomPicker from '@/mobile/components/RoomPicker';
import AutocompleteTextField from '@/mobile/components/AutocompleteTextField';

const RegistrationMobile: React.FC = () => {
  const rooms = useMobileStore((s) => s.rooms);
  const bookings = useMobileStore((s) => s.bookings);
  const roomStatus = useMobileStore((s) => s.roomStatus);
  const addBooking = useMobileStore((s) => s.addBooking);
  const setSection = useMobileStore((s) => s.setSection);
  const roomHolds = useMobileStore((s) => s.roomHolds);

  const DEVICE_ID = useMemo(() => 'mobile-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)), []);

  const [step, setStep] = useState(1);
  const sigPadRef = useRef<SignaturePadRef>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    guestName: '', mobile: '', address: '', persons: '', otherPersons: '', age: '',
    coming: '', going: '', checkIn: '', days: 1, advance: 0, discount: 0,
    discountNote: '', extraNote: '', extraAmt: 0, payMode: 'Cash', advancePayMode: 'Cash' as any,
    advanceNote: '', isReservation: false, occupation: '', identityProofType: 'Aadhar Card', carNo: '', carModel: '',
    identityProof: '', digitalSignature: '',
  });

  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

  // Get available rooms for selected date and duration
  const availableRooms = useMemo(() => {
    return getAvailableRoomsForPeriod(
      rooms,
      bookings,
      roomStatus,
      formData.checkIn || new Date(),
      formData.days || 1
    );
  }, [rooms, bookings, roomStatus, formData.checkIn, formData.days]);

  // Derived options for autocomplete
  const comingFromOptions = useMemo(() => {
    const opts = new Set<string>();
    bookings.forEach(b => { if (b.coming) opts.add(b.coming); });
    return Array.from(opts);
  }, [bookings]);

  const goingToOptions = useMemo(() => {
    const opts = new Set<string>();
    bookings.forEach(b => { if (b.going) opts.add(b.going); });
    return Array.from(opts);
  }, [bookings]);

  const heldRoomNos = useMemo(() => {
    const now = new Date();
    return roomHolds
      .filter(h => h.status === 'active' && h.device_id !== DEVICE_ID && now < new Date(h.expires_at))
      .map(h => h.room_no);
  }, [roomHolds, DEVICE_ID]);

  const toggleRoom = (roomNo: string) => {
    if (heldRoomNos.includes(roomNo)) return;

    if (selectedRooms.includes(roomNo)) {
      setSelectedRooms(prev => prev.filter(r => r !== roomNo));
      releaseRoomHold(roomNo, DEVICE_ID);
    } else {
      setSelectedRooms(prev => [...prev, roomNo]);
      createRoomHold(roomNo, DEVICE_ID);
    }
  };

  React.useEffect(() => {
    return () => {
      selectedRooms.forEach(r => releaseRoomHold(r, DEVICE_ID));
    };
  }, [selectedRooms, DEVICE_ID]);

  const getNextBillNumber = () => {
    // Generate a simple bill number for offline mobile. 
    // Usually, desktop is master of bill numbers, but if mobile creates one, we use a mobile prefix.
    const date = new Date();
    // Desktop is master of bill numbers. Use a random high number for mobile offline creation.
    const random = Math.floor(Math.random() * 90000) + 900000;
    return { billNo: random, billDate: date.toLocaleDateString('en-IN') };
  };

  const handleSaveAndSync = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedRooms.length === 0) {
      alert('Select at least one room!');
      return;
    }

    setLoading(true);

    try {
      let signatureData = formData.digitalSignature;
      if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
         signatureData = sigPadRef.current.toDataURL();
      }

      const extras = [];
      if (formData.extraNote && formData.extraAmt > 0) {
        extras.push({ desc: formData.extraNote, amt: formData.extraAmt });
      }

      const { billNo, billDate } = getNextBillNumber();

      const advancePayments: AdvancePayment[] = [];
      if (formData.advance > 0) {
        advancePayments.push({
          receiptId: `ADV-${billDate.replace(/\//g, '')}-${billNo}-1`,
          date: new Date().toISOString(),
          amount: formData.advance,
          payMode: formData.advancePayMode,
          note: formData.advanceNote || undefined,
        });
      }

      const bookingId = generateUUID();
      
      let identityProofUrl = undefined;
      let digitalSignatureUrl = undefined;

      // Upload ID proof if captured
      if (formData.identityProof) {
        identityProofUrl = await uploadBase64ToStorage('identity-proofs', `${bookingId}/proof.jpg`, formData.identityProof) || undefined;
      }
      
      // Upload signature if drawn
      if (signatureData) {
        digitalSignatureUrl = await uploadBase64ToStorage('digital-signatures', `${bookingId}/signature.png`, signatureData) || undefined;
      }

      const booking: Booking = {
        id: bookingId,
        billNo, billDate, guestName: formData.guestName, mobile: formData.mobile,
        address: formData.address, persons: formData.persons, otherPersons: formData.otherPersons,
        age: formData.age, coming: formData.coming, going: formData.going,
        checkIn: formData.checkIn || new Date().toISOString().slice(0, 16),
        days: formData.days, roomNos: selectedRooms,
        advance: formData.advance, advancePayments, payMode: formData.payMode,
        extras, discount: formData.discount, isReservation: formData.isReservation,
        occupation: formData.occupation, identityProofType: formData.identityProofType, 
        carNo: formData.carNo, carModel: formData.carModel,
        discountNote: formData.discountNote, identityProof: formData.identityProof,
        identityProofUrl, digitalSignature: signatureData, digitalSignatureUrl,
        updated_at: new Date().toISOString(),
        version: 1,
        source: 'mobile',
      };

      // 1. Save locally to mobile store
      addBooking(booking);
      
      // 2. Sync to Supabase directly
      await pushMobileBookingToCloud(booking);
      
      // Release all holds
      selectedRooms.forEach(r => releaseRoomHold(r, DEVICE_ID));
      
      alert(formData.isReservation ? 'Reservation saved successfully!' : 'Check-in successful!');
      setSection('dashboard');
    } catch (error: any) {
      alert(`Error saving booking: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSaveAndSync} className="flex flex-col space-y-4 pb-8 animate-fade-in h-full">
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-foreground tracking-tight">
          {formData.isReservation ? 'New Reservation' : 'New Check-In'}
        </h2>
        
        {/* Toggle switch for Reservation */}
        <label className="flex items-center gap-2 cursor-pointer bg-secondary/50 px-3 py-1.5 rounded-full">
          <input 
            type="checkbox" 
            checked={formData.isReservation} 
            onChange={e => setFormData({...formData, isReservation: e.target.checked})} 
            className="w-4 h-4 rounded border-muted-foreground accent-primary" 
          />
          <span className="font-bold text-xs">Reserve</span>
        </label>
      </div>

      {/* Steps Progress */}
      <div className="flex items-center justify-between px-2 mb-2 bg-card border border-border rounded-xl py-3 shadow-sm">
        {[
          { num: 1, label: 'Guest' },
          { num: 2, label: 'Stay' },
          { num: 3, label: 'Payment' }
        ].map(s => (
          <div key={s.num} className="flex flex-col items-center flex-1 relative">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-1 z-10 transition-colors shadow-sm", 
              step >= s.num ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}>
              {s.num}
            </div>
            <span className={cn(
              "text-[10px] uppercase font-bold transition-colors", 
              step >= s.num ? "text-primary" : "text-muted-foreground"
            )}>
              {s.label}
            </span>
            {s.num < 3 && (
              <div className={cn(
                "absolute top-4 left-1/2 w-full h-[2px] -z-0 transition-colors",
                step > s.num ? "bg-primary" : "bg-secondary"
              )} />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-4 no-scrollbar">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Guest Name *</Label>
              <Input 
                type="text" 
                required 
                value={formData.guestName} 
                onChange={e => setFormData({...formData, guestName: e.target.value})} 
                placeholder="Full Name" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Mobile *</Label>
                <Input 
                  type="tel" 
                  required 
                  value={formData.mobile} 
                  onChange={e => setFormData({...formData, mobile: e.target.value})} 
                  placeholder="10-digit number" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Identity Proof</Label>
                <select 
                  value={formData.identityProofType} 
                  onChange={e => setFormData({...formData, identityProofType: e.target.value})} 
                  className="m-input bg-card shadow-sm"
                >
                  <option>Aadhar Card</option>
                  <option>PAN Card</option>
                  <option>Driving License</option>
                  <option>Passport</option>
                  <option>Voter ID</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address *</Label>
              <textarea 
                required 
                rows={2} 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[80px]" 
                placeholder="Full Address" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Total Persons *</Label>
                <Input 
                  type="number" 
                  required 
                  min="1"
                  value={formData.persons} 
                  onChange={e => setFormData({...formData, persons: e.target.value})} 
                  placeholder="Count" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Age</Label>
                <Input 
                  type="number" 
                  value={formData.age} 
                  onChange={e => setFormData({...formData, age: e.target.value})} 
                  placeholder="Age" 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label>Other Person Names</Label>
              <Input 
                type="text" 
                value={formData.otherPersons} 
                onChange={e => setFormData({...formData, otherPersons: e.target.value})} 
                placeholder="e.g. Ramesh, Suresh" 
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <AutocompleteTextField
                label="Coming From"
                value={formData.coming}
                onChange={(v) => setFormData({...formData, coming: v})}
                options={comingFromOptions}
              />
              <AutocompleteTextField
                label="Going To"
                value={formData.going}
                onChange={(v) => setFormData({...formData, going: v})}
                options={goingToOptions}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Check-In *</Label>
                <Input 
                  type="datetime-local" 
                  required 
                  value={formData.checkIn} 
                  onChange={e => setFormData({...formData, checkIn: e.target.value})} 
                  className="text-xs" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Days</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={formData.days} 
                  onChange={e => setFormData({...formData, days: parseInt(e.target.value)||1})} 
                />
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center mb-3">
                <Label className="mb-0">Select Rooms *</Label>
                <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {selectedRooms.length} Selected
                </span>
              </div>
              
              <RoomPicker 
                availableRooms={availableRooms} 
                selectedRoomNos={selectedRooms} 
                onToggleRoom={toggleRoom}
                heldRoomNos={heldRoomNos}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/20 rounded-xl border border-border shadow-sm">
               <div className="space-y-1.5">
                <Label>Car No</Label>
                <Input 
                  type="text" 
                  value={formData.carNo} 
                  onChange={e => setFormData({...formData, carNo: e.target.value})} 
                  className="uppercase m-input-compact" 
                  placeholder="MH-01-AB-1234"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Car Model</Label>
                <Input 
                  type="text" 
                  value={formData.carModel} 
                  onChange={e => setFormData({...formData, carModel: e.target.value})} 
                  className="m-input-compact" 
                  placeholder="Swift"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-primary font-bold">Advance Paid (₹)</Label>
                <Input 
                  type="number" 
                  value={formData.advance} 
                  onChange={e => setFormData({...formData, advance: parseFloat(e.target.value)||0})} 
                  className="font-black text-primary text-lg" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pay Mode</Label>
                <select 
                  value={formData.advancePayMode} 
                  onChange={e => setFormData({...formData, advancePayMode: e.target.value as any})} 
                  className="m-input bg-card shadow-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>
            </div>

            <CameraCaptureUpload
              label="Identity Proof Photo"
              imageUri={formData.identityProof}
              onCapture={(uri) => setFormData({...formData, identityProof: uri})}
              onClear={() => setFormData({...formData, identityProof: ''})}
            />

            <SignaturePad
              ref={sigPadRef}
              label="Guest Signature"
              onClear={() => setFormData({...formData, digitalSignature: ''})}
            />
          </div>
        )}
      </div>

      {/* Nav Buttons (Fixed at bottom) */}
      <div className="flex gap-3 pt-2 mt-auto bg-background">
        {step > 1 && (
          <button 
            type="button" 
            onClick={() => setStep(step - 1)} 
            className="h-12 w-14 flex items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95 transition-transform shrink-0 shadow-sm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        
        {step < 3 ? (
          <button 
            type="button" 
            onClick={() => setStep(step + 1)} 
            className="h-12 flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-black shadow-sm active:scale-[0.98] transition-transform"
          >
            Next Step <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            type="submit" 
            disabled={loading}
            className="h-12 flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 text-white font-black shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'Saving...' : (
              <>
                <Save className="w-5 h-5" /> {formData.isReservation ? 'Save Reservation' : 'Complete Check-In'}
              </>
            )}
          </button>
        )}
      </div>
    </form>
  );
};

export default RegistrationMobile;
