require("dotenv").config();

const { google } = require("googleapis");
const fs = require("fs");

const TOKEN_PATH = "/root/ai-system/tokens/google-token.json";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Auto-save token ke disk setiap kali googleapis me-refresh access_token
oauth2Client.on("tokens", (tokens) => {
  try {
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")); } catch {}
    // Merge — refresh_token hanya dikirim saat pertama kali auth, pertahankan yang lama
    const merged = { ...existing, ...tokens };
    if (!merged.refresh_token && existing.refresh_token) {
      merged.refresh_token = existing.refresh_token;
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    console.log("[GOOGLE] Token auto-refreshed & saved, expires:", new Date(tokens.expiry_date).toISOString());
  } catch (err) {
    console.error("[GOOGLE] Gagal simpan token yang di-refresh:", err.message);
  }
});

module.exports = {
  google,
  oauth2Client
};
