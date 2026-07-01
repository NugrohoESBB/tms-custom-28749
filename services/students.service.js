/**
 * ============================================================
 * STUDENTS SERVICE
 * ============================================================
 * Semua query Supabase untuk fitur Manajemen Siswa dikumpulkan
 * di sini. Halaman students.html tinggal import fungsi —
 * tidak ada query berserakan di dalam file HTML/view.
 *
 * Catatan RLS:
 * - Guru hanya bisa lihat siswa di kelas yang ia ajar (via schedules).
 * - Admin bisa lihat & kelola semua siswa.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getStudents
 * Mengambil semua siswa yang bisa dilihat guru yang login,
 * beserta kelas-kelasnya (lewat class_students).
 * Mendukung filter pencarian nama/NIS dan filter kelas.
 *
 * @param {{ search?: string, classId?: string, isActive?: boolean }} filters
 * @returns {Promise<Array>}
 */
export async function getStudents(filters = {}) {
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("students")
    .select(`
      id,
      full_name,
      nis,
      birth_date,
      gender,
      is_active,
      created_at,
      class_students (
        academic_year,
        classes ( id, name, grade )
      )
    `)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,nis.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getStudents error:", error.message);
    return [];
  }

  let students = data ?? [];

  // Filter berdasarkan kelas (dilakukan di sisi client karena relasi nested)
  if (filters.classId) {
    students = students.filter((s) =>
      (s.class_students ?? []).some((cs) => cs.classes?.id === filters.classId)
    );
  }

  return students;
}

/**
 * getStudentById
 * Mengambil detail lengkap satu siswa berdasarkan ID,
 * termasuk riwayat kelas dan ringkasan kehadiran.
 *
 * @param {string} studentId
 * @returns {Promise<object|null>}
 */
export async function getStudentById(studentId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      full_name,
      nis,
      birth_date,
      gender,
      photo_url,
      is_active,
      created_at,
      updated_at,
      class_students (
        academic_year,
        classes ( id, name, grade )
      )
    `)
    .eq("id", studentId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("getStudentById error:", error.message);
    return null;
  }

  return data;
}

/**
 * createStudent
 * Membuat data siswa baru.
 *
 * @param {{ fullName: string, nis?: string, birthDate?: string, gender?: 'L'|'P' }} payload
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function createStudent(payload) {
  const supabase = await getSupabaseClient();
  const teacher_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from("students")
    .insert({
      teacher_id,
      full_name:  payload.fullName,
      nis:        payload.nis        || null,
      birth_date: payload.birthDate  || null,
      gender:     payload.gender     || null,
      is_active:  true,
    })
    .select()
    .single();

  if (error) {
    console.error("createStudent error:", error.message);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * updateStudent
 * Memperbarui data siswa.
 *
 * @param {string} studentId
 * @param {{ fullName?: string, nis?: string, birthDate?: string, gender?: 'L'|'P', isActive?: boolean }} payload
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function updateStudent(studentId, payload) {
  const supabase = await getSupabaseClient();

  const updates = { updated_at: new Date().toISOString() };
  if (payload.fullName  !== undefined) updates.full_name  = payload.fullName;
  if (payload.nis       !== undefined) updates.nis        = payload.nis || null;
  if (payload.birthDate !== undefined) updates.birth_date = payload.birthDate || null;
  if (payload.gender    !== undefined) updates.gender     = payload.gender || null;
  if (payload.isActive  !== undefined) updates.is_active  = payload.isActive;

  const { error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", studentId);

  if (error) {
    console.error("updateStudent error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * deleteStudent
 * Menonaktifkan siswa (set is_active = false).
 * Dipakai karena tabel students tidak memiliki kolom deleted_at.
 *
 * @param {string} studentId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deleteStudent(studentId) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("students")
    .update({
      is_active:  false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  if (error) {
    console.error("deleteStudent error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * getClassesForFilter
 * Mengambil daftar kelas yang bisa dilihat guru yang login,
 * dipakai untuk dropdown filter di halaman siswa.
 *
 * @returns {Promise<Array<{ id: string, name: string, grade: string }>>}
 */
export async function getClassesForFilter() {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, grade")
    .order("grade", { ascending: true })
    .order("name",  { ascending: true });

  if (error) {
    console.error("getClassesForFilter error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getAttendanceSummaryForStudent
 * Mengambil ringkasan kehadiran siswa tertentu:
 * jumlah hadir, izin, sakit, alpha — dipakai di detail modal.
 *
 * @param {string} studentId
 * @returns {Promise<{ hadir: number, izin: number, sakit: number, alpha: number, total: number }>}
 */
export async function getAttendanceSummaryForStudent(studentId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("attendances")
    .select("status")
    .eq("student_id", studentId);

  if (error || !data) {
    return { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 };
  }

  const summary = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: data.length };
  data.forEach((r) => { if (summary[r.status] !== undefined) summary[r.status]++; });

  return summary;
}

/**
 * setStudentClass
 * Menempatkan / memindahkan / mengeluarkan siswa dari kelas untuk
 * satu tahun ajaran. classId = null artinya siswa dikeluarkan dari kelas.
 *
 * @param {string} studentId
 * @param {string|null} classId
 * @param {string} academicYear - misal "2026/2027"
 */
export async function setStudentClass(studentId, classId, academicYear) {
  const supabase = await getSupabaseClient();

  // Hapus dulu relasi siswa ini di tahun ajaran yg sama (kalau pindah/keluar kelas)
  const { error: delError } = await supabase
    .from("class_students")
    .delete()
    .eq("student_id", studentId)
    .eq("academic_year", academicYear);

  if (delError) {
    console.error("setStudentClass delete error:", delError.message);
    return { success: false, error: delError.message };
  }

  if (!classId) return { success: true, error: null }; // sengaja dikeluarkan dari kelas

  const { error: insError } = await supabase
    .from("class_students")
    .insert({ student_id: studentId, class_id: classId, academic_year: academicYear });

  if (insError) {
    console.error("setStudentClass insert error:", insError.message);
    return { success: false, error: insError.message };
  }
  return { success: true, error: null };
}
