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

  // Beberapa tabel butuh join relasi supaya nama kelas/mapel ikut tampil
  const SELECT_MAP = {
    schedules: "*, classes ( id, name ), subjects ( id, name )",
    grades:    "*, students ( id, full_name )",
  };

  let query = supabase
    .from(table)
    .select(SELECT_MAP[table] ?? "*")
    .eq("teacher_id", teacherId);

  if (TABLES_WITH_SOFT_DELETE.includes(table)) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) { console.error(`getTeacherData(${table}) error:`, error.message); return []; }
  return data ?? [];
}

/**
 * getTeacherGrades
 * Ambil semua nilai (assignments + scores) milik satu guru,
 * dipakai khusus untuk tab "Nilai" di modal admin — karena
 * strukturnya beda dari tabel lain (assignments → scores).
 * @param {string} teacherId
 */
export async function getTeacherGrades(teacherId) {
  const supabase = await getSupabaseClient();

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select(`
      id, title, category, max_score, assigned_date,
      classes ( name ),
      subjects ( name ),
      scores ( id, score, students ( full_name ) )
    `)
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("assigned_date", { ascending: false });

  if (error) {
    console.error("getTeacherGrades error:", error.message);
    return [];
  }

  return assignments ?? [];
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
    .select("*, teachers:teacher_id ( full_name, email )")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) { console.error(`getAllDataByTable(${table}) error:`, error.message); return []; }
  return data ?? [];
}
