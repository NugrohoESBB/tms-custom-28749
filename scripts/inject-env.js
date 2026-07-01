const fs   = require("fs");
const path = require("path");

// ── env vars ──
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERROR: Environment variables tidak ditemukan!");
  process.exit(1);
}

const configContent = `
export const SUPABASE_CONFIG = {
  url:     "${SUPABASE_URL}",
  anonKey: "${SUPABASE_ANON_KEY}",
};

export const APP_CONFIG = {
  appName:      "Teacher Management System",
  version:      "1.0.0",
  defaultTheme: "light", // "light" | "dark"
};
`;

const outputPath = path.join(__dirname, "..", "config", "supabase.config.js");

try {
  const configDir = path.dirname(outputPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, configContent, "utf8");
  console.log("Config berhasil di-generate dari environment variables.");
  console.log(`   SUPABASE_URL      : ${SUPABASE_URL}`);
  console.log(`   SUPABASE_ANON_KEY : ${SUPABASE_ANON_KEY.slice(0, 10)}...`);
} catch (err) {
  console.error("ERROR: Gagal config!", err.message);
  process.exit(1);
}
