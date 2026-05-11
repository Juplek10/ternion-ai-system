require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const axios = require("axios");
const fs = require("fs-extra");

const execFileAsync = promisify(execFile);

const RECOVERY_LOG = "/root/ai-system/memory/recovery-log.json";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 menit

const CRITICAL_PROCESSES = ["telegram", "worker", "heartbeat"];

async function sendAlert(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[AUTO-RECOVERY] Gagal kirim alert:", err.message);
  }
}

async function logRecovery(entry) {
  try {
    await fs.ensureFile(RECOVERY_LOG);
    let log = [];
    try { log = await fs.readJson(RECOVERY_LOG); } catch { log = []; }
    if (!Array.isArray(log)) log = [];
    log.push(entry);
    if (log.length > 200) log = log.slice(-200);
    await fs.writeJson(RECOVERY_LOG, log, { spaces: 2 });
  } catch (err) {
    console.error("[AUTO-RECOVERY] Gagal log:", err.message);
  }
}

async function checkAndRecover() {
  let procs = [];
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 15000 });
    procs = JSON.parse(stdout);
  } catch (err) {
    console.error("[AUTO-RECOVERY] Tidak bisa baca PM2:", err.message);
    return;
  }

  for (const proc of procs) {
    if (!CRITICAL_PROCESSES.includes(proc.name)) continue;
    if (proc.pm2_env.status !== "online") {
      const now = new Date().toISOString();
      console.log(`[AUTO-RECOVERY] ${proc.name} DOWN (${proc.pm2_env.status}) — restart`);

      try {
        await execFileAsync("pm2", ["restart", proc.name], { timeout: 30000 });
        const entry = { timestamp: now, process: proc.name, action: "restarted", prev_status: proc.pm2_env.status };
        await logRecovery(entry);
        await sendAlert(`⚠️ <b>AUTO-RECOVERY</b>\n\nProses <b>${proc.name}</b> crash (${proc.pm2_env.status})\n✅ Berhasil di-restart\n⏰ ${now}`);
      } catch (err) {
        await logRecovery({ timestamp: now, process: proc.name, action: "restart_failed", error: err.message });
        await sendAlert(`🚨 <b>CRITICAL</b>\n\nGagal restart <b>${proc.name}</b>!\nError: ${err.message}\n⏰ ${now}`);
      }
    }
  }

  // Cek RAM
  try {
    const meminfo = require("fs").readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]);
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]);
    const pct = Math.round(((total - avail) / total) * 100);
    if (pct > 80) {
      await sendAlert(`⚠️ <b>RAM TINGGI</b>\n\nPenggunaan RAM: <b>${pct}%</b>\n💾 Avail: ${(avail / 1e6).toFixed(0)} MB\n⏰ ${new Date().toISOString()}`);
    }
  } catch {}

  // Cek Google token expiry
  checkGoogleToken().catch(() => {});
}

async function checkGoogleToken() {
  try {
    const tokenData = JSON.parse(require("fs").readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
    const expiry = tokenData.expiry_date;
    if (!expiry) return;
    const daysLeft = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      await sendAlert(`🚨 <b>GOOGLE TOKEN EXPIRED</b>\n\nToken sudah expired ${Math.abs(daysLeft)} hari lalu!\n\n⚡ Action: Jalankan ulang autentikasi Google Drive.\n⏰ ${new Date().toISOString()}`);
    } else if (daysLeft < 30) {
      await sendAlert(`⚠️ <b>GOOGLE TOKEN</b>\n\nToken akan expire dalam <b>${daysLeft} hari</b>\nPerlu diperbarui segera!\n⏰ ${new Date().toISOString()}`);
    }
  } catch {}
}

console.log("[AUTO-RECOVERY] Berjalan — cek setiap 10 menit");

// Cek langsung saat start
checkAndRecover();

// Lalu setiap 10 menit
setInterval(checkAndRecover, CHECK_INTERVAL);

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
