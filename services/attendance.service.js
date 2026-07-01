/**
 * ============================================================
 * ATTENDANCE SERVICE
 * ============================================================
 * Semua query Supabase untuk fitur Kehadiran dikumpulkan di sini.
 * Halaman attendance.html tinggal import fungsi — tidak ada query
 * berserakan di dalam HTML/view file (Single Responsibility).
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getStudentsBySchedule
 * Mengambil daftar siswa dari kelas yang terhubung ke schedule_id,
 * beserta status kehadiran mereka di sesi tersebut (jika sudah dicatat).
 *
 * Flow:
 * 1. Dari schedules → ambil class_id
 * 2. Dari class_id → ambil daftar students lewat class_students
 * 3. Dari attendances → ambil record yang ada untuk schedule_id ini
 * 4. Merge: tiap siswa dapat status-nya (atau default "hadir" jika belum ada)
 *
 * @param {string} scheduleId
 * @returns {Promise<{
 *   students: Array<{
 *     id: string,
 *     full_name: string,
 *     nis: string,
 *     status: "hadir"|"izin"|"sakit"|"alpha",
 *     notes: string
 *   }>,
 *   alreadyRecorded: boolean
 * }>}
 */
export async function getStudentsBySchedule(scheduleId) {
  const supabase = await getSupabaseClient();

  // 1. Ambil class_id dari schedule
  const { data: scheduleData, error: scheduleError } = await supabase
    .from("schedules")
    .select("class_id")
    .eq("id", scheduleId)
    .single();

  if (scheduleError || !scheduleData) {
    console.error("getStudentsBySchedule – schedule error:", scheduleError?.message);
    return { students: [], alreadyRecorded: false };
  }

  // 2. Ambil daftar siswa di kelas tersebut
  const { data: classStudents, error: studentsError } = await supabase
    .from("class_students")
    .select(`
      students (
        id,
        full_name,
        nis
      )
    `)
    .eq("class_id", scheduleData.class_id)
    .order("students(full_name)", { ascending: true });

  if (studentsError) {
    console.error("getStudentsBySchedule – students error:", studentsError.message);
    return { students: [], alreadyRecorded: false };
  }

  // 3. Ambil record kehadiran yang sudah ada (jika pernah dicatat sebelumnya)
  const { data: existingAttendances } = await supabase
    .from("attendances")
    .select("student_id, status, notes")
    .eq("schedule_id", scheduleId);

  // Buat map student_id → attendance record untuk lookup O(1)
  const attendanceMap = {};
  (existingAttendances ?? []).forEach((a) => {
    attendanceMap[a.student_id] = a;
  });

  const alreadyRecorded = (existingAttendances ?? []).length > 0;

  // 4. Merge: gabungkan data siswa dengan status kehadiran
  const students = (classStudents ?? [])
    .map((cs) => cs.students)
    .filter(Boolean)
    .map((s) => ({
      id:             s.id,
      full_name:      s.full_name,
      nis: s.nis,
      // Default "hadir" kalau belum pernah dicatat (guru tinggal ubah yang absen saja)
      status: attendanceMap[s.id]?.status ?? "hadir",
      notes:  attendanceMap[s.id]?.notes  ?? "",
    }));

  return { students, alreadyRecorded };
}

/**
 * saveAttendance
 * Menyimpan (atau memperbarui) kehadiran seluruh siswa untuk satu sesi.
 * Menggunakan upsert supaya bisa dipakai untuk create & update
 * tanpa perlu cek dulu apakah data sudah ada.
 *
 * @param {string} scheduleId
 * @param {Array<{ studentId: string, status: string, notes: string }>} records
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function saveAttendance(scheduleId, records) {
  const supabase = await getSupabaseClient();
  const teacher_id = await getCurrentUserId();
  const rows = records.map((r) => ({
    teacher_id,
    schedule_id: scheduleId,
    student_id:  r.studentId,
    status:      r.status,
    notes:       r.notes ?? "",
    recorded_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("attendances")
    .upsert(rows, {
      onConflict: "schedule_id,student_id", // unique constraint di DB
      ignoreDuplicates: false,              // kalau ada, UPDATE (bukan skip)
    });

  if (error) {
    console.error("saveAttendance error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * getAttendanceHistory
 * Mengambil riwayat kehadiran per siswa untuk semua sesi
 * yang diajar oleh guru yang sedang login, dengan filter
 * opsional berdasarkan class_id dan rentang tanggal.
 *
 * Dipakai di tab "Rekap" pada halaman attendance.html.
 *
 * @param {{ classId?: string, dateFrom?: string, dateTo?: string }} filters
 * @returns {Promise<Array>}
 */
export async function getAttendanceHistory(filters = {}) {
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("attendances")
    .select(`
      id,
      status,
      notes,
      recorded_at,
      students ( id, full_name, nis ),
      schedules (
        id,
        scheduled_date,
        start_time,
        end_time,
        class_id,
        classes ( id, name ),
        subjects ( name )
      )
    `)
    .order("schedules(scheduled_date)", { ascending: false })
    .order("schedules(start_time)",     { ascending: true });

  if (filters.classId) {
    query = query.eq("schedules.class_id", filters.classId);
  }
  if (filters.dateFrom) {
    query = query.gte("schedules.scheduled_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("schedules.scheduled_date", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAttendanceHistory error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getClasses
 * Mengambil daftar kelas yang diajar guru yang sedang login,
 * untuk keperluan dropdown filter di tab Rekap.
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getClasses() {
  const supabase = await getSupabaseClient();

  // RLS akan memfilter otomatis berdasarkan teacher yang login
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("getClasses error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getSchedulesForAttendance
 * Mengambil semua jadwal guru yang login, beserta flag apakah
 * sudah diabsen atau belum. Dipakai di tab utama attendance.html.
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   scheduled_date: string,
 *   start_time: string,
 *   end_time: string,
 *   room: string|null,
 *   classes: { id: string, name: string },
 *   subjects: { id: string, name: string },
 *   attendanceCount: number,   // 0 = belum diabsen
 * }>>}
 */
export async function getSchedulesForAttendance() {
  const supabase = await getSupabaseClient();

  // Ambil semua jadwal guru yang login (RLS otomatis filter teacher_id)
  const { data: schedules, error } = await supabase
    .from("schedules")
    .select(`
      id,
      scheduled_date,
      start_time,
      end_time,
      room,
      classes ( id, name ),
      subjects ( id, name )
    `)
    .order("scheduled_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("getSchedulesForAttendance error:", error.message);
    return [];
  }

  if (!schedules || schedules.length === 0) return [];

  // Ambil count kehadiran untuk setiap schedule sekaligus
  const scheduleIds = schedules.map((s) => s.id);
  const { data: attendanceCounts } = await supabase
    .from("attendances")
    .select("schedule_id")
    .in("schedule_id", scheduleIds);

  // Buat map scheduleId → jumlah record attendance
  const countMap = {};
  (attendanceCounts ?? []).forEach((a) => {
    countMap[a.schedule_id] = (countMap[a.schedule_id] || 0) + 1;
  });

  return schedules.map((s) => ({
    ...s,
    attendanceCount: countMap[s.id] ?? 0,
  }));
}
