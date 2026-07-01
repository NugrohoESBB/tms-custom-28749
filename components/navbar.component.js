/**
 * ============================================================
 * NAVBAR COMPONENT
 * ============================================================
 * Tugas file ini:
 * 1. Render top navbar (toggle sidebar, judul halaman, actions).
 * 2. Toggle dark mode + simpan preferensi.
 * 3. Emit custom event ke sidebar saat toggle diklik.
 * ============================================================
 */

/**
 * renderNavbar
 * Memasukkan HTML navbar ke dalam elemen #navbar-root.
 *
 * @param {object} options
 * @param {string} options.pageTitle   - Judul halaman yang tampil di navbar
 * @param {string} options.pageSubtitle - Subjudul/keterangan singkat (opsional)
 * @param {string} options.userName    - Nama user untuk avatar
 */
export function renderNavbar({
  pageTitle = "Dasbor",
  pageSubtitle = "",
  userName = "Guru",
} = {}) {
  const root = document.getElementById("navbar-root");
  if (!root) return;

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Cek tema tersimpan untuk state awal icon dark mode
  const isDark = document.documentElement.classList.contains("dark");

  root.innerHTML = `
    <nav class="dashboard-navbar">

      <!-- Toggle Sidebar -->
      <button class="navbar-toggle-btn" id="navbar-sidebar-toggle" title="Toggle sidebar">
        <i data-lucide="panel-left-close" id="toggle-icon" style="width:1.1rem;height:1.1rem"></i>
      </button>

      <!-- Judul halaman -->
      <div class="navbar-breadcrumb">
        <span class="navbar-page-title">${pageTitle}</span>
        ${pageSubtitle ? `<span class="navbar-page-sub">${pageSubtitle}</span>` : ""}
      </div>

      <!-- Actions kanan -->
      <div class="navbar-actions">

        <!-- Dark mode toggle -->
        <button class="navbar-icon-btn" id="dark-mode-toggle" title="Toggle dark mode">
          <i data-lucide="${isDark ? "sun" : "moon"}" id="theme-icon" style="width:1rem;height:1rem"></i>
        </button>

        <!-- Notifikasi (placeholder — bisa dihubungkan ke realtime nanti) -->
        <button class="navbar-icon-btn" title="Notifikasi">
          <i data-lucide="bell" style="width:1rem;height:1rem"></i>
          <span class="notif-dot"></span>
        </button>

        <!-- Avatar user: arahkan ke profil kalau diklik -->
        <div
          class="navbar-avatar"
          id="navbar-avatar"
          title="Profil saya"
          onclick="window.location.href='./profile.html'"
        >
          ${initials}
        </div>

      </div>
    </nav>
  `;

  lucide.createIcons();

  _bindToggleSidebar();
  _bindDarkMode();
}

/**
 * _bindToggleSidebar
 * Saat tombol toggle diklik, emit custom event "sidebar:toggle"
 * (yang di-listen oleh sidebar.js).
 * Di mobile (layar kecil), emit "sidebar:mobile-open" sebagai gantinya.
 */
function _bindToggleSidebar() {
  const btn = document.getElementById("navbar-sidebar-toggle");
  const icon = document.getElementById("toggle-icon");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      document.dispatchEvent(new CustomEvent("sidebar:mobile-open"));
      return;
    }

    document.dispatchEvent(new CustomEvent("sidebar:toggle"));

    // Ganti icon sesuai state sidebar
    const shell = document.getElementById("dashboard-shell");
    const isNowCollapsed = shell?.classList.contains("sidebar-collapsed");
    icon.setAttribute("data-lucide", isNowCollapsed ? "panel-left-open" : "panel-left-close");
    lucide.createIcons();
  });
}

/**
 * _bindDarkMode
 * Toggle class "dark" di <html>, lalu simpan ke localStorage.
 */
function _bindDarkMode() {
  const btn = document.getElementById("dark-mode-toggle");
  const icon = document.getElementById("theme-icon");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("tms-theme", isDark ? "dark" : "light");

    icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
    lucide.createIcons();
  });
}
