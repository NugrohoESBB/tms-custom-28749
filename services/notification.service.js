/**
 * ============================================================
 * NOTIFICATION SERVICE
 * ============================================================
 * Mengelola reminder kelas berbasis jadwal hari ini:
 * - 15 menit sebelum jam masuk → putar MP3 + browser notif
 * - Tepat jam masuk            → putar MP3 + browser notif
 * - Kelas belum diabsen        → browser notif (tanpa MP3)
 *
 * Dipanggil dari sidebar.component.js saat pertama render.
 * ============================================================
 */

import { getSupabaseClient } from "./supabase.service.js";

// Path MP3 relatif dari root project — sesuaikan kalau beda
const SOUND_REMINDER = "../../assets/sounds/reminder.mp3";
const SOUND_START    = "../../assets/sounds/reminder.mp3";

// Set untuk mencegah notifikasi yang sama muncul dua kali
const _fired = new Set();

/**
 * startNotificationService
 * Entry point — panggil ini sekali saat halaman pertama dimuat.
 * Minta izin notifikasi browser, lalu mulai polling tiap 30 detik.
 */
export async function startNotificationService() {
  // Minta izin notifikasi browser (hanya muncul sekali ke user)
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  // Jalankan sekali langsung, lalu tiap 30 detik
  await _runChecks();
  setInterval(_runChecks, 30_000);
}

/**
 * _runChecks
 * Ambil jadwal hari ini + attendances, lalu evaluasi kondisi:
 * 1. Reminder 15 menit sebelum kelas
 * 2. Reminder tepat jam masuk
 * 3. Reminder kelas belum diabsen (sudah selesai/berlangsung)
 */
async function _runChecks() {
  const supabase = await getSupabaseClient();
  const today    = new Date().toISOString().split("T")[0];
  const now      = new Date();

  // Ambil jadwal hari ini
  const { data: schedules } = await supabase
    .from("schedules")
    .select(`
      id,
      scheduled_date,
      start_time,
      end_time,
      classes ( name ),
      subjects ( name )
    `)
    .eq("scheduled_date", today)
    .order("start_time", { ascending: true });

  if (!schedules || schedules.length === 0) return;

  // Ambil data kehadiran untuk jadwal hari ini sekaligus
  const scheduleIds = schedules.map((s) => s.id);
  const { data: attendances } = await supabase
    .from("attendances")
    .select("schedule_id")
    .in("schedule_id", scheduleIds);

  const recordedIds = new Set((attendances ?? []).map((a) => a.schedule_id));

  schedules.forEach((s) => {
    const label     = `${s.subjects?.name ?? "Kelas"} — ${s.classes?.name ?? ""}`;
    const startDate = new Date(`${s.scheduled_date}T${s.start_time}`);
    const endDate   = new Date(`${s.scheduled_date}T${s.end_time}`);
    const diffMin   = (startDate - now) / 60_000; // positif = belum mulai

    // ── 1. Reminder 15 menit sebelum ──
    const key15 = `15min_${s.id}`;
    if (diffMin > 0 && diffMin <= 15 && !_fired.has(key15)) {
      _fired.add(key15);
      _playSound(SOUND_REMINDER);
      _showNotif(
        "⏰ Kelas Segera Dimulai",
        `${label} dimulai dalam ${Math.round(diffMin)} menit.`
      );
    }

    // ── 2. Reminder tepat jam masuk (toleransi ±1 menit) ──
    const keyStart = `start_${s.id}`;
    if (Math.abs(diffMin) <= 1 && !_fired.has(keyStart)) {
      _fired.add(keyStart);
      _playSound(SOUND_START);
      _showNotif(
        "🔔 Kelas Dimulai Sekarang",
        `${label} sedang dimulai. Jangan lupa catat kehadiran!`
      );
    }

    // ── 3. Reminder belum diabsen (kelas sudah selesai/berlangsung) ──
    const keyAbsen = `absen_${s.id}`;
    const sudahSelesaiAtauBerlangsung = now >= startDate && !recordedIds.has(s.id);
    const belumDiabsen = !recordedIds.has(s.id);

    if (sudahSelesaiAtauBerlangsung && belumDiabsen && !_fired.has(keyAbsen)) {
      // Jangan langsung fired — tunggu 5 menit setelah jam mulai
      const melebihi5Menit = (now - startDate) / 60_000 >= 5;
      if (melebihi5Menit) {
        _fired.add(keyAbsen);
        _showNotif(
          "📋 Kehadiran Belum Dicatat",
          `${label} belum diabsen. Catat sekarang sebelum terlupa!`
        );
      }
    }
  });
}

/**
 * _playSound - Putar file MP3 via Audio API
 */
function _playSound(src) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Browser memblokir autoplay sebelum ada interaksi user — diabaikan
    });
  } catch (_) {}
}

/**
 * _showNotif - Tampilkan browser notification
 */
function _showNotif(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "../../assets/images/logo.png", // ganti path kalau beda
    badge: "../../assets/images/logo.png",
    tag: title, // cegah notif duplikat dari browser
  });
}
