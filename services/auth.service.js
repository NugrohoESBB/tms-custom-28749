/**
 * ============================================================
 * AUTH SERVICE
 * ============================================================
 * Membungkus semua operasi Supabase Auth di satu tempat,
 * supaya halaman (login.js, register.js, dst) tidak langsung
 * memanggil `supabase.auth.xxx` satu-satu (Single Responsibility
 * + memudahkan kalau nanti ada perubahan logic auth, misalnya
 * tambah validasi role, redirect, dsb).
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

/**
 * login - Login dengan email & password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function login(email, password) {
  const supabase = await getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * register - Mendaftarkan guru baru.
 * Supabase otomatis mengirim email verifikasi (jika diaktifkan
 * di Dashboard > Authentication > Email Templates).
 *
 * @param {object} payload
 * @param {string} payload.fullName
 * @param {string} payload.email
 * @param {string} payload.password
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function register({ fullName, email, password }) {
  const supabase = await getSupabaseClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      // data ini akan tersimpan di raw_user_meta_data,
      // nanti dipakai trigger SQL untuk mengisi tabel `teachers`.
      data: { full_name: fullName },
    },
  });
}

/**
 * sendPasswordReset - Mengirim email reset password.
 * @param {string} email
 * @param {string} redirectTo - URL halaman "set password baru" setelah klik link email
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function sendPasswordReset(email, redirectTo) {
  const supabase = await getSupabaseClient();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

/**
 * updatePassword - Mengatur password baru.
 * Dipakai di halaman reset-password.html, SETELAH user klik link
 * dari email reset password (Supabase otomatis membuat sesi sementara
 * dari token di URL, jadi di titik ini user sudah dianggap "login").
 *
 * @param {string} newPassword
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updatePassword(newPassword) {
  const supabase = await getSupabaseClient();
  return supabase.auth.updateUser({ password: newPassword });
}

/**
 * logout - Mengakhiri sesi login.
 * @returns {Promise<{ error: any }>}
 */
export async function logout() {
  const supabase = await getSupabaseClient();
  return supabase.auth.signOut();
}

/**
 * getCurrentSession - Mengambil sesi aktif (dipakai untuk guard halaman).
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getCurrentSession() {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}