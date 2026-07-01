/**
 * ============================================================
 * LOGIN PAGE LOGIC
 * ============================================================
 * Tugas file ini:
 * 1. Validasi realtime (email format, password tidak kosong).
 * 2. Toggle show/hide password.
 * 3. Submit ke Supabase Auth lewat auth.service.js.
 * 4. Menampilkan loading state & feedback sukses/error.
 * ============================================================
 */

import { login } from "../../services/auth.service.js";
import { isValidEmail, isNotEmpty } from "../../utils/validation.util.js";
import { showToast, showError } from "../../utils/notification.util.js";
import { qs, onReady } from "../../helpers/dom.helper.js";

onReady(() => {
  const form = qs("#login-form");
  const emailInput = qs("#email");
  const passwordInput = qs("#password");
  const submitBtn = qs("#login-submit");
  const togglePasswordBtn = qs("#toggle-password");

  /**
   * validateField
   * Validasi satu field, menampilkan/menyembunyikan pesan error,
   * dan memberi class visual (is-valid/is-invalid).
   */
  function validateField(input, errorElId, validatorFn, message) {
    const errorEl = qs(`#${errorElId}`);
    const isValid = validatorFn(input.value);

    input.classList.remove("is-valid", "is-invalid");
    if (input.value.length === 0) {
      errorEl.textContent = "";
      return false;
    }

    if (isValid) {
      input.classList.add("is-valid");
      errorEl.textContent = "";
    } else {
      input.classList.add("is-invalid");
      errorEl.textContent = message;
    }
    return isValid;
  }

  // Validasi realtime saat user mengetik (memenuhi requirement "Realtime Validation")
  emailInput.addEventListener("input", () => {
    validateField(emailInput, "email-error", isValidEmail, "Format email tidak valid.");
  });

  passwordInput.addEventListener("input", () => {
    validateField(passwordInput, "password-error", isNotEmpty, "Password tidak boleh kosong.");
  });

  // Toggle show/hide password
  togglePasswordBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordBtn.setAttribute("data-lucide", isHidden ? "eye-off" : "eye");
    lucide.createIcons(); // re-render icon karena attribute berubah
  });

  /**
   * setLoading
   * Mengubah tampilan button submit jadi loading/disabled,
   * memenuhi requirement "Loading" & "Disabled Button" di Form.
   */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("btn-loading", isLoading);
    submitBtn.classList.toggle("opacity-70", isLoading);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailValid = validateField(emailInput, "email-error", isValidEmail, "Format email tidak valid.");
    const passwordValid = validateField(passwordInput, "password-error", isNotEmpty, "Password tidak boleh kosong.");

    if (!emailValid || !passwordValid) {
      return; // hentikan submit kalau validasi gagal
    }

    setLoading(true);

    const { error } = await login(emailInput.value.trim(), passwordInput.value);

    setLoading(false);

    if (error) {
      // Pesan error Supabase di-translate ke Bahasa Indonesia yang lebih ramah
      const friendlyMessage =
        error.message === "Invalid login credentials"
          ? "Email atau password salah."
          : error.message;
      showError(friendlyMessage);
      return;
    }

    showToast("success", "Berhasil masuk!");

    // TODO: redirect ke halaman dashboard setelah halaman dashboard dibuat.
    window.location.href = "../dashboard/index.html";
    // setTimeout(() => {
    //   window.location.href = "../dashboard/index.html";
    // }, 800);
  });
});
