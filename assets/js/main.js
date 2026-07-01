/**
 * ============================================================
 * MAIN.JS — Entry point JavaScript aplikasi
 * ============================================================
 * Tugas file ini:
 * 1. Menerapkan tema (light/dark) tersimpan sebelum konten
 *    sempat "flash" warna yang salah.
 * 2. Melakukan test koneksi ke Supabase, lalu menampilkan
 *    statusnya di halaman (untuk verifikasi setup).
 * ============================================================
 */

import { getSupabaseClient } from "../../services/supabase.service.js";
import { APP_CONFIG } from "../../config/supabase.config.js";
import { onReady, qs } from "../../helpers/dom.helper.js";

/**
 * applyStoredTheme
 * Membaca preferensi tema dari localStorage dan menerapkannya
 * ke elemen <html>. Dipanggil paling awal supaya tidak ada
 * "flash" tema salah saat halaman dimuat.
 */
function applyStoredTheme() {
  const savedTheme = localStorage.getItem("tms-theme") || APP_CONFIG.defaultTheme;
  document.documentElement.classList.toggle("dark", savedTheme === "dark");
}

/**
 * testSupabaseConnection
 * Mencoba membuat koneksi ke Supabase dan menampilkan hasilnya.
 * Ini HANYA untuk tahap setup, supaya kamu yakin config sudah benar
 * sebelum lanjut membangun fitur Auth/Dashboard.
 */
async function testSupabaseConnection() {
  const statusEl = qs("#connection-status");
  if (!statusEl) return;

  try {
    const supabase = await getSupabaseClient();

    // getSession tidak butuh tabel apapun, jadi aman dipakai
    // hanya untuk memastikan client berhasil terhubung & SDK loaded.
    const { error } = await supabase.auth.getSession();

    if (error) throw error;

    statusEl.textContent = "✅ Supabase client berhasil diinisialisasi.";
    statusEl.classList.add("text-[var(--color-success)]");
  } catch (err) {
    console.error("Supabase connection error:", err);
    statusEl.textContent =
      "⚠️ Gagal terhubung ke Supabase. Pastikan URL & anon key di config/supabase.config.js sudah benar.";
    statusEl.classList.add("text-[var(--color-danger)]");
  }
}

onReady(() => {
  applyStoredTheme();
  testSupabaseConnection();
});
