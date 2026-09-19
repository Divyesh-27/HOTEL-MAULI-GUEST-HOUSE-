/**
 * Supabase Realtime Synchronization Bridge — Phase 3
 * 
 * Subscribes to Supabase Realtime channels across all synchronized tables:
 * bookings, room_statuses, staff, staff_logs, invoice_settings, rooms,
 * room_categories, and room_bed_types.
 * 
 * Conflict Resolution Rule:
 * Desktop ALWAYS wins. Every record has `source` and `version` / `updated_at`.
 * If an incoming mutation from Android ('mobile') conflicts or has stale data,
 * Desktop dominates, rejects the change, and re-pushes authoritative local SQLite state.
 */
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { useStore } from '@/store/useStore';
import { enqueueSync } from '@/lib/syncEngine';
import { Booking, HistoryRecord, Room } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

let activeChannel: RealtimeChannel | null = null;
let onlineListenerRegistered = false;

/**
 * Subscribe to Supabase Realtime changes across all tables.
 */
export function subscribeToRealtime() {
  if (!supabase || !isSupabaseAvailable()) {
    console.warn('[Realtime] Supabase bridge not available, skipping realtime subscription.');
    return;
  }

  unsubscribeFromRealtime();

  if (!onlineListenerRegistered && typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[Realtime] Internet reconnected. Resubscribing to Supabase channels...');
      subscribeToRealtime();
    });
    onlineListenerRegistered = true;
  }

  const store = useStore.getState;

  activeChannel = supabase
    .channel('hotel-mauli-sync-bridge')
    // 1. Bookings & History changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const deletedId = oldRow?.id || oldRow?.local_id;
        if (!deletedId) return;
        // Check if desktop originated this deletion or if it's external
        const exists = state.bookings.some(b => b.id === deletedId);
        if (exists) {
          useStore.setState({ bookings: state.bookings.filter(b => b.id !== deletedId) });
        }
        return;
      }

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRow || !newRow.id) return;

        // Check Desktop Dominance conflict rules
        const existingBooking = state.bookings.find(b => b.id === newRow.id);
        const existingHistory = state.history.find(h => h.id === newRow.id);
        const existing = existingBooking || existingHistory;

        if (existing) {
          // If local desktop record has a higher version or newer desktop timestamp and incoming is from mobile, reject & re-push master
          if (newRow.source === 'mobile' && (existing.version || 0) > (newRow.version || 0)) {
            console.log(`[Realtime] Desktop dominates stale mobile booking ${newRow.id}. Re-pushing master.`);
            enqueueSync('bookings', existing.id, 'UPSERT', existing);
            return;
          }
        }

        const bookingObj: Booking = {
          id: newRow.id,
          billNo: newRow.bill_no || 0,
          billDate: newRow.bill_date || new Date().toLocaleDateString(),
          guestName: newRow.guest_name || newRow.guestName || 'Guest',
          mobile: newRow.mobile || '',
          address: newRow.address || '',
          occupation: newRow.occupation || '',
          age: newRow.age || '',
          identityProofType: newRow.identity_proof_type || '',
          persons: newRow.persons || '1',
          otherPersons: newRow.other_persons || '',
          coming: newRow.coming_from || newRow.coming || '',
          going: newRow.going_to || newRow.going || '',
          checkIn: newRow.check_in || newRow.checkIn || new Date().toISOString(),
          days: Number(newRow.days) || 1,
          roomNos: Array.isArray(newRow.room_nos) ? newRow.room_nos : (newRow.roomNos || []),
          advance: Number(newRow.advance_total || newRow.advance || 0),
          advancePayments: Array.isArray(newRow.advance_payments) ? newRow.advance_payments : (newRow.advancePayments || []),
          payMode: newRow.pay_mode || newRow.payMode || 'Cash',
          extras: Array.isArray(newRow.extras) ? newRow.extras : [],
          discount: Number(newRow.discount || 0),
          discountNote: newRow.discount_note || newRow.discountNote || '',
          isReservation: newRow.status === 'RESERVED' || newRow.isReservation === true,
          carNo: newRow.car_no || newRow.carNo || '',
          carModel: newRow.car_model || newRow.carModel || '',
          identityProof: newRow.identity_proof || '',
          identityProofUrl: newRow.identity_proof_url || newRow.identityProofUrl || '',
          digitalSignature: newRow.digital_signature || '',
          digitalSignatureUrl: newRow.digital_signature_url || newRow.digitalSignatureUrl || '',
          updated_at: newRow.updated_at || new Date().toISOString(),
          version: newRow.version || 1,
          source: newRow.source || 'cloud',
        };

        if (newRow.status === 'COMPLETED') {
          const historyRecord: HistoryRecord = {
            ...bookingObj,
            checkoutDate: newRow.check_out || newRow.checkoutDate || new Date().toISOString(),
            finalAmount: Number(newRow.final_amount || newRow.finalAmount || 0),
            totalPaid: Number(newRow.total_paid || newRow.totalPaid || 0),
          };
          if (existingHistory) {
            state.updateHistory(historyRecord);
          } else {
            state.addHistory(historyRecord);
          }
          if (existingBooking) {
            useStore.setState({ bookings: state.bookings.filter(b => b.id !== newRow.id) });
          }
        } else {
          if (existingBooking) {
            state.updateBooking(bookingObj);
          } else {
            state.addBooking(bookingObj);
          }
        }
      }
    })
    // 2. Room Statuses changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_statuses' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const roomNo = oldRow?.room_no;
        if (roomNo) state.setRoomStatus(roomNo, null);
        return;
      }

      if (newRow && newRow.room_no) {
        const status = newRow.status;
        if (status === 'cleaning' || status === 'maintenance') {
          state.setRoomStatus(newRow.room_no, status);
        } else {
          state.setRoomStatus(newRow.room_no, null);
        }
      }
    })
    // 3. Rooms changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const roomNo = oldRow?.room_no;
        if (roomNo) useStore.setState({ rooms: state.rooms.filter(r => r.roomNo !== roomNo) });
        return;
      }

      if (newRow && newRow.room_no) {
        const roomObj: Room = {
          roomNo: newRow.room_no,
          category: newRow.category || 'AC',
          bedType: newRow.bed_type || 'Double Bed',
          rent: Number(newRow.rent || 0),
          roomName: newRow.room_name || undefined,
          roomType: newRow.room_type || undefined,
          floor: newRow.floor || undefined,
          description: newRow.description || undefined,
          updated_at: newRow.updated_at || new Date().toISOString(),
          version: newRow.version || 1,
          source: newRow.source || 'cloud',
        };

        const exists = state.rooms.some(r => r.roomNo === roomObj.roomNo);
        if (exists) {
          useStore.setState({ rooms: state.rooms.map(r => r.roomNo === roomObj.roomNo ? roomObj : r) });
        } else {
          useStore.setState({ rooms: [...state.rooms, roomObj] });
        }
      }
    })
    // 4. Staff changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const name = oldRow?.name;
        if (name) useStore.setState({ staff: state.staff.filter(s => s.name !== name) });
        return;
      }

      if (newRow && newRow.name) {
        const staffObj = {
          name: newRow.name,
          role: newRow.role || 'Staff',
          salary: Number(newRow.salary || 0),
          updated_at: newRow.updated_at || new Date().toISOString(),
          version: newRow.version || 1,
          source: newRow.source || 'cloud',
        };
        const existingIdx = state.staff.findIndex(s => s.name === staffObj.name);
        if (existingIdx > -1) {
          const updated = [...state.staff];
          updated[existingIdx] = staffObj;
          useStore.setState({ staff: updated });
        } else {
          state.addStaff(staffObj);
        }
      }
    })
    // 5. Staff Logs changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_logs' }, (payload) => {
      const { eventType, new: newRow } = payload;
      const state = store();

      if (eventType === 'INSERT' && newRow) {
        const exists = state.staffLogs.some(
          l => l.date === newRow.date && l.staff === newRow.staff && l.msg === newRow.msg
        );
        if (!exists) {
          state.addStaffLog({
            date: newRow.date,
            staff: newRow.staff,
            type: newRow.type as any,
            amount: Number(newRow.amount || 0),
            msg: newRow.msg || '',
            updated_at: newRow.created_at || newRow.updated_at || new Date().toISOString(),
            version: newRow.version || 1,
            source: newRow.source || 'cloud',
          });
        }
      }
    })
    // 6. Invoice Settings changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_settings' }, (payload) => {
      const { eventType, new: newRow } = payload;
      const state = store();

      if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow && (newRow.id === 'default-settings' || payload.new.id)) {
        state.updateInvoiceSettings({
          gst_enabled: newRow.gst_enabled ?? state.invoiceSettings.gst_enabled,
          gst_number: newRow.gst_number || state.invoiceSettings.gst_number,
          slab1_limit: Number(newRow.slab1_limit ?? state.invoiceSettings.slab1_limit),
          slab1_gst: Number(newRow.slab1_gst ?? state.invoiceSettings.slab1_gst),
          slab1_cgst: Number(newRow.slab1_cgst ?? state.invoiceSettings.slab1_cgst),
          slab1_sgst: Number(newRow.slab1_sgst ?? state.invoiceSettings.slab1_sgst),
          slab2_from: Number(newRow.slab2_from ?? state.invoiceSettings.slab2_from),
          slab2_to: Number(newRow.slab2_to ?? state.invoiceSettings.slab2_to),
          slab2_gst: Number(newRow.slab2_gst ?? state.invoiceSettings.slab2_gst),
          slab2_cgst: Number(newRow.slab2_cgst ?? state.invoiceSettings.slab2_cgst),
          slab2_sgst: Number(newRow.slab2_sgst ?? state.invoiceSettings.slab2_sgst),
          slab3_from: Number(newRow.slab3_from ?? state.invoiceSettings.slab3_from),
          slab3_gst: Number(newRow.slab3_gst ?? state.invoiceSettings.slab3_gst),
          slab3_cgst: Number(newRow.slab3_cgst ?? state.invoiceSettings.slab3_cgst),
          slab3_sgst: Number(newRow.slab3_sgst ?? state.invoiceSettings.slab3_sgst),
          show_gstin_advance: newRow.show_gstin_advance ?? state.invoiceSettings.show_gstin_advance,
          show_gstin_final: newRow.show_gstin_final ?? state.invoiceSettings.show_gstin_final,
          show_breakup_advance: newRow.show_breakup_advance ?? state.invoiceSettings.show_breakup_advance,
          show_breakup_final: newRow.show_breakup_final ?? state.invoiceSettings.show_breakup_final,
        });
      }
    })
    // 7. Categories changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_categories' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();
      if (eventType === 'DELETE' && oldRow?.name) {
        useStore.setState({ customCategories: state.customCategories.filter(c => c !== oldRow.name) });
      } else if (newRow && newRow.name && !state.customCategories.includes(newRow.name)) {
        useStore.setState({ customCategories: [...state.customCategories, newRow.name] });
      }
    })
    // 8. Bed Types changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bed_types' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();
      if (eventType === 'DELETE' && oldRow?.name) {
        useStore.setState({ customBedTypes: state.customBedTypes.filter(b => b !== oldRow.name) });
      } else if (newRow && newRow.name && !state.customBedTypes.includes(newRow.name)) {
        useStore.setState({ customBedTypes: [...state.customBedTypes, newRow.name] });
      }
    })
    // 9. Room Holds changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_holds' }, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();
      
      if (eventType === 'DELETE' && oldRow?.id) {
        useStore.setState({ roomHolds: state.roomHolds.filter(h => h.id !== oldRow.id) });
      } else if (newRow && newRow.id) {
        const hold = {
          id: newRow.id,
          room_no: newRow.room_no,
          device_id: newRow.device_id,
          expires_at: newRow.expires_at,
          status: newRow.status
        } as any;
        
        const exists = state.roomHolds.findIndex(h => h.id === hold.id);
        const updated = [...state.roomHolds];
        if (exists > -1) {
          updated[exists] = hold;
        } else {
          updated.push(hold);
        }
        useStore.setState({ roomHolds: updated });
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed to all Supabase synchronization channels.');
      }
    });
}

/**
 * Unsubscribe from Supabase Realtime channel.
 */
export function unsubscribeFromRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    console.log('[Realtime] Unsubscribed from Supabase channel.');
  }
}
