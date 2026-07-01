/**
 * ============================================================
 * SUPABASE SERVICE (Singleton)
 * ============================================================
 * File ini bertugas membuat dan menyediakan SATU instance
 * Supabase Client yang dipakai di seluruh aplikasi.
 *
 * Kenapa Singleton?
 * - Supabase client menyimpan session/auth state di memory.
 *   Kalau kita bikin instance baru di setiap file, session bisa
 *   tidak sinkron. Dengan singleton, semua file mengambil
 *   instance YANG SAMA.
 *
 * Karena kita TIDAK pakai Node.js/bundler, SDK Supabase
 * di-load langsung dari CDN (ESM build) memakai dynamic import.
 * Ini membuat kode tetap berbentuk ES Module murni dan bisa
 * jalan langsung di browser tanpa build step.
 * ============================================================
 */

import { SUPABASE_CONFIG } from "../config/supabase.config.js";

// CDN ESM build resmi dari Supabase. Versi di-pin (bukan @latest)
// supaya project tidak tiba-tiba rusak kalau ada breaking change.
const SUPABASE_CDN_URL = "https://esm.sh/@supabase/supabase-js@2";

let supabaseInstance = null;

/**
 * getSupabaseClient
 * Mengambil instance Supabase Client. Kalau belum ada,
 * client akan dibuat sekali saja (lazy initialization).
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { createClient } = await import(SUPABASE_CDN_URL);

  supabaseInstance = createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        // Menyimpan session di localStorage agar user tetap login
        // walau browser ditutup (mendukung fitur "Remember Login").
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  return supabaseInstance;
}

/**
 * getCurrentUserId
 * Ambil UUID user yang sedang login.
 * Dipakai oleh semua service saat insert data baru.
 */
export async function getCurrentUserId() {
  const supabase = await getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
