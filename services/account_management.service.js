/**
 * ============================================================
 * ACCOUNT MANAGEMENT SERVICE
 * ============================================================
 * Hanya bisa dipakai oleh admin. Semua operasi yang butuh
 * service_role (ubah email/password orang lain) diarahkan
 * ke Edge Function admin-update-account.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";
import { SUPABASE_CONFIG } from "../config/supabase.config.js";

const EDGE_FUNCTION_URL =
  `${SUPABASE_CONFIG.url}/functions/v1/admin-update-account`;

/**
 * getAllTeachers
 * Ambil semua akun guru/admin. RLS memastikan hanya admin yang bisa.
 */
export async function getAllTeachers() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, email, role, is_active, created_at, nip")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getAllTeachers error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * adminUpdateAccount
 * Panggil Edge Function untuk update email/password/nama akun siapapun.
 * @param {{ targetUserId: string, fullName?: string, email?: string, password?: string }} payload
 */
export async function adminUpdateAccount(payload) {
  const supabase = await getSupabaseClient();

  // Ambil JWT session yang sedang login (dikirim ke Edge Function sebagai auth)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Tidak ada sesi aktif." };

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    return { success: false, error: json.error ?? "Gagal memperbarui akun." };
  }
  return { success: true, error: null };
}

/**
 * toggleTeacherActive
 * Aktifkan / nonaktifkan akun guru (soft disable, bukan delete).
 * @param {string} teacherId
 * @param {boolean} isActive
 */
export async function toggleTeacherActive(teacherId, isActive) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("teachers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", teacherId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
