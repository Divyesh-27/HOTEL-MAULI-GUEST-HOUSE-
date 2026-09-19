/**
 * Mobile Sync Actions — Android Companion App
 * 
 * Direct Supabase writes (no SQLite queue like desktop).
 * For conflict-sensitive ops (bookings): server-first with confirmation.
 * For non-conflict ops (attendance, staff): local-first with async push.
 */
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { Booking, HistoryRecord, InvoiceSettings } from '@/types';

export interface SyncResult {
  success: boolean;
  error?: string;
  conflictingRoom?: string;
}

// ============================================================
// BOOKINGS — Server-validated (conflict sensitive)
// ============================================================

export async function pushMobileBookingToCloud(booking: Booking): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }

  try {
    const record = {
      id: booking.id,
      bill_no: booking.billNo,
      bill_date: booking.billDate,
      guest_name: booking.guestName,
      mobile: booking.mobile,
      address: booking.address,
      occupation: booking.occupation || '',
      age: booking.age || '',
      identity_proof_type: booking.identityProofType || '',
      persons: booking.persons,
      other_persons: booking.otherPersons || '',
      coming_from: booking.coming || '',
      going_to: booking.going || '',
      check_in: booking.checkIn,
      days: booking.days,
      room_nos: booking.roomNos,
      advance_total: booking.advance || 0,
      advance_payments: booking.advancePayments || [],
      pay_mode: booking.payMode || 'Cash',
      extras: booking.extras || [],
      discount: booking.discount || 0,
      discount_note: booking.discountNote || '',
      discount_reason: booking.discountReason || '',
      show_discount_on_invoice: booking.showDiscountOnInvoice ?? true,
      enable_gst_invoice: booking.enableGstInvoice ?? true,
      status: booking.isReservation ? 'RESERVED' : 'CHECKED_IN',
      car_no: booking.carNo || '',
      car_model: booking.carModel || '',
      identity_proof: booking.identityProof || null,
      identity_proof_url: booking.identityProofUrl || null,
      digital_signature: booking.digitalSignature || null,
      digital_signature_url: booking.digitalSignatureUrl || null,
      updated_at: new Date().toISOString(),
      version: (booking.version || 0) + 1,
      source: 'mobile',
    };

    const { error } = await supabase.from('bookings').upsert(record, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function deleteMobileBookingFromCloud(id: string): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function pushMobileHistoryToCloud(record: HistoryRecord): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const payload = {
      id: record.id,
      bill_no: record.billNo,
      bill_date: record.billDate,
      guest_name: record.guestName,
      mobile: record.mobile,
      address: record.address,
      occupation: record.occupation || '',
      age: record.age || '',
      identity_proof_type: record.identityProofType || '',
      persons: record.persons,
      other_persons: record.otherPersons || '',
      coming_from: record.coming || '',
      going_to: record.going || '',
      check_in: record.checkIn,
      check_out: record.checkoutDate,
      days: record.days,
      room_nos: record.roomNos,
      advance_total: record.advance || 0,
      advance_payments: record.advancePayments || [],
      pay_mode: record.payMode || 'Cash',
      extras: record.extras || [],
      discount: record.discount || 0,
      discount_note: record.discountNote || '',
      status: 'COMPLETED',
      final_amount: record.finalAmount || 0,
      total_paid: record.totalPaid || 0,
      car_no: record.carNo || '',
      car_model: record.carModel || '',
      identity_proof: record.identityProof || null,
      identity_proof_url: record.identityProofUrl || null,
      digital_signature: record.digitalSignature || null,
      digital_signature_url: record.digitalSignatureUrl || null,
      updated_at: new Date().toISOString(),
      version: (record.version || 0) + 1,
      source: 'mobile',
    };

    const { error } = await supabase.from('bookings').upsert(payload, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// ROOM STATUSES
// ============================================================

export async function pushMobileRoomStatusToCloud(roomNo: string, status: 'cleaning' | 'maintenance' | 'available' | null): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }

  try {
    if (status === 'available' || status === null) {
      const { error } = await supabase.from('room_statuses').delete().eq('room_no', roomNo);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } else {
      const { error } = await supabase.from('room_statuses').upsert({
        id: roomNo,
        room_no: roomNo,
        status,
        updated_at: new Date().toISOString(),
        source: 'mobile',
      }, { onConflict: 'id' });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMobileRoomStatusFromCloud(roomNo: string): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const { error } = await supabase.from('room_statuses').delete().eq('id', roomNo);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// ROOMS
// ============================================================

export async function pushMobileRoomToCloud(room: { roomNo: string; category: string; bedType: string; rent: number }): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const { error } = await supabase.from('rooms').upsert({
      id: room.roomNo,
      room_no: room.roomNo,
      category: room.category,
      bed_type: room.bedType,
      rent: room.rent,
      updated_at: new Date().toISOString(),
      source: 'mobile',
    }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// STAFF & LOGS
// ============================================================

export async function pushMobileStaffToCloud(staff: { name: string; role: string; salary: number }): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const { error } = await supabase.from('staff').upsert({
      id: staff.name,
      name: staff.name,
      role: staff.role,
      salary: staff.salary,
      updated_at: new Date().toISOString(),
      source: 'mobile',
    }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function pushMobileStaffLogToCloud(log: { date: string; staff: string; type: string; amount: number; msg: string }, localId: string): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const { error } = await supabase.from('staff_logs').upsert({
      id: localId,
      local_id: localId,
      date: log.date,
      staff: log.staff,
      type: log.type,
      amount: log.amount,
      msg: log.msg,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'mobile',
    }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// SETTINGS
// ============================================================

export async function pushMobileInvoiceSettingsToCloud(settings: InvoiceSettings): Promise<SyncResult> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }
  try {
    const id = settings.id || 'default-settings';
    const { error } = await supabase.from('invoice_settings').upsert({
      ...settings,
      id,
      updated_at: new Date().toISOString(),
      source: 'mobile',
    }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// STORAGE
// ============================================================

export async function uploadBase64ToStorage(bucket: string, path: string, base64Data: string): Promise<string | null> {
  if (!supabase || !isSupabaseAvailable()) return null;
  
  try {
    // Ensure we have a data URI
    const dataUri = base64Data.startsWith('data:') 
      ? base64Data 
      : `data:image/${path.endsWith('.png') ? 'png' : 'jpeg'};base64,${base64Data}`;
      
    // Convert data URI to Blob in a browser-friendly way
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const contentType = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, {
        contentType,
        upsert: true
      });
      
    if (error) {
      console.error(`[MobileSyncActions] Upload failed for ${bucket}/${path}:`, error.message);
      return null;
    }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error(`[MobileSyncActions] Upload exception for ${bucket}/${path}:`, err);
    return null;
  }
}

// ============================================================
// INITIAL DATA FETCH — Pull all current data from Supabase
// ============================================================

export async function fetchAllDataFromCloud(): Promise<{
  rooms: any[];
  bookings: any[];
  roomStatuses: any[];
  staff: any[];
  staffLogs: any[];
  invoiceSettings: any | null;
  categories: string[];
  bedTypes: string[];
} | null> {
  if (!supabase || !isSupabaseAvailable()) return null;

  try {
    const [roomsRes, bookingsRes, statusRes, staffRes, logsRes, settingsRes, catsRes, bedsRes] = await Promise.all([
      supabase.from('rooms').select('*'),
      supabase.from('bookings').select('*'),
      supabase.from('room_statuses').select('*'),
      supabase.from('staff').select('*'),
      supabase.from('staff_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('invoice_settings').select('*').eq('id', 'default-settings').single(),
      supabase.from('room_categories').select('name'),
      supabase.from('room_bed_types').select('name'),
    ]);

    return {
      rooms: roomsRes.data || [],
      bookings: bookingsRes.data || [],
      roomStatuses: statusRes.data || [],
      staff: staffRes.data || [],
      staffLogs: logsRes.data || [],
      invoiceSettings: settingsRes.data || null,
      categories: (catsRes.data || []).map((c: any) => c.name),
      bedTypes: (bedsRes.data || []).map((b: any) => b.name),
    };
  } catch (err) {
    console.error('[MobileSyncActions] fetchAllDataFromCloud error:', err);
    return null;
  }
}
