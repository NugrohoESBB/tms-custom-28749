/**
 * ============================================================
 * REGISTER PAGE LOGIC
 * ============================================================
 * Tugas file ini:
 * 1. Validasi realtime semua field (nama, email, password, konfirmasi).
 * 2. Menampilkan indikator kekuatan password.
 * 3. Submit ke Supabase Auth (signUp) lewat auth.service.js.
 * 4. Memberi tahu user untuk cek email verifikasi (requirement
 *    "Email Verification" di brief).
 * ============================================================
 */

import { register } from "../../services/auth.service.js";
import {
  isValidEmail,
  isNotEmpty,
  getPasswordStrength,
  doPasswordsMatch,
} from "../../utils/validation.util.js";
import { showError } from "../../utils/notification.util.js";
import { qs, onReady } from "../../helpers/dom.helper.js";

const STRENGTH_COLOR = {
  weak: "var(--color-danger)",
  medium: "var(--color-warning)",
  strong: "var(--color-success)",
};

const STRENGTH_BARS = { weak: 1, medium: 2, strong: 3 };

onReady(() => {
  const form = qs("#register-form");
  const fullNameInput = qs("#full-name");
  const emailInput = qs("#email");
  const passwordInput = qs("#password");
  const confirmInput = qs("#confirm-password");
  const submitBtn = qs("#register-submit");
  const togglePasswordBtn = qs("#toggle-password");
  const strengthBars = qs("#strength-bar").children;
  const strengthLabel = qs("#strength-label");

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

  fullNameInput.addEventListener("input", () =>
    validateField(fullNameInput, "full-name-error", isNotEmpty, "Nama tidak boleh kosong.")
  );

  emailInput.addEventListener("input", () =>
    validateField(emailInput, "email-error", isValidEmail, "Format email tidak valid.")
  );

  // Update indikator kekuatan password setiap kali user mengetik
  passwordInput.addEventListener("input", () => {
    const { level, label } = getPasswordStrength(passwordInput.value);

    Array.from(strengthBars).forEach((bar, index) => {
      const filled = index < STRENGTH_BARS[level];
      bar.style.backgroundColor = filled ? STRENGTH_COLOR[level] : "var(--color-border)";
    });

    strengthLabel.textContent = passwordInput.value ? `Kekuatan password: ${label}` : "";
    strengthLabel.style.color = STRENGTH_COLOR[level];

    // Re-validasi confirm password kalau sudah pernah diisi (supaya tetap sinkron)
    if (confirmInput.value) {
      validateField(
        confirmInput,
        "confirm-password-error",
        (val) => doPasswordsMatch(passwordInput.value, val),
        "Password tidak sama."
      );
    }
  });

  confirmInput.addEventListener("input", () =>
    validateField(
      confirmInput,
      "confirm-password-error",
      (val) => doPasswordsMatch(passwordInput.value, val),
      "Password tidak sama."
    )
  );

  togglePasswordBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordBtn.setAttribute("data-lucide", isHidden ? "eye-off" : "eye");
    lucide.createIcons();
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("btn-loading", isLoading);
    submitBtn.classList.toggle("opacity-70", isLoading);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const validations = [
      validateField(fullNameInput, "full-name-error", isNotEmpty, "Nama tidak boleh kosong."),
      validateField(emailInput, "email-error", isValidEmail, "Format email tidak valid."),
      validateField(
        passwordInput,
        "password-error",
        (val) => val.length >= 6,
        "Password minimal 6 karakter."
      ),
      validateField(
        confirmInput,
        "confirm-password-error",
        (val) => doPasswordsMatch(passwordInput.value, val),
        "Password tidak sama."
      ),
    ];

    if (validations.includes(false)) return;

    setLoading(true);

    const { error } = await register({
      fullName: fullNameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });

    setLoading(false);

    if (error) {
      const friendlyMessage =
        error.message === "User already registered"
          ? "Email ini sudah terdaftar. Silakan masuk."
          : error.message;
      showError(friendlyMessage);
      return;
    }

    await Swal.fire({
      icon: "success",
      title: "Pendaftaran berhasil!",
      text: "Akun kamu sudah aktif. Silakan masuk dengan email & password yang baru dibuat.",
      confirmButtonColor: "#2563EB",
    });

    window.location.href = "./login.html";
  });
});