/**
 * Mobile Sync Engine — Android Companion App
 * 
 * Manages initial data fetch, sync status, and connection monitoring.
 * Unlike desktop (queue-based), mobile uses direct Supabase writes.
 * This engine handles: initial bootstrap, status tracking, reconnection.
 */
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { useMobileStore, SyncStatusType } from '@/mobile/store/useMobileStore';
import { fetchAllDataFromCloud } from '@/mobile/lib/mobileSyncActions';
import { subscribeMobileRealtime, unsubscribeMobileRealtime } from '@/mobile/lib/mobileRealtimeSync';
import { Booking, HistoryRecord, Room } from '@/types';

let engineStarted = false;
let onlineListenerRegistered = false;

/**
 * Transform Supabase booking row (snake_case) to local Booking (camelCase)
 */
function mapCloudBookingToLocal(row: any): Booking {
  return {
    id: row.id,
    billNo: row.bill_no || 0,
    billDate: row.bill_date || new Date().toLocaleDateString(),
    guestName: row.guest_name || row.guestName || 'Guest',
    mobile: row.mobile || '',
    address: row.address || '',
    occupation: row.occupation || '',
    age: row.age || '',
    identityProofType: row.identity_proof_type || '',
    persons: row.persons || '1',
    otherPersons: row.other_persons || '',
    coming: row.coming_from || row.coming || '',
    going: row.going_to || row.going || '',
    checkIn: row.check_in || row.checkIn || new Date().toISOString(),
    days: Number(row.days) || 1,
    roomNos: Array.isArray(row.room_nos) ? row.room_nos : (row.roomNos || []),
    advance: Number(row.advance_total || row.advance || 0),
    advancePayments: Array.isArray(row.advance_payments) ? row.advance_payments : [],
    payMode: row.pay_mode || row.payMode || 'Cash',
    extras: Array.isArray(row.extras) ? row.extras : [],
    discount: Number(row.discount || 0),
    discountNote: row.discount_note || row.discountNote || '',
    discountReason: row.discount_reason || row.discountReason || '',
    showDiscountOnInvoice: row.show_discount_on_invoice ?? true,
    enableGstInvoice: row.enable_gst_invoice ?? true,
    isReservation: row.status === 'RESERVED' || row.isReservation === true,
    carNo: row.car_no || row.carNo || '',
    carModel: row.car_model || row.carModel || '',
    identityProof: row.identity_proof || '',
    identityProofUrl: row.identity_proof_url || '',
    digitalSignature: row.digital_signature || '',
    digitalSignatureUrl: row.digital_signature_url || '',
    invoiceHtml: row.invoice_html || '',
    updated_at: row.updated_at || new Date().toISOString(),
    version: row.version || 1,
    source: row.source || 'cloud',
  };
}

function mapCloudRoomToLocal(row: any): Room {
  return {
    roomNo: row.room_no || row.roomNo,
    category: row.category || 'AC',
    bedType: row.bed_type || row.bedType || 'Double Bed',
    rent: Number(row.rent || 0),
    updated_at: row.updated_at,
    version: row.version || 1,
    source: row.source || 'cloud',
  };
}

/**
 * Bootstrap: fetch all data from Supabase and populate the mobile store.
 */
