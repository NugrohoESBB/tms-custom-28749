/**
 * ============================================================
 * CLASSES SERVICE
 * ============================================================
 * Semua query Supabase untuk fitur Manajemen Kelas dikumpulkan
 * di sini. Halaman classes.html tinggal import fungsi —
 * tidak ada query berserakan di dalam file HTML/view.
 *
 * RLS di tabel classes:
 * - Semua guru yang login bisa READ.
 * - Guru hanya bisa INSERT/UPDATE/DELETE kelas miliknya sendiri.
 * - Admin bisa akses semua.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getClasses
 * Mengambil semua kelas beserta jumlah siswa (via class_students)
 * dan info wali kelas (via teachers).
 * RLS otomatis membatasi hasil sesuai role yang login.
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   name: string,
 *   grade: string,
 *   homeroom_teacher_id: string|null,
 *   created_at: string,
 *   teachers: { id: string, full_name: string }|null,
 *   class_students: Array<{ id: string, student_id: string }>
 * }>>}
 */
export async function getClasses() {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      grade,
      homeroom_teacher_id,
      created_at,
      teachers:homeroom_teacher_id ( id, full_name ),
      class_students ( id, student_id )
    `)
    .order("grade", { ascending: true })
    .order("name",  { ascending: true });

  if (error) {
    console.error("getClasses error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getClassById
 * Mengambil detail satu kelas berdasarkan ID,
 * termasuk daftar siswa yang terdaftar di kelas tersebut.
 *
 * @param {string} classId
 * @returns {Promise<object|null>}
 */
export async function getClassById(classId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      grade,
      homeroom_teacher_id,
      created_at,
      teachers:homeroom_teacher_id ( id, full_name ),
      class_students (
        id,
        student_id,
        academic_year,
        students ( id, full_name, nis, gender )
      )
    `)
    .eq("id", classId)
    .single();

  if (error) {
    console.error("getClassById error:", error.message);
    return null;
  }

  return data;
}

/**
 * createClass
 * Membuat kelas baru.
 * teacher_id diisi otomatis dari user yang sedang login.
 *
 * @param {{ name: string, grade: string, homeroomTeacherId?: string|null }} payload
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function createClass(payload) {
  const supabase   = await getSupabaseClient();
  const teacher_id = await getCurrentUserId();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      teacher_id,
      name:                payload.name.trim(),
      grade:               payload.grade,
      homeroom_teacher_id: payload.homeroomTeacherId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("createClass error:", error.message);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * updateClass
 * Memperbarui data kelas (nama, tingkat, wali kelas).
 *
 * @param {string} classId
 * @param {{ name?: string, grade?: string, homeroomTeacherId?: string|null }} payload
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function updateClass(classId, payload) {
  const supabase = await getSupabaseClient();

  const updates = {};
  if (payload.name             !== undefined) updates.name                = payload.name.trim();
  if (payload.grade            !== undefined) updates.grade               = payload.grade;
  if (payload.homeroomTeacherId !== undefined) updates.homeroom_teacher_id = payload.homeroomTeacherId || null;

  const { error } = await supabase
    .from("classes")
    .update(updates)
    .eq("id", classId);

  if (error) {
    console.error("updateClass error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * deleteClass
 * Menghapus kelas secara permanen (hard delete).
 * Relasi class_students akan ikut terhapus (cascade delete di DB).
 * Akan gagal kalau masih ada jadwal/nilai yang mereferensikan kelas ini.
 *
 * @param {string} classId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deleteClass(classId) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId);

  if (error) {
    console.error("deleteClass error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * getStudentsInClass
 * Mengambil daftar siswa yang terdaftar di satu kelas tertentu,
 * diurutkan berdasarkan nama.
 * Dipakai untuk detail drawer dan dialog kelola siswa.
 *
 * @param {string} classId
 * @returns {Promise<Array<{
 *   id: string,
 *   full_name: string,
 *   nis: string|null,
 *   gender: string|null,
 *   academic_year: string
 * }>>}
 */
export async function getStudentsInClass(classId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("class_students")
    .select(`
      academic_year,
      students ( id, full_name, nis, gender )
    `)
    .eq("class_id", classId)
    .order("students(full_name)", { ascending: true });

  if (error) {
    console.error("getStudentsInClass error:", error.message);
    return [];
  }

  return (data ?? [])
    .map((cs) => ({ ...cs.students, academic_year: cs.academic_year }))
    .filter(Boolean);
}

/**
 * getAllActiveStudents
 * Mengambil semua siswa aktif (tidak dihapus) untuk keperluan
 * dialog kelola siswa (checklist tambah/keluarkan siswa dari kelas).
 *
 * @returns {Promise<Array<{ id: string, full_name: string, nis: string|null }>>}
 */
export async function getAllActiveStudents() {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, nis")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getAllActiveStudents error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * addStudentsToClass
 * Mendaftarkan satu atau lebih siswa ke kelas untuk tahun ajaran tertentu.
 *
 * @param {string} classId
 * @param {string[]} studentIds - array UUID siswa
 * @param {string} academicYear - misal "2026/2027"
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function addStudentsToClass(classId, studentIds, academicYear) {
  if (studentIds.length === 0) return { success: true, error: null };

  const supabase = await getSupabaseClient();

  const rows = studentIds.map((studentId) => ({
    class_id:      classId,
    student_id:    studentId,
    academic_year: academicYear,
  }));

  const { error } = await supabase
    .from("class_students")
    .insert(rows);

  if (error) {
    console.error("addStudentsToClass error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * removeStudentsFromClass
 * Mengeluarkan satu atau lebih siswa dari kelas untuk tahun ajaran tertentu.
 *
 * @param {string} classId
 * @param {string[]} studentIds - array UUID siswa
 * @param {string} academicYear
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function removeStudentsFromClass(classId, studentIds, academicYear) {
  if (studentIds.length === 0) return { success: true, error: null };

  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .in("student_id", studentIds);

  if (error) {
    console.error("removeStudentsFromClass error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * getActiveTeachers
 * Mengambil daftar semua guru aktif untuk dropdown pilih wali kelas
 * di form tambah/edit kelas.
 *
 * @returns {Promise<Array<{ id: string, full_name: string }>>}
 */
export async function getActiveTeachers() {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getActiveTeachers error:", error.message);
    return [];
  }

  return data ?? [];
}
