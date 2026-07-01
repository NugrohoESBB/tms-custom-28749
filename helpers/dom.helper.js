/**
 * ============================================================
 * DOM HELPER
 * ============================================================
 * Kumpulan fungsi pendek untuk mempermudah akses DOM,
 * supaya kita tidak menulis document.querySelector berulang-ulang
 * di banyak file (DRY Principle).
 * ============================================================
 */

/**
 * qs - shortcut untuk querySelector
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element|null}
 */
export const qs = (selector, scope = document) => scope.querySelector(selector);

/**
 * qsa - shortcut untuk querySelectorAll, langsung dikembalikan
 * sebagai Array (bukan NodeList) supaya bisa pakai .map/.filter dst.
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element[]}
 */
export const qsa = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

/**
 * onReady - menjalankan callback saat DOM sudah siap.
 * Berguna supaya setiap halaman punya satu titik masuk yang jelas.
 * @param {() => void} callback
 */
export function onReady(callback) {
  if (document.readyState !== "loading") {
    callback();
  } else {
    document.addEventListener("DOMContentLoaded", callback);
  }
}

/**
 * getCurrentAcademicYear
 * Format "YYYY/YYYY+1", konsisten dengan kalkulasi di
 * view v_teacher_dashboard_stats (supabase).
 */
export function getCurrentAcademicYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}
