/**
 * ============================================================
 * DASHBOARD SERVICE
 * ============================================================
 * Semua query Supabase khusus untuk halaman Dasbor dikumpulkan
 * di sini. Frontend tinggal import fungsi — tidak ada query
 * berserakan di dalam HTML/view file.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getDashboardStats
 * Mengambil 4 angka stat card sekaligus lewat view
 * v_teacher_dashboard_stats (RLS otomatis membatasi ke guru
 * yang sedang login).
 *
 * @returns {Promise<{
 *   sessions_today: number,
 *   students_present_today: number,
 *   total_students: number,
 *   ungraded_tasks: number,
 *   avg_score: number|null
 * }|null>}
 */
export async function getDashboardStats() {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("v_teacher_dashboard_stats")
    .select("*")
    .single();

  if (error) {
    console.error("getDashboardStats error:", error.message);
    return null;
  }

  return data;
}

/**
 * getTodaySchedules
 * Mengambil jadwal mengajar guru yang sedang login untuk hari ini,
 * diurutkan dari jam paling pagi, beserta nama kelas & mata pelajaran.
 *
 * @returns {Promise<Array>}
 */
export async function getTodaySchedules() {
  const supabase = await getSupabaseClient();

  // Format tanggal hari ini ke 'YYYY-MM-DD' tanpa library date tambahan
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("schedules")
    .select(`
      id,
      scheduled_date,
      start_time,
      end_time,
      room,
      classes ( name ),
      subjects ( name )
    `)
    .eq("scheduled_date", today)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("getTodaySchedules error:", error.message);
    return [];
  }

  return data ?? [];
}
