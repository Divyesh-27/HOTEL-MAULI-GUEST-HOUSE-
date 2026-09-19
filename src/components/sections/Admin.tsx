import { useState, FormEvent, useEffect } from 'react';
import { Trash2, Settings as SettingsIcon, Building2, Check, AlertCircle, Save, Percent, FileText, Edit2, X, Users, Plus, Tag, Download, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { pushRoomStatusToCloud, deleteRoomStatusFromCloud } from '@/lib/syncActions';
import { InvoiceSettings, Room, AppUser, DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES, AcToNonAcDiscountRate } from '@/types';
import { hashPassword } from '@/utils/crypto';
import { normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import { APP_VERSION } from '@/constants/version';

import { useShallow } from 'zustand/react/shallow';

const Admin = () => {
  const { 
    rooms, roomStatus, bookings, addRoom, updateRoom, removeRoom, setRoomStatus, 
    invoiceSettings, updateInvoiceSettings,
    customCategories, addCategory, removeCategory, 
    customBedTypes, addBedType, removeBedType,
    isDeveloperMode, setDeveloperMode,
    appUsers, appRoles, addAppUser, updateAppUser, deleteAppUser
  } = useStore(useShallow(state => ({
    rooms: state.rooms, roomStatus: state.roomStatus, bookings: state.bookings, addRoom: state.addRoom, updateRoom: state.updateRoom, removeRoom: state.removeRoom, setRoomStatus: state.setRoomStatus,
    invoiceSettings: state.invoiceSettings, updateInvoiceSettings: state.updateInvoiceSettings,
    customCategories: state.customCategories || ['AC', 'Air Cooled', 'Hall', 'Non-AC', 'Deluxe'], addCategory: state.addCategory, removeCategory: state.removeCategory,
    customBedTypes: state.customBedTypes || ['Single Bed', 'Double Bed', 'King Size', 'Queen Bed', '3 Bed', '4 Bed'], addBedType: state.addBedType, removeBedType: state.removeBedType,
    isDeveloperMode: state.isDeveloperMode, setDeveloperMode: state.setDeveloperMode,
    appUsers: state.appUsers, appRoles: state.appRoles, addAppUser: state.addAppUser, updateAppUser: state.updateAppUser, deleteAppUser: state.deleteAppUser
  })));
  const [newCatInput, setNewCatInput] = useState('');
  const [newBedInput, setNewBedInput] = useState('');

  // Edit Room Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOriginalRoomNo, setEditingOriginalRoomNo] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({
    roomNo: '',
    category: 'AC',
    bedType: 'Double Bed',
    rent: 1600,
    roomName: '',
    floor: '',
    description: '',
  });
  const [editRoomError, setEditRoomError] = useState<string | null>(null);

  const handleOpenEditModal = (room: Room) => {
    setEditingOriginalRoomNo(room.roomNo);
    setEditRoomForm({
      roomNo: room.roomNo || '',
      category: room.category || 'AC',
      bedType: room.bedType || 'Double Bed',
      rent: room.rent || 0,
      roomName: room.roomName || '',
      floor: room.floor || '',
      description: room.description || '',
    });
    setEditRoomError(null);
    setEditModalOpen(true);
  };

  const handleSaveEditedRoom = (e: FormEvent) => {
    e.preventDefault();
    if (!editingOriginalRoomNo) return;

    const trimmedNo = editRoomForm.roomNo.trim();
    if (!trimmedNo) {
      setEditRoomError('Room Number cannot be empty.');
      return;
    }
    if (isNaN(Number(editRoomForm.rent)) || Number(editRoomForm.rent) < 0) {
      setEditRoomError('Room Price must be a valid positive number.');
      return;
    }

    if (trimmedNo.toLowerCase() !== editingOriginalRoomNo.toLowerCase()) {
      const conflict = rooms.some(
        (r) => r.roomNo.toLowerCase() === trimmedNo.toLowerCase() && r.roomNo !== editingOriginalRoomNo
      );
      if (conflict) {
        setEditRoomError(`Room number "${trimmedNo}" already exists.`);
        return;
      }
    }

    const originalRoom = rooms.find((r) => r.roomNo === editingOriginalRoomNo);

    const updatedRoomData: Room = {
      ...originalRoom,
      roomNo: trimmedNo,
      category: editRoomForm.category,
      bedType: editRoomForm.bedType,
      rent: Number(editRoomForm.rent) || 0,
      roomName: editRoomForm.roomName.trim() || undefined,
      floor: editRoomForm.floor.trim() || undefined,
      description: editRoomForm.description.trim() || undefined,
    };

    updateRoom(editingOriginalRoomNo, updatedRoomData);
    setEditModalOpen(false);
  };
  
  // Tab navigation inside Admin: 'rooms' | 'settings' | 'dev' | 'users'
  const [activeTab, setActiveTab] = useState<'rooms' | 'settings' | 'dev' | 'users'>('rooms');

  // Room Management State
  const [newRoom, setNewRoom] = useState({
    roomNo: '',
    category: 'AC' as 'AC' | 'Air Cooled' | 'Hall',
    bedType: 'Double Bed',
    rent: 1600,
  });

  // Tax & Invoice Settings State
  const [settingsForm, setSettingsForm] = useState<InvoiceSettings>(() => ({
    id: 'default-settings',
    gst_enabled: invoiceSettings?.gst_enabled ?? true,
    gst_number: invoiceSettings?.gst_number || "27AAAAA0000A1Z5",
    slab1_limit: invoiceSettings?.slab1_limit ?? 1000,
    slab1_gst: invoiceSettings?.slab1_gst ?? 0,
    slab1_cgst: invoiceSettings?.slab1_cgst ?? 0,
    slab1_sgst: invoiceSettings?.slab1_sgst ?? 0,
    slab2_from: invoiceSettings?.slab2_from ?? 1001,
    slab2_to: invoiceSettings?.slab2_to ?? 7500,
    slab2_gst: invoiceSettings?.slab2_gst ?? 5,
    slab2_cgst: invoiceSettings?.slab2_cgst ?? 2.5,
    slab2_sgst: invoiceSettings?.slab2_sgst ?? 2.5,
    slab3_from: invoiceSettings?.slab3_from ?? 7501,
    slab3_gst: invoiceSettings?.slab3_gst ?? 18,
    slab3_cgst: invoiceSettings?.slab3_cgst ?? 9,
    slab3_sgst: invoiceSettings?.slab3_sgst ?? 9,
    show_gstin_advance: invoiceSettings?.show_gstin_advance ?? true,
    show_gstin_final: invoiceSettings?.show_gstin_final ?? true,
    show_breakup_advance: invoiceSettings?.show_breakup_advance ?? false,
    show_breakup_final: invoiceSettings?.show_breakup_final ?? true,
    ac_to_non_ac_discount_rates: (invoiceSettings?.ac_to_non_ac_discount_rates && invoiceSettings.ac_to_non_ac_discount_rates.length > 0)
      ? invoiceSettings.ac_to_non_ac_discount_rates
      : DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES,
  }));

  // Sync state if store updates from cloud
  useEffect(() => {
    if (invoiceSettings) {
      setSettingsForm((prev) => ({
        ...prev,
        ...invoiceSettings,
        ac_to_non_ac_discount_rates: (invoiceSettings.ac_to_non_ac_discount_rates && invoiceSettings.ac_to_non_ac_discount_rates.length > 0)
          ? invoiceSettings.ac_to_non_ac_discount_rates
          : (prev.ac_to_non_ac_discount_rates && prev.ac_to_non_ac_discount_rates.length > 0
              ? prev.ac_to_non_ac_discount_rates
              : DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES),
      }));
    }
  }, [invoiceSettings]);

  const handleAddDiscountRate = () => {
    const current = settingsForm.ac_to_non_ac_discount_rates || [];
    setSettingsForm({
      ...settingsForm,
      ac_to_non_ac_discount_rates: [...current, { rent: 0, discount: 0 }],
    });
  };

  const handleUpdateDiscountRate = (index: number, field: 'rent' | 'discount', value: number) => {
    const current = [...(settingsForm.ac_to_non_ac_discount_rates || [])];
    if (!current[index]) return;
    current[index] = {
      ...current[index],
      [field]: value,
    };
    setSettingsForm({
      ...settingsForm,
      ac_to_non_ac_discount_rates: current,
    });
  };

  const handleDeleteDiscountRate = (index: number) => {
    const current = [...(settingsForm.ac_to_non_ac_discount_rates || [])];
    current.splice(index, 1);
    setSettingsForm({
      ...settingsForm,
      ac_to_non_ac_discount_rates: current,
    });
  };

  const [validationError, setValidationError] = useState<string | null>(null);
  const [addRoomError, setAddRoomError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAddRoom = (e: FormEvent) => {
    e.preventDefault();
    setAddRoomError(null);
    const trimmedNo = newRoom.roomNo.trim();
    if (!trimmedNo) {
      setAddRoomError('Room number cannot be empty.');
      return;
    }
    if (!newRoom.rent || isNaN(Number(newRoom.rent)) || Number(newRoom.rent) <= 0) {
      setAddRoomError('Please enter a valid positive room rent.');
      return;
    }
    const duplicate = rooms.some(
      (r) => r.roomNo.trim().toLowerCase() === trimmedNo.toLowerCase()
    );
    if (duplicate) {
      const msg = `Room number "${trimmedNo}" already exists. Duplicate room numbers are not allowed.`;
      setAddRoomError(msg);
      alert(msg);
      return;
    }
    addRoom({ ...newRoom, roomNo: trimmedNo });
    setNewRoom({
      roomNo: '',
      category: 'AC',
      bedType: 'Double Bed',
      rent: 1600,
    });
  };

  const handleDeleteRoom = (index: number) => {
    if (confirm('Delete room?')) {
      removeRoom(index);
    }
  };

  const toggleMaintenance = (roomNo: string) => {
    if (roomStatus[roomNo] === 'maintenance') {
      setRoomStatus(roomNo, null);
      deleteRoomStatusFromCloud(roomNo);
    } else {
      const todayStr = normalizeToDayStr(new Date());
      const activeBooking = bookings.find(b => {
        if (!b.roomNos?.includes(roomNo)) return false;
        const bIn = normalizeToDayStr(b.checkIn);
        const bOut = getCheckoutDayStr(b.checkIn, b.days || 1);
        return todayStr >= bIn && todayStr < bOut;
      });
      if (activeBooking) {
        alert(`Cannot mark Room ${roomNo} as Maintenance: Room currently has an active ${activeBooking.isReservation ? 'reservation' : 'booking'} for ${activeBooking.guestName} (${activeBooking.checkIn} to ${getCheckoutDayStr(activeBooking.checkIn, activeBooking.days || 1)}). Please check out the guest first.`);
        return;
      }
      setRoomStatus(roomNo, 'maintenance');
      pushRoomStatusToCloud(roomNo, 'maintenance');
    }
  };

  // Validate GST = CGST + SGST
  const validateSlabs = (form: InvoiceSettings): boolean => {
    const s1Diff = Math.abs(Number(form.slab1_gst) - (Number(form.slab1_cgst) + Number(form.slab1_sgst)));
    const s2Diff = Math.abs(Number(form.slab2_gst) - (Number(form.slab2_cgst) + Number(form.slab2_sgst)));
    const s3Diff = Math.abs(Number(form.slab3_gst) - (Number(form.slab3_cgst) + Number(form.slab3_sgst)));

    if (s1Diff > 0.001) {
      setValidationError('Slab 1 Error: GST Rate must equal CGST % + SGST %');
      return false;
    }
    if (s2Diff > 0.001) {
      setValidationError('Slab 2 Error: GST Rate must equal CGST % + SGST %');
      return false;
    }
    if (s3Diff > 0.001) {
      setValidationError('Slab 3 Error: GST Rate must equal CGST % + SGST %');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    if (!validateSlabs(settingsForm)) {
      return;
    }

    if (settingsForm.ac_to_non_ac_discount_rates && settingsForm.ac_to_non_ac_discount_rates.length > 0) {
      const seenRents = new Set<number>();
      for (const r of settingsForm.ac_to_non_ac_discount_rates) {
        if (r.rent <= 0) {
          setValidationError('AC to Non-AC Discount Rates: Room Rent must be greater than 0.');
          return;
        }
        if (seenRents.has(r.rent)) {
          setValidationError(`AC to Non-AC Discount Rates: Duplicate entry found for Room Rent ₹${r.rent}.`);
          return;
        }
        seenRents.add(r.rent);
      }
    }

    updateInvoiceSettings(settingsForm);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Auto-split CGST & SGST when GST Rate changes
  const handleGstRateChange = (slab: 1 | 2 | 3, newRate: number) => {
    const half = Number((newRate / 2).toFixed(2));
    setSettingsForm((prev) => {
      const updated = { ...prev };
      if (slab === 1) {
        updated.slab1_gst = newRate;
        updated.slab1_cgst = half;
        updated.slab1_sgst = half;
      } else if (slab === 2) {
        updated.slab2_gst = newRate;
        updated.slab2_cgst = half;
        updated.slab2_sgst = half;
      } else if (slab === 3) {
        updated.slab3_gst = newRate;
        updated.slab3_cgst = half;
        updated.slab3_sgst = half;
      }
      validateSlabs(updated);
      return updated;
    });
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-border space-x-4 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('rooms')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all",
            activeTab === 'rooms'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="w-4 h-4" /> Room Management
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all",
            activeTab === 'settings'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <SettingsIcon className="w-4 h-4" /> Settings → Tax & Invoice Settings
        </button>
        <button
          onClick={() => setActiveTab('dev')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all",
            activeTab === 'dev'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <AlertCircle className="w-4 h-4" /> Developer Tools
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap",
            activeTab === 'users'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4" /> Roles & Users
        </button>
      </div>

      {/* --- TAB 1: ROOM MANAGEMENT --- */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          {/* Add Room */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="font-bold text-lg mb-4">Add New Room</h3>
            <form onSubmit={handleAddRoom} className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Room No"
                value={newRoom.roomNo}
                onChange={(e) => setNewRoom({ ...newRoom, roomNo: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
              />
              <select
                value={newRoom.category}
                onChange={(e) => setNewRoom({ ...newRoom, category: e.target.value as any })}
                className="px-3 py-2 border rounded text-sm"
              >
                {customCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={newRoom.bedType}
                onChange={(e) => setNewRoom({ ...newRoom, bedType: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
              >
                {customBedTypes.map((bed) => (
                  <option key={bed} value={bed}>{bed}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Rent (₹)"
                value={newRoom.rent}
                onChange={(e) => setNewRoom({ ...newRoom, rent: parseInt(e.target.value) || 0 })}
                className="px-3 py-2 border rounded text-sm"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Add Room
              </button>
            </form>
            {addRoomError && (
              <p className="text-destructive text-xs font-semibold mt-3">{addRoomError}</p>
            )}
          </div>

          {/* Room List */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="font-bold text-lg mb-4">Manage Rooms</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {rooms.map((room, index) => {
                const status = roomStatus[room.roomNo] || 'active';
                return (
                  <div key={room.roomNo} className="p-3 border rounded shadow-sm bg-card relative">
                    <div className="absolute top-1 right-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(room)}
                        title="Edit Room"
                        className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(index)}
                        title="Delete Room"
                        className="text-destructive/30 hover:text-destructive transition-colors p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="font-bold">{room.roomNo}</p>
                    <p className="text-xs text-muted-foreground">{room.category} | ₹{room.rent}</p>
                    <p className="text-[10px] text-muted">{room.bedType}</p>
                    <div className="mt-2">
                      <button
                        onClick={() => toggleMaintenance(room.roomNo)}
                        className={cn(
                          'text-[10px] px-2 py-1 rounded border w-full transition-colors',
                          status === 'maintenance'
                            ? 'bg-status-maintenance text-white'
                            : 'bg-secondary'
                        )}
                      >
                        Maint.
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Categories & Bed Types Tag Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="font-bold text-base mb-2">Manage Room Categories</h3>
              <p className="text-xs text-muted-foreground mb-4">Add or remove categories (e.g. AC, Non-AC, Deluxe, VIP)</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="New Category..."
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCatInput.trim()) {
                      addCategory?.(newCatInput.trim());
                      setNewCatInput('');
                    }
                  }}
                  className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-xs font-bold hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customCategories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {cat}
                    <button type="button" onClick={() => removeCategory?.(cat)} className="hover:text-destructive font-bold">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="font-bold text-base mb-2">Manage Bed Types</h3>
              <p className="text-xs text-muted-foreground mb-4">Add or remove bed types (e.g. Single Bed, King Size, 4 Bed)</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="New Bed Type..."
                  value={newBedInput}
                  onChange={(e) => setNewBedInput(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newBedInput.trim()) {
                      addBedType?.(newBedInput.trim());
                      setNewBedInput('');
                    }
                  }}
                  className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-xs font-bold hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customBedTypes.map((bed) => (
                  <span key={bed} className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {bed}
                    <button type="button" onClick={() => removeBedType?.(bed)} className="hover:text-destructive font-bold">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: TAX & INVOICE SETTINGS --- */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          {/* Header & Success Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-lg">
                <FileText className="w-5 h-5" /> Tax & Invoice Settings
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure GST registration, tariff slabs, and invoice receipt displays.
                <span className="text-amber-500 font-semibold ml-1">Old invoices remain unchanged; new settings apply ONLY to future bills.</span>
              </p>
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-bold text-sm shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Save className="w-4 h-4" /> Save Tax & Invoice Settings
            </button>
          </div>

          {saveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 flex items-center gap-3 text-sm font-bold animate-fade-in">
              <Check className="w-5 h-5" /> Settings saved successfully and synced across Desktop & Android!
            </div>
          )}

          {validationError && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive flex items-center gap-3 text-sm font-bold animate-fade-in">
              <AlertCircle className="w-5 h-5" /> {validationError}
            </div>
          )}

          {/* 1. GST Registered Toggle & 2. GST Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
              <h4 className="font-bold text-base flex items-center justify-between">
                <span>1. GST Registered Toggle</span>
                <span className={cn("text-xs px-2.5 py-1 rounded font-mono font-bold uppercase", settingsForm.gst_enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-500/20 text-gray-400")}>
                  {settingsForm.gst_enabled ? "ON (GST ENABLED)" : "OFF (NORMAL TOTALS ONLY)"}
                </span>
              </h4>
              <p className="text-xs text-muted-foreground">
                If OFF: No GST calculations, no GST breakup, hide GST fields on invoices, and show only normal totals.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsForm({ ...settingsForm, gst_enabled: !settingsForm.gst_enabled })}
                  className={cn(
                    "w-full py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2",
                    settingsForm.gst_enabled
                      ? "bg-emerald-600 text-white border-emerald-700 shadow"
                      : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                  )}
                >
                  GST Enabled: [ {settingsForm.gst_enabled ? "ON" : "OFF"} ]
                </button>
              </div>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
              <h4 className="font-bold text-base">2. GST Number (GSTIN)</h4>
              <p className="text-xs text-muted-foreground">
                This value appears on Advance Receipts and Final Bills under Proprietor name.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted">GSTIN:</label>
                <input
                  type="text"
                  placeholder="Example: 27ABCDE1234F1Z5"
                  value={settingsForm.gst_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gst_number: e.target.value.toUpperCase() })}
                  disabled={!settingsForm.gst_enabled}
                  className="w-full px-3 py-2 border rounded font-mono text-sm uppercase bg-background disabled:opacity-50"
                />
              </div>
              <div className="p-3 bg-secondary/40 rounded border border-border text-xs font-mono">
                <span className="text-muted text-[10px] uppercase block mb-1">Receipt Header Display Preview:</span>
                <strong>J.R. Jaiswal</strong><br />
                <strong>GSTIN: {settingsForm.gst_number || "XXXXXXXXXXXXXXX"}</strong>
              </div>
            </div>
          </div>

          {/* 3. Accommodation GST Slabs */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <h4 className="font-bold text-base flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary" /> 3. Accommodation GST Slabs
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configurable per-night tariff slabs. <strong className="text-foreground">Validation Rule:</strong> GST Rate must equal CGST % + SGST %.
                </p>
              </div>
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", !settingsForm.gst_enabled && "opacity-50 pointer-events-none")}>
              
              {/* Slab 1 */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-3">
                <div className="border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase text-muted tracking-wider">Slab 1</span>
                  <h5 className="font-bold text-sm mt-0.5">Tariff Below Limit</h5>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted">Tariff Limit (₹):</label>
                  <div className="flex items-center">
                    <span className="px-2.5 py-1.5 bg-secondary border border-r-0 rounded-l text-xs">Below ₹</span>
                    <input
                      type="number"
                      value={settingsForm.slab1_limit}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab1_limit: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded-r text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <label className="text-[10px] text-muted block font-semibold">GST Rate%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab1_gst}
                      onChange={(e) => handleGstRateChange(1, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-xs font-mono font-bold text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">CGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab1_cgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab1_cgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">SGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab1_sgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab1_sgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Slab 2 */}
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 shadow-sm">
                <div className="border-b border-primary/20 pb-2">
                  <span className="text-xs font-bold uppercase text-primary tracking-wider">Slab 2 (Standard)</span>
                  <h5 className="font-bold text-sm mt-0.5">Middle Tariff Range</h5>
                </div>
                <div className="grid grid-cols-2 gap-2 space-y-0">
                  <div>
                    <label className="text-xs text-muted">From (₹):</label>
                    <input
                      type="number"
                      value={settingsForm.slab2_from}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab2_from: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted">To (₹):</label>
                    <input
                      type="number"
                      value={settingsForm.slab2_to}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab2_to: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <label className="text-[10px] text-muted block font-semibold">GST Rate%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab2_gst}
                      onChange={(e) => handleGstRateChange(2, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-xs font-mono font-bold text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">CGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab2_cgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab2_cgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">SGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab2_sgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab2_sgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Slab 3 */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-3">
                <div className="border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase text-muted tracking-wider">Slab 3</span>
                  <h5 className="font-bold text-sm mt-0.5">High Tariff Range</h5>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted">Tariff Above (₹):</label>
                  <div className="flex items-center">
                    <span className="px-2.5 py-1.5 bg-secondary border border-r-0 rounded-l text-xs">Above ₹</span>
                    <input
                      type="number"
                      value={settingsForm.slab3_from}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab3_from: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded-r text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <label className="text-[10px] text-muted block font-semibold">GST Rate%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab3_gst}
                      onChange={(e) => handleGstRateChange(3, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-xs font-mono font-bold text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">CGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab3_cgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab3_cgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block">SGST%</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.slab3_sgst}
                      onChange={(e) => setSettingsForm({ ...settingsForm, slab3_sgst: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 5. Invoice Display Settings */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
            <h4 className="font-bold text-base">5. Invoice Receipt Display Settings</h4>
            <p className="text-xs text-muted-foreground">
              Select which documents should include GSTIN and GST Breakup details.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Show GSTIN */}
              <div className="p-4 rounded-lg border border-border bg-secondary/10 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Show GSTIN On:</span>
                <label className="flex items-center gap-3 p-2.5 rounded hover:bg-secondary/40 cursor-pointer border border-transparent hover:border-border">
                  <input
                    type="checkbox"
                    checked={settingsForm.show_gstin_advance}
                    onChange={(e) => setSettingsForm({ ...settingsForm, show_gstin_advance: e.target.checked })}
                    className="w-4 h-4 rounded text-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium">☑ Advance Receipt</span>
                </label>
                <label className="flex items-center gap-3 p-2.5 rounded hover:bg-secondary/40 cursor-pointer border border-transparent hover:border-border">
                  <input
                    type="checkbox"
                    checked={settingsForm.show_gstin_final}
                    onChange={(e) => setSettingsForm({ ...settingsForm, show_gstin_final: e.target.checked })}
                    className="w-4 h-4 rounded text-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium">☑ Final Bill</span>
                </label>
              </div>

              {/* Show GST Breakup */}
              <div className="p-4 rounded-lg border border-border bg-secondary/10 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Show GST Breakup On:</span>
                <label className="flex items-center gap-3 p-2.5 rounded hover:bg-secondary/40 cursor-pointer border border-transparent hover:border-border">
                  <input
                    type="checkbox"
                    checked={settingsForm.show_breakup_advance}
                    onChange={(e) => setSettingsForm({ ...settingsForm, show_breakup_advance: e.target.checked })}
                    className="w-4 h-4 rounded text-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium">☐ Advance Receipt (Default: Hidden)</span>
                </label>
                <label className="flex items-center gap-3 p-2.5 rounded hover:bg-secondary/40 cursor-pointer border border-transparent hover:border-border">
                  <input
                    type="checkbox"
                    checked={settingsForm.show_breakup_final}
                    onChange={(e) => setSettingsForm({ ...settingsForm, show_breakup_final: e.target.checked })}
                    className="w-4 h-4 rounded text-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium">☑ Final Bill</span>
                </label>
              </div>
            </div>
          </div>

          {/* 5. AC to Non-AC Discount Rates */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h4 className="font-bold text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" /> AC to Non-AC Discount Rates
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure flat discount amounts applied when converting an AC room to Non-AC based on daily room tariff.
                </p>
              </div>
              <button
                type="button"
                id="admin-btn-add-discount-rate"
                onClick={handleAddDiscountRate}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Add Discount Rate
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground bg-secondary/30">
                    <th className="py-2.5 px-4 font-semibold">Room Rent (₹ / Day)</th>
                    <th className="py-2.5 px-4 font-semibold">Discount (₹)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(settingsForm.ac_to_non_ac_discount_rates || []).map((rate, index) => (
                    <tr key={index} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="relative max-w-[200px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="0"
                            id={`discount-rate-rent-${index}`}
                            value={rate.rent || ''}
                            onChange={(e) => handleUpdateDiscountRate(index, 'rent', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-1.5 border rounded text-sm font-semibold bg-background"
                            placeholder="Rent (e.g. 1600)"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="relative max-w-[200px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="0"
                            id={`discount-rate-discount-${index}`}
                            value={rate.discount || ''}
                            onChange={(e) => handleUpdateDiscountRate(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-1.5 border rounded text-sm font-semibold text-destructive bg-background"
                            placeholder="Discount (e.g. 400)"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          id={`discount-rate-delete-${index}`}
                          onClick={() => handleDeleteDiscountRate(index)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!settingsForm.ac_to_non_ac_discount_rates || settingsForm.ac_to_non_ac_discount_rates.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-muted-foreground italic">
                        No discount rates configured. Click "Add Discount Rate" above to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Save */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <Save className="w-5 h-5" /> Save & Apply Tax & Invoice Settings
            </button>
          </div>

        </form>
      )}

      {/* --- TAB 3: DEVELOPER TOOLS --- */}
      {activeTab === 'dev' && (
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-destructive font-bold text-lg mb-2">
              <AlertCircle className="w-5 h-5" /> Developer Tools
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Developer tools are designed for testing purposes only. Enabling Developer Mode allows pre-filling dummy data in the registration form to speed up testing. It does NOT bypass validation or affect production data synchronization.
            </p>
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
              <div>
                <h4 className="font-bold text-foreground text-sm">Developer Mode</h4>
                <p className="text-xs text-muted-foreground">Enable dummy data filling in New Registration.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isDeveloperMode}
                  onChange={(e) => setDeveloperMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          {/* Software Updates Card */}
          <SoftwareUpdatesCard />
        </div>
      )}

      {/* --- EDIT ROOM MODAL --- */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
              <div>
                <h3 className="font-bold text-base text-foreground">Edit Room Details</h3>
                <p className="text-xs text-muted-foreground">Modify details for Room {editingOriginalRoomNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRoom} className="p-6 space-y-4">
              {editRoomError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {editRoomError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Room Number *</label>
                <input
                  type="text"
                  value={editRoomForm.roomNo}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, roomNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm bg-background"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Room Category *</label>
                <select
                  value={editRoomForm.category}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm bg-background"
                >
                  {Array.from(new Set([...customCategories, editRoomForm.category])).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Bed Type *</label>
                <select
                  value={editRoomForm.bedType}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, bedType: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm bg-background"
                >
                  {Array.from(new Set([...customBedTypes, editRoomForm.bedType])).map((bed) => (
                    <option key={bed} value={bed}>{bed}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Room Price / Rent (₹) *</label>
                <input
                  type="number"
                  min="0"
                  value={editRoomForm.rent}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, rent: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded text-sm bg-background font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Floor (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Floor"
                    value={editRoomForm.floor}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, floor: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Room Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Deluxe Suite"
                    value={editRoomForm.roomName}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, roomName: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Any extra room details"
                  value={editRoomForm.description}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB 4: USERS & ROLES --- */}
      {activeTab === 'users' && (
        <AdminUsersTab 
          appUsers={appUsers}
          appRoles={appRoles}
          addAppUser={addAppUser}
          updateAppUser={updateAppUser}
          deleteAppUser={deleteAppUser}
        />
      )}
    </div>
  );
};

// --- Sub-component for Software Updates ---
type UpdateCheckState = 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'error';

const SoftwareUpdatesCard = () => {
  const [checkState, setCheckState] = useState<UpdateCheckState>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateAvailable) return;

    api.onUpdateNotAvailable(() => {
      setCheckState('up-to-date');
    });
    api.onUpdateAvailable((info: any) => {
      setUpdateVersion(info.version);
      setCheckState('downloading');
    });
    api.onUpdateDownloadProgress((prog: any) => {
      setProgress(prog.percent);
    });
    api.onUpdateDownloaded((info: any) => {
      setUpdateVersion(info.version);
      setCheckState('ready');
    });
    api.onUpdateError((err: any) => {
      setErrorMsg(err.message || 'Update check failed.');
      setCheckState('error');
    });

    return () => {
      // Note: don't call removeUpdateListeners here — that would break
      // the UpdateNotification component. Listeners are additive.
    };
  }, []);

  const handleCheckForUpdates = async () => {
    const api = (window as any).electronAPI;
    if (!api?.checkForUpdates) {
      setErrorMsg('Auto-updater is not available in development mode.');
      setCheckState('error');
      return;
    }
    setCheckState('checking');
    setErrorMsg('');
    try {
      const result = await api.checkForUpdates();
      if (!result.success) {
        setErrorMsg(result.error || 'Check failed.');
        setCheckState('error');
      }
      // On success, the state will be updated by the IPC event listeners above
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error during update check.');
      setCheckState('error');
    }
  };

  const handleInstallUpdate = () => {
    (window as any).electronAPI?.installUpdate();
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-primary font-bold text-lg">
        <Download className="w-5 h-5" /> Software Updates
      </div>
      <p className="text-sm text-muted-foreground">
        Current version: <span className="font-mono font-bold text-foreground">v{APP_VERSION}</span>
      </p>

      {/* Status display */}
      {checkState === 'up-to-date' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-500">You're on the latest version!</span>
        </div>
      )}

      {checkState === 'downloading' && (
        <div className="space-y-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-semibold text-primary">Downloading v{updateVersion}…</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right font-mono">{progress}%</p>
        </div>
      )}

      {checkState === 'ready' && (
        <div className="space-y-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-500">Update v{updateVersion} is ready to install!</span>
          </div>
          <button
            onClick={handleInstallUpdate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Restart & Install
          </button>
        </div>
      )}

      {checkState === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-semibold text-destructive">{errorMsg}</span>
        </div>
      )}

      {/* Check button */}
      <button
        onClick={handleCheckForUpdates}
        disabled={checkState === 'checking' || checkState === 'downloading'}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm",
          checkState === 'checking' || checkState === 'downloading'
            ? 'bg-secondary text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {checkState === 'checking' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
        ) : (
          <><RefreshCw className="w-4 h-4" /> Check for Updates</>
        )}
      </button>
    </div>
  );
};

// --- Sub-component for Users Tab to keep Admin.tsx clean ---
const AdminUsersTab = ({ appUsers, appRoles, addAppUser, updateAppUser, deleteAppUser }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    roleId: 'role-staff',
    status: 'active' as 'active' | 'disabled'
  });
  
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = (user?: any) => {
    setError(null);
    if (user) {
      setEditingUserId(user.id);
      setForm({
        fullName: user.fullName,
        username: user.username,
        password: '',
        confirmPassword: '',
        roleId: user.roleId,
        status: user.status
      });
    } else {
      setEditingUserId(null);
      setForm({
        fullName: '',
        username: '',
        password: '',
        confirmPassword: '',
        roleId: 'role-staff',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim() || !form.username.trim()) {
      setError('Full Name and Username are required.');
      return;
    }
    if (!editingUserId && !form.password) {
      setError('Password is required for new users.');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    // Check for username uniqueness
    const conflict = appUsers.find((u: any) => u.username.toLowerCase() === form.username.toLowerCase() && u.id !== editingUserId);
    if (conflict) {
      setError('Username already exists.');
      return;
    }

    try {
      let passwordHash = '';
      if (form.password) {
        passwordHash = await hashPassword(form.password);
      }

      if (editingUserId) {
        const existingUser = appUsers.find((u: any) => u.id === editingUserId);
        updateAppUser(editingUserId, {
          ...existingUser,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          roleId: form.roleId,
          status: form.status,
          ...(passwordHash ? { passwordHash } : {})
        });
      } else {
        const newUser = {
          id: `user-${Date.now()}`,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          passwordHash,
          roleId: form.roleId,
          status: form.status,
        };
        addAppUser(newUser);
      }
      setIsModalOpen(false);
    } catch (err) {
      setError('Failed to save user.');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h3 className="font-bold text-lg text-primary flex items-center gap-2">
            <Users className="w-5 h-5" /> Staff & User Accounts
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Manage login access and role permissions for staff members.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-all shadow-md"
        >
          + Add User
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs">
            <tr>
              <th className="px-6 py-3 font-semibold">Name</th>
              <th className="px-6 py-3 font-semibold">Username</th>
              <th className="px-6 py-3 font-semibold">Role</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {appUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No users found. Click "Add User" to create one.
                </td>
              </tr>
            ) : (
              appUsers.map((user: any) => {
                const role = appRoles.find((r: any) => r.id === user.roleId);
                return (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{user.fullName}</td>
                    <td className="px-6 py-4 font-mono text-xs">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                        {role?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-bold uppercase",
                        user.status === 'active' ? "bg-emerald-500/20 text-emerald-500" : "bg-destructive/20 text-destructive"
                      )}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="text-primary hover:underline font-medium text-sm mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
                            deleteAppUser(user.id);
                          }
                        }}
                        className="text-destructive hover:underline font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border flex flex-col animate-scale-up">
            <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30 rounded-t-xl">
              <h3 className="font-bold text-lg">{editingUserId ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({...form, fullName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Username / Login ID *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({...form, username: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                    placeholder="johndoe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      {editingUserId ? 'New Password' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({...form, password: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                      placeholder={editingUserId ? "Leave blank to keep" : "••••••"}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                      placeholder="••••••"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Role</label>
                    <select
                      value={form.roleId}
                      onChange={(e) => setForm({...form, roleId: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    >
                      {appRoles.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({...form, status: e.target.value as any})}
                      className={cn(
                        "w-full px-3 py-2 border rounded-lg text-sm font-semibold",
                        form.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                      )}
                    >
                      <option value="active">Active (Can Login)</option>
                      <option value="disabled">Disabled (Cannot Login)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm shadow hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