async function bootstrapFromCloud(): Promise<boolean> {
  const store = useMobileStore.getState();
  store.setSyncStatus('syncing');

  const data = await fetchAllDataFromCloud();
  if (!data) {
    store.setSyncStatus('sync-failed');
    return false;
  }

  // Map rooms
  const rooms: Room[] = data.rooms.map(mapCloudRoomToLocal);

  // Map bookings (split by status)
  const bookings: Booking[] = [];
  const history: HistoryRecord[] = [];

  data.bookings.forEach((row: any) => {
    const booking = mapCloudBookingToLocal(row);
    if (row.status === 'COMPLETED') {
      history.push({
        ...booking,
        checkoutDate: row.check_out || new Date().toISOString(),
        finalAmount: Number(row.final_amount || 0),
        totalPaid: Number(row.total_paid || 0),
      });
    } else {
      bookings.push(booking);
    }
  });

  // Map room statuses
  const roomStatus: Record<string, 'cleaning' | 'maintenance'> = {};
  data.roomStatuses.forEach((rs: any) => {
    if (rs.room_no && (rs.status === 'cleaning' || rs.status === 'maintenance')) {
      roomStatus[rs.room_no] = rs.status;
    }
  });

  // Map staff
  const staff = data.staff.map((s: any) => ({
    name: s.name,
    role: s.role || 'Staff',
    salary: Number(s.salary || 0),
    updated_at: s.updated_at,
    version: s.version || 1,
    source: s.source || 'cloud',
  }));

  // Map staff logs
  const staffLogs = data.staffLogs.map((l: any) => ({
    date: l.date,
    staff: l.staff,
    type: l.type as any,
    amount: Number(l.amount || 0),
    msg: l.msg || '',
    updated_at: l.updated_at || l.created_at,
    version: l.version || 1,
    source: l.source || 'cloud',
  }));

  // Invoice settings
  const invoiceSettings = data.invoiceSettings ? {
    ...store.invoiceSettings,
    gst_enabled: data.invoiceSettings.gst_enabled ?? store.invoiceSettings.gst_enabled,
    gst_number: data.invoiceSettings.gst_number || store.invoiceSettings.gst_number,
    slab1_limit: Number(data.invoiceSettings.slab1_limit ?? store.invoiceSettings.slab1_limit),
    slab1_gst: Number(data.invoiceSettings.slab1_gst ?? store.invoiceSettings.slab1_gst),
    slab1_cgst: Number(data.invoiceSettings.slab1_cgst ?? store.invoiceSettings.slab1_cgst),
    slab1_sgst: Number(data.invoiceSettings.slab1_sgst ?? store.invoiceSettings.slab1_sgst),
    slab2_from: Number(data.invoiceSettings.slab2_from ?? store.invoiceSettings.slab2_from),
    slab2_to: Number(data.invoiceSettings.slab2_to ?? store.invoiceSettings.slab2_to),
    slab2_gst: Number(data.invoiceSettings.slab2_gst ?? store.invoiceSettings.slab2_gst),
    slab2_cgst: Number(data.invoiceSettings.slab2_cgst ?? store.invoiceSettings.slab2_cgst),
    slab2_sgst: Number(data.invoiceSettings.slab2_sgst ?? store.invoiceSettings.slab2_sgst),
    slab3_from: Number(data.invoiceSettings.slab3_from ?? store.invoiceSettings.slab3_from),
    slab3_gst: Number(data.invoiceSettings.slab3_gst ?? store.invoiceSettings.slab3_gst),
    slab3_cgst: Number(data.invoiceSettings.slab3_cgst ?? store.invoiceSettings.slab3_cgst),
    slab3_sgst: Number(data.invoiceSettings.slab3_sgst ?? store.invoiceSettings.slab3_sgst),
    show_gstin_advance: data.invoiceSettings.show_gstin_advance ?? store.invoiceSettings.show_gstin_advance,
    show_gstin_final: data.invoiceSettings.show_gstin_final ?? store.invoiceSettings.show_gstin_final,
    show_breakup_advance: data.invoiceSettings.show_breakup_advance ?? store.invoiceSettings.show_breakup_advance,
    show_breakup_final: data.invoiceSettings.show_breakup_final ?? store.invoiceSettings.show_breakup_final,
  } : store.invoiceSettings;

  // Categories & bed types
  const categories = data.categories.length > 0
    ? Array.from(new Set([...store.customCategories, ...data.categories]))
    : store.customCategories;
  const bedTypes = data.bedTypes.length > 0
    ? Array.from(new Set([...store.customBedTypes, ...data.bedTypes]))
    : store.customBedTypes;

  // Merge into store
  store.mergeSyncedData({
    rooms,
    bookings,
    history,
    roomStatus,
    staff,
    staffLogs,
    invoiceSettings,
    customCategories: categories,
    customBedTypes: bedTypes,
  });

  store.setSyncStatus('synced');
  store.setLastSyncedAt(new Date().toISOString());
  return true;
}

// ============================================================
// ROOM HOLDS CLEANUP
// ============================================================
let holdCleanupTimer: ReturnType<typeof setInterval> | null = null;

async function cleanupExpiredHolds(): Promise<void> {
  if (!supabase || !isSupabaseAvailable()) return;
  try {
    const nowISO = new Date().toISOString();
    await supabase.from('room_holds').delete().lt('expires_at', nowISO);
  } catch (err) {
    console.warn('[MobileSyncEngine] Room holds cleanup failed:', err);
  }
}

function scheduleHoldCleanup(): void {
  if (holdCleanupTimer) clearInterval(holdCleanupTimer);
  holdCleanupTimer = setInterval(cleanupExpiredHolds, 60000); // Every minute
}

/**
 * Start the mobile sync engine.
 */
export function startMobileSyncEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  // Register online/offline listeners
  if (!onlineListenerRegistered && typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[MobileSyncEngine] Internet restored. Reconnecting...');
      useMobileStore.getState().setSyncStatus('reconnecting');
      bootstrapFromCloud().then(() => {
        subscribeMobileRealtime();
      });
    });

    window.addEventListener('offline', () => {
      console.log('[MobileSyncEngine] Offline.');
      useMobileStore.getState().setSyncStatus('offline');
      unsubscribeMobileRealtime();
    });

    onlineListenerRegistered = true;
  }

  // Initial bootstrap
  if (navigator.onLine && isSupabaseAvailable()) {
    bootstrapFromCloud().then((ok) => {
      if (ok) {
        subscribeMobileRealtime();
        scheduleHoldCleanup();
      }
    });
  } else {
    useMobileStore.getState().setSyncStatus('offline');
  }

  console.log('[MobileSyncEngine] Started.');
}

export function stopMobileSyncEngine(): void {
  unsubscribeMobileRealtime();
  if (holdCleanupTimer) {
    clearInterval(holdCleanupTimer);
    holdCleanupTimer = null;
  }
  engineStarted = false;
  console.log('[MobileSyncEngine] Stopped.');
}

/**
 * Force refresh — pull all data from cloud
 */
export async function refreshFromCloud(): Promise<boolean> {
  return bootstrapFromCloud();
}

// Export the mapper for reuse in realtime sync
export { mapCloudBookingToLocal, mapCloudRoomToLocal };
