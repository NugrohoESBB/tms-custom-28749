/**
 * ============================================================
 * SIDEBAR COMPONENT
 * ============================================================
 * Tugas file ini:
 * 1. Render HTML sidebar secara dinamis (menu items dari config).
 * 2. Menandai item aktif berdasarkan URL saat ini.
 * 3. Menangani collapse/expand sidebar (desktop) & off-canvas (mobile).
 * 4. Menyimpan state collapsed ke localStorage supaya diingat.
 * ============================================================
 */

import { getCurrentSession, logout } from "../services/auth.service.js";
import { showConfirm, showToast } from "../utils/notification.util.js";
import { getSchedulesForAttendance } from "../services/attendance.service.js";
import { startNotificationService } from "../services/notification.service.js";
import { clearGradeSettingsCache } from "../services/grades.service.js";

/**
 * NAV_ITEMS
 * Konfigurasi menu sidebar. Tambah/hapus item di sini tanpa
 * menyentuh kode render — Single Source of Truth untuk navigasi.
 *
 * Setiap item:
 * - icon: nama icon Lucide (https://lucide.dev/icons/)
 * - label: teks yang tampil
 * - href: path relatif dari folder pages/dashboard/
 * - badge: (opsional) angka notifikasi
 * - group: (opsional) label grup pembatas
 */
const NAV_ITEMS = [
  {
    group: "Menu Utama",
    items: [
      { icon: "layout-dashboard", label: "Dasbor",        href: "./index.html" },
      { icon: "calendar-days",    label: "Jadwal",         href: "./schedule.html" },
      { icon: "clipboard-list",   label: "Kehadiran",      href: "./attendance.html" },
      { icon: "book-open",        label: "Nilai",          href: "./grades.html" },
    ],
  },
  {
    group: "Data",
    items: [
      { icon: "users",            label: "Siswa",          href: "./students.html" },
      { icon: "school",       label: "Kelas",          href: "./classes.html" },
      { icon: "book-marked",      label: "Mata Pelajaran", href: "./subjects.html" },
    ],
  },
  {
    group: "Akun",
    items: [
      { icon: "user-circle",      label: "Profil Saya",    href: "./profile.html" },
      { icon: "settings",         label: "Pengaturan",     href: "./settings.html" },
      { icon: "shield-check",     label: "Manajemen Akun", href: "./account-management.html", adminOnly: true },
    ],
  },
];

/**
 * renderSidebar
 * Memasukkan HTML sidebar ke dalam elemen #sidebar-root,
 * lalu mengaktifkan semua event listener.
 *
 * @param {object} options
 * @param {string} options.userName  - Nama user yang sedang login
 * @param {string} options.userRole  - Role/jabatan singkat
 */
