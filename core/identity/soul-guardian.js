require("dotenv").config();

const fs = require("fs");
const path = require("path");

const SOUL_PATH = "/root/ai-system/prompts/ternion-soul.txt";
const BACKUP_SOUL_PATH = "/root/ai-system/prompts/ternion-soul.backup.txt";
const RELOAD_INTERVAL = 30 * 60 * 1000; // 30 menit

let cachedSoul = null;
let lastLoaded = null;

function loadSoul() {
  try {
    const content = fs.readFileSync(SOUL_PATH, "utf8");

    if (!content || content.trim().length < 100) {
      throw new Error("Soul file terlalu pendek atau kosong");
    }

    // Buat backup setiap kali berhasil load
    fs.writeFileSync(BACKUP_SOUL_PATH, content, "utf8");

    cachedSoul = content;
    lastLoaded = new Date().toISOString();

    console.log(`[SOUL-GUARDIAN] Soul loaded: ${lastLoaded}`);
    return content;

  } catch (err) {
    console.error(`[SOUL-GUARDIAN] Error load soul: ${err.message}`);

    // Coba restore dari backup lokal
    try {
      const backup = fs.readFileSync(BACKUP_SOUL_PATH, "utf8");
      if (backup && backup.trim().length > 100) {
        cachedSoul = backup;
        console.log("[SOUL-GUARDIAN] Soul restored dari backup lokal");
        return backup;
      }
    } catch (backupErr) {
      console.error("[SOUL-GUARDIAN] Backup juga tidak tersedia");
    }

    // Fallback minimal
    if (cachedSoul) {
      console.log("[SOUL-GUARDIAN] Menggunakan cached soul terakhir");
      return cachedSoul;
    }

    // Hardcoded fallback
    const fallback = `Kamu adalah Ternion-AI, asisten strategis pribadi Brian Kinayom dari TERNION GROUP, Kupang NTT. Panggil user "Bry". Fokus pada procurement, konstruksi, trading komoditas NTT, dan ekspor-impor. Karakter: pragmatis, action-oriented, tidak bertele-tele.`;
    cachedSoul = fallback;
    return fallback;
  }
}

function getSoul() {
  if (!cachedSoul) {
    return loadSoul();
  }
  return cachedSoul;
}

function getLastLoaded() {
  return lastLoaded;
}

// Load pertama kali
loadSoul();

// Reload setiap 30 menit
setInterval(() => {
  loadSoul();
}, RELOAD_INTERVAL);

module.exports = { getSoul, loadSoul, getLastLoaded };
