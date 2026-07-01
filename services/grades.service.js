/**
 * ============================================================
 * GRADES SERVICE
 * ============================================================
 * Semua query Supabase untuk fitur Nilai (Score) dikumpulkan
 * di sini. Kategori nilai yang didukung:
 *   - tugas        (bobot default 20%)
 *   - ulangan      (bobot default 30%)
 *   - uts          (bobot default 20%)
 *   - uas          (bobot default 30%)
 *
 * Nilai akhir dihitung di sisi client (bukan DB) supaya guru
 * bisa melihat preview sebelum data disimpan.
 * ============================================================
 */

import { getSupabaseClient, getCurrentUserId } from "./supabase.service.js";

// ── Konstanta kategori & bobot default ──
export const GRADE_CATEGORIES = [
  { key: "tugas",    label: "Tugas",          weight: 20, color: "#2563eb" },
  { key: "ulangan",  label: "Ulangan Harian", weight: 30, color: "#f59e0b" },
  { key: "uts",      label: "UTS",            weight: 20, color: "#7c3aed" },
  { key: "uas",      label: "UAS",            weight: 30, color: "#22c55e" },
];

/**
 * getAssignmentsByClass
 * Mengambil semua assignment (tugas/ujian) untuk kelas tertentu
 * dalam satu semester, diurutkan dari terbaru.
 *
 * @param {string} classId
 * @param {string} [subjectId]  - filter opsional per mapel
 * @returns {Promise<Array>}
 */
export async function getAssignmentsByClass(classId, subjectId = null) {
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("assignments")
    .select(`
      id,
      title,
      category,
      max_score,
      assigned_date,
      due_date,
      description,
      subjects ( id, name )
    `)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("assigned_date", { ascending: false });

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAssignmentsByClass error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * getScoresByAssignment
 * Mengambil nilai semua siswa untuk satu assignment,
 * beserta data siswa (nama, nomor).
 *
 * @param {string} assignmentId
 * @returns {Promise<Array<{
 *   id: string,
 *   student_id: string,
 *   score: number|null,
 *   full_name: string,
 *   student_number: string
 * }>>}
 */
export async function getScoresByAssignment(assignmentId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("scores")
    .select(`
      id,
      student_id,
      score,
      notes,
      students ( id, full_name, nis )
    `)
    .eq("assignment_id", assignmentId)
    .order("students(full_name)", { ascending: true });

  if (error) {
    console.error("getScoresByAssignment error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id:             r.id,
    student_id:     r.student_id,
    score:          r.score,
    notes:          r.notes ?? "",
    full_name:      r.students?.full_name ?? "—",
    nis:            r.students?.nis       ?? "",
  }));
}

/**
 * getStudentsWithScores
 * Mengambil semua siswa di kelas beserta semua nilai mereka
 * lintas assignment. Dipakai untuk tabel rekap & perhitungan
 * rata-rata / ranking.
 *
 * @param {string} classId
 * @param {string} [subjectId]
 * @returns {Promise<{
 *   students: Array,
 *   assignments: Array
 * }>}
 */
export async function getStudentsWithScores(classId, subjectId = null) {
  const supabase = await getSupabaseClient();

  // 1. Daftar siswa di kelas
  const { data: classStudents, error: csError } = await supabase
    .from("class_students")
    .select("students ( id, full_name, nis )")
    .eq("class_id", classId)
    .order("students(full_name)", { ascending: true });

  if (csError) {
    console.error("getStudentsWithScores – students error:", csError.message);
    return { students: [], assignments: [] };
  }

  // 2. Assignment di kelas (opsional filter mapel)
  const assignments = await getAssignmentsByClass(classId, subjectId);

  if (assignments.length === 0) {
    return {
      students: (classStudents ?? []).map((cs) => cs.students).filter(Boolean),
      assignments: [],
    };
  }

  // 3. Semua nilai untuk assignment-assignment tersebut
  const assignmentIds = assignments.map((a) => a.id);

  const { data: allScores, error: scError } = await supabase
    .from("scores")
    .select("assignment_id, student_id, score, notes")
    .in("assignment_id", assignmentIds);

  if (scError) {
    console.error("getStudentsWithScores – scores error:", scError.message);
  }

  // 4. Buat lookup: { student_id: { assignment_id: score } }
  const scoreLookup = {};
  (allScores ?? []).forEach((s) => {
    if (!scoreLookup[s.student_id]) scoreLookup[s.student_id] = {};
    scoreLookup[s.student_id][s.assignment_id] = s.score;
  });

  // 5. Gabungkan
  const students = (classStudents ?? [])
    .map((cs) => cs.students)
    .filter(Boolean)
    .map((s) => ({
      ...s,
      scores: scoreLookup[s.id] ?? {},
    }));

  return { students, assignments, attendanceScores: {} };
}

