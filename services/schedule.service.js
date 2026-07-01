/**
 * ============================================================
 * SCHEDULE SERVICE
 * ============================================================
 * Semua query Supabase untuk halaman Jadwal dikumpulkan di sini.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getSchedulesByWeek
 * Mengambil semua jadwal guru yang sedang login dalam rentang
 * satu minggu (dateFrom s/d dateTo), beserta nama kelas & mapel.
 *
 * @param {string} dateFrom  - format "YYYY-MM-DD"
 * @param {string} dateTo    - format "YYYY-MM-DD"
 * @returns {Promise<Array>}
 */
export async function getSchedulesByWeek(dateFrom, dateTo) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("schedules")
    .select(`
      id,
      scheduled_date,
      start_time,
      end_time,
      room,
      notes,
      classes ( id, name ),
      subjects ( id, name )
    `)
    .gte("scheduled_date", dateFrom)
    .lte("scheduled_date", dateTo)
    .order("scheduled_date", { ascending: true })
    .order("start_time",     { ascending: true });

  if (error) {
    console.error("getSchedulesByWeek error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getAttendanceSummaryForSchedule
 * Mengambil ringkasan kehadiran (jumlah hadir/total) untuk
 * satu sesi jadwal — ditampilkan di card jadwal sebagai info cepat.
 *
 * @param {string} scheduleId
 * @returns {Promise<{ recorded: boolean, hadir: number, total: number }>}
 */
export async function getAttendanceSummaryForSchedule(scheduleId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("attendances")
    .select("status")
    .eq("schedule_id", scheduleId);

  if (error || !data) return { recorded: false, hadir: 0, total: 0 };

  const hadir = data.filter((r) => r.status === "hadir").length;
  return { recorded: data.length > 0, hadir, total: data.length };
}

/**
 * createSchedule
 * Membuat satu sesi jadwal mengajar baru.
 * @param {object} payload { teacherId, classId, subjectId, scheduledDate, startTime, endTime, room?, notes? }
 */
export async function createSchedule(payload) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase.from("schedules").insert({
    teacher_id:     payload.teacherId,
    class_id:       payload.classId,
    subject_id:     payload.subjectId,
    scheduled_date: payload.scheduledDate,
    start_time:     payload.startTime,
    end_time:       payload.endTime,
    room:           payload.room  || null,
    notes:          payload.notes || null,
  });

  if (error) {
    console.error("createSchedule error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

/**
 * updateSchedule
 * Mengubah data satu sesi jadwal yang sudah ada.
 * @param {string} scheduleId
 * @param {object} payload { classId, subjectId, scheduledDate, startTime, endTime, room?, notes? }
 */
export async function updateSchedule(scheduleId, payload) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("schedules")
    .update({
      class_id:       payload.classId,
      subject_id:     payload.subjectId,
      scheduled_date: payload.scheduledDate,
      start_time:     payload.startTime,
      end_time:       payload.endTime,
      room:           payload.room  || null,
      notes:          payload.notes || null,
    })
    .eq("id", scheduleId);

  if (error) {
    console.error("updateSchedule error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

/**
 * deleteSchedule
 * Menghapus satu sesi jadwal.
 * @param {string} scheduleId
 */
export async function deleteSchedule(scheduleId) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    console.error("deleteSchedule error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}
