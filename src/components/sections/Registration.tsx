import { useState, FormEvent, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useStore } from '@/store/useStore';
import { Booking, AdvancePayment, DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES } from '@/types';
import { cn } from '@/lib/utils';
import { getAvailableRoomsForPeriod } from '@/utils/availabilityUtils';
import { printAdvanceReceipt } from '@/utils/printAdvanceReceipt';
import ImageCapture from '@/components/ui/ImageCapture'; 
import { generateUUID } from '@/lib/uuid';
import { pushBookingToCloud, uploadBase64ToStorage } from '@/lib/syncActions';
import { createRoomHold, releaseRoomHold } from '@/lib/supabaseBridge';
import { toLocalDateTimeString } from '@/utils/dateUtils';

import { useShallow } from 'zustand/react/shallow';

const DEVICE_ID = 'desktop-main';

const Registration = () => {
  const { 
    rooms, bookings, roomStatus, addBooking, setSection, getNextBillNumber, isDeveloperMode,
    prefilledRegistration, setPrefilledRegistration, invoiceSettings, roomHolds
  } = useStore(useShallow(state => ({
    rooms: state.rooms,
    bookings: state.bookings,
    roomStatus: state.roomStatus,
    addBooking: state.addBooking,
    setSection: state.setSection,
    getNextBillNumber: state.getNextBillNumber,
    isDeveloperMode: state.isDeveloperMode,
    prefilledRegistration: state.prefilledRegistration,
    setPrefilledRegistration: state.setPrefilledRegistration,
    invoiceSettings: state.invoiceSettings,
    roomHolds: state.roomHolds
  })));
  const sigPadRef = useRef<any>(null);
  
  const [formData, setFormData] = useState({
    guestName: '',
    customerGstin: '',
    mobile: '',
    address: '',
    persons: '',
    otherPersons: '', // <--- NEW FIELD
    age: '',
    coming: '',
    going: '',
    checkIn: toLocalDateTimeString(new Date()),
    days: 1,
    advance: 0,
    discount: 0,
    discountNote: '',
    discountReason: 'Normal Discount',
    showDiscountOnInvoice: true,
    extraNote: '',
    extraAmt: 0,
    payMode: 'Cash',
    advancePayMode: 'Cash' as 'Cash' | 'UPI' | 'Card' | 'Other',
    advanceNote: '',
    isReservation: false,
    occupation: '',
    identityProofType: '',
    carNo: '',
    carModel: '',
    identityProof: '',
    digitalSignature: '',
  });
  
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [occSearch, setOccSearch] = useState('');
  const [occDropdownOpen, setOccDropdownOpen] = useState(false);
  const [idProofSearch, setIdProofSearch] = useState('');
  const [idProofDropdownOpen, setIdProofDropdownOpen] = useState(false);
  const PREDEFINED_OCCUPATIONS = [
    'Business',
    'Job / Service',
    'Agriculture',
    'Freelancer',
    'Self Employed',
    'Student',
    'Homemaker',
    'Retired',
    'Unemployed',
    'Other'
  ];

  const PREDEFINED_ID_PROOFS = [
    'Aadhaar Card',
    'Driving Licence',
    'PAN Card',
    'Election Card (Voter ID)',
    'Passport'
  ];

  const [extraChargeType, setExtraChargeType] = useState<'Extra Bed' | 'Custom'>('Extra Bed');

  // Handle prefilled registration data from GuestDetailsModal ("New Booking (Same Guest)")
  useEffect(() => {
    if (prefilledRegistration) {
      setFormData(prev => ({
        ...prev,
        guestName: prefilledRegistration.guestName || '',
        customerGstin: prefilledRegistration.customerGstin || '',
        mobile: prefilledRegistration.mobile || '',
        occupation: prefilledRegistration.occupation || '',
        address: prefilledRegistration.address || '',
        identityProofType: prefilledRegistration.identityProofType || '',
        carNo: prefilledRegistration.carNo || '',
        carModel: prefilledRegistration.carModel || '',
        coming: prefilledRegistration.coming || '',
        // Explicitly ensuring stay-specific fields start fresh/empty
        persons: '',
        otherPersons: '',
        age: '',
        going: '',
        checkIn: prefilledRegistration.checkIn ? toLocalDateTimeString(prefilledRegistration.checkIn) : toLocalDateTimeString(new Date()),
        days: 1,
        advance: 0,
        discount: 0,
        extraNote: '',
        extraAmt: 0,
        identityProof: '',
        digitalSignature: '',
      }));
      setSelectedRooms([]);
      if (prefilledRegistration.occupation) {
        setOccSearch(prefilledRegistration.occupation);
      }
      if (prefilledRegistration.identityProofType) {
        setIdProofSearch(prefilledRegistration.identityProofType);
      }
      setPrefilledRegistration(null);
    }
  }, [prefilledRegistration, setPrefilledRegistration]);

  // Get available rooms using exact overlap detection for requested check-in and duration
  const availableRooms = getAvailableRoomsForPeriod(
    rooms,
    bookings,
    roomStatus,
    formData.checkIn || new Date(),
    formData.days || 1
  );

  const isRoomHeld = (roomNo: string) => {
    const hold = roomHolds.find(h => h.room_no === roomNo && h.status === 'active');
    if (!hold) return false;
    if (hold.device_id === DEVICE_ID) return false; // Held by us
    return new Date() < new Date(hold.expires_at); // Held by someone else and not expired
  };

  const toggleRoom = async (roomNo: string) => {
    if (isRoomHeld(roomNo)) return;

    if (selectedRooms.includes(roomNo)) {
      setSelectedRooms(prev => prev.filter(r => r !== roomNo));
      releaseRoomHold(roomNo, DEVICE_ID);
    } else {
      setSelectedRooms(prev => [...prev, roomNo]);
      createRoomHold(roomNo, DEVICE_ID);
    }
  };

  // Clean up holds on unmount
  useEffect(() => {
    return () => {
      selectedRooms.forEach(r => releaseRoomHold(r, DEVICE_ID));
    };
  }, [selectedRooms]);

  const getTotalRate = () => {
    return selectedRooms.reduce((sum, rNo) => {
      const room = rooms.find(r => r.roomNo === rNo);
      return sum + (room?.rent || 0);
    }, 0);
  };

  const handleClearSignature = () => {
    sigPadRef.current?.clear();
    setFormData(prev => ({ ...prev, digitalSignature: '' }));
  };

  const handleSaveAndPrint = async (e: FormEvent) => {
    e.preventDefault();
    
    if (selectedRooms.length === 0) {
      alert('Select at least one room!');
      return;
    }

    const trimmedGuestName = formData.guestName.trim();
    if (!trimmedGuestName) {
      alert('Please enter a valid guest name.');
      return;
    }

    const trimmedMobile = formData.mobile.trim();
    if (trimmedMobile) {
      const activeBooking = bookings.find(b => b.mobile && b.mobile.trim() === trimmedMobile);
      if (activeBooking) {
        const existingRooms = activeBooking.roomNos ? activeBooking.roomNos.join(', ') : 'another room';
        if (!confirm(`This guest is already checked into Room ${existingRooms} — continue anyway?`)) {
          return;
        }
      }
    }

    // Capture Signature
    let signatureData = formData.digitalSignature;
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
       signatureData = sigPadRef.current.toDataURL();
    }

    const extras = [];
    if (formData.extraNote && formData.extraAmt > 0) {
      extras.push({ desc: formData.extraNote, amt: formData.extraAmt });
    }

    // Get day-wise bill number
    const { billNo, billDate } = getNextBillNumber();

    // Create advance payments array
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
    
    // Upload files to Supabase Storage if they exist
    let identityProofUrl = undefined;
    let digitalSignatureUrl = undefined;

    if (formData.identityProof) {
      identityProofUrl = await uploadBase64ToStorage('identity-proofs', `${bookingId}/proof.jpg`, formData.identityProof) || undefined;
    }
    
    if (signatureData) {
      digitalSignatureUrl = await uploadBase64ToStorage('digital-signatures', `${bookingId}/signature.png`, signatureData) || undefined;
    }

    const trimmedGstin = (formData.customerGstin || '').trim().toUpperCase();

    const booking: Booking = {
      id: bookingId,
      billNo,
      billDate,
      guestName: trimmedGuestName,
      customerGstin: trimmedGstin || undefined,
      mobile: trimmedMobile,
      address: formData.address,
      persons: formData.persons,
      otherPersons: formData.otherPersons, // <--- SAVE NEW FIELD
      age: formData.age,
      coming: formData.coming,
      going: formData.going,
      checkIn: formData.checkIn,
      days: formData.days,
      roomNos: selectedRooms,
      advance: formData.advance,
      advancePayments,
      payMode: formData.payMode,
      extras,
      discount: formData.discount,
      discountReason: formData.discountReason,
      showDiscountOnInvoice: formData.showDiscountOnInvoice,
      isReservation: formData.isReservation,
      
      occupation: formData.occupation,
      identityProofType: formData.identityProofType,
      carNo: formData.carNo,
      carModel: formData.carModel,
      discountNote: formData.discountNote,
      identityProof: formData.identityProof, // Keep base64 locally
      identityProofUrl, // Remote URL
      digitalSignature: signatureData, // Keep base64 locally
      digitalSignatureUrl, // Remote URL
      updated_at: new Date().toISOString(),
      version: 1,
      source: 'desktop',
    };

    addBooking(booking);
    
    // Immediately push to cloud
    pushBookingToCloud(booking);
    
    // Release all holds
    selectedRooms.forEach(r => releaseRoomHold(r, DEVICE_ID));
    
    // Print Advance Receipt (RESTORED CALL)
    if (formData.advance > 0 && advancePayments.length > 0) {
      const roomTotal = getTotalRate() * formData.days;
      
      printAdvanceReceipt({
        guestName: trimmedGuestName,
        mobile: trimmedMobile,
        roomNos: selectedRooms,
        persons: formData.persons,
        checkIn: formData.checkIn,
        roomTotal: roomTotal, // Added
        advancePayment: advancePayments[0],
        totalAdvancePaid: formData.advance // Added
      });
    }
    
    alert(formData.isReservation ? 'Reservation Created Successfully!' : 'Guest Check-In Successful!');
    
    resetForm();
    setSection('dashboard');
  };

  const resetForm = () => {
    setFormData({
      guestName: '',
      customerGstin: '',
      mobile: '',
      address: '',
      persons: '',
      otherPersons: '', // <--- RESET NEW FIELD
      age: '',
      coming: '',
      going: '',
      checkIn: toLocalDateTimeString(new Date()),
      days: 1,
      advance: 0,
      discount: 0,
      discountNote: '',
      discountReason: 'Normal Discount',
      showDiscountOnInvoice: true,
      extraNote: '',
      extraAmt: 0,
      payMode: 'Cash',
      advancePayMode: 'Cash',
      advanceNote: '',
      isReservation: false,
      occupation: '',
      identityProofType: '',
      carNo: '',
      carModel: '',
      identityProof: '',
      digitalSignature: '',
    });
    setSelectedRooms([]);
    sigPadRef.current?.clear();
    setOccSearch('');
    setOccDropdownOpen(false);
    setIdProofSearch('');
    setIdProofDropdownOpen(false);
    setExtraChargeType('Extra Bed');
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLElement) {
      if (e.target.tagName === 'TEXTAREA' && e.shiftKey) {
        return;
      }
      if (e.target.getAttribute('role') === 'option' || e.target.closest('.occupation-dropdown-menu') || e.target.closest('.idproof-dropdown-menu')) {
        return;
      }
      e.preventDefault();

      const sequence = [
        'reg-field-guestName',
        'reg-field-customerGstin',
        'reg-field-coming',
        'reg-field-going',
        'reg-field-mobile',
        'reg-field-occupation',
        'reg-field-checkIn',
        'reg-field-days',
        'reg-field-address',
        'reg-field-persons',
        'reg-field-otherPersons',
        'reg-field-age',
        'reg-field-idProofType',
        'reg-field-carNo',
        'reg-field-carModel',
        'reg-field-idProof',
        'reg-field-advance',
        'reg-field-advancePayMode',
        'reg-field-advanceNote',
        'reg-field-discount',
        'reg-field-submitBtn'
      ];

      const currentId = e.target.id;
      const currentIndex = sequence.indexOf(currentId);
      
      if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
        const nextId = sequence[currentIndex + 1];
        const nextElement = document.getElementById(nextId);
        if (nextElement) {
          nextElement.focus();
          
          if (nextId === 'reg-field-occupation') {
            setOccDropdownOpen(true);
          } else if (nextId === 'reg-field-idProofType') {
            setIdProofDropdownOpen(true);
          } else if (nextElement.tagName === 'SELECT' || nextElement.getAttribute('type') === 'datetime-local') {
            try {
              if ('showPicker' in nextElement && typeof (nextElement as HTMLInputElement | HTMLSelectElement).showPicker === 'function') {
                (nextElement as HTMLInputElement | HTMLSelectElement).showPicker();
              }
            } catch (_err) {
              // Ignore unsupported showPicker
            }
          } else if (nextElement.tagName === 'INPUT') {
            (nextElement as HTMLInputElement).select?.();
          }
        }
      } else if (currentId === 'reg-field-submitBtn' || currentIndex === sequence.length - 1) {
        const submitBtn = document.getElementById('reg-field-submitBtn') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.click();
        }
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-card rounded-xl shadow-sm border border-border animate-fade-in">
      <div className="p-6 border-b border-border bg-secondary/50 flex justify-between items-center">
        <h3 className="font-bold text-lg text-foreground">New Guest Registration</h3>
        {isDeveloperMode && (
          <button
            type="button"
            onClick={() => {
              setFormData({
                guestName: 'John Doe',
                customerGstin: '27AAAAA0000A1Z5',
                mobile: '9876543210',
                address: '123 Fake Street, Dummy City',
                persons: '2',
                otherPersons: 'Jane Doe',
                age: '30',
                coming: 'Mumbai',
                going: 'Pune',
                checkIn: new Date().toISOString().slice(0, 16),
                days: 2,
                advance: 1000,
                discount: 0,
                discountNote: '',
                discountReason: 'Normal Discount',
                showDiscountOnInvoice: true,
                extraNote: '',
                extraAmt: 0,
                payMode: 'Cash',
                advancePayMode: 'Cash',
                advanceNote: '',
                isReservation: false,
                occupation: 'Business',
                identityProofType: 'Aadhaar Card',
                carNo: 'MH-12-AB-1234',
                carModel: 'Swift',
                identityProof: '',
                digitalSignature: '',
              });
            }}
            className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-xs font-bold hover:bg-destructive/20 transition-colors"
          >
            Fill Dummy Data (Dev Mode)
          </button>
        )}
      </div>
      
      <form onSubmit={handleSaveAndPrint} onKeyDown={handleFormKeyDown} className="p-8">
        {/* Reservation Toggle */}
        <div className="mb-6 p-4 bg-secondary/30 rounded-lg border border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isReservation}
              onChange={(e) => setFormData({ ...formData, isReservation: e.target.checked })}
              className="w-5 h-5 rounded border-muted-foreground"
            />
            <span className="font-bold text-foreground">Make Reservation (Future Date)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* Column 1: Personal Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Guest Full Name *</label>
                <input
                  id="reg-field-guestName"
                  type="text"
                  required
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">
                  Customer GSTIN <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </label>
                <input
                  id="reg-field-customerGstin"
                  type="text"
                  maxLength={15}
                  value={formData.customerGstin}
                  onChange={(e) => setFormData({ ...formData, customerGstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className={cn(
                    "w-full h-10 px-3 rounded text-sm border font-mono uppercase bg-background transition-colors",
                    (formData.customerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/i.test(formData.customerGstin.trim()))
                      ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-input"
                  )}
                />
                {formData.customerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/i.test(formData.customerGstin.trim()) && (
                  <p className="text-[11px] text-red-500 mt-1">Invalid GSTIN format (15 characters expected)</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Mobile Number *</label>
                <input
                  id="reg-field-mobile"
                  type="tel"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
              <div className="relative">
                <label className="block text-sm mb-1 font-bold text-foreground">Occupation</label>
                <input
                  id="reg-field-occupation"
                  type="text"
                  value={occDropdownOpen ? occSearch : formData.occupation}
                  onFocus={() => {
                    setOccDropdownOpen(true);
                    setOccSearch('');
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setOccDropdownOpen(false);
                      if (!PREDEFINED_OCCUPATIONS.includes(formData.occupation)) {
                        setFormData(prev => ({ ...prev, occupation: 'Other' }));
                      }
                    }, 200);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOccSearch(val);
                    const matches = PREDEFINED_OCCUPATIONS.filter(o => o.toLowerCase().includes(val.toLowerCase()));
                    if (matches.length === 0 && val.trim() !== '') {
                      setFormData(prev => ({ ...prev, occupation: 'Other' }));
                    } else if (matches.length === 1 && matches[0].toLowerCase() === val.toLowerCase()) {
                      setFormData(prev => ({ ...prev, occupation: matches[0] }));
                    }
                  }}
                  className="w-full h-10 px-3 rounded text-sm border bg-background"
                  placeholder="Select occupation..."
                  autoComplete="off"
                />
                {occDropdownOpen && (
                  <div className="occupation-dropdown-menu absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-xl py-1">
                    {(() => {
                      const matches = PREDEFINED_OCCUPATIONS.filter(o => o.toLowerCase().includes(occSearch.toLowerCase()));
                      if (matches.length === 0) {
                        return (
                          <div
                            onMouseDown={() => {
                              setFormData(prev => ({ ...prev, occupation: 'Other' }));
                              setOccDropdownOpen(false);
                            }}
                            className="px-3 py-2 text-sm text-muted-foreground hover:bg-secondary cursor-pointer font-medium"
                          >
                            Other (No match found)
                          </div>
                        );
                      }
                      return matches.map((occ) => (
                        <div
                          key={occ}
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, occupation: occ }));
                            setOccDropdownOpen(false);
                          }}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors font-medium flex items-center justify-between",
                            formData.occupation === occ && "bg-primary/15 text-primary font-bold"
                          )}
                        >
                          <span>{occ}</span>
                          {formData.occupation === occ && <span className="text-xs">✓</span>}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 font-bold text-foreground">Full Address *</label>
              <textarea
                id="reg-field-address"
                required
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm border"
              />
            </div>

            {/* --- PERSONS ROW (UPDATED) --- */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm mb-1 font-bold text-foreground">Count *</label>
                <input
                  id="reg-field-persons"
                  type="number"
                  min="1"
                  required
                  placeholder="No."
                  value={formData.persons}
                  onChange={(e) => setFormData({ ...formData, persons: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm mb-1 font-bold text-foreground">Other Persons (Names)</label>
                <input
                  id="reg-field-otherPersons"
                  type="text"
                  placeholder="e.g. Ramesh, Suresh"
                  value={formData.otherPersons}
                  onChange={(e) => setFormData({ ...formData, otherPersons: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
            </div>
            
            {/* --- AGE & ID PROOF TYPE ROW --- */}
            <div className="flex gap-4 items-start">
              <div className="w-[140px] shrink-0">
                 <label className="block text-sm mb-1 font-bold text-foreground">Age</label>
                 <input
                   id="reg-field-age"
                   type="number"
                   min="1"
                   max="120"
                   placeholder="Age"
                   value={formData.age}
                   onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                   className="w-[140px] h-10 px-3 rounded text-sm font-mono border"
                 />
              </div>

              <div className="flex-1 relative">
                <label className="block text-sm mb-1 font-bold text-foreground">Identity Proof Type</label>
                <div className="relative">
                  <input
                    id="reg-field-idProofType"
                    type="text"
                    value={idProofDropdownOpen ? idProofSearch : (formData.identityProofType || '')}
                    onFocus={() => {
                      setIdProofSearch('');
                      setIdProofDropdownOpen(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setIdProofDropdownOpen(false);
                        if (idProofSearch.trim()) {
                          const exactMatch = PREDEFINED_ID_PROOFS.find(o => o.toLowerCase() === idProofSearch.trim().toLowerCase());
                          if (exactMatch) {
                            setFormData(prev => ({ ...prev, identityProofType: exactMatch }));
                          } else {
                            setFormData(prev => ({ ...prev, identityProofType: idProofSearch.trim() }));
                          }
                        }
                      }, 200);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIdProofSearch(val);
                      const matches = PREDEFINED_ID_PROOFS.filter(o => o.toLowerCase().includes(val.toLowerCase()));
                      if (matches.length === 1 && matches[0].toLowerCase() === val.toLowerCase()) {
                        setFormData(prev => ({ ...prev, identityProofType: matches[0] }));
                      } else {
                        setFormData(prev => ({ ...prev, identityProofType: val }));
                      }
                    }}
                    className="w-full h-10 px-3 rounded text-sm border bg-background"
                    placeholder="Select Identity Proof"
                    autoComplete="off"
                  />
                  {idProofDropdownOpen && (
                    <div className="idproof-dropdown-menu absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-xl py-1">
                      {(() => {
                        const matches = PREDEFINED_ID_PROOFS.filter(o => o.toLowerCase().includes(idProofSearch.toLowerCase()));
                        if (matches.length === 0) {
                          return (
                            <div
                              onMouseDown={() => {
                                setFormData(prev => ({ ...prev, identityProofType: idProofSearch || 'Other' }));
                                setIdProofDropdownOpen(false);
                              }}
                              className="px-3 py-2 text-sm text-muted-foreground hover:bg-secondary cursor-pointer font-medium"
                            >
                              {idProofSearch ? `Use "${idProofSearch}"` : 'No match found'}
                            </div>
                          );
                        }
                        return matches.map((idProof) => (
                          <div
                            key={idProof}
                            onMouseDown={() => {
                              setFormData(prev => ({ ...prev, identityProofType: idProof }));
                              setIdProofDropdownOpen(false);
                            }}
                            className={cn(
                              "px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors font-medium flex items-center justify-between",
                              formData.identityProofType === idProof && "bg-primary/15 text-primary font-bold"
                            )}
                          >
                            <span>{idProof}</span>
                            {formData.identityProofType === idProof && <span className="text-xs">✓</span>}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/10 rounded border border-secondary/20">
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Car No.</label>
                <input
                  id="reg-field-carNo"
                  type="text"
                  placeholder="MH-12-AB-1234"
                  value={formData.carNo}
                  onChange={(e) => setFormData({ ...formData, carNo: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border uppercase"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Car Model</label>
                <input
                  id="reg-field-carModel"
                  type="text"
                  placeholder="e.g. Swift"
                  value={formData.carModel}
                  onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
            </div>
          </div>

          {/* Column 2: Stay & Room Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Coming From</label>
                <input
                  id="reg-field-coming"
                  type="text"
                  value={formData.coming}
                  onChange={(e) => setFormData({ ...formData, coming: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Going To</label>
                <input
                  id="reg-field-going"
                  type="text"
                  value={formData.going}
                  onChange={(e) => setFormData({ ...formData, going: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">
                  {formData.isReservation ? 'Res. Date *' : 'Check-In *'}
                </label>
                <input
                  id="reg-field-checkIn"
                  type="datetime-local"
                  required
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 font-bold text-foreground">Days</label>
                <input
                  id="reg-field-days"
                  type="number"
                  min="1"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 1 })}
                  className="w-full h-10 px-3 rounded text-sm border"
                />
              </div>
            </div>

            {/* Room Selection */}
            <div>
              <label className="block text-sm mb-2 font-bold text-foreground">Select Room(s) *</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 border rounded bg-secondary/30">
                {availableRooms.map((room) => {
                  const held = isRoomHeld(room.roomNo);
                  return (
                  <div
                    key={room.roomNo}
                    onClick={() => toggleRoom(room.roomNo)}
                    className={cn(
                      'flex flex-col items-center justify-center p-2 border rounded transition-all duration-150 h-16 relative',
                      held ? 'bg-secondary/50 cursor-not-allowed opacity-60' : 'cursor-pointer',
                      selectedRooms.includes(room.roomNo) && !held
                        ? 'border-accent bg-accent/10 ring-2 ring-accent'
                        : (!held && 'bg-card hover:bg-accent/5')
                    )}
                  >
                    {held && (
                      <div className="absolute top-1 right-1 text-[10px] text-destructive flex items-center gap-0.5 font-bold" title="Booking in progress on another device">
                        🔒 Held
                      </div>
                    )}
                    <input
                      type="checkbox"
                      checked={selectedRooms.includes(room.roomNo)}
                      readOnly
                      className="hidden"
                    />
                    <span className="font-bold text-sm">{room.roomNo}</span>
                    <span className="text-[10px] text-muted-foreground">₹{room.rent}</span>
                  </div>
                )})}
              </div>
              {selectedRooms.length > 0 && (
                <p className="mt-2 text-sm font-bold text-accent text-right">
                  {selectedRooms.length} Rooms Selected | Total Rent: ₹{getTotalRate()}/day
                </p>
              )}
            </div>
            
            {/* Identity Proof Camera */}
            <div className="p-3 border rounded bg-white">
              <ImageCapture 
                label="Customer Identity Proof" 
                imageSrc={formData.identityProof}
                onCapture={(src) => setFormData(prev => ({ ...prev, identityProof: src }))}
                buttonId="reg-field-idProof"
              />
            </div>
          </div>
        </div>

        {/* Payment & Charges Section */}
        <div className="mt-8 border-t pt-6">
          <h4 className="font-bold text-sm text-muted-foreground mb-4 uppercase">Payment & Charges</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm mb-1 font-bold text-foreground">Advance Paid (₹)</label>
              <input
                id="reg-field-advance"
                type="number"
                value={formData.advance}
                onChange={(e) => setFormData({ ...formData, advance: parseFloat(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded text-sm font-bold border"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-bold text-foreground">Advance Mode</label>
              <select
                id="reg-field-advancePayMode"
                value={formData.advancePayMode}
                onChange={(e) => setFormData({ ...formData, advancePayMode: e.target.value as any })}
                className="w-full h-10 px-3 rounded text-sm border"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
               <label className="block text-sm mb-1 font-bold text-foreground">Advance Note</label>
               <input
                 id="reg-field-advanceNote"
                 type="text"
                 placeholder="e.g. Transaction ID"
                 value={formData.advanceNote}
                 onChange={(e) => setFormData({ ...formData, advanceNote: e.target.value })}
                 className="w-full h-10 px-3 rounded text-sm border"
               />
            </div>
            
            {/* Discount Section */}
            <div className="p-2 bg-red-50 border border-red-100 rounded space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-destructive">Discount (₹)</label>
                <button
                  type="button"
                  id="reg-btn-convert-ac"
                  onClick={() => {
                    if (selectedRooms.length === 0) {
                      alert('Please select a room first to apply AC to Non-AC discount.');
                      return;
                    }

                    const discountRates = (invoiceSettings?.ac_to_non_ac_discount_rates && invoiceSettings.ac_to_non_ac_discount_rates.length > 0)
                      ? invoiceSettings.ac_to_non_ac_discount_rates
                      : DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES;

                    let totalDiscount = 0;
                    let missingRent: number | null = null;

                    for (const rNo of selectedRooms) {
                      const r = rooms.find(room => room.roomNo === rNo);
                      const rRent = r?.rent || 0;
                      const match = discountRates.find(rate => rate.rent === rRent);
                      if (!match) {
                        missingRent = rRent;
                        break;
                      }
                      totalDiscount += match.discount;
                    }

                    if (missingRent !== null) {
                      alert(`No AC-to-Non-AC discount configured for ₹${missingRent}/day — please enter a custom discount manually or add this rate in Admin Settings`);
                      setFormData({
                        ...formData,
                        discount: 0,
                        discountReason: 'Normal Discount',
                        discountNote: '',
                      });
                    } else {
                      setFormData({
                        ...formData,
                        discount: totalDiscount,
                        discountReason: 'AC to Non AC Conversion',
                        discountNote: 'AC room converted to Non-AC',
                      });
                    }
                  }}
                  className="text-[10px] bg-red-100 hover:bg-red-200 text-destructive font-bold px-1.5 py-0.5 rounded border border-red-300 transition-colors"
                >
                  ⚡ Convert AC to Non-AC
                </button>
              </div>
              <input
                id="reg-field-discount"
                type="number"
                value={formData.discount || ''}
                onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                className="w-full h-9 px-3 rounded text-sm font-bold text-destructive border border-red-200"
                placeholder="0"
              />
              <select
                value={formData.discountReason}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    discountReason: val,
                    discountNote: val === 'AC to Non AC Conversion' ? 'AC room converted to Non-AC' : formData.discountNote
                  });
                }}
                className="w-full h-8 px-2 text-xs border border-red-200 rounded bg-white font-medium"
              >
                <option value="Normal Discount">Normal Discount</option>
                <option value="AC to Non AC Conversion">AC to Non AC Conversion</option>
                <option value="Corporate Discount">Corporate Discount</option>
                <option value="Long Stay Discount">Long Stay Discount</option>
                <option value="Staff Discount">Staff Discount</option>
                <option value="Custom / Other">Custom / Other</option>
              </select>
              <input 
                className="w-full h-8 px-2 text-xs border border-red-200 rounded"
                placeholder="Additional discount note..."
                value={formData.discountNote}
                onChange={e => setFormData({ ...formData, discountNote: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs font-bold text-destructive cursor-pointer pt-1">
                <input 
                  type="checkbox" 
                  checked={formData.showDiscountOnInvoice}
                  onChange={(e) => setFormData({ ...formData, showDiscountOnInvoice: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-destructive"
                />
                Show Discount on Invoice
              </label>
            </div>

            <div>
              <label className="block text-sm mb-1 font-bold text-foreground">Custom Charge (Description & Amt)</label>
              <div className="flex gap-2 items-center">
                <select
                  value={extraChargeType}
                  onChange={(e) => {
                    const type = e.target.value as 'Extra Bed' | 'Custom';
                    setExtraChargeType(type);
                    if (type === 'Extra Bed') {
                      setFormData(prev => ({ ...prev, extraNote: 'Extra Bed' }));
                    } else {
                      setFormData(prev => ({ ...prev, extraNote: '' }));
                    }
                  }}
                  className="w-1/3 h-10 px-3 rounded text-sm border bg-background font-medium"
                >
                  <option value="Extra Bed">Extra Bed</option>
                  <option value="Custom">Custom</option>
                </select>
                {extraChargeType === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter charge description"
                    value={formData.extraNote === 'Extra Bed' ? '' : (formData.extraNote || '')}
                    onChange={(e) => setFormData({ ...formData, extraNote: e.target.value })}
                    className="w-1/3 h-10 px-3 rounded text-sm border bg-background"
                  />
                )}
                <input
                  type="number"
                  placeholder="₹ Amt"
                  value={formData.extraAmt || ''}
                  onChange={(e) => setFormData({ ...formData, extraAmt: parseFloat(e.target.value) || 0 })}
                  className="w-1/3 h-10 px-3 rounded text-sm border font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Digital Signature Section */}
        <div className="mt-8 border-t pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                 <label className="text-sm font-bold text-foreground">Digital Signature (Optional)</label>
                 <button 
                   type="button" 
                   onClick={handleClearSignature}
                   className="text-xs text-red-500 hover:underline"
                 >
                   Clear Signature
                 </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden h-32 w-full relative">
                <SignatureCanvas 
                  ref={sigPadRef}
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full' }}
                  onEnd={() => setFormData(prev => ({ ...prev, digitalSignature: sigPadRef.current.toDataURL() }))}
                />
                <div className="absolute bottom-1 right-2 text-[10px] text-gray-400 pointer-events-none">Sign Here</div>
              </div>
            </div>
            
            {/* Submit Buttons */}
            <div className="flex items-end justify-end gap-3 flex-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-secondary text-foreground rounded hover:bg-secondary/80 font-bold transition-colors"
              >
                Clear Form
              </button>
              <button
                id="reg-field-submitBtn"
                type="submit"
                className="px-8 py-3 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-bold shadow-lg transition-all duration-200 hover:scale-105"
              >
                {formData.isReservation ? 'Create Reservation' : 'Check In Guest'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Registration;