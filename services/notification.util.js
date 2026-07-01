/**
 * ============================================================
 * NOTIFICATION UTIL
 * ============================================================
 * Wrapper di atas SweetAlert2 supaya pemanggilan notifikasi
 * di seluruh aplikasi konsisten (style, posisi, durasi sama).
 *
 * Kenapa di-wrap, tidak panggil Swal langsung di tiap file?
 * - Kalau suatu saat kita ganti library notifikasi, cukup ubah
 *   file ini saja, tidak perlu ubah semua halaman (DRY + mudah
 *   maintenance / Single Responsibility).
 *
 * Library SweetAlert2 di-load via <script> CDN di index.html,
 * sehingga tersedia secara global sebagai `Swal`.
 * ============================================================
 */

/**
 * showToast - notifikasi kecil di pojok (untuk sukses/info ringan)
 * @param {"success"|"error"|"warning"|"info"} icon
 * @param {string} title
 */
export function showToast(icon, title) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

/**
 * showConfirm - dialog konfirmasi (misal sebelum hapus data)
 * @param {string} title
 * @param {string} text
 * @returns {Promise<boolean>} true jika user menekan confirm
 */
export async function showConfirm(title, text) {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#2563EB", // Primary color sesuai brief
    cancelButtonColor: "#EF4444", // Danger color sesuai brief
    confirmButtonText: "Ya, lanjutkan",
    cancelButtonText: "Batal",
  });
  return result.isConfirmed;
}

/**
 * showError - menampilkan error besar (misal gagal koneksi/auth)
 * @param {string} message
 */
export function showError(message) {
  Swal.fire({
    icon: "error",
    title: "Terjadi Kesalahan",
    text: message,
    confirmButtonColor: "#2563EB",
  });
}
