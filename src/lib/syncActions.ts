/**
 * Synchronization Actions — Phase 3 Rebuild
 * 
 * Replaces direct Firebase/Firestore calls with non-blocking enqueuing to SQLite `sync_queue`.
 * All push/delete actions return immediately so UI components (`Dashboard`, `Registration`, etc.)
 * feel 100% instantaneous and offline-safe.
 */
import { enqueueSync } from '@/lib/syncEngine';
import { uploadMediaToCloud } from '@/lib/supabaseBridge';
import { Booking, HistoryRecord, InvoiceSettings } from '@/types';

/**
 * Upload a base64 data URL to Supabase Storage.
 * Attempts quick upload if online; if offline or fails, enqueues to background `sync_queue`
 * and returns local base64 so booking creation is never blocked or delayed.
 */
export async function uploadBase64ToStorage(bucket: string, path: string, base64: string): Promise<string | null> {
  if (!base64) return null;
  if (!base64.startsWith('data:')) return base64; // Already a URL

  // Try quick direct upload if network is up
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const url = await uploadMediaToCloud(bucket, path, base64);
      if (url) return url;
    } catch (e) {
      console.warn('[SyncActions] Direct media upload failed, enqueuing for background worker:', e);
    }
  }

  // Enqueue for background retry
  const bookingId = path.split('/')[0] || 'media-upload';
  const field = bucket === 'identity-proofs' ? 'identityProofUrl' : 'digitalSignatureUrl';
  enqueueSync('media', `${bookingId}-${field}`, 'UPSERT', {
    bucket,
    filePath: path,
    base64,
    bookingId,
    field,
  });

  return base64; // Return base64 temporarily so local UI can render immediately
}

// ============================================================
// BOOKINGS & HISTORY
// ============================================================

export async function pushBookingToCloud(booking: Booking) {
  try {
    const record = {
      ...booking,
      room_nos: booking.roomNos,
      check_in: booking.checkIn,
      check_out: booking.checkoutDate || null,
      status: booking.isReservation ? 'RESERVED' : 'CHECKED_IN',
      advance_total: booking.advance || 0,
      advance_payments: booking.advancePayments || [],
      pay_mode: booking.payMode || 'Cash',
      identity_proof: booking.identityProof || null,
      identity_proof_url: booking.identityProofUrl || null,
      digital_signature: booking.digitalSignature || null,
      digital_signature_url: booking.digitalSignatureUrl || null,
      updated_at: new Date().toISOString(),
      version: (booking.version || 0) + 1,
      source: 'desktop',
    };

    // Enqueue non-blocking
    enqueueSync('bookings', booking.id, 'UPSERT', record);
  } catch (err) {
    console.error('[SyncActions] pushBookingToCloud error:', err);
  }
}