/**
 * upsertScores
 * Menyimpan/memperbarui nilai satu siswa untuk satu assignment.
 * Menggunakan upsert dengan unique constraint (assignment_id, student_id).
 *
 * @param {Array<{ assignmentId: string, studentId: string, score: number, notes: string }>} records
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function upsertScores(records) {
  const supabase = await getSupabaseClient();

  const rows = records.map((r) => ({
    assignment_id: r.assignmentId,
    student_id:    r.studentId,
    score:         r.score,
    notes:         r.notes ?? "",
    updated_at:    new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("scores")
    .upsert(rows, {
      onConflict:      "assignment_id,student_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("upsertScores error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * createAssignment
 * Membuat assignment baru (tugas/ujian).
 *
 * @param {object} payload
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export async function createAssignment(payload) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id:    payload.teacherId,
      class_id:      payload.classId,
      subject_id:    payload.subjectId,
      title:         payload.title,
      category:      payload.category,
      max_score:     payload.maxScore ?? 100,
      assigned_date: payload.assignedDate,
      due_date:      payload.dueDate ?? null,
      description:   payload.description ?? "",
    })
    .select()
    .single();

  if (error) {
    console.error("createAssignment error:", error.message);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * deleteAssignment
 * Soft delete assignment (set deleted_at = now()).
 *
 * @param {string} assignmentId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deleteAssignment(assignmentId) {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) {
    console.error("deleteAssignment error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * getSubjectsByClass
 * Mengambil daftar mapel yang diajarkan di kelas tertentu,
 * untuk dropdown filter.
 *
 * @param {string} classId
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getSubjectsByClass(classId) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("schedules")
    .select("subjects ( id, name )")
    .eq("class_id", classId);

  if (error) {
    console.error("getSubjectsByClass error:", error.message);
    return [];
  }

  // Deduplicate mapel
  const seen = new Set();
  return (data ?? [])
    .map((r) => r.subjects)
    .filter((s) => s && !seen.has(s.id) && seen.add(s.id));
}

// /* ============================================================
//    PATCH: grades.service.js
//    ============================================================
//    EDIT fungsi calculateFinalScore — ganti seluruh fungsi lama
//    dengan versi baru di bawah ini (baca bobot dari localStorage).
//    ============================================================ */

// /**
//  * getGradeSettings
//  * Helper internal: baca bobot & skala grade dari localStorage.
//  * Fallback ke default kalau belum pernah disimpan.
//  */
// const DEFAULT_WEIGHTS = { tugas: 20, ulangan: 30, uts: 20, uas: 30 };
// const DEFAULT_SCALE   = { A: 85, B: 70, C: 55 };
// const DEFAULT_EXTRAS  = { kehadiran: { active: false, weight: 10 }, bonus: { active: false, weight: 5 } };

// // Cache in-memory sederhana supaya tidak query berulang di render yang sama
// let _gradeSettingsCache = null;

// /**
//  * getGradeSettings
//  * Ambil bobot & skala grade milik guru yang login dari tabel grade_settings.
//  * Kalau belum pernah disimpan, kembalikan default (tanpa insert dulu).
//  */
// export async function getGradeSettings() {
//   if (_gradeSettingsCache) return _gradeSettingsCache;

