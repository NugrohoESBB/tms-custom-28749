/**
 * ============================================================
 * PROFILE SERVICE
 * ============================================================
 * Semua query Supabase untuk halaman Profil Saya dikumpulkan
 * di sini. Halaman profile.html tinggal import fungsi —
 * tidak ada query berserakan di dalam file HTML/view.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * getMyProfile
 * Mengambil data lengkap profil guru yang sedang login
 * dari tabel public.teachers.
 *
 * @returns {Promise<{
 *   id: string,
 *   full_name: string,
 *   email: string,
 *   phone: string|null,
 *   nip: string|null,
 *   photo_url: string|null,
 *   role: "admin"|"teacher",
 *   is_active: boolean,
 *   created_at: string
 * }|null>}
 */
export async function getMyProfile() {
  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, email, phone, nip, photo_url, role, is_active, created_at")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("getMyProfile error:", error.message);
    return null;
  }

  return data;
}

/**
 * updateMyProfile
 * Memperbarui data profil guru yang sedang login.
 * Hanya field yang dikirim dalam payload yang akan diupdate.
 *
 * @param {{ fullName?: string, nip?: string|null, phone?: string|null }} payload
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function updateMyProfile(payload) {
  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();
  if (!userId) return { success: false, error: "Tidak ada sesi aktif." };

  const updates = { updated_at: new Date().toISOString() };
  if (payload.fullName !== undefined) updates.full_name = payload.fullName.trim();
  if (payload.nip      !== undefined) updates.nip       = payload.nip  || null;
  if (payload.phone    !== undefined) updates.phone     = payload.phone || null;

  const { error } = await supabase
    .from("teachers")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error("updateMyProfile error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * updateMyPassword
 * Mengubah password user yang sedang login lewat Supabase Auth.
 *
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function updateMyPassword(newPassword) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error("updateMyPassword error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * uploadProfilePhoto
 * Upload foto profil ke Supabase Storage (bucket: teacher-photos),
 * lalu update kolom photo_url di tabel teachers.
 *
 * @param {File} file - file gambar dari input[type=file]
 * @returns {Promise<{ publicUrl: string|null, error: string|null }>}
 */
export async function uploadProfilePhoto(file) {
  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();
  if (!userId) return { publicUrl: null, error: "Tidak ada sesi aktif." };

  // Validasi ukuran file (maks 2 MB)
  if (file.size > 2 * 1024 * 1024) {
    return { publicUrl: null, error: "Ukuran foto maksimal 2 MB." };
  }

  const ext  = file.name.split(".").pop();
  const path = `avatars/${userId}.${ext}`;

  // Upload ke storage (upsert: replace kalau sudah ada)
  const { error: upErr } = await supabase.storage
    .from("teacher-photos")
    .upload(path, file, { upsert: true });

  if (upErr) {
    console.error("uploadProfilePhoto storage error:", upErr.message);
    return { publicUrl: null, error: upErr.message };
  }

  // Ambil public URL
  const { data: { publicUrl } } = supabase.storage
    .from("teacher-photos")
    .getPublicUrl(path);

  // Simpan URL ke tabel teachers
  const { error: dbErr } = await supabase
    .from("teachers")
    .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (dbErr) {
    console.error("uploadProfilePhoto db error:", dbErr.message);
    return { publicUrl: null, error: dbErr.message };
  }

  return { publicUrl, error: null };
}

/**
 * getMyStats
 * Mengambil 3 angka statistik untuk ditampilkan di halaman profil:
 * - Total jadwal mengajar
 * - Total siswa (distinct) yang diajar
 * - Total sesi yang sudah diabsen
 *
 * @returns {Promise<{ jadwal: number, siswa: number, absen: number }>}
 */
export async function getMyStats() {
  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();
  if (!userId) return { jadwal: 0, siswa: 0, absen: 0 };

  // Ambil semua class_id dari jadwal guru ini untuk hitung siswa
  const { data: scheduleData } = await supabase
    .from("schedules")
    .select("class_id")
    .eq("teacher_id", userId);

  const classIds = [...new Set((scheduleData ?? []).map((s) => s.class_id))];

  // Jalankan 3 query sekaligus secara paralel
  const [
    { count: jadwal },
    { count: siswa },
    { count: absen },
  ] = await Promise.all([
    // Total jadwal guru ini
    supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", userId),

    // Total siswa unik di semua kelas yang diajar guru ini
    classIds.length > 0
      ? supabase
          .from("class_students")
          .select("student_id", { count: "exact", head: true })
          .in("class_id", classIds)
      : Promise.resolve({ count: 0 }),

    // Total sesi yang sudah diabsen oleh guru ini
    supabase
      .from("attendances")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", userId),
  ]);

  return {
    jadwal: jadwal ?? 0,
    siswa:  siswa  ?? 0,
    absen:  absen  ?? 0,
  };
}