export async function deleteBookingFromCloud(localId: string) {
  try {
    enqueueSync('bookings', localId, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteBookingFromCloud error:', err);
  }
}

export async function pushHistoryToCloud(record: HistoryRecord) {
  try {
    const payload = {
      ...record,
      room_nos: record.roomNos,
      check_in: record.checkIn,
      check_out: record.checkoutDate,
      status: 'COMPLETED',
      final_amount: record.finalAmount || 0,
      total_paid: record.totalPaid || 0,
      advance_total: record.advance || 0,
      advance_payments: record.advancePayments || [],
      pay_mode: record.payMode || 'Cash',
      identity_proof: record.identityProof || null,
      identity_proof_url: record.identityProofUrl || null,
      digital_signature: record.digitalSignature || null,
      digital_signature_url: record.digitalSignatureUrl || null,
      updated_at: new Date().toISOString(),
      version: (record.version || 0) + 1,
      source: 'desktop',
    };

    enqueueSync('bookings', record.id, 'UPSERT', payload);
  } catch (err) {
    console.error('[SyncActions] pushHistoryToCloud error:', err);
  }
}

// ============================================================
// ROOM STATUSES
// ============================================================

export async function pushRoomStatusToCloud(roomNo: string, status: 'cleaning' | 'maintenance') {
  try {
    enqueueSync('room_statuses', roomNo, 'UPSERT', {
      room_no: roomNo,
      status,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushRoomStatusToCloud error:', err);
  }
}

export async function deleteRoomStatusFromCloud(roomNo: string) {
  try {
    enqueueSync('room_statuses', roomNo, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteRoomStatusFromCloud error:', err);
  }
}

// ============================================================
// STAFF & LOGS
// ============================================================

export async function pushStaffToCloud(staffMember: { name: string; role: string; salary: number }) {
  try {
    enqueueSync('staff', staffMember.name, 'UPSERT', {
      name: staffMember.name,
      role: staffMember.role,
      salary: staffMember.salary,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushStaffToCloud error:', err);
  }
}

export async function deleteStaffFromCloud(name: string) {
  try {
    enqueueSync('staff', name, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteStaffFromCloud error:', err);
  }
}

export async function pushStaffLogToCloud(log: { date: string; staff: string; type: string; amount: number; msg: string }, localId: string) {
  try {
    enqueueSync('staff_logs', localId, 'UPSERT', {
      local_id: localId,
      date: log.date,
      staff: log.staff,
      type: log.type,
      amount: log.amount,
      msg: log.msg,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushStaffLogToCloud error:', err);
  }
}

// ============================================================
// SETTINGS & METADATA
// ============================================================

export async function pushInvoiceSettingsToCloud(settings: InvoiceSettings) {
  try {
    const id = settings.id || 'default-settings';
    enqueueSync('invoice_settings', id, 'UPSERT', {
      ...settings,
      id,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushInvoiceSettingsToCloud error:', err);
  }
}

export async function pushRoomToCloud(room: { roomNo: string; category: string; bedType: string; rent: number; roomName?: string; roomType?: string; floor?: string; description?: string }) {
  try {
    enqueueSync('rooms', room.roomNo, 'UPSERT', {
      room_no: room.roomNo,
      category: room.category,
      bed_type: room.bedType,
      rent: room.rent,
      room_name: room.roomName || null,
      room_type: room.roomType || null,
      floor: room.floor || null,
      description: room.description || null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushRoomToCloud error:', err);
  }
}

export async function deleteRoomFromCloud(roomNo: string) {
  try {
    enqueueSync('rooms', roomNo, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteRoomFromCloud error:', err);
  }
}

export async function pushCategoryToCloud(name: string) {
  try {
    enqueueSync('room_categories', name, 'UPSERT', {
      name,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushCategoryToCloud error:', err);
  }
}

export async function deleteCategoryFromCloud(name: string) {
  try {
    enqueueSync('room_categories', name, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteCategoryFromCloud error:', err);
  }
}

export async function pushBedTypeToCloud(name: string) {
  try {
    enqueueSync('room_bed_types', name, 'UPSERT', {
      name,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushBedTypeToCloud error:', err);
  }
}

export async function deleteBedTypeFromCloud(name: string) {
  try {
    enqueueSync('room_bed_types', name, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteBedTypeFromCloud error:', err);
  }
}

// ============================================================
// USERS & ROLES
// ============================================================

export async function pushAppRoleToCloud(role: import('@/types').AppRole) {
  try {
    enqueueSync('app_roles', role.id, 'UPSERT', {
      id: role.id,
      name: role.name,
      permissions: role.permissions,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushAppRoleToCloud error:', err);
  }
}

export async function deleteAppRoleFromCloud(id: string) {
  try {
    enqueueSync('app_roles', id, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteAppRoleFromCloud error:', err);
  }
}

export async function pushAppUserToCloud(user: import('@/types').AppUser) {
  try {
    enqueueSync('app_users', user.id, 'UPSERT', {
      id: user.id,
      full_name: user.fullName,
      username: user.username,
      password_hash: user.passwordHash,
      role_id: user.roleId,
      status: user.status,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SyncActions] pushAppUserToCloud error:', err);
  }
}

export async function deleteAppUserFromCloud(id: string) {
  try {
    enqueueSync('app_users', id, 'DELETE');
  } catch (err) {
    console.error('[SyncActions] deleteAppUserFromCloud error:', err);
  }
}
