/**
 * Supabase Bridge — Phase 3 Synchronization Engine
 * 
 * Single, clean Supabase client initialization.
 * Supabase is ONLY a temporary synchronization bridge between Desktop and Android.
 * Supabase is NEVER the master database. SQLite is ALWAYS the permanent source of truth.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://your-project-url.supabase.co') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: { eventsPerSecond: 2 },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    console.log('[Supabase] Client initialized.');
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    supabase = null;
  }
} else {
  console.warn('[Supabase] Missing or placeholder credentials. Cloud sync disabled — Desktop operates in offline-only mode.');
}

/**
 * Check if Supabase is available and configured.
 */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

/**
 * Upload a base64 data URL to Supabase Storage.
 * Returns the public URL or null on failure.
 * Never blocks booking creation — called asynchronously from sync queue.
 */
export async function uploadMediaToCloud(bucket: string, filePath: string, base64: string): Promise<string | null> {
  if (!supabase || !base64) return null;
  if (!base64.startsWith('data:')) return base64; // Already a URL

  try {
    // Extract mime type and base64 data
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const b64Data = match[2];
    const buffer = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn(`[Supabase] Storage upload error for ${bucket}/${filePath}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn(`[Supabase] Storage upload exception for ${bucket}/${filePath}:`, err);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteMediaFromCloud(bucket: string, filePath: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * Room Hold Functions (Phase 3 Sync Architecture)
 */
export async function createRoomHold(roomNo: string, deviceId: string): Promise<boolean> {
  if (!supabase || !isSupabaseAvailable() || typeof navigator !== 'undefined' && !navigator.onLine) return false;
  
  try {
    const holdId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    // Expires in exactly 5 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    const { error } = await supabase.from('room_holds').insert({
      id: holdId,
      room_no: roomNo,
      device_id: deviceId,
      expires_at: expiresAt.toISOString(),
      status: 'active'
    });
    
    return !error;
  } catch (err) {
    console.warn('[Supabase] Failed to create room hold:', err);
    return false;
  }
}

export async function releaseRoomHold(roomNo: string, deviceId: string): Promise<void> {
  if (!supabase || !isSupabaseAvailable() || typeof navigator !== 'undefined' && !navigator.onLine) return;
  
  try {
    // Delete any active hold for this room by this specific device
    await supabase.from('room_holds')
      .delete()
      .eq('room_no', roomNo)
      .eq('device_id', deviceId);
  } catch (err) {
    console.warn('[Supabase] Failed to release room hold:', err);
  }
}

export { supabase };