export async function renderSidebar({ userName = "Guru", userRole = "Pengajar", isAdmin = false } = {}) {
  const root = document.getElementById("sidebar-root");
  if (!root) return;

  // Inisial avatar: ambil 2 huruf pertama dari nama
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Tentukan halaman aktif dari URL saat ini
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  // ── Render HTML ──
  root.innerHTML = `
    <aside class="sidebar" id="app-sidebar">

      <!-- Logo -->
      <div class="sidebar-header">
        <div class="sidebar-logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <span class="sidebar-logo-text">TMS</span>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav" id="sidebar-nav">
        ${NAV_ITEMS.map((group) => `
          <p class="nav-group-label">${group.group}</p>
          ${group.items.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const isActive = item.href.includes(currentPath);
            return `
              <a
                href="${item.href}"
                class="nav-item ${isActive ? "active" : ""}"
                data-tooltip="${item.label}"
              >
                <i data-lucide="${item.icon}" class="nav-item-icon"></i>
                <span class="nav-item-label">${item.label}</span>
                ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ""}
              </a>
            `;
          }).join("")}
        `).join("")}
      </nav>

      <!-- Footer: user -->
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-logout-btn" title="Klik untuk keluar">
          <div class="sidebar-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${userName}</div>
            <div class="sidebar-user-role">${userRole}</div>
          </div>
          <i data-lucide="log-out" style="
            flex-shrink:0;
            width:.875rem;
            height:.875rem;
            color: var(--color-text-muted);
            transition: opacity .15s;
          " class="nav-item-label"></i>
        </div>
      </div>
    </aside>

    <!-- Overlay gelap untuk menutup sidebar di mobile -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;

  // Re-render icon Lucide untuk elemen yang baru saja dimasukkan ke DOM
  lucide.createIcons();
  _updateAttendanceBadge();

  // ── Event Listeners ──
  _bindCollapseState();
  _bindMobileOverlay();
  _bindLogout();
  startNotificationService();

  /**
   * _updateAttendanceBadge
   * Menghitung jadwal yang sudah lewat atau sedang berlangsung
   * tapi belum diabsen, lalu tampilkan count di nav item Kehadiran.
   */
  async function _updateAttendanceBadge() {
    try {
      const schedules = await getSchedulesForAttendance();
      const now = new Date();

      const unrecorded = schedules.filter((s) => {
        if (s.attendanceCount > 0) return false; // sudah diabsen
        // Jadwal berlangsung atau sudah selesai (bukan mendatang)
        const endDateTime = new Date(`${s.scheduled_date}T${s.end_time}`);
        return endDateTime <= now || _isOngoing(s, now);
      });

      const count = unrecorded.length;
      if (count === 0) return;

      // Cari nav-item Kehadiran dan tambahkan badge
      const navItems = document.querySelectorAll(".nav-item");
      navItems.forEach((el) => {
        if (el.getAttribute("href")?.includes("attendance.html")) {
          // Hapus badge lama kalau ada
          el.querySelector(".nav-badge")?.remove();
          const badge = document.createElement("span");
          badge.className = "nav-badge";
          badge.textContent = count > 9 ? "9+" : count;
          el.appendChild(badge);
        }
      });
    } catch (e) {
      console.warn("_updateAttendanceBadge error:", e);
    }
  }

  function _isOngoing(schedule, now) {
    const start = new Date(`${schedule.scheduled_date}T${schedule.start_time}`);
    const end   = new Date(`${schedule.scheduled_date}T${schedule.end_time}`);
    return now >= start && now <= end;
  }
}

/**
 * _bindCollapseState
 * Membaca state collapse dari localStorage, menerapkannya,
 * dan merespons event toggle dari navbar.
 */
function _bindCollapseState() {
  const shell = document.getElementById("dashboard-shell");
  if (!shell) return;

  // Terapkan state tersimpan saat pertama render
  const isCollapsed = localStorage.getItem("tms-sidebar-collapsed") === "true";
  shell.classList.toggle("sidebar-collapsed", isCollapsed);

  // Dengarkan event dari navbar toggle button
  document.addEventListener("sidebar:toggle", () => {
    const nowCollapsed = shell.classList.toggle("sidebar-collapsed");
    localStorage.setItem("tms-sidebar-collapsed", nowCollapsed);
  });
}

/**
 * _bindMobileOverlay
 * Menangani buka/tutup sidebar off-canvas di mobile lewat overlay.
 */
function _bindMobileOverlay() {
  const overlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("app-sidebar");
  if (!overlay || !sidebar) return;

  // Dengarkan event dari navbar mobile toggle
  document.addEventListener("sidebar:mobile-open", () => {
    sidebar.classList.add("mobile-open");
    overlay.classList.add("active");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("active");
  });
}

/**
 * _bindLogout
 * Konfirmasi lalu logout saat user klik area profil di footer sidebar.
 */
function _bindLogout() {
  const logoutBtn = document.getElementById("sidebar-logout-btn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    const confirmed = await showConfirm("Keluar dari TMS?", "Sesi kamu akan diakhiri.");
    if (!confirmed) return;

    const { error } = await logout();
    if (error) {
      showToast("error", "Gagal keluar. Coba lagi.");
      return;
    }

    clearGradeSettingsCache();

    window.location.href = "../../pages/auth/login.html";
  });
}
