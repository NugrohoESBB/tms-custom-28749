/**
 * ============================================================
 * SUBJECTS SERVICE
 * ============================================================
 * Semua query Supabase untuk fitur Mata Pelajaran (Subjects)
 * dikumpulkan di sini. Halaman subjects.html tinggal import
 * fungsi — tidak ada query berserakan di dalam file HTML/view.
 *
 * RLS di tabel subjects:
 * - Semua guru yang login bisa READ (select).
 * - Hanya admin yang bisa INSERT / UPDATE / DELETE.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getSubjects
 * Mengambil semua mata pelajaran, opsional filter by search (nama/kode).
 * Diurutkan nama A–Z secara default.
 *
 * @param {{ search?: string }} filters
 * @returns {Promise<Array<{
 *   id: string,
 *   name: string,
 *   code: string|null,
 *   created_at: string,
 *   teacher_count: number,
 *   schedule_count: number
 * }>>}
 */
export async function getSubjects(filters = {}) {
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("subjects")
    .select(`
      id,
      name,
      code,
      created_at,
      schedules ( id, teacher_id )
    `)
    .order("name", { ascending: true });

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getSubjects error:", error.message);
    return [];
  }

  // Hitung jumlah guru unik & sesi per mapel dari relasi schedules
  return (data ?? []).map((s) => {
    const schedules     = s.schedules ?? [];
    const teacherIds    = [...new Set(schedules.map((sc) => sc.teacher_id).filter(Boolean))];
    return {
      id:             s.id,
      name:           s.name,
      code:           s.code,
      created_at:     s.created_at,
      teacher_count:  teacherIds.length,
      schedule_count: schedules.length,
    };
  });
}

/**
 * getSubjectById
 * Mengambil detail satu mata pelajaran beserta daftar jadwal
 * terkait (kelas & guru yang mengajarkan mapel ini).
 * Dipakai di detail drawer.
 *
 * @param {string} subjectId
 * @returns {Promise<object|null>}
 */
export async function getSubjectById(subjectId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(`
      id,
      name,
      code,
      created_at,
      schedules (
        id,
        scheduled_date,
        start_time,
        end_time,
        classes ( id, name, grade ),
        teachers:teacher_id ( id, full_name )
      )
    `)
    .eq("id", subjectId)
    .single();

  if (error) {
    console.error("getSubjectById error:", error.message);
    return null;
  }

  return data;
}

/**
 * createSubject
 * Membuat mata pelajaran baru.
 * Hanya berhasil jika user yang login adalah admin (RLS).
 *
 * @param {{ name: string, code?: string }} payload
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function createSubject(payload) {
  const supabase = await getSupabaseClient();
  const teacher_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      teacher_id,
      name: payload.name.trim(),
      code: payload.code?.trim().toUpperCase() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("createSubject error:", error.message);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * updateSubject
 * Memperbarui nama dan/atau kode mata pelajaran.
 * Hanya berhasil jika user yang login adalah admin (RLS).
 *
 * @param {string} subjectId
 * @param {{ name?: string, code?: string }} payload
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function updateSubject(subjectId, payload) {
  const supabase = await getSupabaseClient();

  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.code !== undefined) {
    updates.code = payload.code?.trim().toUpperCase() || null;
  }

  const { error } = await supabase
    .from("subjects")
    .update(updates)
    .eq("id", subjectId);

  if (error) {
    console.error("updateSubject error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * deleteSubject
 * Menghapus mata pelajaran secara permanen (hard delete).
 * Akan gagal jika masih ada schedules/grades yang mereferensikan
 * subject ini (foreign key constraint) — ini perilaku yang benar
 * supaya data tidak yatim.
 * Hanya berhasil jika user yang login adalah admin (RLS).
 *
 * @param {string} subjectId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deleteSubject(subjectId) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId);

  if (error) {
    console.error("deleteSubject error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * checkSubjectCodeExists
 * Cek apakah kode mapel sudah dipakai (untuk validasi unik di form).
 * Exclude subjectId kalau sedang mode edit (kode milik diri sendiri
 * tidak dianggap duplikat).
 *
 * @param {string} code
 * @param {string|null} excludeId
 * @returns {Promise<boolean>}
 */
export async function checkSubjectCodeExists(code, excludeId = null) {
  if (!code) return false;

  const supabase = await getSupabaseClient();

  let query = supabase
    .from("subjects")
    .select("id")
    .eq("code", code.trim().toUpperCase());

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) return false;
  return (data ?? []).length > 0;
}