//   const supabase = await getSupabaseClient();
//   const userId   = await getCurrentUserId();
//   if (!userId) return { weights: DEFAULT_WEIGHTS, gradeScale: DEFAULT_SCALE, extras: DEFAULT_EXTRAS };

//   const { data, error } = await supabase
//     .from("grade_settings")
//     .select("weights, grade_scale, extras")
//     .eq("teacher_id", userId)
//     .maybeSingle();

//   if (error) {
//     console.error("getGradeSettings error:", error.message);
//   }

//   const result = {
//     weights:    data?.weights     ?? DEFAULT_WEIGHTS,
//     gradeScale: data?.grade_scale ?? DEFAULT_SCALE,
//     extras:     data?.extras      ?? DEFAULT_EXTRAS,
//   };

//   _gradeSettingsCache = result;
//   return result;
// }

// /**
//  * saveGradeSettings
//  * Upsert bobot & skala grade milik guru yang login.
//  * Panggil ini dari halaman settings.html / grades.html saat user simpan.
//  *
//  * @param {{ weights?: object, gradeScale?: object, extras?: object }} payload
//  */
// export async function saveGradeSettings(payload) {
//   const supabase = await getSupabaseClient();
//   const userId   = await getCurrentUserId();
//   if (!userId) return { success: false, error: "Tidak ada sesi aktif." };

//   const current = await getGradeSettings();

//   const row = {
//     teacher_id:  userId,
//     weights:     payload.weights    ?? current.weights,
//     grade_scale: payload.gradeScale ?? current.gradeScale,
//     extras:      payload.extras     ?? current.extras,
//     updated_at:  new Date().toISOString(),
//   };

//   const { error } = await supabase
//     .from("grade_settings")
//     .upsert(row, { onConflict: "teacher_id" });

//   if (error) {
//     console.error("saveGradeSettings error:", error.message);
//     return { success: false, error: error.message };
//   }

//   _gradeSettingsCache = { weights: row.weights, gradeScale: row.grade_scale, extras: row.extras };
//   return { success: true, error: null };
// }

// /**
//  * clearGradeSettingsCache
//  * Panggil saat logout supaya cache tidak "bocor" ke akun berikutnya
//  * yang login di tab yang sama.
//  */
// export function clearGradeSettingsCache() {
//   _gradeSettingsCache = null;
// }

// /**
//  * getActiveWeights
//  * Mengembalikan bobot efektif semua komponen (utama + tambahan),
//  * dengan mempertimbangkan komponen tambahan yang aktif.
//  * Dipakai di calculateFinalScore dan di weight-bar grades.html.
//  *
//  * @returns {Array<{ key, label, weight, color }>}
//  */
// export async function getActiveWeights() {
//   const { weights, extras } = await getGradeSettings();

//   const LABELS = { tugas: "Tugas", ulangan: "Ulangan Harian", uts: "UTS", uas: "UAS" };
//   const COLORS = { tugas: "#2563eb", ulangan: "#f59e0b", uts: "#7c3aed", uas: "#22c55e" };

//   const result = Object.entries(weights).map(([key, w]) => ({
//     key,
//     label:  LABELS[key],
//     color:  COLORS[key],
//     weight: w,
//   }));

//   if (extras.kehadiran?.active) {
//     result.push({ key: "kehadiran", label: "Kehadiran", color: "#16a34a", weight: extras.kehadiran.weight });
//   }
//   if (extras.bonus?.active) {
//     result.push({ key: "bonus", label: "Bonus", color: "#d97706", weight: extras.bonus.weight });
//   }

//   return result;
// }

// /**
//  * getGradeLabel
//  * Konversi nilai angka ke huruf (A/B/C/D) berdasarkan skala
//  * yang tersimpan di localStorage (atau default).
//  * GANTI fungsi toGrade() lokal di grades.html dengan ini juga.
//  *
//  * @param {number|null} score
//  * @returns {string}
//  */
// export async function getGradeLabel(score) {
//   if (score == null) return "—";
//   const { gradeScale } = await getGradeSettings();
//   if (score >= gradeScale.A) return "A";
//   if (score >= gradeScale.B) return "B";
//   if (score >= gradeScale.C) return "C";
//   return "D";
// }

