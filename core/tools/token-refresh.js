require("dotenv").config({ path: "/root/ai-system/.env" });

const { google, oauth2Client } = require("../integrations/google");
const fs = require("fs");
const path = require("path");
const TOKEN_PATH = "/root/ai-system/tokens/google-token.json";

async function refreshIfNeeded() {
  let token;
  try {
    token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  } catch (err) {
    console.error("[TOKEN-REFRESH] Tidak bisa baca token:", err.message);
    process.exit(1);
  }

  const expiry = token.expiry_date || 0;
  const msLeft = expiry - Date.now();
  const minutesLeft = Math.round(msLeft / 60000);

  if (msLeft > 10 * 60 * 1000) {
    console.log(`[TOKEN-REFRESH] Token masih valid ${minutesLeft} menit. Skip.`);
    process.exit(0);
  }

  console.log(`[TOKEN-REFRESH] Token akan/sudah expired (${minutesLeft} menit). Refresh...`);

  if (!token.refresh_token) {
    console.error("[TOKEN-REFRESH] Tidak ada refresh_token. Perlu re-auth manual.");
    process.exit(1);
  }

  oauth2Client.setCredentials(token);
  oauth2Client.refreshAccessToken((err, newToken) => {
    if (err) {
      console.error("[TOKEN-REFRESH] Gagal refresh:", err.message);
      process.exit(1);
    }
    const merged = { ...token, ...newToken };
    if (!merged.refresh_token) merged.refresh_token = token.refresh_token;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    console.log("[TOKEN-REFRESH] Berhasil! Expiry baru:", new Date(newToken.expiry_date).toISOString());
    process.exit(0);
  });
}

refreshIfNeeded();
