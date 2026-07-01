/**
 * ============================================================
 * SUPABASE CONFIG — EXAMPLE / TEMPLATE
 * ============================================================
 * File ini adalah TEMPLATE
 *
 * Cara setup untuk development lokal:
 * 1. Copy file ini: cp config/supabase.config.example.js
 * 2. Buka config/supabase.config.js
 * 3. Ganti YOUR_SUPABASE_URL dan YOUR_SUPABASE_ANON_KEY
 * ============================================================
 */

export const SUPABASE_CONFIG = {
  url:     "YOUR_SUPABASE_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};

export const APP_CONFIG = {
  appName:      "Teacher Management System",
  version:      "1.0.0",
  defaultTheme: "light", // "light" | "dark"
};