// /**
//  * calculateFinalScore  ← GANTI fungsi lama dengan ini
//  * Menghitung nilai akhir berdasarkan bobot aktif dari localStorage.
//  * Parameter weights opsional masih diterima untuk backward-compat.
//  *
//  * @param {object} scoresByCategory - { tugas: [80,90], ulangan: [75], kehadiran: [88], bonus: [5] }
//  * @param {object} [weights]        - (opsional) override bobot, kalau tidak diisi pakai localStorage
//  * @returns {number|null}
//  */
// export async function calculateFinalScore(scoresByCategory, weights = null) {
//   const activeWeights = weights
//     ? Object.entries(weights).map(([key, weight]) => ({ key, weight }))
//     : await getActiveWeights();

//   let totalWeight = 0;
//   let weightedSum = 0;

//   activeWeights.forEach(({ key, weight }) => {
//     const scores      = scoresByCategory[key] ?? [];
//     const validScores = scores.filter((s) => s != null && !isNaN(s));
//     if (validScores.length === 0) return;

//     const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
//     weightedSum += avg * weight;
//     totalWeight += weight;
//   });

//   if (totalWeight === 0) return null;
//   return Math.round((weightedSum / totalWeight) * 10) / 10;
// }

/* ============================================================
   GRADE SETTINGS (Supabase — pengganti localStorage)
   ============================================================ */

const DEFAULT_WEIGHTS      = { tugas: 20, ulangan: 30, uts: 20, uas: 30 };
const DEFAULT_SCALE        = { A: 85, B: 70, C: 55 };
const DEFAULT_EXTRAS       = { kehadiran: { active: false, weight: 10 }, bonus: { active: false, weight: 5 } };
const DEFAULT_CLASS_GRADES = ["X", "XI", "XII"];

let _gradeSettingsCache = null;

/**
 * getGradeSettings
 * Ambil bobot, skala grade, extras, dan tingkat kelas milik guru
 * yang login dari tabel grade_settings. Di-cache per sesi halaman.
 */
export async function getGradeSettings() {
  if (_gradeSettingsCache) return _gradeSettingsCache;

  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();

  const fallback = {
    weights: DEFAULT_WEIGHTS, gradeScale: DEFAULT_SCALE,
    extras: DEFAULT_EXTRAS, classGrades: DEFAULT_CLASS_GRADES,
  };
  if (!userId) return fallback;

  const { data, error } = await supabase
    .from("grade_settings")
    .select("weights, grade_scale, extras, class_grades")
    .eq("teacher_id", userId)
    .maybeSingle();

  if (error) console.error("getGradeSettings error:", error.message);

  const result = {
    weights:     data?.weights      ?? DEFAULT_WEIGHTS,
    gradeScale:  data?.grade_scale  ?? DEFAULT_SCALE,
    extras:      data?.extras       ?? DEFAULT_EXTRAS,
    classGrades: data?.class_grades ?? DEFAULT_CLASS_GRADES,
  };

  _gradeSettingsCache = result;
  return result;
}

/**
 * saveGradeSettings
 * Upsert sebagian/semua field pengaturan nilai milik guru yang login.
 * @param {{ weights?:object, gradeScale?:object, extras?:object, classGrades?:string[] }} payload
 */
export async function saveGradeSettings(payload) {
  const supabase = await getSupabaseClient();
  const userId   = await getCurrentUserId();
  if (!userId) return { success: false, error: "Tidak ada sesi aktif." };

  const current = await getGradeSettings();

  const row = {
    teacher_id:   userId,
    weights:      payload.weights     ?? current.weights,
    grade_scale:  payload.gradeScale  ?? current.gradeScale,
    extras:       payload.extras      ?? current.extras,
    class_grades: payload.classGrades ?? current.classGrades,
    updated_at:   new Date().toISOString(),
  };

  const { error } = await supabase
    .from("grade_settings")
    .upsert(row, { onConflict: "teacher_id" });

  if (error) {
    console.error("saveGradeSettings error:", error.message);
    return { success: false, error: error.message };
  }

  _gradeSettingsCache = {
    weights: row.weights, gradeScale: row.grade_scale,
    extras: row.extras, classGrades: row.class_grades,
  };
  return { success: true, error: null };
}

