/**
 * ============================================================
 * ADMIN SERVICE
 * ============================================================
 * Khusus dipakai oleh halaman account-management (admin only).
 * Karena RLS mengizinkan admin baca semua baris, query di sini
 * tidak perlu filter teacher_id — cukup filter lewat parameter.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getTeacherData
 * Ambil semua data milik satu guru tertentu dari tabel manapun.
 * @param {"classes"|"subjects"|"schedules"|"grades"|"students"} table
 * @param {string} teacherId - UUID guru yang ingin dilihat datanya
 */
export async function getTeacherData(table, teacherId) {
  const supabase = await getSupabaseClient();
  const TABLES_WITH_SOFT_DELETE = ["assignments"];
  const TABLES_WITHOUT_TEACHER_ID = ["classes", "subjects", "students", "attendances"];

  let query = supabase.from(table).select("*");

  // Tabel yang sudah punya teacher_id terisi → filter per guru
  // Tabel yang teacher_id-nya masih NULL → tampilkan semua (sementara)
  if (!TABLES_WITHOUT_TEACHER_ID.includes(table)) {
    query = query.eq("teacher_id", teacherId);
  }

  if (TABLES_WITH_SOFT_DELETE.includes(table)) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) { console.error(`getTeacherData(${table}) error:`, error.message); return []; }
  return data ?? [];
}

/**
 * getAllDataByTable
 * Ambil semua data dari satu tabel (semua guru).
 * Dipakai admin untuk halaman monitoring/overview.
 * @param {"classes"|"subjects"|"schedules"|"grades"|"students"} table
 */
export async function getAllDataByTable(table) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .select("*, teachers(full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) { console.error(`getAllDataByTable(${table}) error:`, error.message); return []; }
  return data ?? [];
}
