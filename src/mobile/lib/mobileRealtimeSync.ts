/**
 * Mobile Realtime Sync — Android Companion App
 * 
 * Subscribes to Supabase Realtime channels for live updates.
 * Server-wins conflict resolution (opposite of desktop).
 * Updates useMobileStore without creating circular sync loops.
 */
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { mapCloudBookingToLocal, mapCloudRoomToLocal } from '@/mobile/lib/mobileSyncEngine';
import { Booking, HistoryRecord, Room } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

let activeChannel: RealtimeChannel | null = null;

// Flag to prevent circular updates when we ourselves write data
let _suppressRealtimeUpdates = false;

export function suppressRealtimeUpdates(suppress: boolean) {
  _suppressRealtimeUpdates = suppress;
  // Auto-reset after 2 seconds to prevent permanent suppression
  if (suppress) {
    setTimeout(() => { _suppressRealtimeUpdates = false; }, 2000);
  }
}

export function subscribeMobileRealtime() {
  if (!supabase || !isSupabaseAvailable()) {
    console.warn('[MobileRealtime] Supabase not available.');
    return;
  }

  unsubscribeMobileRealtime();

  const store = () => useMobileStore.getState();

  activeChannel = supabase
    .channel('mobile-sync-bridge')

    // 1. Bookings changes
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const deletedId = oldRow?.id;
        if (!deletedId) return;
        useMobileStore.setState({
          bookings: state.bookings.filter(b => b.id !== deletedId),
          history: state.history.filter(h => h.id !== deletedId),
        });
        return;
      }

      if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow?.id) {
        const booking = mapCloudBookingToLocal(newRow);

        if (newRow.status === 'COMPLETED') {
          const historyRecord: HistoryRecord = {
            ...booking,
            checkoutDate: newRow.check_out || new Date().toISOString(),
            finalAmount: Number(newRow.final_amount || 0),
            totalPaid: Number(newRow.total_paid || 0),
          };

          const existingIdx = state.history.findIndex(h => h.id === newRow.id);
          const updatedHistory = [...state.history];
          if (existingIdx > -1) {
            updatedHistory[existingIdx] = historyRecord;
          } else {
            updatedHistory.unshift(historyRecord);
          }

          useMobileStore.setState({
            history: updatedHistory,
            bookings: state.bookings.filter(b => b.id !== newRow.id),
          });
        } else {
          const existingIdx = state.bookings.findIndex(b => b.id === newRow.id);
          const updatedBookings = [...state.bookings];
          if (existingIdx > -1) {
            updatedBookings[existingIdx] = booking;
          } else {
            updatedBookings.push(booking);
          }

          useMobileStore.setState({ bookings: updatedBookings });
        }
      }
    })

    // 2. Room Statuses
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_statuses' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const roomNo = oldRow?.room_no;
        if (roomNo) {
          const newStatus = { ...state.roomStatus };
          delete newStatus[roomNo];
          useMobileStore.setState({ roomStatus: newStatus });
        }
        return;
      }

      if (newRow?.room_no) {
        const status = newRow.status;
        const newRoomStatus = { ...state.roomStatus };
        if (status === 'cleaning' || status === 'maintenance') {
          newRoomStatus[newRow.room_no] = status;
        } else {
          delete newRoomStatus[newRow.room_no];
        }
        useMobileStore.setState({ roomStatus: newRoomStatus });
      }
    })

    // 3. Rooms
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const roomNo = oldRow?.room_no;
        if (roomNo) {
          useMobileStore.setState({ rooms: state.rooms.filter(r => r.roomNo !== roomNo) });
        }
        return;
      }

      if (newRow?.room_no) {
        const room = mapCloudRoomToLocal(newRow);
        const existingIdx = state.rooms.findIndex(r => r.roomNo === room.roomNo);
        const updatedRooms = [...state.rooms];
        if (existingIdx > -1) {
          updatedRooms[existingIdx] = room;
        } else {
          updatedRooms.push(room);
        }
        useMobileStore.setState({ rooms: updatedRooms });
      }
    })

    // 4. Staff
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();

      if (eventType === 'DELETE') {
        const name = oldRow?.name;
        if (name) {
          useMobileStore.setState({ staff: state.staff.filter(s => s.name !== name) });
        }
        return;
      }

      if (newRow?.name) {
        const staffObj = {
          name: newRow.name,
          role: newRow.role || 'Staff',
          salary: Number(newRow.salary || 0),
          updated_at: newRow.updated_at,
          version: newRow.version || 1,
          source: newRow.source || 'cloud' as const,
        };
        const existingIdx = state.staff.findIndex(s => s.name === staffObj.name);
        const updatedStaff = [...state.staff];
        if (existingIdx > -1) {
          updatedStaff[existingIdx] = staffObj;
        } else {
          updatedStaff.push(staffObj);
        }
        useMobileStore.setState({ staff: updatedStaff });
      }
    })

    // 5. Staff Logs
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_logs' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow } = payload;
      const state = store();

      if (eventType === 'INSERT' && newRow) {
        const exists = state.staffLogs.some(
          l => l.date === newRow.date && l.staff === newRow.staff && l.msg === newRow.msg
        );
        if (!exists) {
          useMobileStore.setState({
            staffLogs: [{
              date: newRow.date,
              staff: newRow.staff,
              type: newRow.type as any,
              amount: Number(newRow.amount || 0),
              msg: newRow.msg || '',
              updated_at: newRow.updated_at || newRow.created_at,
              version: newRow.version || 1,
              source: newRow.source || 'cloud',
            }, ...state.staffLogs],
          });
        }
      }
    })

    // 6. Invoice Settings
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_settings' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow } = payload;
      const state = store();

      if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow) {
        useMobileStore.setState({
          invoiceSettings: {
            ...state.invoiceSettings,
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
          },
        });
      }
    })

    // 7. Categories
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_categories' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload as any;
      const state = store();
      if (eventType === 'DELETE' && oldRow?.name) {
        useMobileStore.setState({ customCategories: state.customCategories.filter(c => c !== oldRow.name) });
      } else if (newRow?.name && !state.customCategories.includes(newRow.name)) {
        useMobileStore.setState({ customCategories: [...state.customCategories, newRow.name] });
      }
    })

    // 8. Bed Types
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bed_types' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload as any;
      const state = store();
      if (eventType === 'DELETE' && oldRow?.name) {
        useMobileStore.setState({ customBedTypes: state.customBedTypes.filter(b => b !== oldRow.name) });
      } else if (newRow?.name && !state.customBedTypes.includes(newRow.name)) {
        useMobileStore.setState({ customBedTypes: [...state.customBedTypes, newRow.name] });
      }
    })

    // 9. Room Holds
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_holds' }, (payload) => {
      if (_suppressRealtimeUpdates) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      const state = store();
      
      if (eventType === 'DELETE' && oldRow?.id) {
        useMobileStore.setState({ roomHolds: state.roomHolds.filter(h => h.id !== oldRow.id) });
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
        useMobileStore.setState({ roomHolds: updated });
      }
    })

    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[MobileRealtime] Subscribed to all channels.');
        useMobileStore.getState().setSyncStatus('synced');
      }
    });
}

export function unsubscribeMobileRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    console.log('[MobileRealtime] Unsubscribed.');
  }
}
