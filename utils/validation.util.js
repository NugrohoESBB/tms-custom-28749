/**
 * ============================================================
 * VALIDATION UTIL
 * ============================================================
 * Kumpulan fungsi validasi murni (pure function) yang dipakai
 * berulang di banyak form. Dipisah dari logic UI supaya bisa
 * dites/dipakai ulang tanpa tergantung DOM (Single Responsibility).
 * ============================================================
 */

/**
 * isValidEmail
 * @param {string} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(value.trim());
}

/**
 * getPasswordStrength
 * Mengembalikan level kekuatan password sederhana untuk feedback
 * realtime ke user (bukan validasi blocking, hanya panduan visual).
 * @param {string} value
 * @returns {{ level: "weak"|"medium"|"strong", label: string }}
 */
export function getPasswordStrength(value) {
  if (value.length < 6) return { level: "weak", label: "Terlalu pendek" };

  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  if (value.length >= 8 && score >= 2) return { level: "strong", label: "Kuat" };
  if (value.length >= 6) return { level: "medium", label: "Sedang" };
  return { level: "weak", label: "Lemah" };
}

/**
 * isNotEmpty
 * @param {string} value
 * @returns {boolean}
 */
export function isNotEmpty(value) {
  return value.trim().length > 0;
}

/**
 * doPasswordsMatch
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {boolean}
 */
export function doPasswordsMatch(password, confirmPassword) {
  return password === confirmPassword && password.length > 0;
}