/**
 * clearGradeSettingsCache
 * Panggil saat logout supaya cache tidak "bocor" ke akun berikutnya
 * yang login di tab browser yang sama.
 */
export function clearGradeSettingsCache() {
  _gradeSettingsCache = null;
}

/**
 * buildActiveWeights
 * Fungsi PURE (tanpa akses DB) — ubah { weights, extras } jadi array
 * bobot aktif. Dipakai grades.html setelah settings di-fetch sekali.
 */
export function buildActiveWeights(weights, extras) {
  const LABELS = { tugas: "Tugas", ulangan: "Ulangan Harian", uts: "UTS", uas: "UAS" };
  const COLORS = { tugas: "#2563eb", ulangan: "#f59e0b", uts: "#7c3aed", uas: "#22c55e" };

  const result = Object.entries(weights).map(([key, w]) => ({
    key, label: LABELS[key], color: COLORS[key], weight: w,
  }));

  if (extras.kehadiran?.active) {
    result.push({ key: "kehadiran", label: "Kehadiran", color: "#16a34a", weight: extras.kehadiran.weight });
  }
  if (extras.bonus?.active) {
    result.push({ key: "bonus", label: "Bonus", color: "#d97706", weight: extras.bonus.weight });
  }
  return result;
}

/**
 * calculateFinalScorePure
 * Fungsi PURE — hitung nilai akhir dari activeWeights yang SUDAH di-resolve
 * (bukan ambil dari DB lagi). Sync, aman dipakai di dalam .map()/.forEach().
 * @param {object} scoresByCategory
 * @param {Array<{key,weight}>} activeWeights
 */
export function calculateFinalScorePure(scoresByCategory, activeWeights) {
  let totalWeight = 0;
  let weightedSum = 0;

  activeWeights.forEach(({ key, weight }) => {
    const scores      = scoresByCategory[key] ?? [];
    const validScores = scores.filter((s) => s != null && !isNaN(s));
    if (validScores.length === 0) return;

    const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    weightedSum += avg * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/**
 * getGradeLabelPure
 * Fungsi PURE — konversi nilai ke huruf, pakai gradeScale yang sudah di-resolve.
 */
export function getGradeLabelPure(score, gradeScale) {
  if (score == null) return "—";
  if (score >= gradeScale.A) return "A";
  if (score >= gradeScale.B) return "B";
  if (score >= gradeScale.C) return "C";
  return "D";
}

/**
 * getAttendanceScoreByClass
 * Menghitung nilai kehadiran per siswa di kelas tertentu
 * dari tabel attendances: (jumlah hadir / total pertemuan) × 100
 * Filter opsional per subject_id.
 *
 * @param {string} classId
 * @param {string|null} subjectId
 * @returns {Promise<object>} map { student_id: nilai_kehadiran (0-100) }
 */
export async function getAttendanceScoreByClass(classId, subjectId = null) {
  const supabase = await getSupabaseClient();

  // Ambil semua record kehadiran di kelas ini lewat schedules
  let query = supabase
    .from("attendances")
    .select(`
      student_id,
      status,
      schedules!inner ( class_id, subject_id )
    `)
    .eq("schedules.class_id", classId);

  if (subjectId) {
    query = query.eq("schedules.subject_id", subjectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAttendanceScoreByClass error:", error.message);
    return {};
  }

  // Hitung per siswa: { student_id: { hadir: N, total: N } }
  const map = {};
  (data ?? []).forEach(({ student_id, status }) => {
    if (!map[student_id]) map[student_id] = { hadir: 0, total: 0 };
    map[student_id].total += 1;
    if (status === "hadir") map[student_id].hadir += 1;
  });

  // Konversi ke nilai 0-100
  const result = {};
  Object.entries(map).forEach(([sid, { hadir, total }]) => {
    result[sid] = total > 0 ? Math.round((hadir / total) * 100 * 10) / 10 : 0;
  });

  return result;
}
