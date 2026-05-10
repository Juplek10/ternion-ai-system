require("dotenv").config();

const { runBackup } = require("./core/integrations/drive-vault");

const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam

async function doBackup() {
  console.log("[BACKUP-SCHEDULER] Memulai backup...");
  try {
    const result = await runBackup();
    if (result.success) {
      console.log(`[BACKUP-SCHEDULER] ✓ Berhasil: ${result.success} file`);
    } else {
      console.error("[BACKUP-SCHEDULER] Gagal:", result.error);
    }
  } catch (err) {
    console.error("[BACKUP-SCHEDULER] Error:", err.message);
  }
}

// Jalankan pertama kali setelah 30 detik (beri waktu boot)
setTimeout(doBackup, 30000);

// Ulangi setiap 6 jam
setInterval(doBackup, BACKUP_INTERVAL);

console.log("[BACKUP-SCHEDULER] Aktif — backup setiap 6 jam");
